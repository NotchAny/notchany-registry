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
      mergeable_state: "clean",
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
  let ready = false;
  const result = await mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshot(),
    evaluate: async () => ({ allowed: true, policy_revision: 7 }),
    loadMainSHA: async () => BASE,
    markReady: async () => { ready = true; },
    githubRequest: async (path, options = {}) => {
      assert.equal(ready, true, "the reviewed status must be successful before merge");
      requests.push({ path, options });
      if (path === "/pulls/42/merge") return { merged: true, sha: "c".repeat(40) };
      if (path === "/actions/workflows/publish-index.yml/dispatches") return null;
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { updated: false, merged: true, mergeSHA: "c".repeat(40) });
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
    loadMainSHA: async () => BASE,
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
      loadMainSHA: async () => BASE,
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
    loadMainSHA: async () => BASE,
    githubRequest: async (path, options = {}) => {
      requests.push({ path, options });
      if (path === "/actions/workflows/publish-index.yml/dispatches") return null;
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { updated: false, merged: false, mergeSHA: "f".repeat(40) });
  assert.deepEqual(requests.map(request => request.path), ["/actions/workflows/publish-index.yml/dispatches"]);
});

test("an approved PR behind main is updated and must be revalidated before merge", async () => {
  const requests = [];
  let ready = false;
  const result = await mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshot({ mergeable_state: "behind" }),
    evaluate: async () => ({ allowed: true, policy_revision: 7 }),
    loadMainSHA: async () => "d".repeat(40),
    markReady: async () => { ready = true; },
    githubRequest: async (path, options = {}) => {
      requests.push({ path, options });
      if (path === "/pulls/42/update-branch") return { message: "Updating pull request branch." };
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { updated: true, merged: false, mergeSHA: null });
  assert.equal(ready, false, "an updated head must pass validation again before success");
  assert.deepEqual(requests.map(request => request.path), ["/pulls/42/update-branch"]);
  assert.deepEqual(JSON.parse(requests[0].options.body), { expected_head_sha: HEAD });
});

test("a merge race that makes the PR behind updates the branch instead of failing", async () => {
  const requests = [];
  const snapshots = [snapshot(), snapshot({ mergeable_state: "behind" })];
  const mainSHAs = [BASE, "e".repeat(40)];
  let ready = false;
  const result = await mergeApprovedPackagePullRequest({
    number: 42,
    expectedHeadSHA: HEAD,
    expectedBaseSHA: BASE,
    expectedPolicyRevision: 7,
    loadPullRequest: async () => snapshots.shift(),
    evaluate: async () => ({ allowed: true, policy_revision: 7 }),
    loadMainSHA: async () => mainSHAs.shift(),
    markReady: async () => { ready = true; },
    githubRequest: async (path, options = {}) => {
      requests.push({ path, options });
      if (path === "/pulls/42/merge") throw new Error("GitHub 405: /pulls/42/merge");
      if (path === "/pulls/42/update-branch") return { message: "Updating pull request branch." };
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  });

  assert.deepEqual(result, { updated: true, merged: false, mergeSHA: null });
  assert.equal(ready, true, "the race happens only after the reviewed status is posted");
  assert.deepEqual(requests.map(request => request.path), ["/pulls/42/merge", "/pulls/42/update-branch"]);
});
