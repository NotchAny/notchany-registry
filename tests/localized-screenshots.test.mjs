import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { hash, treeHash, verifyPublishedIndex } from "../scripts/publication-lib.mjs";

const icon = readFileSync(resolve("tests/fixtures/icon.png"));
const action = JSON.stringify({ notchany_export: 2, action: { id: "notchany.custom.shell.localized", name: "Localized", kind: "shell", input_kind: "none", script: "true" } });

function drillRepo(t, prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(resolve("scripts"), join(root, "scripts"), { recursive: true });
  const put = (path, value) => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), value); };
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return { root, put, git };
}

test("check-pr accepts a single primary-language summary and per-language screenshot sets", t => {
  const { root, put } = drillRepo(t, "market-localized-check-");
  const dir = "packages/alice/localized";
  const manifest = { manifest_version: 1, names: { ja: "ローカライズ" }, summaries: { ja: "日本語だけの概要" }, version: "1.0.0", license: "MIT" };
  put(`${dir}/package.notchany.json`, action);
  put(`${dir}/icon.png`, icon);
  put(`${dir}/LICENSE`, "MIT License\nCopyright (c) Test fixture authors\n");
  const saveManifest = () => put(`${dir}/manifest.json`, JSON.stringify(manifest));
  const check = () => spawnSync(process.execPath, ["scripts/check-pr.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, SKIP_MARKET_AUTH: "1" } });
  const expectPass = () => { const result = check(); assert.equal(result.status, 0, result.stdout + result.stderr); };
  const expectFail = pattern => { const result = check(); assert.notEqual(result.status, 0); assert.match(result.stdout + result.stderr, pattern); };

  // 旧形状：只有一种语言的摘要、没有 default_locale、截图平铺
  saveManifest();
  for (const index of [1, 2, 3]) put(`${dir}/screenshots/${index}.png`, icon);
  expectPass();

  // 语言子目录要求 default_locale
  for (const index of [1, 2, 3, 4]) put(`${dir}/screenshots/en/${index}.png`, icon);
  expectFail(/需要 manifest 声明 default_locale/);

  // 每组各自计数：主语言 3 + en 4 合法
  manifest.default_locale = "ja";
  saveManifest();
  expectPass();

  manifest.default_locale = "zh-Hans";
  saveManifest();
  expectFail(/summaries 缺少主语言 zh-Hans 的摘要/);
  manifest.default_locale = "not a code";
  saveManifest();
  expectFail(/default_locale 必须是合法语言码/);
  manifest.default_locale = "ja";
  saveManifest();

  put(`${dir}/screenshots/en/5.png`, icon);
  expectFail(/en\/截图最多 4 张/);
  rmSync(join(root, dir, "screenshots/en/5.png"));

  put(`${dir}/screenshots/JA/1.png`, icon);
  expectFail(/主语言 JA 的截图应直接放在 screenshots\/ 下/);
  rmSync(join(root, dir, "screenshots/JA"), { recursive: true });

  put(`${dir}/screenshots/en_US/1.png`, icon);
  expectFail(/截图子目录 en_US 不是合法语言码/);
  rmSync(join(root, dir, "screenshots/en_US"), { recursive: true });

  put(`${dir}/screenshots/en/deep/1.png`, icon);
  expectFail(/只允许一层语言子目录/);
  rmSync(join(root, dir, "screenshots/en/deep"), { recursive: true });

  put(`${dir}/screenshots/en/notes.txt`, "x");
  expectFail(/en\/notes\.txt 只允许 PNG\/JPEG/);
  rmSync(join(root, dir, "screenshots/en/notes.txt"));
  expectPass();
});

test("build-index publishes default_locale and localized_screenshots that pass snapshot verification", t => {
  const { root, put, git } = drillRepo(t, "market-localized-index-");
  const packageID = "alice/localized";
  const manifest = { manifest_version: 1, names: { ja: "ローカライズ", en: "Localized" }, summaries: { ja: "概要" }, version: "1.0.0", license: "MIT", default_locale: "ja" };
  const packageAction = JSON.stringify({ notchany_export: 10, action: {
    id: "notchany.custom.shell.localized", name: "Localized", kind: "shell", input_kind: "none", script: "true",
    fullscreen_effect: { source: { html: "<main></main>", css: "", javascript: "", default_duration_ms: 2300 } },
  } });
  const files = {
    "package.notchany.json": Buffer.from(packageAction),
    "manifest.json": Buffer.from(JSON.stringify(manifest)),
    "icon.png": icon,
    "screenshots/1.png": icon,
    "screenshots/2.png": icon,
    "screenshots/en/1.png": icon,
    "screenshots/zh-Hans/1.png": icon,
  };
  for (const [path, bytes] of Object.entries(files)) put(`packages/${packageID}/${path}`, bytes);
  git("init", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com"); git("add", "."); git("commit", "-m", "source");
  const release = { version: "1.0.0", sha256: hash(packageAction), source_commit: git("rev-parse", "HEAD"), merged_at: null, pr: null, contributors: [] };
  for (const [path, bytes] of Object.entries(files)) put(`published/${packageID}/${path}`, bytes);
  put("published/state.json", JSON.stringify({ schema: 1, packages: { [packageID]: { active: true, source_commit: release.source_commit, tree_hash: treeHash(files), release } }, decisions: [] }));
  put(`history/v1/${packageID}.json`, JSON.stringify({ history_schema: 1, package_id: packageID, releases: [release], contributors: [] }));
  execFileSync(process.execPath, ["scripts/build-index.mjs"], { cwd: root });

  const index = JSON.parse(readFileSync(join(root, "index/v1/index.json"), "utf8"));
  const entry = index.packages.find(item => item.package_id === packageID);
  assert.equal(entry.default_locale, "ja");
  assert.equal(entry.has_fullscreen_effect, true);
  // manifest 未写 tags：已发版 App 把 tags 按必填解码，双索引都必须落空数组。
  assert.deepEqual(entry.tags, []);
  assert.deepEqual(JSON.parse(readFileSync(join(root, "index/v2/index.json"), "utf8")).packages[0].tags, []);
  // 主语言组保持平铺，旧 App 照读
  assert.deepEqual(entry.screenshots, [`published/${packageID}/screenshots/1.png`, `published/${packageID}/screenshots/2.png`]);
  assert.deepEqual(entry.localized_screenshots, {
    en: [`published/${packageID}/screenshots/en/1.png`],
    "zh-Hans": [`published/${packageID}/screenshots/zh-Hans/1.png`],
  });
  assert.doesNotThrow(() => verifyPublishedIndex(index, root));

  const tampered = structuredClone(index);
  tampered.packages[0].localized_screenshots.en = ["published/alice/other/screenshots/en/1.png"];
  assert.throws(() => verifyPublishedIndex(tampered, root), /Invalid published asset path/);
});
