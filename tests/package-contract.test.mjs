import test from "node:test";
import assert from "node:assert/strict";
import { packageContractProblems } from "../scripts/package-contract.mjs";

const envelope = (version, fields) => ({ notchany_export: version, action: { id: "custom", kind: "shell", input_kind: "none", ...fields } });
test("current exports v7 through v9 and legacy exports are accepted", () => {
  for (const value of [envelope(2, {}), envelope(7, { requires: ["jq"], dependency_hints: { jq: { brew: "jq" } }, env_requires: [{ key: "API_TOKEN", secret: true }] }),
    envelope(8, { widget: { wants_text_input: true } }), envelope(9, { input_kind: "filesOnly", accepts: { extensions: ["png"], count: "single" } })]) {
    assert.deepEqual(packageContractProblems(value), []);
  }
});
test("capabilities cannot understate their minimum export version", () => {
  for (const value of [envelope(6, { env_requires: [{ key: "API_TOKEN" }] }), envelope(7, { widget: { wants_text_input: true } }),
    envelope(8, { input_kind: "filesOnly", accepts: {} })]) assert.ok(packageContractProblems(value).length);
});
test("private values, reserved environment keys and undeclared install hints are rejected", () => {
  for (const fields of [{ parameter_values: {} }, { env_requires: [{ key: "NOTCH_PRIVATE" }] },
    { env_requires: [{ key: "TOKEN", value: "private" }] }, { dependency_hints: { jq: { brew: "other/tap/jq" } } },
    { accepts: {} }]) assert.ok(packageContractProblems(envelope(9, fields)).length);
});
