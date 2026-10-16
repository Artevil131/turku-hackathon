import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The API (apps/api) runs on its own port; the dev server proxies /api to it
// so the browser sees one origin. AEI_API_URL points it elsewhere.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.AEI_API_URL ?? "http://localhost:8787", changeOrigin: true } },
  },
});
