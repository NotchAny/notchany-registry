import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { git, directoryTree, hash } from "./publication-lib.mjs";
import { join } from "node:path";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function sealBatch(payload, secret) {
  if (!secret) throw new Error("Missing publication secret");
  return { payload, signature: createHmac("sha256", secret).update(JSON.stringify(canonical(payload))).digest("hex") };
}
export function verifyBatch(document, secret, artifacts) {
  const payload = document?.payload;
  if (payload?.schema !== 1 || !/^[a-f0-9]{40}$/.test(payload.candidate_commit) || !/^[a-f0-9]{64}$/.test(document?.signature)) throw new Error("Invalid release manifest");
  const expected = sealBatch(payload, secret).signature;
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(document.signature, "hex"))) throw new Error("Release signature mismatch");
  for (const [path, digest] of Object.entries(artifacts)) {
    if (!/^(published\/|index\/v[12]\/index.json$|history\/v1\/)/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")
      || (digest !== null && !/^[a-f0-9]{64}$/.test(digest))) throw new Error("Unapproved release path");
  }
  if (JSON.stringify(canonical(artifacts)) !== JSON.stringify(canonical(payload.artifacts))) throw new Error("Release artifact inventory or hash mismatch");
  return payload;
}

export function artifactChanges(commit, root = process.cwd()) {
  const prefixes = ["published", "index/v1", "index/v2", "history/v1"];
  const before = {};
  for (const item of git("ls-tree", "-rz", commit, "--", ...prefixes).toString().split("\0").filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(item);
    if (!match) throw new Error("Invalid prior publication files");
    before[match[3]] = hash(git("cat-file", "blob", match[2]));
  }
  const after = {};
  for (const prefix of prefixes) if (existsSync(join(root, prefix))) {
    for (const [path, bytes] of Object.entries(directoryTree(join(root, prefix)))) after[`${prefix}/${path}`] = hash(bytes);
  }
  return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .filter(path => before[path] !== after[path]).map(path => [path, after[path] ?? null]));
}
