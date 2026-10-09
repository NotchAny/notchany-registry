import { execFileSync } from "node:child_process";

export function publicCommitForDecision(decisionID, root = process.cwd()) {
  const shallow = execFileSync(
    "git",
    ["rev-parse", "--is-shallow-repository"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  if (shallow === "true") {
    throw new Error("Market 对账需要完整 Git 历史，请将 checkout 的 fetch-depth 设为 0");
  }
  const commit = execFileSync(
    "git",
    ["log", "--reverse", "--format=%H", `-S${decisionID}`, "--", "published/state.json"],
    { cwd: root, encoding: "utf8" },
  ).trim().split("\n")[0];
  if (!/^[a-f0-9]{40}$/.test(commit || "")) throw new Error("Missing public commit");
  return commit;
}
