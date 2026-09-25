#!/usr/bin/env node
// PR 校验：pr-validate.yml 调用；也可本地全量自检（node scripts/check-pr.mjs）。
// 零第三方依赖，Node ≥18。所有违规聚合输出后 exit 1。
//
// 两种模式：
// - PR 模式：环境变量 CHANGED_FILES（换行分隔的变更文件列表）存在时，只校验被改的包，
//   并附加「变更范围」「版本递增」检查；PR_AUTHOR 存在时校验作者与 owner 目录一致
//   （MAINTAINERS 文件中的用户名豁免）。
// - 本地模式：CHANGED_FILES 缺席时扫描全部包（跳过变更范围/作者/版本递增检查）。

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, lstatSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { readPngDimensions } from "./png.mjs";
import { signedMarketPost } from "./market-client.mjs";
import { tree, hash } from "./publication-lib.mjs";
import { packageContractProblems } from "./package-contract.mjs";

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "packages");
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
// GitHub 用户名：1–39 位字母/数字/连字符，不得以连字符开头/结尾或连续连字符。
const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const TAG_PATTERN = /^[a-z0-9-]{1,24}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 1024 * 1024;
const MAX_ICON_BYTES = 512 * 1024;

const violations = [];
function violate(message) {
  violations.push(message);
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isDecodableBase64(text) {
  return typeof text === "string" && text.length % 4 === 0 && BASE64_PATTERN.test(text);
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function maintainers() {
  const path = join(ROOT, "MAINTAINERS");
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#"))
  );
}

// ---------- manifest 校验（手写零依赖，对齐 schema/manifest.schema.json） ----------

const MANIFEST_KEYS = new Set([
  "manifest_version",
  "names",
  "summaries",
  "descriptions",
  "version",
  "tags",
  "homepage",
  "license",
  "min_app_version",
  "derived_from",
]);

function validateManifest(manifest, label) {
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    violate(`${label}：manifest 必须是 JSON 对象`);
    return;
  }
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(key)) violate(`${label}：不允许的字段 ${key}`);
  }
  if (manifest.manifest_version !== 1) {
    violate(`${label}：manifest_version 必须为 1`);
  }
  validateLocaleMap(manifest.names, `${label}：names`, { required: true });
  validateLocaleMap(manifest.summaries, `${label}：summaries`, {
    required: true,
    maxLength: 80,
  });
  if (manifest.descriptions !== undefined) {
    validateLocaleMap(manifest.descriptions, `${label}：descriptions`, {
      allowEmptyValues: true,
    });
  }
  if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
    violate(`${label}：version 必须是 x.y.z 形状的字符串`);
  }
  if (manifest.tags !== undefined) {
    if (!Array.isArray(manifest.tags) || manifest.tags.length > 5) {
      violate(`${label}：tags 必须是最多 5 项的数组`);
    } else {
      for (const tag of manifest.tags) {
        if (typeof tag !== "string" || !TAG_PATTERN.test(tag)) {
          violate(`${label}：tag ${JSON.stringify(tag)} 不符合 ^[a-z0-9-]{1,24}$`);
        }
      }
    }
  }
  if (manifest.homepage !== undefined) {
    let ok = typeof manifest.homepage === "string";
    if (ok) {
      try {
        new URL(manifest.homepage);
      } catch {
        ok = false;
      }
    }
    if (!ok) violate(`${label}：homepage 必须是合法 URL 字符串`);
  }
  if (typeof manifest.license !== "string" || manifest.license.length === 0) {
    violate(`${label}：license 必须是非空字符串（SPDX 标识，如 MIT）`);
  }
  if (
    manifest.min_app_version !== undefined &&
    (typeof manifest.min_app_version !== "string" ||
      !VERSION_PATTERN.test(manifest.min_app_version))
  ) {
    violate(`${label}：min_app_version 必须是 x.y.z 形状的字符串`);
  }
}

function validateLocaleMap(value, label, { required = false, maxLength, allowEmptyValues = false } = {}) {
  if (value === undefined) {
    if (required) violate(`${label} 是必填字段`);
    return;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    violate(`${label} 必须是 {语言码: 文案} 对象`);
    return;
  }
  const keys = Object.keys(value);
  if (required && keys.length === 0) {
    violate(`${label} 至少要有一个语言条目`);
  }
  for (const key of keys) {
    const text = value[key];
    if (typeof text !== "string") {
      violate(`${label}.${key} 必须是字符串`);
      continue;
    }
    if (!allowEmptyValues && text.length === 0) {
      violate(`${label}.${key} 不能为空`);
    }
    // 按 Unicode 码点计数（对齐 JSON Schema 的 maxLength 语义）
    if (maxLength !== undefined && [...text].length > maxLength) {
      violate(`${label}.${key} 超过 ${maxLength} 字符（现 ${[...text].length}）`);
    }
  }
}

