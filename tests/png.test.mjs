import test from "node:test";
import assert from "node:assert/strict";

import { readPngDimensions } from "../scripts/png.mjs";

test("reads PNG dimensions from IHDR", () => {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(512, 16);
  bytes.writeUInt32BE(256, 20);
  assert.deepEqual(readPngDimensions(bytes), { width: 512, height: 256 });
});

test("rejects non-PNG and truncated files", () => {
  assert.throws(() => readPngDimensions(Buffer.from("not png")), /不完整/);
  assert.throws(() => readPngDimensions(Buffer.alloc(24)), /文件签名/);
});
