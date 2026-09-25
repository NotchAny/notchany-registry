import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { detailPage, downloadPage, homePage } from "../scripts/site-template.mjs";

const packages = ["cpu", "image", "wifi"].map((slug, index) => ({
  package_id: `owner/${slug}`,
  names: { "zh-Hans": `包 ${index + 1}`, en: `Package ${index + 1}` },
  summaries: { "zh-Hans": "摘要", en: "Summary" },
  descriptions: {},
  version: "1.0.0",
  tags: ["example"],
  license: "MIT",
  icon_path: `packages/owner/${slug}/icon.png`,
  kind: index === 1 ? "action" : "widget",
  action_kind: "shell",
  published_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  size_bytes: 100,
  requires: [],
  screenshots: [],
}));

test("home hero renders an interactive Mac desktop with live clock targets", () => {
  const html = homePage({
    lang: "zh",
    packages,
    featuredIDs: packages.map((item) => item.package_id),
    countsURL: "",
    css: "",
    js: "",
  });

  for (const marker of ["macbook", "mac-desktop", "keyboard-deck", "mac-menu-date", "mac-menu-time", "demo-notch"]) {
    assert.match(html, new RegExp(`(?:class|id)=\"[^\"]*${marker}`));
  }
  assert.equal((html.match(/class="demo-tray-item"/g) || []).length, 3);
  assert.equal((html.match(/class="mac-key"/g) || []).length, 77);
  assert.match(html, /<link rel="canonical" href="https:\/\/notchany\.com\/">/);
  assert.match(html, /href="https:\/\/account\.notchany\.com\/account\?lang=zh"/);
  assert.equal((html.match(/assets\/app-icon\.png\?v=balanced-20260925/g) || []).length, 4);
});

test("each hero tray icon links to its package detail page", () => {
  const html = homePage({
    lang: "en",
    packages,
    featuredIDs: packages.map((item) => item.package_id),
    countsURL: "",
    css: "",
    js: "",
  });

  for (const item of packages) {
    assert.match(html, new RegExp(`href=\"\.\./en/packages/${item.package_id}/\"`));
    assert.match(html, new RegExp(`src=\"\.\./assets/${item.icon_path.replaceAll("/", "\\/")}\"`));
  }
});

