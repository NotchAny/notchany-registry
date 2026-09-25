// 公开 Store 的交付层。页面内容只来自构建好的 Static Assets；Worker 只负责
// 规范域名、方法约束、缓存和安全响应头，不读取 Registry 候选目录或商业数据。

const STORE_ORIGIN = "https://notchany.com";

const HTML_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://account.notchany.com https://notchany-market.glzlaohuai.workers.dev",
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function cacheControl(response, contentType) {
  const noTransform = contentType.includes("text/html") ? ", no-transform" : "";
  if (response.status >= 400) return `public, max-age=60${noTransform}`;
  if (contentType.includes("text/html")) {
    return "public, max-age=300, stale-while-revalidate=86400, no-transform";
  }
  return "public, max-age=3600, stale-while-revalidate=86400";
}

function hardened(response) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("Content-Type") ?? "";
  headers.set("Cache-Control", cacheControl(response, contentType));
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (contentType.includes("text/html")) headers.set("Content-Security-Policy", HTML_CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function redirectToCanonical(url) {
  const target = new URL(url.pathname + url.search, STORE_ORIGIN);
  return hardened(new Response(null, {
    status: 308,
    headers: { Location: target.toString() },
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === "www.notchany.com") return redirectToCanonical(url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return hardened(new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
      }));
    }
    return hardened(await env.ASSETS.fetch(request));
  },
};
