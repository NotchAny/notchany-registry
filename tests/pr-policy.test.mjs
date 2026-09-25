import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyMergedPackage,
  classifyPackagePullRequest,
} from "../scripts/pr-policy-lib.mjs";

test("PR policy classifies one package create/update/unlist", () => {
  assert.deepEqual(classifyPackagePullRequest([
    { filename: "packages/alice/tool/manifest.json", status: "added" },
    { filename: "packages/alice/tool/package.notchany.json", status: "added" },
  ]), { packageID: "alice/tool", operation: "create" });
  assert.equal(classifyPackagePullRequest([
    { filename: "packages/alice/tool/manifest.json", status: "modified" },
  ]).operation, "update");
  assert.equal(classifyPackagePullRequest([
    { filename: "packages/alice/tool/manifest.json", status: "removed" },
  ]).operation, "unlist");
  assert.equal(classifyPackagePullRequest([
    { filename: "packages/alice/tool/manifest.json", status: "added" },
  ], { isReserved: (packageID) => packageID === "alice/tool" }).operation, "update");
});

test("merged package treats a restored historical ID as update", () => {
  assert.equal(classifyMergedPackage({
    existsNow: true,
    existedBefore: false,
    hasHistory: true,
  }), "update");
  assert.equal(classifyMergedPackage({
    existsNow: true,
    existedBefore: false,
    hasHistory: false,
  }), "create");
  assert.equal(classifyMergedPackage({
    existsNow: false,
    existedBefore: true,
    hasHistory: true,
  }), "unlist");
});

test("PR policy rejects multiple packages and non-package files", () => {
  assert.throws(() => classifyPackagePullRequest([
    { filename: "packages/alice/one/manifest.json", status: "modified" },
    { filename: "packages/alice/two/manifest.json", status: "modified" },
  ]), /只涉及一个包/);
  assert.throws(() => classifyPackagePullRequest([
    { filename: "packages/alice/one/manifest.json", status: "modified" },
    { filename: ".github/workflows/steal.yml", status: "added" },
  ]), /只允许修改 packages/);
  assert.throws(() => classifyPackagePullRequest([]), /没有可授权/);
});

test("PR policy treats cross-package rename as multiple packages", () => {
  assert.throws(() => classifyPackagePullRequest([
    {
      filename: "packages/bob/tool/manifest.json",
      previous_filename: "packages/alice/tool/manifest.json",
      status: "renamed",
    },
  ]), /只涉及一个包/);
});
