import { github, pullRequest } from "./github-pr.mjs";
import { signedMarketPost } from "./market-client.mjs";

export async function mergeApprovedPackagePullRequest({
  number,
  expectedHeadSHA,
  expectedBaseSHA,
  expectedPolicyRevision,
  loadPullRequest = pullRequest,
  evaluate = evaluation => signedMarketPost("/internal/market/pr-evaluate", evaluation),
  githubRequest = github,
}) {
  const current = await loadPullRequest(number);
  if (current.pr.head.sha !== expectedHeadSHA) throw new Error("PR head changed before merge");
  if (current.pr.base.sha !== expectedBaseSHA) throw new Error("PR base changed before merge");
  const decision = await evaluate(current.evaluation);
  if (!decision.allowed || decision.policy_revision !== expectedPolicyRevision) {
    throw new Error("PR permission changed before merge");
  }

  let merged = false;
  let mergeSHA = current.pr.merge_commit_sha;
  if (!current.pr.merged_at) {
    if (current.pr.state !== "open") throw new Error("Approved PR is not open");
    const result = await githubRequest(`/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ sha: expectedHeadSHA, merge_method: "squash" }),
    });
    if (!result?.merged || !result.sha) throw new Error("GitHub refused approved package merge");
    merged = true;
    mergeSHA = result.sha;
  }
  if (!mergeSHA) throw new Error("Merged PR is missing its merge commit");

  // GITHUB_TOKEN 产生的合并不会可靠触发 push workflow，必须显式启动发布链。
  await githubRequest("/actions/workflows/publish-index.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  });
  return { merged, mergeSHA };
}
