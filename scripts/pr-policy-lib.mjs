function packageIDForPath(path) {
  if (typeof path !== "string" || !path.startsWith("packages/")) return null;
  const parts = path.split("/");
  return parts.length >= 4 && parts[1] && parts[2] ? `${parts[1]}/${parts[2]}` : null;
}

export function classifyPackagePullRequest(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("PR 没有可授权的包变更");
  }
  const packageIDs = new Set();
  for (const file of files) {
    const current = packageIDForPath(file?.filename);
    if (!current) throw new Error(`PR 只允许修改 packages/**：${file?.filename || "unknown"}`);
    packageIDs.add(current);
    if (file.status === "renamed" && file.previous_filename) {
      const previous = packageIDForPath(file.previous_filename);
      if (!previous) throw new Error(`PR 只允许修改 packages/**：${file.previous_filename}`);
      packageIDs.add(previous);
    }
  }
  if (packageIDs.size !== 1) {
    throw new Error(`PR 必须只涉及一个包：${[...packageIDs].join(", ") || "none"}`);
  }
  const packageID = [...packageIDs][0];
  const manifest = files.find((file) => file.filename === `packages/${packageID}/manifest.json`);
  const operation = manifest?.status === "added"
    ? options.isReserved?.(packageID) ? "update" : "create"
    : manifest?.status === "removed" ? "unlist" : "update";
  return { packageID, operation };
}

export function classifyMergedPackage({ existsNow, existedBefore, hasHistory }) {
  if (!existsNow) return "unlist";
  return existedBefore || hasHistory ? "update" : "create";
}
