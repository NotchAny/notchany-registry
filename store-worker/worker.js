// 公开 Store 的交付层。页面内容只来自构建好的 Static Assets；Worker 只负责
// 规范域名、方法约束、缓存和安全响应头，不读取 Registry 候选目录或商业数据。

const STORE_ORIGIN = "https://notchany.com";

const HTML_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://account.notchany.com https://notchany-market.glzlaohuai.workers.dev",
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "media-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function cacheControl(response, contentType, pathname) {
  const noTransform = contentType.includes("text/html") ? ", no-transform" : "";
  if (response.status >= 400) return `public, max-age=60${noTransform}`;
  // 落地页素材目录名即内容哈希，换素材就换地址
  if (pathname.startsWith("/assets/landing/")) return "public, max-age=31536000, immutable";
  if (contentType.includes("text/html")) {
    return "public, max-age=300, stale-while-revalidate=86400, no-transform";
  }
  return "public, max-age=3600, stale-while-revalidate=86400";
}

function hardened(response, pathname = "") {
  const headers = new Headers(response.headers);
  const contentType = headers.get("Content-Type") ?? "";
  headers.set("Cache-Control", cacheControl(response, contentType, pathname));
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (contentType.includes("text/html")) headers.set("Content-Security-Policy", HTML_CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Static Assets 不处理 Range，而 Safari 播放 <video> 必须拿到 206，否则拒绝播放。
// 只接单段区间；多段、畸形或 If-Range 不匹配时按规范退回完整 200。
async function withRange(request, response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (response.status !== 200 || !/^(video|audio)\//.test(contentType)) return response;
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  const range = request.method === "GET" ? request.headers.get("Range") : null;
  const match = range?.trim().match(/^bytes=(\d*)-(\d*)$/);
  const ifRange = request.headers.get("If-Range");
  const etag = headers.get("ETag");
  const ifRangeMatches = !ifRange || (etag && !etag.startsWith("W/") && ifRange === etag);
  if (!match || (!match[1] && !match[2]) || !ifRangeMatches) {
    return new Response(response.body, { status: 200, statusText: response.statusText, headers });
  }

  const body = await response.arrayBuffer();
  const size = body.byteLength;
  let start;
  let end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (match[2] && Number(match[2]) < start) {
      return new Response(body, { status: 200, statusText: response.statusText, headers });
    }
  } else {
    const suffix = Number(match[2]);
    start = Math.max(size - suffix, 0);
    end = suffix === 0 ? -1 : size - 1;
  }
  if (start >= size || end < start) {
    headers.delete("Content-Length");
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

function redirectToCanonical(url) {
  const target = new URL(url.pathname + url.search, STORE_ORIGIN);
  return hardened(new Response(null, {
    status: 308,
    headers: { Location: target.toString() },
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === "www.notchany.com") return redirectToCanonical(url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return hardened(new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
      }));
    }
    return hardened(await withRange(request, await env.ASSETS.fetch(request)), url.pathname);
  },
};
