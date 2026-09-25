import assert from "node:assert/strict";
import test from "node:test";

import {
  historyDocument,
  packageSHA256,
  versionContributors,
} from "../scripts/history-lib.mjs";

test("version contributors put the PR author first, dedupe numeric IDs, and drop bare email commits", () => {
  const alice = { id: 10, login: "alice", avatar_url: "https://avatars.test/10" };
  const bob = { id: 20, login: "bob", avatar_url: null };
  assert.deepEqual(
    versionContributors(alice, [
      { author: bob },
      { author: alice },
      { author: null, commit: { author: { email: "unknown@example.com" } } },
    ]),
    [
      { github_user_id: "10", login: "alice", avatar_url: "https://avatars.test/10" },
      { github_user_id: "20", login: "bob", avatar_url: null },
    ],
  );
});

test("package contributors are ordered by most recent release contribution", () => {
  const alice = { github_user_id: "10", login: "alice", avatar_url: null };
  const bob = { github_user_id: "20", login: "bob", avatar_url: null };
  const history = historyDocument("alice/demo", [
    {
      version: "1.0.0", merged_at: "2026-01-01T00:00:00Z", source_commit: "a",
      sha256: packageSHA256(Buffer.from("one")), pr: null, contributors: [alice],
    },
    {
      version: "2.0.0", merged_at: "2026-02-01T00:00:00Z", source_commit: "b",
      sha256: packageSHA256(Buffer.from("two")), pr: null, contributors: [bob, alice],
    },
  ]);
  assert.deepEqual(history.releases.map((release) => release.version), ["2.0.0", "1.0.0"]);
  assert.deepEqual(history.contributors.map((user) => user.github_user_id), ["20", "10"]);
});
