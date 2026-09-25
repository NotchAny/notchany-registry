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
