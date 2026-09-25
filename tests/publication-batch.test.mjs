import test from "node:test";
import assert from "node:assert/strict";
import { sealBatch, verifyBatch } from "../scripts/publication-batch.mjs";

const payload = { schema: 1, candidate_commit: "a".repeat(40), decision_id: "decision", requests: [],
  artifacts: { "index/v1/index.json": "b".repeat(64), "published/alice/example/obsolete": null } };
test("generated release binds the entire artifact inventory, bytes and candidate", () => {
  const signed = sealBatch(payload, "test-secret");
  assert.deepEqual(verifyBatch(signed, "test-secret", payload.artifacts), payload);
  assert.throws(() => verifyBatch(signed, "wrong-secret", payload.artifacts));
  assert.throws(() => verifyBatch(signed, "test-secret", { ...payload.artifacts, "index/v1/index.json": "c".repeat(64) }));
  assert.throws(() => verifyBatch(signed, "test-secret", { ...payload.artifacts, "scripts/unsafe.mjs": "b".repeat(64) }));
  assert.throws(() => verifyBatch({ ...signed, payload: { ...payload, candidate_commit: "d".repeat(40) } }, "test-secret", payload.artifacts));
});
test("release manifests cannot authorize source or workflow changes", () => {
  const artifacts = { "packages/alice/example/package.notchany.json": "b".repeat(64) };
  assert.throws(() => verifyBatch(sealBatch({ ...payload, artifacts }, "test-secret"), "test-secret", artifacts));
});
