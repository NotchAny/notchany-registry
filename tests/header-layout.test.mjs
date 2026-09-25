import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

test("共享页头为短页面预留滚动条槽", () => {
  const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");

  assert.match(styles, /html\s*\{[^}]*scrollbar-gutter:\s*stable;/s);
});
