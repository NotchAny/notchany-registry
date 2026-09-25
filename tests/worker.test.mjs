import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { createWorker } from "../worker/worker.js";

function upstream({ legacy = false, mismatch = false, path, status = 200 } = {}) {
  const digest = createHash("sha256").update("package").digest("hex");
  return async url => {
    if (legacy && url.endsWith("/index/v2/index.json")) return new Response(null, { status: 404 });
    if (/\/index\/v[12]\/index.json$/.test(url)) return Response.json({ index_schema: legacy ? 1 : 2, packages: [{
      package_id: "alice/cpu", path: path ?? `${legacy ? "packages" : "published"}/alice/cpu/package.notchany.json`, sha256: digest,
    }] });
    return new Response(mismatch ? "modified" : "package", { status });
  };
}

class MemoryKV {
  constructor(entries = {}, shouldThrow = false) {
    this.entries = new Map(Object.entries(entries));
    this.shouldThrow = shouldThrow;
  }
  async get(key) {
    if (this.shouldThrow) throw new Error("kv unavailable");
    return this.entries.get(key) ?? null;
  }
  async put(key, value) {
    if (this.shouldThrow) throw new Error("kv unavailable");
    this.entries.set(key, value);
  }
  async list() {
    if (this.shouldThrow) throw new Error("kv unavailable");
    return { keys: [...this.entries.keys()].map((name) => ({ name })), list_complete: true };
  }
}

function context() {
  const pending = [];
  return {
    pending,
    waitUntil(promise) { pending.push(promise); },
  };
}

test("successful package proxy increments its package count", async () => {
  const kv = new MemoryKV();
  const worker = createWorker(upstream());
  const ctx = context();
  const response = await worker.fetch(new Request("https://market.test/pkg/alice/cpu"), { COUNTS: kv }, ctx);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "package");
  await Promise.all(ctx.pending);
  assert.equal(await kv.get("alice/cpu"), "1");
});

test("upstream failure does not increment", async () => {
  const kv = new MemoryKV();
  const worker = createWorker(upstream({ status: 503 }));
  const ctx = context();
  const response = await worker.fetch(new Request("https://market.test/pkg/alice/cpu"), { COUNTS: kv }, ctx);
  assert.equal(response.status, 502);
  assert.equal(ctx.pending.length, 0);
});

test("upstream network errors return CORS-safe 502 without incrementing", async () => {
  const kv = new MemoryKV();
  const worker = createWorker(async () => { throw new Error("offline"); });
  const ctx = context();
  const response = await worker.fetch(
    new Request("https://market.test/pkg/alice/cpu"),
    { COUNTS: kv },
    ctx
  );
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(ctx.pending.length, 0);
  assert.equal(await kv.get("alice/cpu"), null);
});

test("KV failure never blocks a successful package response", async () => {
  const worker = createWorker(upstream());
  const ctx = context();
  const response = await worker.fetch(
    new Request("https://market.test/pkg/alice/cpu"),
    { COUNTS: new MemoryKV({}, true) },
    ctx
  );
  assert.equal(response.status, 200);
  await Promise.all(ctx.pending);
});

test("legacy v1 remains installable during migration with matching hashes", async () => {
  const worker = createWorker(upstream({ legacy: true }));
  const response = await worker.fetch(new Request("https://market.test/pkg/alice/cpu"), { COUNTS: new MemoryKV() }, context());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "package");
});

test("unpublished paths and checksum mismatches cannot escape the published index", async () => {
  for (const options of [{ mismatch: true }, { path: "packages/alice/cpu/package.notchany.json" }]) {
    const ctx = context();
    const worker = createWorker(upstream(options));
    const response = await worker.fetch(new Request("https://market.test/pkg/alice/cpu"), { COUNTS: new MemoryKV() }, ctx);
    assert.equal(response.status, 502);
    assert.equal(ctx.pending.length, 0);
  }
});

test("counts are returned in stable package id order", async () => {
  const worker = createWorker(async () => new Response("unused"));
  const response = await worker.fetch(
    new Request("https://market.test/counts.json"),
    { COUNTS: new MemoryKV({ "z/pkg": "2", "a/pkg": "7" }) },
    context()
  );
  assert.deepEqual(await response.json(), { "a/pkg": 7, "z/pkg": 2 });
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

test("invalid paths and unsupported methods fail closed", async () => {
  const worker = createWorker(async () => new Response("unused"));
  const env = { COUNTS: new MemoryKV() };
  assert.equal((await worker.fetch(new Request("https://market.test/pkg/-bad/cpu"), env, context())).status, 400);
  assert.equal((await worker.fetch(new Request("https://market.test/other"), env, context())).status, 404);
  assert.equal((await worker.fetch(new Request("https://market.test/counts.json", { method: "POST" }), env, context())).status, 405);
  assert.equal((await worker.fetch(new Request("https://market.test/counts.json", { method: "OPTIONS" }), env, context())).status, 204);
});
