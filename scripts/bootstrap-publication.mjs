#!/usr/bin/env node
// 基线只取固定提交的公开 v1 索引及匹配字节；没有证据的 PR、合并时间与贡献者留空。
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { git, tree, treeHash, writeTree, hash } from "./publication-lib.mjs";
import { historyDocument } from "./history-lib.mjs";
import { REGISTRY_REPOSITORY } from "./registry-repo.mjs";
const commit = process.env.BASELINE_COMMIT;
const output = process.env.BASELINE_OUTPUT;
if (!/^[a-f0-9]{40}$/.test(commit || "") || !output || existsSync(output)) throw new Error("Set BASELINE_COMMIT and an unused BASELINE_OUTPUT directory");
const indexBytes = git("show", `${commit}:index/v1/index.json`);
const index = JSON.parse(indexBytes);
if (index.index_schema !== 1 || !Array.isArray(index.packages)) throw new Error("Invalid v1 baseline");
async function verifyOnline(path, bytes) {
  if (process.env.BASELINE_VERIFY_ONLINE !== "1") return;
  const response = await fetch(`https://raw.githubusercontent.com/${REGISTRY_REPOSITORY}/${commit}/${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== hash(bytes)) throw new Error(`Online baseline mismatch: ${path}`);
}
await verifyOnline("index/v1/index.json", indexBytes);
const state = { schema: 1, baseline_commit: commit, packages: {}, decisions: [] };
const prepared = [];
for (const entry of index.packages) {
  const id = entry.package_id;
  if (!/^[A-Za-z0-9-]+\/[a-z0-9-]+$/.test(id) || state.packages[id] || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Invalid or duplicate baseline identity");
  if (entry.path !== `packages/${id}/package.notchany.json`) throw new Error(`Unexpected v1 baseline path: ${id}`);
  const files = tree(commit, `packages/${id}`);
  if (hash(files["package.notchany.json"] || "") !== entry.sha256 || JSON.parse(files["manifest.json"]).version !== entry.version) throw new Error(`Baseline mismatch: ${id}`);
  await verifyOnline(entry.path, files["package.notchany.json"]);
  const release = {
    version: entry.version, sha256: entry.sha256, source_commit: commit,
    published_at: entry.updated_at || entry.published_at || null, merged_at: null, pr: null, contributors: [],
    ...(entry.derived_from && { derived_from: entry.derived_from }),
  };
  state.packages[id] = { active: true, tree_hash: treeHash(files), source_commit: commit, first_published_at: entry.published_at || null, release };
  prepared.push({ id, files, history: historyDocument(id, [release]) });
}
// 所有字节验证完成后才写出目录，失败时不留下看似可发布的半成品。
for (const { id, files, history } of prepared) {
  writeTree(join(output, "published", id), files);
  const path = join(output, "history/v1", `${id}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(history, null, 2) + "\n");
}
mkdirSync(join(output,"published"), { recursive: true });
writeFileSync(join(output,"published/state.json"),JSON.stringify(state,null,2)+"\n");
console.log(`Verified ${prepared.length} published packages from ${commit}; baseline at ${resolve(output)}`);
