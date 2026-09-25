#!/usr/bin/env node
// 用 Registry 当前目录 + 保留的 history 纠正 D1 包状态。已存在包只同步 active/unlisted，
// 不根据可变 namespace 改写 Owner；首次回填才用 GitHub API 把 namespace 解析为数字 ID。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { signedMarketPost } from "./market-client.mjs";
import { verifyPublished } from "./publication-lib.mjs";

const ROOT = process.cwd();
const publication = verifyPublished(ROOT);
const PACKAGES = join(ROOT, "published");
const HISTORY = join(ROOT, "history", "v1");
const token = process.env.GITHUB_API_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";

function directories(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function registryPackages() {
  const states = new Map();
  for (const namespace of directories(PACKAGES)) {
    for (const slug of directories(join(PACKAGES, namespace))) {
      if (existsSync(join(PACKAGES, namespace, slug, "manifest.json"))) {
        states.set(`${namespace}/${slug}`, "active");
      }
    }
  }
  for (const namespace of directories(HISTORY)) {
    const path = join(HISTORY, namespace);
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const document = JSON.parse(readFileSync(join(path, entry.name), "utf8"));
        if (typeof document.package_id === "string" && !states.has(document.package_id)) {
          states.set(document.package_id, "unlisted");
        }
      } catch (error) {
        throw new Error(`无法读取 ${namespace}/${entry.name}：${error.message}`);
      }
    }
  }
  return [...states].sort(([a], [b]) => a.localeCompare(b, "en"));
}

const profileCache = new Map();
async function namespaceOwner(namespace) {
  const key = namespace.toLowerCase();
  if (profileCache.has(key)) return profileCache.get(key);
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(namespace)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "notchany-registry-reconcile",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) {
    profileCache.set(key, null);
    return null;
  }
  if (!response.ok) throw new Error(`GitHub 用户 ${namespace} 解析失败：${response.status}`);
  const user = await response.json();
  if (!Number.isSafeInteger(user?.id) || typeof user?.login !== "string") {
    throw new Error(`GitHub 用户 ${namespace} 返回格式无效`);
  }
  const profile = {
    github_user_id: String(user.id),
    login: user.login,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
  };
  profileCache.set(key, profile);
  return profile;
}

const packages = [];
for (const [packageID, state] of registryPackages()) {
  packages.push({
    package_id: packageID,
    state,
    owner: await namespaceOwner(packageID.split("/")[0]),
  });
}

const totals = { created: 0, updated: 0, claimed: 0, unclaimed: 0 };
for (let offset = 0; offset < packages.length; offset += 40) {
  const result = await signedMarketPost("/internal/market/reconcile", {
    packages: packages.slice(offset, offset + 40),
  });
  for (const key of Object.keys(totals)) totals[key] += Number(result[key] || 0);
}
console.log(
  `Market 对账完成：${packages.length} 包，新增 ${totals.created}，更新 ${totals.updated}，` +
  `已认领 ${totals.claimed}，待认领 ${totals.unclaimed}`,
);
for (const decision of publication.decisions) {
  // 状态文件首次记录该决定的 Git 提交即公开提交，重复回填幂等。
  const { execFileSync } = await import("node:child_process");
  const commit = execFileSync("git",["log","--reverse","--format=%H",`-S${decision.id}`,"--","published/state.json"],{ encoding: "utf8" }).trim().split("\n")[0];
  if (!/^[a-f0-9]{40}$/.test(commit || "")) throw new Error("Missing public commit");
  await signedMarketPost("/internal/market/publication-complete",{ decision_id: decision.id, public_commit: commit });
}
