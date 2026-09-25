import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import worker from "../store-worker/worker.js";

function environment(response) {
  return {
    ASSETS: {
      fetch: async () => response.clone(),
    },
  };
}

test("HTML 响应保留正文并设置短缓存与安全响应头", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/en/"),
    environment(new Response("<h1>Store</h1>", {
      headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"v1"' },
    })),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<h1>Store</h1>");
  assert.equal(response.headers.get("ETag"), '"v1"');
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, stale-while-revalidate=86400, no-transform");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.match(response.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
});

test("静态图片使用较长缓存", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/assets/icon.png"),
    environment(new Response("png", { headers: { "Content-Type": "image/png" } })),
  );
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600, stale-while-revalidate=86400");
});

test("未知路径保持真实 404 且不长时间缓存", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/missing"),
    environment(new Response("not found", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })),
  );
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "not found");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, no-transform");
});

test("www 永久跳转到规范根域并保留路径与查询", async () => {
  const response = await worker.fetch(
    new Request("https://www.notchany.com/en/packages/owner/demo/?q=one"),
    environment(new Response("unused")),
  );
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "https://notchany.com/en/packages/owner/demo/?q=one");
});

test("HTML CSP 允许同源媒体", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/"),
    environment(new Response("<h1>Store</h1>", { headers: { "Content-Type": "text/html; charset=utf-8" } })),
  );
  assert.match(response.headers.get("Content-Security-Policy") ?? "", /media-src 'self'/);
});

const VIDEO = Uint8Array.from({ length: 2048 }, (_, index) => index % 251);

function videoRequest(headers = {}, method = "GET") {
  return worker.fetch(
    new Request("https://notchany-store.example/assets/landing/0123456789/video.mp4", { method, headers }),
    environment(new Response(method === "HEAD" ? null : VIDEO, {
      headers: { "Content-Type": "video/mp4", "Content-Length": String(VIDEO.length), ETag: '"film"' },
    })),
  );
}

test("落地页素材按内容哈希长期缓存并声明支持 Range", async () => {
  const response = await videoRequest();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal((await response.arrayBuffer()).byteLength, VIDEO.length);

  const head = await videoRequest({}, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Accept-Ranges"), "bytes");
});

test("视频单段 Range 返回 206 与对应字节", async () => {
  const cases = [
    ["bytes=0-1023", 0, 1023],
    ["bytes=0-1", 0, 1],
    ["bytes=2000-", 2000, 2047],
    ["bytes=-48", 2000, 2047],
    ["bytes=-4096", 0, 2047],
    ["bytes=1024-99999", 1024, 2047],
  ];
  for (const [range, start, end] of cases) {
    const response = await videoRequest({ Range: range });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get("Content-Range"), `bytes ${start}-${end}/${VIDEO.length}`, range);
    assert.equal(response.headers.get("Content-Length"), String(end - start + 1), range);
    assert.equal(response.headers.get("Content-Type"), "video/mp4", range);
    assert.equal(response.headers.get("ETag"), '"film"', range);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), VIDEO.slice(start, end + 1), range);
  }
});

test("越界 Range 返回 416，其余无法满足的 Range 退回完整 200", async () => {
  for (const range of ["bytes=2048-", "bytes=-0"]) {
    const response = await videoRequest({ Range: range });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get("Content-Range"), `bytes */${VIDEO.length}`, range);
  }
  for (const range of ["bytes=0-1,4-5", "bytes=9-3", "items=0-1", "bytes=-"]) {
    const response = await videoRequest({ Range: range });
    assert.equal(response.status, 200, range);
    assert.equal((await response.arrayBuffer()).byteLength, VIDEO.length, range);
  }
  const stale = await videoRequest({ Range: "bytes=0-1", "If-Range": '"old"' });
  assert.equal(stale.status, 200);
  const current = await videoRequest({ Range: "bytes=0-1", "If-Range": '"film"' });
  assert.equal(current.status, 206);
});

test("非媒体响应不处理 Range", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/assets/icon.png", { headers: { Range: "bytes=0-1" } }),
    environment(new Response("png", { headers: { "Content-Type": "image/png" } })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Accept-Ranges"), null);
  assert.equal(await response.text(), "png");
});

test("静态站拒绝写方法", async () => {
  const response = await worker.fetch(
    new Request("https://notchany-store.example/", { method: "POST" }),
    environment(new Response("unused")),
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});

test("部署校验轮询 commit 标记并穿透旧静态资源缓存", () => {
  const workflow = readFileSync(new URL("../.github/workflows/deploy-store-cloudflare.yml", import.meta.url), "utf8");
  assert.match(workflow, /for attempt in \{1\.\.12\}/);
  assert.match(workflow, /notchany-store\.json\?commit=\$\{\{ github\.sha \}\}&attempt=\$\{attempt\}/);
  assert.match(workflow, /sleep 5/);
});
