#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { github, pullRequest } from "./github-pr.mjs";
import { signedMarketPost } from "./market-client.mjs";

const number = Number(process.env.PR_NUMBER);
const snapshot = await pullRequest(number);
const head = snapshot.pr.head.sha;
const context = "market/content-and-permission";
const status = (state, description) => github(`/statuses/${head}`, { method: "POST", body: JSON.stringify({ state, context, description: description.slice(0,140) }) });
await status("pending", "正在校验内容与当前维护权限");
const root = mkdtempSync(join(tmpdir(), "notchany-pr-"));
const candidate = join(root, "candidate");
try {
  execFileSync("git", ["fetch", "origin", `pull/${number}/head`], { stdio: "pipe" });
  if (execFileSync("git", ["rev-parse", "FETCH_HEAD"], { encoding: "utf8" }).trim() !== head) throw new Error("PR head changed");
  execFileSync("git", ["worktree", "add", "--detach", candidate, head], { stdio: "pipe" });
  execFileSync(process.execPath, [resolve("scripts/check-pr.mjs")], { cwd: candidate, stdio: "pipe",
    env: { ...process.env, CHANGED_FILES: snapshot.files.flatMap(f => [f.filename, ...(f.previous_filename ? [f.previous_filename] : [])]).join("\n"),
      TRUSTED_HISTORY_ROOT: resolve("history/v1"), SKIP_MARKET_AUTH: "1" } });
  const decision = await signedMarketPost("/internal/market/pr-evaluate", snapshot.evaluation);
  if (!decision.allowed) throw new Error(decision.reason);
  const current = await pullRequest(number);
  const latest = await signedMarketPost("/internal/market/pr-evaluate", current.evaluation);
  if (current.pr.head.sha !== head || current.pr.base.sha !== snapshot.pr.base.sha || !latest.allowed || latest.policy_revision !== decision.policy_revision) throw new Error("PR or policy changed; retry");
  await status("success", "内容与当前维护权限校验通过");
} catch (error) {
  await status("failure", error.message);
  throw error;
} finally {
  try { execFileSync("git", ["worktree", "remove", "--force", candidate], { stdio: "pipe" }); } catch { /* 尚未创建工作树 */ }
  rmSync(root, { recursive: true, force: true });
}
