/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the analysis runs: "local" (this browser, default) or "remote" (the server's /api/analytics routes). See src/analytics. */
  readonly VITE_AEI_ANALYTICS?: string;
}
