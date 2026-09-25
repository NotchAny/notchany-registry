#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { github, pages } from "./github-pr.mjs";

const number = Number(process.env.PR_NUMBER);
if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Invalid PR number");
const pr = await github(`/pulls/${number}`);
const files = await pages(`/pulls/${number}/files`);
if (files.length !== pr.changed_files || pr.base.ref !== "main") throw new Error("Incomplete or invalid PR");
if (pr.head.repo?.full_name === pr.base.repo.full_name && pr.head.ref.startsWith("codex/publish-")) {
  execFileSync(process.execPath, [resolve("scripts/validate-publication.mjs")], { stdio: "inherit" });
} else if (files.some(file => file.filename.startsWith("packages/") || file.previous_filename?.startsWith("packages/"))) {
  execFileSync(process.execPath, [resolve("scripts/validate-reviewed-pr.mjs")], { stdio: "inherit" });
} else {
  // 仓库维护必须由当前管理员提交，且不可混入包或生成产物；不执行 PR 脚本。
  const permission = await github(`/collaborators/${encodeURIComponent(pr.user.login)}/permission`);
  const allowed = permission.permission === "admin" && files.every(file =>
    !/^(published|publication|index|history)\//.test(file.filename) && !/^(published|publication|index|history)\//.test(file.previous_filename || ""));
  await github(`/statuses/${pr.head.sha}`, { method: "POST", body: JSON.stringify({ context: "market/content-and-permission",
    state: allowed ? "success" : "failure", description: allowed ? "仓库维护范围与管理员身份校验通过" : "仓库维护不能修改发布快照，且需要管理员身份" }) });
  if (!allowed) throw new Error("Registry maintenance permission or scope denied");
}
