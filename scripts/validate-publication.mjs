#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { github, pages, pullRequest } from "./github-pr.mjs";
import { git, hash, verifyPublishedIndex } from "./publication-lib.mjs";
import { verifyBatch } from "./publication-batch.mjs";
import { signedMarketPost } from "./market-client.mjs";
import { REGISTRY_REPOSITORY } from "./registry-repo.mjs";

const SITE_REPOSITORY = "NotchAny/notchany-site";

const number = Number(process.env.PR_NUMBER);
if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Invalid PR number");
const pr = await github(`/pulls/${number}`);
const head = pr.head.sha;
const status = (state, description) => github(`/statuses/${head}`, { method: "POST", body: JSON.stringify({ state, context: "market/content-and-permission", description: description.slice(0, 140) }) });
await status("pending", "正在核对发布清单与当前批准");
const root = mkdtempSync(join(tmpdir(), "market-publication-check-"));
const candidate = join(root, "candidate");
try {
  if (pr.state !== "open" || pr.base.ref !== "main" || pr.head.repo?.full_name !== REGISTRY_REPOSITORY
    || !pr.head.ref.startsWith("codex/publish-")) throw new Error("Invalid generated PR identity");
  git("fetch", "origin", "main", `pull/${number}/head`);
  git("worktree", "add", "--detach", candidate, head);
  const document = JSON.parse(readFileSync(join(candidate, "publication/last-batch.json")));
  const main = git("rev-parse", "origin/main").toString().trim();
  if (document.payload?.candidate_commit !== main) throw new Error("Main changed; regenerate the publication batch");
  const paths = git("diff", "--name-only", "-z", main, head).toString().split("\0").filter(Boolean);
  const artifacts = {};
  for (const path of paths.filter(path => path !== "publication/last-batch.json")) {
    let contents;
    try { contents = git("show", `${head}:${path}`); } catch { contents = null; }
    artifacts[path] = contents === null ? null : hash(contents);
  }
  const batch = verifyBatch(document, process.env.MARKET_INTERNAL_HMAC_SECRET, artifacts);
  for (const version of [1, 2]) verifyPublishedIndex(JSON.parse(readFileSync(join(candidate, `index/v${version}/index.json`))), candidate);
  const requests = [];
  for (const original of batch.requests) {
    const current = await pullRequest(original.pr_number);
    if (!current.pr.merged_at || current.pr.head.sha !== original.head_sha || current.evaluation.package_id !== original.package_id) throw new Error("Source PR changed");
    requests.push({ ...current.evaluation, operation: original.operation });
  }
  const authorize = () => signedMarketPost("/internal/market/publication-validate", { decision_id: batch.decision_id, requests });
  await authorize();
  const freshPR = await github(`/pulls/${number}`);
  if (freshPR.head.sha !== head || freshPR.base.sha !== main) throw new Error("Publication PR changed");
  await status("success", "发布清单与当前批准校验通过");
  if (process.env.MERGE_PUBLICATION === "1") {
    // 紧邻合入再次检查；GitHub 的 sha 条件防止检查后替换产物。
    for (let i = 0; i < requests.length; i++) {
      const current = await pullRequest(requests[i].pr_number);
      if (current.pr.head.sha !== requests[i].head_sha) throw new Error("Source head changed before merge");
      requests[i] = { ...current.evaluation, operation: requests[i].operation };
    }
    await authorize();
    const merged = await github(`/pulls/${number}/merge`, { method: "PUT", body: JSON.stringify({ sha: head, merge_method: "squash" }) });
    if (!merged.merged) throw new Error("GitHub refused publication merge");
    await signedMarketPost("/internal/market/publication-complete", { decision_id: batch.decision_id, public_commit: merged.sha });
    await github("/actions/workflows/reconcile-market.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: "main" }) });
    await dispatchSiteDeploy();
    console.log(`Published ${merged.sha}`);
  }
} catch (error) {
  await status("failure", error.message);
  throw error;
} finally {
  try { git("worktree", "remove", "--force", candidate); } catch { /* 校验可能早于工作树创建失败 */ }
  rmSync(root, { recursive: true, force: true });
}

// 官网在私有仓库，GITHUB_TOKEN 够不着；SITE_DEPLOY_TOKEN 只授该仓库 Actions 写权限，不带参数即构建 main 最新提交。
// 走到这里发布已合入，调度失败只告警，由官网整点 cron 兜底。
async function dispatchSiteDeploy() {
  const token = process.env.SITE_DEPLOY_TOKEN;
  if (!token) { console.warn("::warning::未配置 SITE_DEPLOY_TOKEN，官网等待整点 cron 刷新"); return; }
  try {
    const response = await fetch(`https://api.github.com/repos/${SITE_REPOSITORY}/actions/workflows/deploy.yml/dispatches`, {
      method: "POST", body: JSON.stringify({ ref: "main" }),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
  } catch (error) {
    console.warn(`::warning::官网部署调度失败（${error.message}），等待整点 cron 刷新`);
  }
}