// ---------- package.notchany.json 校验 ----------

function validatePackageFile(envelope, label) {
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    violate(`${label}：必须是 JSON 对象`);
    return;
  }
  const version = envelope.notchany_export;
  for (const problem of packageContractProblems(envelope)) violate(`${label}：${problem}`);
  const action = envelope.action;
  if (typeof action !== "object" || action === null || Array.isArray(action)) {
    violate(`${label}：action 必须是对象`);
    return;
  }
  if (typeof action.id !== "string" || action.id.length === 0) {
    violate(`${label}：action.id 必须是非空字符串`);
  }
  if (typeof action.kind !== "string" || action.kind.length === 0) {
    violate(`${label}：action.kind 必须是非空字符串`);
  }
  // 脱敏硬校验：parameter_values 是使用者的本机参数值（可能含路径/密钥），禁止入库。
  if ("parameter_values" in action) {
    violate(`${label}：action.parameter_values 必须移除（脱敏要求：不得携带个人参数值）`);
  }
  if (action.icon_type === "image") {
    const data = envelope.icon_image?.data_base64;
    if (data === undefined) {
      violate(`${label}：icon_type 为 image 但缺少 icon_image.data_base64`);
    } else if (!isDecodableBase64(data)) {
      violate(`${label}：icon_image.data_base64 不是可解码的 base64`);
    }
  }
  const icons = action.icons;
  if (typeof icons === "object" && icons !== null && !Array.isArray(icons)) {
    for (const [key, icon] of Object.entries(icons)) {
      if (icon?.icon_type !== "image") continue;
      const data = envelope.state_icon_images?.[key]?.data_base64;
      if (data === undefined) {
        violate(`${label}：状态图标 ${key} 为 image 但缺少 state_icon_images.${key}.data_base64`);
      } else if (!isDecodableBase64(data)) {
        violate(`${label}：state_icon_images.${key}.data_base64 不是可解码的 base64`);
      }
    }
  }
}

// ---------- 截图校验 ----------

function validateScreenshots(packageDir, label) {
  const dir = join(packageDir, "screenshots");
  if (!existsSync(dir)) return;
  const files = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile());
  if (files.length > MAX_SCREENSHOTS) {
    violate(`${label}：截图最多 ${MAX_SCREENSHOTS} 张（现 ${files.length} 张）`);
  }
  for (const file of files) {
    if (!/\.(png|jpe?g)$/.test(file.name)) {
      violate(`${label}：截图 ${file.name} 只允许 PNG/JPEG`);
      continue;
    }
    const size = statSync(join(dir, file.name)).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      violate(`${label}：截图 ${file.name} 超过 1MB（现 ${size} 字节）`);
    }
  }
}

function validateIcon(packageDir, label) {
  const path = join(packageDir, "icon.png");
  if (!existsSync(path)) {
    violate(`${label}：缺少 icon.png；请使用 NotchAny 发布向导重新产出，确保市场展示与安装后的真实图标一致`);
    return;
  }
  const size = statSync(path).size;
  if (size > MAX_ICON_BYTES) {
    violate(`${label}：icon.png 超过 512KB（现 ${size} 字节）`);
  }
  try {
    const { width, height } = readPngDimensions(readFileSync(path));
    if (width !== height) {
      violate(`${label}：icon.png 必须为方形（现 ${width}×${height}）`);
    }
    if (width < 256 || width > 1024 || height < 256 || height > 1024) {
      violate(`${label}：icon.png 宽高必须在 256–1024px（现 ${width}×${height}）`);
    }
  } catch (error) {
    violate(`${label}：icon.png 无效：${error.message}`);
  }
}

// ---------- 单个包的完整校验 ----------

