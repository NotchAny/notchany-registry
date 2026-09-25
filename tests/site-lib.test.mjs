import test from "node:test";
import assert from "node:assert/strict";

import {
  catalogPage,
  iconDescriptor,
  parseCatalogState,
  pick,
  relatedPackages,
  searchText,
  validateCuration,
} from "../scripts/site-lib.mjs";

const packages = [
  {
    package_id: "alice/cpu",
    kind: "widget",
    names: { "zh-Hans": "CPU 占用", en: "CPU Usage" },
    summaries: { "zh-Hans": "实时处理器指标", en: "Live processor metric" },
    tags: ["system", "monitor"],
    published_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-03T00:00:00Z",
  },
  {
    package_id: "bob/image-jpg",
    kind: "action",
    names: { "zh-Hans": "图片转 JPG", en: "Image to JPG" },
    summaries: { "zh-Hans": "批量转换图片", en: "Convert images in batches" },
    tags: ["image", "files"],
    published_at: "2026-08-02T00:00:00Z",
    updated_at: "2026-08-02T00:00:00Z",
  },
  {
    package_id: "alice/memory",
    kind: "widget",
    names: { "zh-Hans": "内存占用", en: "Memory Usage" },
    summaries: { "zh-Hans": "实时内存指标", en: "Live memory metric" },
    tags: ["system", "monitor"],
    published_at: "2026-08-03T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
  },
];

test("pick follows zh then en fallback", () => {
  assert.equal(pick({ "zh-Hans": "中文", en: "English" }, "zh"), "中文");
  assert.equal(pick({ "zh-Hans": "中文", en: "English" }, "en"), "English");
  assert.equal(pick({ ja: "日本語" }, "en"), "日本語");
});

test("curation rejects unknown, duplicate, and oversized featured lists", () => {
  assert.deepEqual(validateCuration({ featured: ["alice/cpu"] }, packages), ["alice/cpu"]);
  assert.throws(() => validateCuration({ featured: ["missing/pkg"] }, packages), /未知/);
  assert.throws(() => validateCuration({ featured: ["alice/cpu", "alice/cpu"] }, packages), /重复/);
  assert.throws(
    () => validateCuration({ featured: ["alice/cpu", "bob/image-jpg", "alice/memory", "four/pkg"] }, [...packages, { package_id: "four/pkg" }]),
    /最多 3/
  );
});

test("search text includes both locales, author, package id, and tags", () => {
  const text = searchText(packages[0]);
  for (const fragment of ["cpu 占用", "cpu usage", "alice", "alice/cpu", "monitor"]) {
    assert.ok(text.includes(fragment));
  }
});

test("catalog filters, sorts, and paginates deterministically", () => {
  const counts = { "alice/cpu": 9, "bob/image-jpg": 20, "alice/memory": 9 };
  const recent = catalogPage(packages, { q: "", sort: "recent", kind: "all", tag: "", page: 1 }, counts, 2);
  assert.deepEqual(recent.items.map((item) => item.package_id), ["alice/memory", "bob/image-jpg"]);
  assert.equal(recent.pageCount, 2);

  const popular = catalogPage(packages, { q: "", sort: "popular", kind: "all", tag: "", page: 1 }, counts, 12);
  assert.deepEqual(popular.items.map((item) => item.package_id), ["bob/image-jpg", "alice/memory", "alice/cpu"]);

  const filtered = catalogPage(packages, { q: "memory", sort: "all", kind: "widget", tag: "system", page: 5 }, counts, 12);
  assert.deepEqual(filtered.items.map((item) => item.package_id), ["alice/memory"]);
  assert.equal(filtered.page, 1);
});

test("query state ignores unsupported values and clamps page", () => {
  const state = parseCatalogState(new URLSearchParams("q=cpu&sort=nope&kind=widget&tag=system&page=-2"));
  assert.deepEqual(state, { q: "cpu", sort: "all", kind: "widget", tag: "system", page: 1 });
});

test("related packages prefer shared tags and exclude the current package", () => {
  assert.deepEqual(
    relatedPackages(packages[0], packages, { "alice/memory": 5, "bob/image-jpg": 100 }).map((item) => item.package_id),
    ["alice/memory"]
  );
});

test("missing icon uses a deterministic kind fallback", () => {
  assert.deepEqual(iconDescriptor({ package_id: "alice/cpu", kind: "widget" }), {
    type: "fallback",
    value: "widget",
  });
  assert.deepEqual(iconDescriptor({ package_id: "alice/cpu", kind: "widget", icon_path: "packages/alice/cpu/icon.png" }), {
    type: "image",
    value: "packages/alice/cpu/icon.png",
  });
});
