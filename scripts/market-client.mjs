import { createHmac } from "node:crypto";

export async function signedMarketPost(path, body, env = process.env, options = {}) {
  const base = env.MARKET_API_BASE?.trim().replace(/\/+$/, "");
  const secret = env.MARKET_INTERNAL_HMAC_SECRET?.trim();
  if (!base || !secret) throw new Error("缺少 MARKET_API_BASE 或 MARKET_INTERNAL_HMAC_SECRET");
  const bodyText = JSON.stringify(body);
  const timestamp = String(Math.floor((options.now?.() ?? Date.now()) / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${bodyText}`).digest("hex");
  const response = await (options.fetcher ?? fetch)(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NotchAny-Timestamp": timestamp,
      "X-NotchAny-Signature": signature,
    },
    body: bodyText,
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Market ${path} 返回 ${response.status} ${result.code || "unknown"}`);
  }
  return result;
}
