import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./styles.css";
import "./motion.css";
import "./soft.css";
import "./ai.css";

// A deploy replaces the hashed page chunks; a tab opened before it would fail to load the next page. Reload instead,
// once per minute at most, so a chunk that is really missing cannot loop.
addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("aei.reloadedAt") ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("aei.reloadedAt", String(Date.now()));
  } catch {
    // storage blocked: reload anyway, the boundary catches a second failure
  }
  event.preventDefault();
  location.reload();
});

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
