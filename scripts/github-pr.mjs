import { existsSync } from "node:fs";
import { classifyPackagePullRequest } from "./pr-policy-lib.mjs";
import { REGISTRY_REPOSITORY } from "./registry-repo.mjs";

export async function github(path, options = {}) {
  const repo = process.env.GITHUB_REPOSITORY || REGISTRY_REPOSITORY;
  if (repo !== REGISTRY_REPOSITORY) throw new Error("Registry repository mismatch");
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${path}`);
  return response.status === 204 ? null : response.json();
}

export async function pages(path) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await github(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid paginated response");
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error("Pagination limit reached; refusing incomplete evidence");
}

export async function pullRequest(number) {
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Invalid PR number");
  const pr = await github(`/pulls/${number}`);
  if (pr.base.repo.full_name !== REGISTRY_REPOSITORY || pr.base.ref !== "main") throw new Error("Invalid PR base");
  const files = await pages(`/pulls/${number}/files`);
  if (files.length !== pr.changed_files) throw new Error("Incomplete PR file list");
  const { packageID, operation } = classifyPackagePullRequest(files, { isReserved: id => existsSync(`history/v1/${id}.json`) });
  const reviews = await pages(`/pulls/${number}/reviews`);
  return { pr, files, evaluation: {
    repository: pr.base.repo.full_name, pr_number: number, head_sha: pr.head.sha, base_sha: pr.base.sha,
    package_id: packageID, operation, actor_github_user_id: String(pr.user.id),
    reviews: reviews.filter(r => r.state !== "PENDING").map(r => ({ reviewer_id: String(r.user.id), review_id: String(r.id),
      commit_id: r.commit_id, state: r.state, submitted_at: r.submitted_at })),
  } };
}
