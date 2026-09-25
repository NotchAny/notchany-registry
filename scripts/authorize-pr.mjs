#!/usr/bin/env node
// pull_request_target 的只读授权步骤。只读取 GitHub API 文件列表，不检出或执行 PR 代码。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { signedMarketPost } from "./market-client.mjs";
import { classifyPackagePullRequest } from "./pr-policy-lib.mjs";

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const pullNumber = event.pull_request?.number;
const actorID = event.pull_request?.user?.id;
if (!repository || !token || !Number.isInteger(pullNumber) || !Number.isSafeInteger(actorID)) {
  throw new Error("GitHub PR 上下文不完整");
}

const files = [];
for (let page = 1; ; page += 1) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "notchany-registry-authorize",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) throw new Error(`GitHub PR 文件列表返回 ${response.status}`);
  const pageFiles = await response.json();
  files.push(...pageFiles);
  if (pageFiles.length < 100) break;
}

const { packageID, operation } = classifyPackagePullRequest(files, {
  isReserved: (id) => existsSync(join(process.cwd(), "history", "v1", `${id}.json`)),
});
const result = await signedMarketPost("/internal/market/pr-authorize", {
  package_id: packageID,
  actor_github_user_id: String(actorID),
  operation,
});
if (result.allowed !== true) throw new Error(`Market 拒绝 ${operation} ${packageID}：${result.reason}`);
console.log(`Market 允许 ${operation} ${packageID}`);
