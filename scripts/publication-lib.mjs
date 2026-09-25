import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";

export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export function git(...args) { return execFileSync("git", args, { maxBuffer: 40 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); }
export function tree(commit, prefix) {
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^(packages|published)\/[A-Za-z0-9-]+\/[a-z0-9-]+$/.test(prefix)) throw new Error("Invalid tree identity");
  const files = {};
  let total = 0;
  for (const item of git("ls-tree", "-rz", commit, "--", prefix).toString().split("\0").filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(item);
    if (!match) throw new Error("Packages may only contain regular files");
    const path = match[3].slice(prefix.length + 1);
    if (!path || /[\x00-\x1f\\]/.test(path) || path.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Invalid package path");
    const bytes = git("cat-file", "blob", match[2]);
    total += bytes.length;
    if (total > 25 * 1024 * 1024 || Object.keys(files).length >= 100) throw new Error("Package size limit exceeded");
    files[path] = bytes;
  }
  return files;
}
export function treeHash(files) { return hash(JSON.stringify(Object.keys(files).sort().map(path => [path, hash(files[path])]))); }
export function writeTree(root, files) {
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(root,path)), { recursive: true });
    writeFileSync(join(root,path), bytes);
  }
}
export function readState(root = process.cwd()) {
  const path = join(root,"published/state.json");
  if (!existsSync(path)) throw new Error("Missing approved baseline: run bootstrap-publication into an empty staging directory first");
  const state = JSON.parse(readFileSync(path,"utf8"));
  if (state.schema !== 1 || !state.packages) throw new Error("Invalid publication state");
  return state;
}
export function pendingPackages(candidateTrees, state) {
  return [...new Set([...Object.keys(candidateTrees), ...Object.keys(state.packages)])].sort().filter(id => {
    const files = candidateTrees[id] || {};
    return Object.keys(files).length ? state.packages[id]?.tree_hash !== treeHash(files) || state.packages[id]?.active !== true : state.packages[id]?.active === true;
  });
}

export function directoryTree(root) {
  const files = {};
  function visit(path = "") {
    const directory = join(root, path);
    if (lstatSync(directory).isSymbolicLink()) throw new Error("Snapshot symlink rejected");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = path ? `${path}/${entry.name}` : entry.name;
      if (/[\x00-\x1f\\]/.test(relative)) throw new Error("Invalid snapshot path");
      if (entry.isDirectory()) visit(relative);
      else if (entry.isFile()) files[relative] = readFileSync(join(root, relative));
      else throw new Error("Snapshot must only contain regular files");
    }
  }
  visit();
  return files;
}

export function verifyPublished(root = process.cwd()) {
  const state = readState(root);
  const files = directoryTree(join(root, "published"));
  const active = Object.keys(state.packages).filter(id => state.packages[id].active).sort();
  const disk = [...new Set(Object.keys(files).filter(path => path !== "state.json").map(path => path.split("/").slice(0, 2).join("/")))].sort();
  if (JSON.stringify(active) !== JSON.stringify(disk)) throw new Error("Published snapshot inventory mismatch");
  for (const id of active) {
    const item = state.packages[id];
    const contents = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(`${id}/`)).map(([path, bytes]) => [path.slice(id.length + 1), bytes]));
    if (treeHash(contents) !== item.tree_hash || hash(contents["package.notchany.json"] || "") !== item.release.sha256
      || JSON.parse(contents["manifest.json"]).version !== item.release.version) throw new Error(`Published snapshot mismatch: ${id}`);
  }
  return state;
}

export function verifyPublishedIndex(index, root = process.cwd()) {
  const state = verifyPublished(root);
  const active = Object.keys(state.packages).filter(id => state.packages[id].active).sort();
  if (!Array.isArray(index.packages) || JSON.stringify(index.packages.map(item => item.package_id).sort()) !== JSON.stringify(active)) throw new Error("Index snapshot inventory mismatch");
  for (const entry of index.packages) {
    const id = entry.package_id;
    const release = state.packages[id].release;
    if (entry.path !== `published/${id}/package.notchany.json` || entry.sha256 !== release.sha256 || entry.version !== release.version) throw new Error(`Index snapshot mismatch: ${id}`);
    if (entry.history_path && entry.history_path !== `history/v1/${id}.json`) throw new Error("Invalid published history path");
    for (const path of [entry.icon_path, ...(entry.screenshots || [])].filter(Boolean)) {
      if (!path.startsWith(`published/${id}/`) || path.split("/").some(part => part === ".." || part === ".") || !existsSync(join(root, path))) throw new Error("Invalid published asset path");
    }
  }
  return state;
}
