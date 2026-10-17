import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The API (apps/api) runs on its own port; the dev server proxies /api to it
// so the browser sees one origin. AEI_API_URL points it elsewhere.
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // React changes only with an upgrade, so its own chunk stays cached while the app's code changes.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/notebook/api/contents/projects/": {
        target: process.env.AEI_API_URL ?? "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace("/notebook/api/contents/projects/", "/api/lite/contents/projects/"),
      },
      "/notebook/files/projects/": {
        target: process.env.AEI_API_URL ?? "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace("/notebook/files/projects/", "/api/lite/files/projects/"),
      },
      "/api": { target: process.env.AEI_API_URL ?? "http://localhost:8787", changeOrigin: true },
    },
  },
});
