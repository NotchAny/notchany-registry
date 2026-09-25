#!/usr/bin/env node
// 生成 index/v1/index.json：扫描 packages/<owner>/<slug>/，合并 manifest 人写字段与
// 从 package.notchany.json / git 历史推导的字段。零第三方依赖，Node ≥18。
//
// 用法：node scripts/build-index.mjs（在仓库根目录执行）
//
// 可重现性：generated_at 取 HEAD commit 时间（而非当前时间）——同一提交任何时候
// 重跑，产出字节一致；published_at/updated_at 取包目录的首次/最后 commit 时间。

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { verifyPublished } from "./publication-lib.mjs";

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "published");
const publication = verifyPublished(ROOT);
const V1_INDEX_PATH = join(ROOT, "index", "v1", "index.json");
const V2_INDEX_PATH = join(ROOT, "index", "v2", "index.json");

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// HEAD commit 时间（ISO8601）；仓库尚无提交时回落当前时间。
const headTime = git("log", "-1", "--format=%cI") || new Date().toISOString();

// 包目录的首次/最后 commit 时间；目录尚未入库（无历史）时都回落 HEAD 时间。
function commitTimes(relativeDir) {
  const output = git("log", "--follow", "--format=%cI", "--", relativeDir);
  const lines = output.split("\n").filter(Boolean);
  if (lines.length === 0) return { published: headTime, updated: headTime };
  return { published: lines[lines.length - 1], updated: lines[0] };
}

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function fail(message) {
  console.error(`build-index: ${message}`);
  process.exit(1);
}

const entries = [];
for (const owner of listDirs(PACKAGES_DIR)) {
  for (const slug of listDirs(join(PACKAGES_DIR, owner))) {
    const relativeDir = `published/${owner}/${slug}`;
    const approved = publication.packages[`${owner}/${slug}`];
    if (!approved?.active) fail(`${relativeDir} is not approved`);
    const packageDir = join(PACKAGES_DIR, owner, slug);
    const packagePath = join(packageDir, "package.notchany.json");
    const manifestPath = join(packageDir, "manifest.json");
    const iconPath = join(packageDir, "icon.png");
    if (!existsSync(packagePath)) fail(`${relativeDir} 缺少 package.notchany.json`);
    if (!existsSync(manifestPath)) fail(`${relativeDir} 缺少 manifest.json`);

    let manifest;
    let envelope;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      fail(`${relativeDir}/manifest.json 不是合法 JSON：${error.message}`);
    }
    try {
      envelope = JSON.parse(readFileSync(packagePath, "utf8"));
    } catch (error) {
      fail(`${relativeDir}/package.notchany.json 不是合法 JSON：${error.message}`);
    }
    const action = envelope.action;
    if (!action || typeof action !== "object") {
      fail(`${relativeDir}/package.notchany.json 缺少 action 对象`);
    }

    const bytes = readFileSync(packagePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== approved.release.sha256 || manifest.version !== approved.release.version) fail(`${relativeDir} approved release mismatch`);

    // 截图：实际存在的 .png/.jpg 文件，按文件名排序。
    const screenshotsDir = join(packageDir, "screenshots");
    const screenshots = existsSync(screenshotsDir)
      ? readdirSync(screenshotsDir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && /\.(png|jpe?g)$/.test(entry.name))
          .map((entry) => `${relativeDir}/screenshots/${entry.name}`)
          .sort()
      : [];

    const published = approved.first_published_at || approved.release.published_at || null;
    const updated = approved.release.published_at || approved.release.merged_at || null;

    // manifest 人写字段在前，推导字段在后。
    const entry = {
      names: manifest.names,
      summaries: manifest.summaries,
      ...(manifest.descriptions !== undefined && { descriptions: manifest.descriptions }),
      version: manifest.version,
      ...(manifest.tags !== undefined && { tags: manifest.tags }),
      ...(manifest.homepage !== undefined && { homepage: manifest.homepage }),
      license: manifest.license,
      ...(manifest.derived_from && { derived_from: manifest.derived_from }),
      ...(approved.release.approved_by?.length && { approved_by: approved.release.approved_by }),
      ...(manifest.min_app_version !== undefined && {
        min_app_version: manifest.min_app_version,
      }),
      package_id: `${owner}/${slug}`,
      path: `${relativeDir}/package.notchany.json`,
      ...(existsSync(iconPath) && { icon_path: `${relativeDir}/icon.png` }),
      id: action.id,
      kind: action.presentation_mode === "widget" ? "widget" : "action",
      action_kind: action.kind,
      input_kind: action.input_kind,
      envelope_version: envelope.notchany_export,
      sha256,
      size_bytes: bytes.length,
      requires: Array.isArray(action.requires) ? action.requires : [],
      has_parameters: Array.isArray(action.parameters) && action.parameters.length > 0,
      has_notification: action.notification !== undefined && action.notification !== null,
      ...(action.widget?.wants_text_input === true && { has_text_input: true }),
      ...(action.accepts != null && { accepts: action.accepts }),
      ...(action.dependency_hints && { dependency_hints: action.dependency_hints }),
      ...(action.env_requires?.length && { env_requires: action.env_requires }),
      ...(action.kind === "shell" && { interpreter: action.interpreter ?? "shell" }),
      screenshots,
      published_at: published,
      updated_at: updated,
    };
    entries.push(entry);
  }
}

entries.sort((a, b) => (a.package_id < b.package_id ? -1 : 1));

const index = {
  index_schema: 1,
  generated_at: headTime,
  packages: entries,
};

const v2Index = {
  index_schema: 2,
  generated_at: headTime,
  packages: entries.map((entry) => ({
    ...entry,
    history_path: `history/v1/${entry.package_id}.json`,
  })),
};

mkdirSync(join(ROOT, "index", "v1"), { recursive: true });
mkdirSync(join(ROOT, "index", "v2"), { recursive: true });
writeFileSync(V1_INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
writeFileSync(V2_INDEX_PATH, JSON.stringify(v2Index, null, 2) + "\n");
console.log(`已生成 index/v1 与 index/v2（${entries.length} 个包，generated_at=${index.generated_at}）`);
