import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function workflow(path) {
  return readFileSync(new URL(`../.github/workflows/${path}`, import.meta.url), "utf8");
}

function assertMergePermissions(source, label) {
  for (const permission of ["contents", "pull-requests", "statuses", "actions"]) {
    assert.match(source, new RegExp(`${permission}: write`), `${label} must grant ${permission}: write`);
  }
}

test("trusted package validation can merge and dispatch publishing", () => {
  assertMergePermissions(workflow("pr-validate.yml"), "PR validation caller");
  assertMergePermissions(workflow("trusted-pr-check.yml"), "trusted reusable workflow");
});

test("scheduled rechecks grant write access only to the trusted merge job", () => {
  const source = workflow("recheck-prs.yml");
  assert.match(source, /permissions:\n  contents: read\n  pull-requests: read/);
  const checkJob = source.slice(source.indexOf("  check:"), source.indexOf("  acknowledge:"));
  assertMergePermissions(checkJob, "scheduled trusted merge job");
});

test("approved package validation invokes the trusted merge boundary", () => {
  const source = readFileSync(new URL("../scripts/validate-reviewed-pr.mjs", import.meta.url), "utf8");
  assert.match(source, /mergeApprovedPackagePullRequest/);
  assert.match(source, /expectedHeadSHA: head/);
  assert.match(source, /expectedPolicyRevision: latest\.policy_revision/);
});
