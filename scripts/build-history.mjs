#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { historyDocument } from "./history-lib.mjs";
import { readState } from "./publication-lib.mjs";

// 公开历史只追加发布状态中的版本，候选源码的 manifest 变化不构成发布事实。
const publication = readState();
for (const [id, item] of Object.entries(publication.packages)) {
  if (!item.release) continue;
  const path = join("history/v1", `${id}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path,"utf8")) : { releases: [] };
  const releases = existing.releases || [];
  const same = releases.find(r => r.version === item.release.version);
  if (same && same.sha256 !== item.release.sha256) throw new Error(`Published version reused: ${id}`);
  if (!same) releases.push(item.release);
  mkdirSync(dirname(path),{ recursive: true });
  writeFileSync(path,JSON.stringify(historyDocument(id,releases),null,2)+"\n");
}
console.log("Published history verified");
