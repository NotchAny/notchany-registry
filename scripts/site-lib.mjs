export function pick(table, language) {
  if (!table || typeof table !== "object") return "";
  const stableFallback = Object.keys(table).sort().map((key) => table[key]).find((value) => typeof value === "string") ?? "";
  if (language === "zh") {
    return table["zh-Hans"] ?? table.zh ?? table["zh-Hant"] ?? table.en ?? stableFallback;
  }
  return table.en ?? table["zh-Hans"] ?? table.zh ?? stableFallback;
}

export function validateCuration(curation, packages) {
  const featured = Array.isArray(curation?.featured) ? curation.featured : [];
  if (featured.length > 3) throw new Error("精选包最多 3 个");
  if (new Set(featured).size !== featured.length) throw new Error("精选包 ID 不得重复");
  const known = new Set(packages.map((item) => item.package_id));
  for (const packageID of featured) {
    if (!known.has(packageID)) throw new Error(`精选配置包含未知包：${packageID}`);
  }
  return featured;
}

export function searchText(packageItem) {
  const owner = String(packageItem.package_id ?? "").split("/")[0] ?? "";
  return [
    packageItem.package_id,
    owner,
    packageItem.version,
    ...Object.values(packageItem.names ?? {}),
    ...Object.values(packageItem.summaries ?? {}),
    ...(packageItem.tags ?? []),
  ].join(" ").toLocaleLowerCase();
}

export function parseCatalogState(params) {
  const sort = ["all", "recent", "popular"].includes(params.get("sort")) ? params.get("sort") : "all";
  const kind = ["all", "widget", "action"].includes(params.get("kind")) ? params.get("kind") : "all";
  const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").trim(),
    sort,
    kind,
    tag: (params.get("tag") ?? "").trim().toLocaleLowerCase(),
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function timestamp(value) {
  const result = Date.parse(value ?? "");
  return Number.isFinite(result) ? result : 0;
}

function compareStable(a, b) {
  return String(a.package_id).localeCompare(String(b.package_id), "en");
}

export function catalogPage(packages, state, counts = {}, pageSize = 12) {
  const query = String(state.q ?? "").trim().toLocaleLowerCase();
  const tag = String(state.tag ?? "").trim().toLocaleLowerCase();
  const filtered = packages.filter((item) => {
    if (state.kind !== "all" && item.kind !== state.kind) return false;
    if (tag && !(item.tags ?? []).some((value) => value.toLocaleLowerCase() === tag)) return false;
    return !query || searchText(item).includes(query);
  });

  filtered.sort((a, b) => {
    if (state.sort === "recent") {
      return timestamp(b.published_at) - timestamp(a.published_at) || compareStable(a, b);
    }
    if (state.sort === "popular") {
      return (counts[b.package_id] ?? 0) - (counts[a.package_id] ?? 0)
        || timestamp(b.updated_at) - timestamp(a.updated_at)
        || compareStable(a, b);
    }
    return compareStable(a, b);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(Number(state.page) || 1, 1), pageCount);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageCount,
  };
}

export function relatedPackages(current, packages, counts = {}, limit = 3) {
  const currentTags = new Set(current.tags ?? []);
  return packages
    .filter((item) => item.package_id !== current.package_id)
    .map((item) => ({
      item,
      shared: (item.tags ?? []).filter((tag) => currentTags.has(tag)).length,
    }))
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared
      || (counts[b.item.package_id] ?? 0) - (counts[a.item.package_id] ?? 0)
      || compareStable(a.item, b.item))
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function iconDescriptor(packageItem) {
  if (packageItem.icon_path) return { type: "image", value: packageItem.icon_path };
  return { type: "fallback", value: packageItem.kind === "widget" ? "widget" : "action" };
}