function validatePackage(owner, slug, { checkVersionBump }) {
  const label = `packages/${owner}/${slug}`;
  if (!OWNER_PATTERN.test(owner)) {
    violate(`${label}：owner 目录名 ${owner} 不符合 GitHub 用户名规则`);
  }
  if (!SLUG_PATTERN.test(slug)) {
    violate(`${label}：slug ${slug} 不符合 ^[a-z0-9][a-z0-9-]{1,63}$`);
  }

  const packageDir = join(PACKAGES_DIR, owner, slug);
  const packagePath = join(packageDir, "package.notchany.json");
  const manifestPath = join(packageDir, "manifest.json");
  let complete = true;
  if (!existsSync(packagePath)) {
    violate(`${label}：缺少 package.notchany.json`);
    complete = false;
  }
  if (!existsSync(manifestPath)) {
    violate(`${label}：缺少 manifest.json`);
    complete = false;
  }
  if (!complete) return;

  try {
    validateManifest(readJSON(manifestPath), `${label}/manifest.json`);
  } catch (error) {
    violate(`${label}/manifest.json 不是合法 JSON：${error.message}`);
  }
  let envelope;
  try {
    envelope = readJSON(packagePath);
  } catch (error) {
    violate(`${label}/package.notchany.json 不是合法 JSON：${error.message}`);
  }
  if (envelope !== undefined) {
    validatePackageFile(envelope, `${label}/package.notchany.json`);
  }
  validateScreenshots(packageDir, label);
  validateIcon(packageDir, label);
  try { validateIdentityAndSource(`${owner}/${slug}`, packageDir, envelope); }
  catch (error) { violate(`${label}: ${error.message}`); }

  // 版本递增（仅 PR 模式）：origin/main 上已有同名包时，新 version 必须严格大于旧值。
  if (checkVersionBump) {
    let oldManifestText;
    try {
      oldManifestText = execFileSync(
        "git",
        ["show", `origin/main:packages/${owner}/${slug}/manifest.json`],
        { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
    } catch {
      oldManifestText = undefined; // 新包，跳过
    }
    if (oldManifestText !== undefined) {
      try {
        const oldVersion = JSON.parse(oldManifestText).version;
        const newVersion = readJSON(manifestPath).version;
        if (
          typeof oldVersion === "string" &&
          typeof newVersion === "string" &&
          VERSION_PATTERN.test(oldVersion) &&
          VERSION_PATTERN.test(newVersion) &&
          compareSemver(newVersion, oldVersion) <= 0
        ) {
          violate(`${label}：version 必须严格大于 origin/main 上的 ${oldVersion}（现 ${newVersion}）`);
        }
      } catch {
        // 新旧 manifest 解析失败已由其它检查报告
      }
    }
  }
}

function validateIdentityAndSource(id, directory, envelope) {
  const historyRoot = process.env.TRUSTED_HISTORY_ROOT || join(ROOT,"history/v1");
  const manifest = readJSON(join(directory,"manifest.json"));
  function regularFiles(dir) {
    for (const entry of readdirSync(dir,{ withFileTypes: true })) {
      const path = join(dir,entry.name);
      if (lstatSync(path).isSymbolicLink()) throw new Error("不允许符号链接");
      if (entry.isDirectory()) regularFiles(path);
      else if (!entry.isFile()) throw new Error("只允许普通文件");
    }
  }
  regularFiles(directory);
  const ownPath = join(historyRoot,`${id}.json`);
  const own = existsSync(ownPath) ? readJSON(ownPath) : null;
  const previous = own?.releases?.[0];
  if (previous) {
    const old = tree(previous.source_commit,`packages/${id}`);
    if (JSON.parse(old["package.notchany.json"]).action.id !== envelope.action.id) throw new Error("原包动作 ID 不可更改");
    const original = JSON.parse(old["manifest.json"]).derived_from;
    if (JSON.stringify(original) !== JSON.stringify(manifest.derived_from)) throw new Error("衍生来源不可更改");
  }
  for (const ownerEntry of existsSync(historyRoot) ? readdirSync(historyRoot,{ withFileTypes: true }) : []) {
    if (!ownerEntry.isDirectory()) continue;
    for (const name of readdirSync(join(historyRoot,ownerEntry.name)).filter(n => n.endsWith(".json"))) {
      const other = readJSON(join(historyRoot,ownerEntry.name,name));
      if (other.package_id === id) continue;
      for (const release of other.releases || []) {
        const bytes = tree(release.source_commit,`packages/${other.package_id}`)["package.notchany.json"];
        if (!bytes || hash(bytes) !== release.sha256) throw new Error("无法验证保留的动作身份");
        if (JSON.parse(bytes).action.id === envelope.action.id) throw new Error("动作 ID 已被市场历史保留");
      }
    }
  }
  const source = manifest.derived_from;
  if (!source) return;
  if (Object.keys(source).sort().join(",") !== "package_id,sha256,version" || !/^[A-Za-z0-9-]+\/[a-z0-9-]+$/.test(source.package_id) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("无效的 derived_from");
  const history = readJSON(join(historyRoot,`${source.package_id}.json`));
  const release = history.releases.find(r => r.version === source.version && r.sha256 === source.sha256);
  if (!release) throw new Error("衍生来源不在已发布历史中");
  const files = tree(release.source_commit,`packages/${source.package_id}`);
  if (hash(files["package.notchany.json"]) !== source.sha256) throw new Error("来源摘要不匹配");
  const original = JSON.parse(files["manifest.json"]);
  if (manifest.license !== original.license || !["MIT","Apache-2.0","GPL-3.0-only","BSD-2-Clause","Unlicense"].includes(original.license)) throw new Error("license_review_required");
  const attribution = Object.keys(files).filter(p => /(^|\/)(LICENSE|COPYING|NOTICE|AUTHORS|ATTRIBUTION)(\.|$)/i.test(p));
  if (!attribution.some(p => /(^|\/)(LICENSE|COPYING)(\.|$)/i.test(p))) throw new Error("缺少来源许可证材料");
  for (const path of attribution) if (!existsSync(join(directory,path)) || hash(readFileSync(join(directory,path))) !== hash(files[path])) throw new Error(`未保留署名文件 ${path}`);
}

// ---------- 入口 ----------

const changedFilesEnv = process.env.CHANGED_FILES;
const targets = new Map(); // "owner/slug" -> {owner, slug}

if (changedFilesEnv !== undefined) {
  // PR 模式：变更只允许出现在 packages/**。
  const changedFiles = changedFilesEnv.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const file of changedFiles) {
    if (!file.startsWith("packages/")) {
      if (/^(index|schema|scripts)\//.test(file)) {
        violate(`变更 ${file}：index/、schema/、scripts/ 由 maintainer 直接维护，PR 请勿改动`);
      } else {
        violate(`变更 ${file}：PR 只允许改动 packages/** 下的文件`);
      }
      continue;
    }
    const parts = file.split("/");
    if (parts.length < 4) {
      violate(`变更 ${file}：不符合 packages/<owner>/<slug>/… 目录规范`);
      continue;
    }
    const [, owner, slug] = parts;
    targets.set(`${owner}/${slug}`, { owner, slug });
  }
  if (targets.size > 1) {
    violate(`一个 PR 只能修改一个包（当前涉及 ${[...targets.keys()].join("、")}）`);
  }
  for (const { owner, slug } of targets.values()) {
    // 整目录被删除的包视为下架请求，内容检查自然跳过。
    if (!existsSync(join(PACKAGES_DIR, owner, slug))) continue;
    validatePackage(owner, slug, { checkVersionBump: true });
  }
  if (targets.size === 1 && process.env.SKIP_MARKET_AUTH !== "1") {
    const packageID = [...targets.keys()][0];
    const actorGitHubUserID = process.env.PR_AUTHOR_ID;
    const currentPath = join(PACKAGES_DIR, packageID);
    let existedOnBase = true;
    try {
      execFileSync("git", ["cat-file", "-e", `origin/main:packages/${packageID}/manifest.json`], {
        cwd: ROOT,
        stdio: "ignore",
      });
    } catch {
      existedOnBase = false;
    }
    const hasHistory = existsSync(join(ROOT, "history", "v1", `${packageID}.json`));
    const operation = !existsSync(currentPath)
      ? "unlist" : existedOnBase || hasHistory ? "update" : "create";
    if (!actorGitHubUserID || !/^\d{1,20}$/.test(actorGitHubUserID)) {
      violate("PR_AUTHOR_ID 缺失或不是 GitHub 数字用户 ID");
    } else {
      try {
        const authorization = await signedMarketPost("/internal/market/pr-authorize", {
          package_id: packageID,
          actor_github_user_id: actorGitHubUserID,
          operation,
        });
        if (authorization.allowed !== true) {
          violate(`Market 拒绝 ${operation} ${packageID}：${authorization.reason || "forbidden"}`);
        }
      } catch (error) {
        violate(`Market 权限服务不可用，按 fail closed 拒绝：${error.message}`);
      }
    }
  }
} else {
  // 本地全量模式：扫描全部包（跳过变更范围/作者/版本递增检查）。
  if (existsSync(PACKAGES_DIR)) {
    for (const owner of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
      if (!owner.isDirectory()) continue;
      for (const slug of readdirSync(join(PACKAGES_DIR, owner.name), { withFileTypes: true })) {
        if (!slug.isDirectory()) continue;
        targets.set(`${owner.name}/${slug.name}`, { owner: owner.name, slug: slug.name });
        validatePackage(owner.name, slug.name, { checkVersionBump: false });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`发现 ${violations.length} 处违规：\n`);
  for (const message of violations) console.error(`  ✗ ${message}`);
  process.exit(1);
}
console.log(`校验通过（${targets.size} 个包）`);
