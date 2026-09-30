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
  loadMainSHA = async () => {
    const ref = await githubRequest("/git/ref/heads/main");
    if (!ref?.object?.sha) throw new Error("GitHub main ref is missing its commit");
    return ref.object.sha;
  },
  markReady = async () => {},
}) {
  const current = await loadPullRequest(number);
  if (current.pr.head.sha !== expectedHeadSHA) throw new Error("PR head changed before merge");
  if (current.pr.base.sha !== expectedBaseSHA) throw new Error("PR base changed before merge");
  const decision = await evaluate(current.evaluation);
  if (!decision.allowed || decision.policy_revision !== expectedPolicyRevision) {
    throw new Error("PR permission changed before merge");
  }

  const updateBranch = async () => {
    await githubRequest(`/pulls/${number}/update-branch`, {
      method: "PUT",
      body: JSON.stringify({ expected_head_sha: expectedHeadSHA }),
    });
    return { updated: true, merged: false, mergeSHA: null };
  };
  const branchIsBehind = (snapshot, mainSHA) =>
    snapshot.pr.mergeable_state === "behind" || snapshot.pr.base.sha !== mainSHA;

  let merged = false;
  let mergeSHA = current.pr.merge_commit_sha;
  if (!current.pr.merged_at) {
    if (current.pr.state !== "open") throw new Error("Approved PR is not open");
    if (branchIsBehind(current, await loadMainSHA())) return updateBranch();

    await markReady();
    try {
      const result = await githubRequest(`/pulls/${number}/merge`, {
        method: "PUT",
        body: JSON.stringify({ sha: expectedHeadSHA, merge_method: "squash" }),
      });
      if (!result?.merged || !result.sha) throw new Error("GitHub refused approved package merge");
      merged = true;
      mergeSHA = result.sha;
    } catch (error) {
      if (!String(error?.message).startsWith(`GitHub 405: /pulls/${number}/merge`)) throw error;
      const refreshed = await loadPullRequest(number);
      if (refreshed.pr.head.sha !== expectedHeadSHA || refreshed.pr.state !== "open") throw error;
      if (!branchIsBehind(refreshed, await loadMainSHA())) throw error;
      return updateBranch();
    }
  } else {
    await markReady();
  }
  if (!mergeSHA) throw new Error("Merged PR is missing its merge commit");

  // GITHUB_TOKEN 产生的合并不会可靠触发 push workflow，必须显式启动发布链。
  await githubRequest("/actions/workflows/publish-index.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  });
  return { updated: false, merged, mergeSHA };
}
