#!/usr/bin/env node
// 生成双语 Web Store 到 site/dist/。样式与交互保持可维护的独立源文件，构建时内联，
// 最终产物为零运行时依赖的纯静态 HTML。

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

import { validateCuration } from "./site-lib.mjs";
import { authorPage, contributorPage, detailPage, downloadPage, homePage, notFoundPage } from "./site-template.mjs";
import { verifyPublishedIndex } from "./publication-lib.mjs";

const ROOT = process.cwd();
const DIST = join(ROOT, "site", "dist");
const INDEX_PATH = join(ROOT, "index", "v2", "index.json");
const CURATION_PATH = join(ROOT, "site", "curation.json");
const COUNTS_URL = process.env.NOTCHANY_COUNTS_URL?.trim() || "";
const APP_DOWNLOAD_URL = process.env.NOTCHANY_APP_DOWNLOAD_URL?.trim() || "";
const marketAPI = process.env.NOTCHANY_MARKET_API_BASE?.trim() || "";
const MARKET_API_BASE = marketAPI === "/" ? "/" : marketAPI.replace(/\/+$/, "");
const BUILD_COMMIT = process.env.NOTCHANY_BUILD_COMMIT?.trim() || "";

function fail(message) {
  console.error(`build-site: ${message}`);
  process.exit(1);
}

function readJSON(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} 不是合法 JSON：${error.message}`);
  }
}

if (!existsSync(INDEX_PATH)) fail("缺少 index/v2/index.json，请先运行 build:index");
if (!existsSync(CURATION_PATH)) fail("缺少 site/curation.json");
if (BUILD_COMMIT && !/^[a-f0-9]{40}$/.test(BUILD_COMMIT)) fail("NOTCHANY_BUILD_COMMIT 必须是完整 Git commit");
const index = readJSON(INDEX_PATH, "index/v2/index.json");
verifyPublishedIndex(index, ROOT);
const packages = Array.isArray(index.packages) ? index.packages : [];
let featuredIDs;
try {
  featuredIDs = validateCuration(readJSON(CURATION_PATH, "site/curation.json"), packages);
} catch (error) {
  fail(error.message);
}
const css = readFileSync(join(ROOT, "site", "styles.css"), "utf8");
const js = readFileSync(join(ROOT, "site", "store.js"), "utf8") + "\n" + readFileSync(join(ROOT, "site", "profile.js"), "utf8");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "assets"), { recursive: true });

function write(relativePath, contents) {
  const output = join(DIST, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, contents);
}

function copy(relativePath) {
  const source = join(ROOT, relativePath);
  if (!existsSync(source)) return;
  const output = join(DIST, "assets", relativePath);
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(source, output);
}

copyFileSync(join(ROOT, "site", "assets", "app-icon.png"), join(DIST, "assets", "app-icon.png"));
copyFileSync(
  join(ROOT, "site", "assets", "macos-desktop-wallpaper.webp"),
  join(DIST, "assets", "macos-desktop-wallpaper.webp")
);
const histories = {};
for (const item of packages) {
  if (item.icon_path) copy(item.icon_path);
  for (const screenshot of item.screenshots || []) copy(screenshot);
}

write("index.html", homePage({ lang: "zh", packages, featuredIDs, countsURL: COUNTS_URL, css, js }));
write("en/index.html", homePage({ lang: "en", packages, featuredIDs, countsURL: COUNTS_URL, css, js }));
write("download/index.html", downloadPage({ lang: "zh", css, js, downloadURL: APP_DOWNLOAD_URL }));
write("en/download/index.html", downloadPage({ lang: "en", css, js, downloadURL: APP_DOWNLOAD_URL }));
for (const item of packages) {
  const history = item.history_path && existsSync(join(ROOT, item.history_path))
    ? readJSON(join(ROOT, item.history_path), item.history_path)
    : { releases: [], contributors: [] };
  histories[item.package_id] = history;
  write(`packages/${item.package_id}/index.html`, detailPage({ lang: "zh", item, packages, history, marketAPIBase: MARKET_API_BASE, countsURL: COUNTS_URL, css, js }));
  write(`en/packages/${item.package_id}/index.html`, detailPage({ lang: "en", item, packages, history, marketAPIBase: MARKET_API_BASE, countsURL: COUNTS_URL, css, js }));
}

const authors = Map.groupBy(packages, (item) => item.package_id.split("/")[0]);
for (const [namespace, authorPackages] of authors) {
  for (const lang of ["zh", "en"]) {
    write(`${lang === "en" ? "en/" : ""}authors/${namespace}/index.html`,
      authorPage({ lang, namespace, packages: authorPackages, histories, marketAPIBase: MARKET_API_BASE, css, js }));
  }
}

for (const lang of ["zh", "en"]) {
  write(`${lang === "en" ? "en/" : ""}contributors/index.html`, contributorPage({ lang, packages, histories, marketAPIBase: MARKET_API_BASE, css, js }));
}

write(".nojekyll", "");
if (BUILD_COMMIT) {
  write(".well-known/notchany-store.json", `${JSON.stringify({ registry_commit: BUILD_COMMIT })}\n`);
}
if (process.env.NOTCHANY_SITE_URL === "https://notchany.com") write("CNAME", "notchany.com\n");
write("404.html", notFoundPage({ css }));
console.log(`已生成 site/dist（2 个首页，2 个下载页，${packages.length * 2} 个详情页，counts=${COUNTS_URL || "未配置"}，app=${APP_DOWNLOAD_URL || "未配置"}）`);
