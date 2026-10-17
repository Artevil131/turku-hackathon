import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CodeMaps } from "@aei/ingest";
import { buildRegistry, parseSitesFile, type RegistryOptions, type SiteRegistry, SitesFileError } from "./index.ts";

// Reading a sites file from disk (D-051), for servers. Separate from the
// main entry so that entry stays usable in a browser.

export interface LoadedSites {
  registry: SiteRegistry;
  /** Things worth saying at startup that do not stop the server, e.g. a token file others can read. */
  notes: string[];
}

/**
 * The registry from the sites file at `path`, with each site's code map read
 * relative to the file. Without a path, the home site alone. Throws
 * `SitesFileError` (every problem listed) when the file cannot be used.
 */
export function loadSites(path: string | undefined, options: Omit<RegistryOptions, "codeMaps"> = {}): LoadedSites {
  if (!path) return { registry: buildRegistry(undefined, options), notes: [] };
  const file = resolve(path);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new SitesFileError([`${file}: ${error instanceof Error ? error.message : String(error)}`]);
  }
  const sites = parseSitesFile(json, options.home);
  const codeMaps: Record<string, Partial<CodeMaps>> = {};
  const problems: string[] = [];
  for (const s of sites.sites) {
    if (!s.codeMap) continue;
    const mapFile = resolve(dirname(file), s.codeMap);
    try {
      codeMaps[s.id] = JSON.parse(readFileSync(mapFile, "utf8")) as Partial<CodeMaps>;
    } catch (error) {
      problems.push(`site "${s.id}": code map ${mapFile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (problems.length) throw new SitesFileError(problems);
  const notes: string[] = [];
  const mode = statSync(file).mode & 0o777;
  if (sites.sites.some((s) => s.token) && mode & 0o077)
    notes.push(`${file} holds tokens and is readable by others (mode ${mode.toString(8)}); chmod 600 it`);
  return { registry: buildRegistry(sites, { ...options, codeMaps }), notes };
}
