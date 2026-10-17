// Run from the repository root: node --experimental-strip-types scripts/sync-methods-registry.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { registryJson } from "../libs/utils/methods/src/index.ts";

const snapshot = execFileSync("pnpm", ["exec", "biome", "format", "--stdin-file-path=libs/utils/methods/registry.json"], {
  input: registryJson(),
  encoding: "utf8",
  cwd: new URL("..", import.meta.url),
});

for (const path of ["libs/utils/methods/registry.json", "libs/utils/py/aei/registry.json", "libs/utils/r/inst/registry.json"]) {
  mkdirSync(new URL(".", new URL(`../${path}`, import.meta.url)), { recursive: true });
  writeFileSync(new URL(`../${path}`, import.meta.url), snapshot);
}
