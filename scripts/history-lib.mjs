import { createHash } from "node:crypto";

export function snapshotGitHubUser(user) {
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.login !== "string") {
    return null;
  }
  return {
    github_user_id: String(user.id),
    login: user.login,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
  };
}

export function versionContributors(prAuthor, commits) {
  const ordered = [prAuthor, ...commits.map((commit) => commit?.author)];
  const seen = new Set();
  const result = [];
  for (const raw of ordered) {
    const user = snapshotGitHubUser(raw);
    if (!user || seen.has(user.github_user_id)) continue;
    seen.add(user.github_user_id);
    result.push(user);
  }
  return result;
}

export function packageContributors(releases) {
  const seen = new Set();
  const result = [];
  for (const release of releases) {
    for (const contributor of release.contributors || []) {
      if (seen.has(contributor.github_user_id)) continue;
      seen.add(contributor.github_user_id);
      result.push(contributor);
    }
  }
  return result;
}

export function packageSHA256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function historyDocument(packageID, releases) {
  const ordered = [...releases].sort((a, b) =>
    (Date.parse(b.published_at || b.merged_at) || 0) - (Date.parse(a.published_at || a.merged_at) || 0) ||
    String(b.source_commit).localeCompare(String(a.source_commit), "en"),
  );
  return {
    history_schema: 1,
    package_id: packageID,
    releases: ordered,
    contributors: packageContributors(ordered),
  };
}
