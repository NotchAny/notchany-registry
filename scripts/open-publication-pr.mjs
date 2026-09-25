#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { git } from "./publication-lib.mjs";
import { github } from "./github-pr.mjs";

if (!git("status", "--porcelain", "--", "published", "index", "history", "publication").toString().trim()) {
  console.log("No new publication artifacts");
  process.exit(0);
}
const { payload } = JSON.parse(readFileSync("publication/last-batch.json"));
if (!/^[a-f0-9-]{36}$/.test(payload.decision_id)) throw new Error("Invalid publication decision");
const branch = `codex/publish-${payload.decision_id}`;
git("switch", "-c", branch);
git("config", "user.name", "github-actions[bot]");
git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
git("add", "--", "published", "index/v1", "index/v2", "history/v1", "publication/last-batch.json");
git("commit", "-m", "chore: publish verified market snapshot");
git("push", "origin", branch);
const pr = await github("/pulls", { method: "POST", body: JSON.stringify({ head: branch, base: "main",
  title: "发布已校验的市场快照", body: `本批 ${payload.requests.length} 个包已完成内容与权限校验。生成文件由签名清单固定；合入前再次验证来源 PR 的当前 Review 和维护权限。\n\n候选提交：${payload.candidate_commit}\n发布决定：${payload.decision_id}` }) });
// GITHUB_TOKEN 创建的 PR 不触发 pull_request_target，必须显式调度可信检查。
await github("/actions/workflows/validate-publication.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: "main", inputs: { pr_number: String(pr.number) } }) });
console.log(`Publication PR: ${pr.html_url}`);
