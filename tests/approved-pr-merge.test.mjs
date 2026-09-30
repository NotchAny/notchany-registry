import test from "node:test";
import assert from "node:assert/strict";

import { mergeApprovedPackagePullRequest } from "../scripts/approved-pr-merge.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

function snapshot(overrides = {}) {
  return {
    pr: {
      number: 42,
      state: "open",
      merged_at: null,
      merge_commit_sha: null,
      head: { sha: HEAD },
      base: { sha: BASE },
      ...overrides,
    },
    evaluation: {
      repository: "NotchAny/notchany-registry",
      pr_number: 42,
      head_sha: HEAD,
      base_sha: BASE,
      package_id: "alice/tool",
      operation: "update",
      actor_github_user_id: "100",
      reviews: [],
    },
  };
}

test("approved package PR merges the reviewed head and dispatches publication", async () => {
  const requests = [];
  const result = await mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshot(),
    evaluate: async () => ({ allowed: true, policy_revision: 7 }),
    githubRequest: async (path, options = {}) => {
      requests.push({ path, options });
      if (path === "/pulls/42/merge") return { merged: true, sha: "c".repeat(40) };
      if (path === "/actions/workflows/publish-index.yml/dispatches") return null;
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { merged: true, mergeSHA: "c".repeat(40) });
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(requests[0].options.body), { sha: HEAD, merge_method: "squash" });
  assert.deepEqual(JSON.parse(requests[1].options.body), { ref: "main" });
});

test("permission or approval changes block merge and publication", async () => {
  const requests = [];
  await assert.rejects(() => mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshot(),
    evaluate: async () => ({ allowed: false, policy_revision: 8, reason: "maintainer_review_required" }),
    githubRequest: async (...args) => { requests.push(args); },
  }), /permission changed before merge/);
  assert.deepEqual(requests, []);
});

test("head, base, and policy revision are pinned through merge", async () => {
  const cases = [
    { current: snapshot({ head: { sha: "d".repeat(40) } }), revision: 7, message: /head changed/ },
    { current: snapshot({ base: { sha: "e".repeat(40) } }), revision: 7, message: /base changed/ },
    { current: snapshot(), revision: 8, message: /permission changed before merge/ },
  ];
  for (const item of cases) {
    await assert.rejects(() => mergeApprovedPackagePullRequest({
      number: 42,
      expectedHeadSHA: HEAD,
      expectedBaseSHA: BASE,
      expectedPolicyRevision: 7,
      loadPullRequest: async () => item.current,
      evaluate: async () => ({ allowed: true, policy_revision: item.revision }),
      githubRequest: async () => { throw new Error("merge must not be attempted"); },
    }), item.message);
  }
});

test("an already merged approved PR can restart the publication workflow", async () => {
  const requests = [];
  const result = await mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshot({
      state: "closed",
      merged_at: "2026-09-30T13:14:30Z",
      merge_commit_sha: "f".repeat(40),
    }),
    evaluate: async () => ({ allowed: true, policy_revision: 7 }),
    githubRequest: async (path, options = {}) => {
      requests.push({ path, options });
      if (path === "/actions/workflows/publish-index.yml/dispatches") return null;
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { merged: false, mergeSHA: "f".repeat(40) });
  assert.deepEqual(requests.map(request => request.path), ["/actions/workflows/publish-index.yml/dispatches"]);
});
