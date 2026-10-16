import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The app reads everything from a data feed over HTTP (src/feed). In
// development the feed runs on its own port and Vite proxies /api to it, so
// the browser sees one origin. AEI_FEED_URL points it at another feed.
//
// Optional AI layer (src/ai): a small OpenAI-compatible language model
// (llama.cpp server) behind Cloudflare Access. Its URL, model name and the
// Access service token are secrets: they are read here, on the dev server,
// from ../../.env.ai (gitignored) or from the same variables in the
// environment, and never reach the browser (no VITE_ prefix, no `define`).
// The browser calls /llm/v1/...; the proxy adds the Access headers on the
// server side. Without the variables there is no /llm route and the app
// reports the AI layer as off.
//
// Production: a static build has no dev server, so a deployment that wants
// the AI layer needs the same small server-side proxy (any reverse proxy or
// serverless function): forward only GET /llm/v1/models and
// POST /llm/v1/chat/completions to AEI_LLM_URL/v1/..., adding the
// CF-Access-Client-Id and CF-Access-Client-Secret headers there.

interface LlmConfig {
  url: string;
  model?: string;
  accessId?: string;
  accessSecret?: string;
}

const LLM_KEYS = ["AEI_LLM_URL", "AEI_LLM_MODEL", "AEI_LLM_ACCESS_ID", "AEI_LLM_ACCESS_SECRET"] as const;

/** KEY=value lines; comments and blank lines skipped; surrounding quotes removed. */
function readEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value) out[key] = value;
  }
  return out;
}

function llmConfig(): LlmConfig | null {
  const file = readEnvFile(fileURLToPath(new URL("../../.env.ai", import.meta.url)));
  const get = (key: (typeof LLM_KEYS)[number]) => process.env[key]?.trim() || file[key];
  const url = get("AEI_LLM_URL");
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return {
    // The proxy maps /llm/v1/... to <url>/v1/..., so a URL given with /v1 is trimmed.
    url: url.replace(/\/+$/, "").replace(/\/v1$/i, ""),
    model: get("AEI_LLM_MODEL"),
    accessId: get("AEI_LLM_ACCESS_ID"),
    accessSecret: get("AEI_LLM_ACCESS_SECRET"),
  };
}

const llm = llmConfig();

/** Only the two calls the app makes go through; anything else under /llm is a 404. */
function allowedLlmCall(req: IncomingMessage): boolean {
  const path = (req.url ?? "").split("?")[0];
  return (
    (req.method === "GET" && path === "/llm/v1/models") ||
    (req.method === "POST" && path === "/llm/v1/chat/completions")
  );
}

const accessHeaders: Record<string, string> = {};
if (llm?.accessId) accessHeaders["CF-Access-Client-Id"] = llm.accessId;
if (llm?.accessSecret) accessHeaders["CF-Access-Client-Secret"] = llm.accessSecret;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.AEI_FEED_URL ?? "http://localhost:8787", changeOrigin: true },
      ...(llm
        ? {
            "/llm": {
              target: llm.url,
              changeOrigin: true,
              secure: true,
              proxyTimeout: 30_000,
              timeout: 30_000,
              rewrite: (path: string) => path.replace(/^\/llm/, ""),
              headers: accessHeaders,
              bypass: (req: IncomingMessage) => (allowedLlmCall(req) ? undefined : false),
              configure: (proxy) => {
                proxy.on("proxyReq", (proxyReq) => {
                  // The browser's cookies and credentials are not the model's business.
                  proxyReq.removeHeader("cookie");
                  proxyReq.removeHeader("authorization");
                  for (const [name, value] of Object.entries(accessHeaders)) proxyReq.setHeader(name, value);
                });
                proxy.on("proxyRes", (proxyRes, req) => {
                  // Access session cookies stay between the proxy and Cloudflare.
                  delete proxyRes.headers["set-cookie"];
                  // The configured model name (not a secret: /v1/models lists it too), so the
                  // app can prefer it when the server lists several.
                  if (llm.model && req.url?.endsWith("/v1/models")) proxyRes.headers["x-aei-model"] = llm.model;
                });
              },
            },
          }
        : {}),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
