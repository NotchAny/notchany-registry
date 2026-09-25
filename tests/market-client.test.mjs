import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { signedMarketPost } from "../scripts/market-client.mjs";

test("Market client fails closed without config or when service is unavailable", async () => {
  await assert.rejects(() => signedMarketPost("/internal/test", {}, {}), /缺少 MARKET_API_BASE/);
  await assert.rejects(() => signedMarketPost(
    "/internal/test",
    {},
    { MARKET_API_BASE: "https://market.test", MARKET_INTERNAL_HMAC_SECRET: "secret" },
    { fetcher: async () => { throw new Error("offline"); } },
  ), /offline/);
});

test("Market client signs the timestamp and exact JSON body", async () => {
  const secret = "test-secret";
  let captured;
  const result = await signedMarketPost(
    "/internal/test",
    { package_id: "alice/tool" },
    { MARKET_API_BASE: "https://market.test/", MARKET_INTERNAL_HMAC_SECRET: secret },
    {
      now: () => 1_700_000_000_000,
      fetcher: async (url, options) => {
        captured = { url, options };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );
  const body = JSON.stringify({ package_id: "alice/tool" });
  assert.deepEqual(result, { ok: true });
  assert.equal(captured.url, "https://market.test/internal/test");
  assert.equal(captured.options.headers["X-NotchAny-Timestamp"], "1700000000");
  assert.equal(
    captured.options.headers["X-NotchAny-Signature"],
    createHmac("sha256", secret).update(`1700000000.${body}`).digest("hex"),
  );
});
