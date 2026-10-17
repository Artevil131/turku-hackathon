/// <reference types="vite/client" />

/** Whether /llm leads to a language model: set by vite.config.ts (the dev proxy, or AEI_LLM_PROXY=1 for a build). */
declare const __AEI_LLM__: boolean | undefined;
