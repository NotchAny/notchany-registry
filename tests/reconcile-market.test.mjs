import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publicCommitForDecision } from "../scripts/reconcile-history.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("Market reconciliation checkout keeps the publication history", () => {
  const source = readFileSync(new URL("../.github/workflows/reconcile-market.yml", import.meta.url), "utf8");
  assert.match(source, /fetch-depth:\s*0/);
});

test("publication commit lookup rejects a shallow repository", (t) => {
  const root = mkdtempSync(join(tmpdir(), "market-reconcile-history-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const shallow = join(root, "shallow");
  mkdirSync(join(source, "published"), { recursive: true });
  git(source, "init", "-b", "main");
  git(source, "config", "user.name", "Test");
  git(source, "config", "user.email", "test@example.com");

  const firstDecision = "11111111-1111-4111-8111-111111111111";
  const secondDecision = "22222222-2222-4222-8222-222222222222";
  writeFileSync(join(source, "published/state.json"), JSON.stringify({ decisions: [{ id: firstDecision }] }));
  git(source, "add", "published/state.json");
  git(source, "commit", "-m", "first publication");
  const firstCommit = git(source, "rev-parse", "HEAD");

  writeFileSync(join(source, "published/state.json"), JSON.stringify({ decisions: [{ id: firstDecision }, { id: secondDecision }] }));
  git(source, "add", "published/state.json");
  git(source, "commit", "-m", "second publication");
  execFileSync("git", ["clone", "--depth=1", `file://${source}`, shallow], { stdio: "pipe" });

  assert.equal(publicCommitForDecision(firstDecision, source), firstCommit);
  assert.throws(
    () => publicCommitForDecision(firstDecision, shallow),
    /完整 Git 历史/,
  );
});
