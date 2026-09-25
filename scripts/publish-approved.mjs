#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { git, tree, treeHash, hash, writeTree, readState, pendingPackages } from "./publication-lib.mjs";
import { pages, pullRequest } from "./github-pr.mjs";
import { signedMarketPost } from "./market-client.mjs";
import { snapshotGitHubUser, versionContributors } from "./history-lib.mjs";
import { sealBatch, artifactChanges } from "./publication-batch.mjs";

const commit = git("rev-parse","HEAD").toString().trim();
const state = readState();
const ids = new Set(git("ls-tree","-r","--name-only",commit,"--","packages").toString().split("\n").filter(Boolean).map(p => p.split("/").slice(1,3).join("/")));
const trees = Object.fromEntries([...ids].map(id => [id,tree(commit,`packages/${id}`)]));
const pending = pendingPackages(trees,state);
if (!pending.length) { console.log("No unpublished changes"); process.exit(0); }
const snapshots = [];
for (const id of pending) {
  const changedCommit = git("log","-1","--format=%H",commit,"--",`packages/${id}`).toString().trim();
  const pulls = await pages(`/commits/${changedCommit}/pulls`);
  const merged = pulls.filter(pr => pr.merged_at && pr.base.ref === "main");
  if (merged.length !== 1) throw new Error(`Cannot identify a single merged PR for ${id}`);
  const snapshot = await pullRequest(merged[0].number);
  if (!snapshot.pr.merged_at || snapshot.evaluation.package_id !== id) throw new Error("Merged PR mismatch");
  // 必须与获审 head 整包一致；合并冲突产生的新内容须重新走 PR。
  git("fetch","origin",`pull/${snapshot.pr.number}/head`);
  if (treeHash(tree(snapshot.pr.head.sha,`packages/${id}`)) !== treeHash(trees[id] || {})) throw new Error(`Candidate differs from reviewed head: ${id}`);
  snapshot.evaluation.operation = Object.keys(trees[id] || {}).length ? state.packages[id] ? "update" : "create" : "unlist";
  const decision = await signedMarketPost("/internal/market/pr-evaluate",snapshot.evaluation);
  if (!decision.allowed) throw new Error(`Publication rejected: ${id}: ${decision.reason}`);
  snapshots.push(snapshot);
}
const staging = mkdtempSync(join(tmpdir(),"notchany-release-"));
try {
  // 先验证整个候选树与已保留身份；执行的是当前可信脚本，候选文件仅作为数据。
  execFileSync(process.execPath,[resolve("scripts/check-pr.mjs")], { stdio: "inherit", env: { ...process.env, SKIP_MARKET_AUTH: "1" } });
  for (const id of Object.keys(state.packages)) if (state.packages[id].active) {
    const files = tree(commit,`published/${id}`);
    if (treeHash(files) !== state.packages[id].tree_hash) throw new Error(`Published snapshot modified: ${id}`);
    writeTree(join(staging,"published",id),files);
  }
  const now = git("show","-s","--format=%cI",commit).toString().trim();
  for (const snapshot of snapshots) {
    const id = snapshot.evaluation.package_id;
    const files = trees[id] || {};
    rmSync(join(staging,"published",id), { recursive: true, force: true });
    if (!Object.keys(files).length) { state.packages[id].active = false; continue; }
    const manifest = JSON.parse(files["manifest.json"]);
    const old = state.packages[id]?.release;
    if (old && compareVersion(manifest.version,old.version) <= 0) throw new Error(`Version must exceed published ${old.version}: ${id}`);
    writeTree(join(staging,"published",id),files);
    const author = snapshotGitHubUser(snapshot.pr.user);
    const commits = await pages(`/pulls/${snapshot.pr.number}/commits`);
    if (commits.length !== snapshot.pr.commits) throw new Error("Incomplete PR contributor evidence");
    state.packages[id] = { active: true, tree_hash: treeHash(files), source_commit: commit,
      first_published_at: state.packages[id]?.first_published_at || old?.published_at || now, release: {
      version: manifest.version, sha256: hash(files["package.notchany.json"]), source_commit: commit, merged_at: snapshot.pr.merged_at,
      published_at: now, derived_from: manifest.derived_from,
      pr: { number: snapshot.pr.number, url: snapshot.pr.html_url, title: snapshot.pr.title, body: snapshot.pr.body || "", author },
      contributors: versionContributors(snapshot.pr.user, commits),
    } };
  }
  // 完成产物准备后再读 Review 与当前角色，事务修订号比较是本批授权生效时点。
  const requests = [];
  for (const old of snapshots) {
    const fresh = await pullRequest(old.pr.number);
    if (fresh.pr.head.sha !== old.pr.head.sha) throw new Error("Reviewed head changed");
    fresh.evaluation.operation = old.evaluation.operation;
    requests.push(fresh.evaluation);
  }
  const prepared = await signedMarketPost("/internal/market/publication-prepare", { candidate_commit: commit, requests });
  prepared.decisions.forEach((decision,i) => {
    if (state.packages[requests[i].package_id].active) state.packages[requests[i].package_id].release.approved_by = decision.approved_by;
  });
  state.decisions.push({ id: prepared.decision_id, candidate_commit: commit });
  mkdirSync(join(staging,"published"),{ recursive: true });
  writeFileSync(join(staging,"published/state.json"),JSON.stringify(state,null,2)+"\n");
  // 仅修改本地生成目录；workflow 以一次提交公开，推送竞争直接失败。
  rmSync("published", { recursive: true });
  execFileSync("cp",["-R",join(staging,"published"),"published"]);
  execFileSync(process.execPath,[resolve("scripts/build-index.mjs")],{ stdio: "inherit" });
  execFileSync(process.execPath,[resolve("scripts/build-history.mjs")],{ stdio: "inherit" });
  const batch = sealBatch({ schema: 1, candidate_commit: commit, decision_id: prepared.decision_id,
    requests, artifacts: artifactChanges(commit) }, process.env.MARKET_INTERNAL_HMAC_SECRET);
  mkdirSync("publication", { recursive: true });
  writeFileSync("publication/last-batch.json", JSON.stringify(batch, null, 2) + "\n");
} finally { rmSync(staging,{ recursive: true, force: true }); }

function compareVersion(a,b) {
  for (let i=0;i<3;i++) { const diff = BigInt(a.split(".")[i])-BigInt(b.split(".")[i]); if (diff) return diff > 0n ? 1 : -1; }
  return 0;
}
