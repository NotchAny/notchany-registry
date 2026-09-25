// NotchAny 市场下载计数 Worker（Cloudflare Workers，ES module）。
//
// 路由：
// - GET /pkg/<owner>/<slug>  透传 GitHub raw 的 package.notchany.json，成功时 KV 计数 +1
// - GET /counts.json         聚合返回 { "<owner>/<slug>": n, ... }
// - 其他路径                  404
//
// 隐私声明：本 Worker 不记录任何请求者信息——不存 IP、不存 UA、不存时间戳日志。
// KV 里只有 "<owner>/<slug>" -> 累计次数 这一种数据，无法关联到任何个人。
//
// 计数语义：KV 读-改-写不是原子操作，并发下偶有少计——这是「大致安装量」而非精确
// 账本，够用且换来零个人信息存储。KV 写失败不影响包体响应（下载永远优先于计数）。

const RAW_BASE = "https://raw.githubusercontent.com/NotchAny/notchany-registry/main";

// 与仓库 scripts/check-pr.mjs 一致的形状校验。
// owner：GitHub 用户名——1–39 位字母/数字/连字符，不得以连字符开头/结尾或连续连字符。
const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
// slug：包目录名。
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

// KV 计数 +1（尽力而为：任何失败都吞掉，绝不影响响应）。
async function bumpCount(env, key) {
  try {
    const current = parseInt((await env.COUNTS.get(key)) ?? "0", 10) || 0;
    await env.COUNTS.put(key, String(current + 1));
  } catch {
    // KV 写失败不影响响应
  }
}

async function handlePackage(owner, slug, env, ctx, fetchImpl, rawBase) {
  if (!OWNER_PATTERN.test(owner) || !SLUG_PATTERN.test(slug)) {
    return json({ error: "invalid owner or slug" }, 400);
  }
  let upstream;
  let entry;
  try {
    let legacy = false;
    let response = await fetchImpl(`${rawBase}/index/v2/index.json`);
    if (response.status === 404) {
      legacy = true;
      response = await fetchImpl(`${rawBase}/index/v1/index.json`);
    }
    if (!response.ok) return json({ error: "published index unavailable" }, 502);
    const index = await response.json();
    entry = index.packages?.find(item => item.package_id === `${owner}/${slug}`);
    if (!entry) return json({ error: "package not found" }, 404);
    const validPath = entry.path === `published/${owner}/${slug}/package.notchany.json`
      || (legacy && entry.path === `packages/${owner}/${slug}/package.notchany.json`);
    if (!validPath || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      return json({ error: "invalid published entry" }, 502);
    }
    upstream = await fetchImpl(
      `${rawBase}/${entry.path}`
    );
  } catch {
    return json({ error: "package upstream unavailable" }, 502);
  }
  if (!upstream.ok) {
    return json({ error: "published package upstream unavailable" }, 502);
  }
  const body = await upstream.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)), b => b.toString(16).padStart(2,"0")).join("");
  if (digest !== entry.sha256) return json({ error: "published package hash mismatch" }, 502);
  // 成功透传才计数；waitUntil 让计数在响应返回后完成，不增加延迟。
  ctx.waitUntil(bumpCount(env, `${owner}/${slug}`));
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

async function handleCounts(env) {
  const counts = {};
  let cursor;
  do {
    const page = await env.COUNTS.list({ cursor });
    await Promise.all(
      page.keys.map(async ({ name }) => {
        const n = parseInt((await env.COUNTS.get(name)) ?? "", 10);
        if (Number.isFinite(n)) counts[name] = n;
      })
    );
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  // key 排序，产出稳定，便于缓存与 diff。
  const sorted = Object.fromEntries(
    Object.keys(counts).sort().map((key) => [key, counts[key]])
  );
  return json(sorted, 200, { "cache-control": "public, max-age=300" });
}

export function createWorker(fetchImpl = fetch, rawBase = RAW_BASE) {
  return {
    async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }
    const url = new URL(request.url);
    if (url.pathname === "/counts.json") {
      return handleCounts(env);
    }
    const match = url.pathname.match(/^\/pkg\/([^/]+)\/([^/]+)$/);
    if (match) {
      return handlePackage(match[1], match[2], env, ctx, fetchImpl, rawBase);
    }
    return json({ error: "not found" }, 404);
    },
  };
}

export default createWorker();