test("home navigation uses icon controls, a language menu, and two synchronized search targets", () => {
  const html = homePage({
    lang: "zh",
    packages,
    featuredIDs: packages.map((item) => item.package_id),
    countsURL: "",
    css: "",
    js: "",
  });

  assert.equal((html.match(/class="nav-icon-button/g) || []).length, 4);
  assert.match(html, /id="language-toggle"[^>]+aria-haspopup="menu"[^>]+aria-expanded="false"/);
  assert.match(html, /href="" role="menuitem" lang="zh-Hans" aria-current="page">中文<\/a>/);
  assert.match(html, /href="en\/" role="menuitem" lang="en">English<\/a>/);
  assert.equal((html.match(/data-store-search/g) || []).length, 2);
  assert.match(html, /id="library-search"/);
  assert.match(html, /id="result-count" aria-live="polite"/);
  assert.match(html, /class="nav-download-button" href="download\/" aria-label="下载 App"/);
});

test("detail navigation language menu preserves the package route", () => {
  const html = detailPage({ lang: "en", item: packages[0], packages, countsURL: "", css: "", js: "" });

  assert.match(html, /href="\.\.\/\.\.\/\.\.\/\.\.\/packages\/owner\/cpu\/" role="menuitem" lang="zh-Hans">中文<\/a>/);
  assert.match(html, /href="\.\.\/\.\.\/\.\.\/\.\.\/en\/packages\/owner\/cpu\/" role="menuitem" lang="en" aria-current="page">English<\/a>/);
});

test("download page keeps the release control disabled until a URL is configured", () => {
  const pending = downloadPage({ lang: "zh", css: "", js: "" });
  const ready = downloadPage({ lang: "en", css: "", js: "", downloadURL: "https://example.com/NotchAny.dmg" });

  assert.match(pending, /class="primary-button download-primary" type="button" disabled aria-disabled="true"/);
  assert.match(pending, /下载地址准备中/);
  assert.match(ready, /class="primary-button download-primary" href="https:\/\/example\.com\/NotchAny\.dmg"/);
  assert.match(ready, /Download NotchAny/);
  assert.match(ready, /href="\.\.\/\.\.\/download\/" role="menuitem" lang="zh-Hans"/);
  assert.match(ready, /href="\.\.\/\.\.\/en\/download\/" role="menuitem" lang="en" aria-current="page"/);
});

test("package deep links include a local download fallback", () => {
  const html = detailPage({ lang: "zh", item: packages[0], packages, countsURL: "", css: "", js: "" });

  assert.match(html, /id="open-in-notchany"[^>]+data-fallback-url="\.\.\/\.\.\/\.\.\/download\/"/);
  assert.doesNotMatch(html, /id="launch-help"/);
});

test("migrated releases without verified merge dates do not invent epoch dates", () => {
  for (const lang of ["zh", "en"]) {
    const html = detailPage({ lang, item: packages[0], packages,
      history: { releases: [{ version: "1.0.0", merged_at: null, pr: null, contributors: [] }] },
      countsURL: "", css: "", js: "" });
    assert.doesNotMatch(html, /1970|datetime="null"/);
    assert.match(html, /class="release"/);
  }
});

test("detail renders sanitized PR release notes and display-only history", () => {
  const history = {
    releases: [{
      version: "1.2.0",
      merged_at: "2026-09-10T00:00:00Z",
      source_commit: "abc123",
      sha256: "0".repeat(64),
      pr: {
        number: 42,
        url: "https://github.com/example/repo/pull/42",
        title: "Ship <img src=x onerror=alert(1)>",
        body: "**Fixed** `<unsafe>`\n\n- [safe](https://example.com/a)\n- [blocked](javascript:alert(1))\n\n<script>alert(1)</script>",
      },
      contributors: [{ github_user_id: "20", login: "helper", avatar_url: null }],
    }],
    contributors: [{ github_user_id: "20", login: "helper", avatar_url: null }],
  };
  const html = detailPage({
    lang: "en",
    item: packages[0],
    packages,
    history,
    marketAPIBase: "https://account.notchany.com",
    countsURL: "",
    css: "",
    js: "",
  });

  assert.match(html, /class="history-section"/);
  assert.match(html, /v1\.2\.0/);
  assert.match(html, /Ship &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<strong>Fixed<\/strong>/);
  assert.match(html, /<code>&lt;unsafe&gt;<\/code>/);
  assert.match(html, /href="https:\/\/example\.com\/a" target="_blank" rel="noopener"/);
  assert.match(html, /\[blocked\]\(javascript:alert\(1\)\)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /data-github-user-id="20"/);
  assert.doesNotMatch(html, /rollback|install-version|download-version/);

  const asideStart = html.indexOf('<aside class="side-info"');
  const article = html.slice(html.indexOf("<article>"), asideStart);
  const aside = html.slice(asideStart, html.indexOf("</aside>") + "</aside>".length);
  assert.doesNotMatch(article, /data-community-package|Collaboration & contributions/);
  assert.match(aside, /<section class="side-community"[^>]+data-community-package="owner\/cpu"/);
  assert.match(aside, /<h2>Collaboration & contributions<\/h2>/);
  assert.match(aside, /data-community-owner/);
  assert.match(aside, /data-community-maintainers/);
  assert.match(aside, /data-github-user-id="20"[\s\S]*?<small>Contributors/);
  assert.ok(aside.indexOf("side-community") < aside.indexOf("side-details"));
});

test("community display distinguishes unclaimed packages and replaces failed avatars", () => {
  const template = detailPage({
    lang: "zh",
    item: packages[0],
    packages,
    marketAPIBase: "https://account.notchany.com",
    countsURL: "",
    css: "",
    js: "",
  });
  const source = readFileSync(new URL("../site/store.js", import.meta.url), "utf8");

  assert.match(template, /"unclaimed":"待认领"/);
  assert.match(source, /if \(body\.owner\)/);
  assert.match(source, /unclaimed\.textContent = text\.unclaimed/);
  assert.match(source, /avatar\.naturalWidth === 0/);
  assert.match(source, /currentAvatar\?\.replaceWith\(image\)/);
});

test("mobile detail grids keep long content inside the viewport", () => {
  const source = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");

  assert.match(source, /\.detail-title \{ min-width: 0; \}/);
  assert.match(source, /\.detail-hero \{ grid-template-columns: 70px minmax\(0, 1fr\); gap: 16px; \}/);
  assert.match(source, /\.detail-layout \{ grid-template-columns: minmax\(0, 1fr\); gap: 38px; \}/);
  assert.match(source, /\.contributor-roster \{ display: grid; gap: 14px; \}/);
  assert.match(source, /\.side-community \.identity-list \{ display: grid; gap: 14px; \}/);
  assert.match(source, /\.profile-sidebar \.profile-avatar \{ width: 88px; height: 88px; border-radius: 50%; \}/);
});

test("notch intro is session-scoped and does not schedule repeating cycles", () => {
  const source = readFileSync(new URL("../site/store.js", import.meta.url), "utf8");

  assert.match(source, /sessionStorage\.getItem\(introStorageKey\)/);
  assert.match(source, /notchany-store-intro/);
  assert.doesNotMatch(source, /scheduleCycle/);
});

test("pressing Enter in either search reveals the catalog", () => {
  const source = readFileSync(new URL("../site/store.js", import.meta.url), "utf8");

  assert.match(source, /event\.key !== "Enter"/);
  assert.match(source, /requestAnimationFrame\(revealCatalog\)/);
  assert.match(source, /behavior: reducedMotion \? "auto" : "smooth"/);
});

test("typing hides the hero shortcut hint so the native clear button stays usable", () => {
  const source = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");

  assert.match(source, /input:not\(:placeholder-shown\) ~ \.search-key \{ opacity: 0; \}/);
  assert.match(source, /pointer-events: none/);
});

test("failed app launches redirect to the download guide", () => {
  const source = readFileSync(new URL("../site/store.js", import.meta.url), "utf8");

  assert.match(source, /launch\.dataset\.fallbackUrl/);
  assert.match(source, /location\.assign\(fallbackURL\)/);
  assert.match(source, /!document\.hidden && document\.hasFocus\(\)/);
  assert.match(source, /addEventListener\("blur", cancel/);
});
