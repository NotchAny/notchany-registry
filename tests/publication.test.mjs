import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { hash, pendingPackages, treeHash, verifyPublished, verifyPublishedIndex } from "../scripts/publication-lib.mjs";

const bootstrap = resolve("scripts/bootstrap-publication.mjs");
function fixture(t, wrongHash = false) {
  const root = mkdtempSync(join(tmpdir(), "market-baseline-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, data) => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), data); };
  const bytes = JSON.stringify({ notchany_export: 2, action: { id: "source", kind: "shell", script: "true" } });
  for (const id of ["alice/published", "alice/unpublished"]) {
    put(`packages/${id}/package.notchany.json`, bytes);
    put(`packages/${id}/manifest.json`, JSON.stringify({ version: "1.0.0", license: "MIT" }));
  }
  put("index/v1/index.json", JSON.stringify({ index_schema: 1, packages: [{
    package_id: "alice/published", path: "packages/alice/published/package.notchany.json",
    version: "1.0.0", sha256: wrongHash ? "0".repeat(64) : hash(bytes), published_at: "2026-09-10T00:00:00Z",
  }] }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init"); git("add", "."); git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline");
  return { root, commit: git("rev-parse", "HEAD"), bytes };
}

test("bootstrap accepts v1-only release evidence and excludes unpublished source", t => {
  const { root, commit, bytes } = fixture(t);
  const output = join(root, "baseline-output");
  execFileSync(process.execPath, [bootstrap], { cwd: root, env: { ...process.env, BASELINE_COMMIT: commit, BASELINE_OUTPUT: output } });
  const state = JSON.parse(readFileSync(join(output, "published/state.json")));
  assert.deepEqual(Object.keys(state.packages), ["alice/published"]);
  assert.equal(readFileSync(join(output, "published/alice/published/package.notchany.json"), "utf8"), bytes);
  const history = JSON.parse(readFileSync(join(output, "history/v1/alice/published.json")));
  assert.equal(history.releases[0].sha256, hash(bytes));
  assert.equal(history.releases[0].source_commit, commit);
  assert.equal(history.releases[0].pr, null);
  assert.equal(history.releases[0].merged_at, null);
  assert.equal(verifyPublished(output).packages["alice/published"].active, true);
  const entry = { package_id: "alice/published", path: "published/alice/published/package.notchany.json", version: "1.0.0", sha256: hash(bytes) };
  assert.doesNotThrow(() => verifyPublishedIndex({ packages: [entry] }, output));
  assert.throws(() => verifyPublishedIndex({ packages: [{ ...entry, path: "packages/alice/published/package.notchany.json" }] }, output));
  writeFileSync(join(output, "published/alice/published/manifest.json"), '{"version":"9.0.0"}');
  assert.throws(() => verifyPublished(output), /snapshot/i);
});

test("baseline checksum failure writes no partial output", t => {
  const { root, commit } = fixture(t, true);
  const output = join(root, "baseline-output");
  const result = spawnSync(process.execPath, [bootstrap], { cwd: root, env: { ...process.env, BASELINE_COMMIT: commit, BASELINE_OUTPUT: output } });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(output), false);
});

test("pending source changes never mutate the published snapshot", () => {
  const old = { "package.notchany.json": Buffer.from("published") };
  const state = { packages: { "alice/example": { active: true, tree_hash: treeHash(old) } } };
  const before = JSON.stringify(state);
  assert.deepEqual(pendingPackages({ "alice/example": { "package.notchany.json": Buffer.from("failed candidate") } }, state), ["alice/example"]);
  assert.equal(JSON.stringify(state), before);
});
