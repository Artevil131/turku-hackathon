import { DEFAULT_GUIDE, HOME_SITE, type Site, type SiteId, siteOfWard as siteOfCode, WARDS, type Ward, type WardCode } from "@aei/domain";
import { type CodeMaps, DEFAULT_CODE_MAPS, extendCodeMaps, type IngestResult, wardCodeMap } from "@aei/ingest";

// Sites (D-051): the hospitals connected to one server. The home site is the
// dataset's hospital and is defined in code; other sites come from a sites
// file. Each site sends with its own bearer token; its units are stored
// qualified as `<siteId>/<code>` so two hospitals may both have an "ICU".
// This gear validates the file, builds the ward registry, resolves a token to
// a site and qualifies what a site sends. Reading the file from disk is in
// `@aei/sites/node`, so this entry also runs in a browser.

/** The regions of the regional data (`data/external/thl/regional.json`), the keys a site's `county` must use. */
export const COUNTIES: readonly string[] = [
  "Ahvenanmaa",
  "Etelä-Karjalan hyvinvointialue",
  "Etelä-Pohjanmaan hyvinvointialue",
  "Etelä-Savon hyvinvointialue",
  "Helsingin kaupunki",
  "Itä-Uudenmaan hyvinvointialue",
  "Kainuun hyvinvointialue",
  "Kanta-Hämeen hyvinvointialue",
  "Keski-Pohjanmaan hyvinvointialue",
  "Keski-Suomen hyvinvointialue",
  "Keski-Uudenmaan hyvinvointialue",
  "Kymenlaakson hyvinvointialue",
  "Lapin hyvinvointialue",
  "Länsi-Uudenmaan hyvinvointialue",
  "Pirkanmaan hyvinvointialue",
  "Pohjanmaan hyvinvointialue",
  "Pohjois-Karjalan hyvinvointialue",
  "Pohjois-Pohjanmaan hyvinvointialue",
  "Pohjois-Savon hyvinvointialue",
  "Päijät-Hämeen hyvinvointialue",
  "Satakunnan hyvinvointialue",
  "Vantaan ja Keravan hyvinvointialue",
  "Varsinais-Suomen hyvinvointialue",
];

/** A unit as the sites file registers it: the site's own code, without the site. */
export interface SiteWardEntry {
  code: string;
  fi: string;
  en: string;
  type: "in" | "out";
  institution: "hospital" | "primary_care";
}

/** One site in the sites file. The home site may be listed to give it a token; its names and county are then optional. */
export interface SiteEntry {
  id: SiteId;
  fi: string;
  en: string;
  county: string;
  /** The shared secret the site sends as `Authorization: Bearer <token>`. */
  token?: string;
  wards: SiteWardEntry[];
  /** A code map file (see @aei/ingest CodeMaps), relative to the sites file, merged over the THL defaults for this site only. */
  codeMap?: string;
  /** The id of the treatment guide table the site uses (D-047); "varha" when not given. Not the `guideline` below. */
  guide?: string;
  /** The breakpoint guideline label recorded on the site's results (like AEI_GUIDELINE). */
  guideline?: string;
}

export interface SitesFile {
  sites: SiteEntry[];
}

/** A sites file that cannot be used; `problems` lists every reason, so one run shows them all. */
export class SitesFileError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid sites file:\n  - ${problems.join("\n  - ")}`);
    this.name = "SitesFileError";
    this.problems = problems;
  }
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Checks a parsed sites file and returns it typed; throws `SitesFileError` listing every problem. */
export function parseSitesFile(json: unknown, home: Site = HOME_SITE): SitesFile {
  const problems: string[] = [];
  if (!isObject(json) || !Array.isArray(json.sites)) throw new SitesFileError(['the file must be an object with a "sites" array']);
  const ids = new Set<string>();
  const tokens = new Map<string, string>();
  const homeCodes = new Set(WARDS.map((w) => w.code));
  const sites: SiteEntry[] = [];
  for (const [i, raw] of (json.sites as unknown[]).entries()) {
    const where = `sites[${i}]`;
    if (!isObject(raw)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    const id = raw.id;
    if (!nonEmpty(id) || !ID.test(id)) {
      problems.push(`${where}: "id" must be lower-case letters, digits and "-"`);
      continue;
    }
    const at = `site "${id}"`;
    if (ids.has(id)) problems.push(`${at}: duplicate id`);
    ids.add(id);
    const isHome = id === home.id;
    for (const key of ["fi", "en", "county"] as const)
      if (raw[key] !== undefined ? !nonEmpty(raw[key]) : !isHome) problems.push(`${at}: "${key}" is required`);
    if (nonEmpty(raw.county) && !COUNTIES.includes(raw.county))
      problems.push(`${at}: unknown county "${raw.county}" (use a region name of the regional data, e.g. "Satakunnan hyvinvointialue")`);
    if (raw.token !== undefined) {
      if (!nonEmpty(raw.token)) problems.push(`${at}: "token" must be a non-empty string`);
      else if (tokens.has(raw.token)) problems.push(`${at}: same token as site "${tokens.get(raw.token)}"`);
      else tokens.set(raw.token, id);
    }
    if (raw.guide !== undefined && !nonEmpty(raw.guide)) problems.push(`${at}: "guide" must be a non-empty string`);
    for (const key of ["codeMap", "guideline"] as const)
      if (raw[key] !== undefined && typeof raw[key] !== "string") problems.push(`${at}: "${key}" must be a string`);
    if (raw.wards === undefined && !isHome) problems.push(`${at}: "wards" is required`);
    else if (raw.wards !== undefined && !Array.isArray(raw.wards)) problems.push(`${at}: "wards" must be an array`);
    const codes = new Set<string>();
    const wards: SiteWardEntry[] = [];
    for (const [j, w] of (Array.isArray(raw.wards) ? raw.wards : []).entries()) {
      const wAt = `${at} wards[${j}]`;
      if (!isObject(w)) {
        problems.push(`${wAt}: not an object`);
        continue;
      }
      if (!nonEmpty(w.code) || w.code.includes("/")) problems.push(`${wAt}: "code" is required and may not contain "/"`);
      else if (codes.has(w.code)) problems.push(`${at}: duplicate ward code "${w.code}"`);
      else if (isHome && homeCodes.has(w.code)) problems.push(`${at}: ward "${w.code}" is already a unit of the dataset`);
      if (nonEmpty(w.code)) codes.add(w.code);
      for (const key of ["fi", "en"] as const) if (!nonEmpty(w[key])) problems.push(`${wAt}: "${key}" is required`);
      if (w.type !== "in" && w.type !== "out") problems.push(`${wAt}: "type" must be "in" or "out"`);
      if (w.institution !== "hospital" && w.institution !== "primary_care")
        problems.push(`${wAt}: "institution" must be "hospital" or "primary_care"`);
      const { code, fi, en, type, institution } = w as unknown as SiteWardEntry;
      wards.push({ code, fi, en, type, institution });
    }
    sites.push({
      id,
      fi: nonEmpty(raw.fi) ? raw.fi : home.fi,
      en: nonEmpty(raw.en) ? raw.en : home.en,
      county: nonEmpty(raw.county) ? raw.county : home.county,
      wards,
      ...(nonEmpty(raw.token) ? { token: raw.token } : {}),
      ...(typeof raw.codeMap === "string" ? { codeMap: raw.codeMap } : {}),
      ...(typeof raw.guideline === "string" ? { guideline: raw.guideline } : {}),
      ...(nonEmpty(raw.guide) ? { guide: raw.guide } : {}),
    });
  }
  if (problems.length) throw new SitesFileError(problems);
  return { sites };
}

/** A site as the server uses it: who it is, its units (qualified), how its codes map and which token it sends. */
export interface ConnectedSite {
  site: Site;
  token?: string;
  wards: readonly Ward[];
  maps: CodeMaps;
  guideline: string;
}

export interface SiteRegistry {
  home: Site;
  /** Every site, home first, then in file order. */
  sites: readonly Site[];
  /** Every registered unit of every site, home first. */
  wards: readonly Ward[];
  site(id: SiteId): Site | undefined;
  ward(code: WardCode): Ward | undefined;
  wardsOf(id: SiteId): readonly Ward[];
  /** The site of a unit: the registry's, else from the code ("sata/X" is sata's, a bare code the home site's). */
  siteOfWard(code: WardCode): SiteId;
  connection(id: SiteId): ConnectedSite | undefined;
  byToken(token: string): ConnectedSite | undefined;
  /** True when the home site must also send a token. */
  homeHasToken: boolean;
}

export interface RegistryOptions {
  home?: Site;
  /** The home site's units (default: the dataset's nine). */
  homeWards?: readonly Ward[];
  /** The home site's code maps (default: the THL defaults; the server passes `AEI_CODE_MAP` merged in). */
  homeMaps?: CodeMaps;
  homeGuideline?: string;
  /** Each site's own code map, read from the file its `codeMap` names. */
  codeMaps?: Record<SiteId, Partial<CodeMaps>>;
}

/** The ward code a site's unit is stored under: bare for the home site, `<siteId>/<code>` for any other. */
export function qualifyWard(siteId: SiteId, code: string, home: SiteId = HOME_SITE.id): WardCode {
  if (siteId === home || code.startsWith(`${siteId}/`)) return code;
  return `${siteId}/${code}`;
}

/** The registry of sites and units: the home site alone without a file, so nothing changes for one hospital. */
export function buildRegistry(file: SitesFile = { sites: [] }, options: RegistryOptions = {}): SiteRegistry {
  const home: Site = options.home ?? HOME_SITE;
  const homeEntry = file.sites.find((s) => s.id === home.id);
  const homeSite: Site = homeEntry
    ? {
        id: home.id,
        fi: homeEntry.fi,
        en: homeEntry.en,
        county: homeEntry.county,
        home: true,
        guide: homeEntry.guide ?? home.guide ?? DEFAULT_GUIDE,
      }
    : { ...home, guide: home.guide ?? DEFAULT_GUIDE };
  const homeExtra: Ward[] = (homeEntry?.wards ?? []).map((w) => ({ ...w, site: home.id }));
  const homeWards = [...(options.homeWards ?? WARDS), ...homeExtra];
  const homeBase = options.homeMaps ?? DEFAULT_CODE_MAPS;
  const homeMaps = extendCodeMaps(
    { ...(options.codeMaps?.[home.id] ?? {}), wards: { ...wardCodeMap(homeExtra), ...(options.codeMaps?.[home.id]?.wards ?? {}) } },
    homeBase,
  );
  const connections = new Map<SiteId, ConnectedSite>();
  connections.set(home.id, {
    site: homeSite,
    wards: homeWards,
    maps: homeMaps,
    guideline: homeEntry?.guideline ?? options.homeGuideline ?? "",
    ...(homeEntry?.token ? { token: homeEntry.token } : {}),
  });
  for (const entry of file.sites) {
    if (entry.id === home.id) continue;
    const site: Site = { id: entry.id, fi: entry.fi, en: entry.en, county: entry.county, guide: entry.guide ?? DEFAULT_GUIDE };
    // A site's codes are its own: its units by code and name (no other site's), the THL defaults for the rest.
    const base: CodeMaps = { ...DEFAULT_CODE_MAPS, wards: wardCodeMap(entry.wards), keepUnknownWards: true };
    connections.set(entry.id, {
      site,
      wards: entry.wards.map((w) => ({ ...w, code: qualifyWard(entry.id, w.code, home.id), site: entry.id })),
      maps: extendCodeMaps(options.codeMaps?.[entry.id] ?? {}, base),
      guideline: entry.guideline ?? "",
      ...(entry.token ? { token: entry.token } : {}),
    });
  }
  const all = [...connections.values()];
  const wards = all.flatMap((c) => c.wards);
  const byCode = new Map(wards.map((w) => [w.code, w]));
  const byToken = new Map(all.filter((c) => c.token).map((c) => [c.token as string, c]));
  return {
    home: homeSite,
    sites: all.map((c) => c.site),
    wards,
    site: (id) => connections.get(id)?.site,
    ward: (code) => byCode.get(code),
    wardsOf: (id) => connections.get(id)?.wards ?? [],
    siteOfWard: (code) => byCode.get(code)?.site ?? siteOfCode(code, home.id),
    connection: (id) => connections.get(id),
    byToken: (token) => byToken.get(token),
    homeHasToken: Boolean(connections.get(home.id)?.token),
  };
}

export type Authorization = { ok: true; site: ConnectedSite } | { ok: false; status: 401; error: string };

/**
 * The site a request comes from, by its `Authorization: Bearer <token>` header.
 * No header is the home site, unless the home site has a token; an unknown
 * token is refused. Tokens are plain shared secrets (pilot packaging, D-051).
 */
export function authorize(registry: SiteRegistry, header: string | undefined): Authorization {
  if (!header) {
    if (registry.homeHasToken) return { ok: false, status: 401, error: "a token is required: send Authorization: Bearer <token>" };
    return { ok: true, site: registry.connection(registry.home.id) as ConnectedSite };
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const site = match ? registry.byToken(match[1] as string) : undefined;
  return site ? { ok: true, site } : { ok: false, status: 401, error: "unknown token" };
}

/**
 * What a site sent, with every culture's unit qualified to the site and its
 * in/outpatient type taken from the site's registration. A unit the site did
 * not register is kept as sent (qualified anyway) with a warning on that
 * culture, and listed in `unregistered`. The home site's rows are unchanged.
 */
export function qualifyResult(
  result: IngestResult,
  from: ConnectedSite,
  home: SiteId = HOME_SITE.id,
): { result: IngestResult; unregistered: string[] } {
  if (from.site.id === home) return { result, unregistered: [] };
  const registered = new Map(from.wards.map((w) => [w.code, w]));
  const unregistered: string[] = [];
  const warnings = [...result.warnings];
  const cultures = result.cultures.map((c) => {
    const ward = qualifyWard(from.site.id, c.ward, home);
    const w = registered.get(ward);
    if (!w) {
      unregistered.push(ward);
      warnings.push(`culture ${c.cultureId}: unit "${c.ward}" is not registered for site ${from.site.id}; kept as ${ward}`);
      return { ...c, ward };
    }
    return { ...c, ward, wardType: w.type };
  });
  return { result: { ...result, cultures, warnings }, unregistered };
}

// ---------- per-site views of rows the server holds ----------

type SiteOf = (code: WardCode) => SiteId;

/** The site an alert is about: its unit's, or for a hospital-wide trend the site it carries (the home site if none). */
export function alertSite(a: { ward: WardCode | null; site?: SiteId }, siteOf: SiteOf = (c) => siteOfCode(c)): SiteId {
  return a.ward !== null ? siteOf(a.ward) : (a.site ?? HOME_SITE.id);
}

/** Flows or trail links with either end at the site: moves within it and between it and another hospital. */
export function touchingSite<T extends { from: WardCode; to: WardCode }>(
  items: readonly T[],
  site: SiteId,
  siteOf: SiteOf = (c) => siteOfCode(c),
): T[] {
  return items.filter((x) => siteOf(x.from) === site || siteOf(x.to) === site);
}

interface Rows {
  patients: readonly { patientId: string }[];
  cultures: readonly { cultureId: string; patientId: string; ward: WardCode }[];
  isolates: readonly { isolateId: string; cultureId: string }[];
  susceptibility: readonly { isolateId: string }[];
}

/** One site's rows: its cultures, their isolates and results, and the patients they belong to. */
export function rowsOfSite<R extends Rows>(rows: R, site: SiteId, siteOf: SiteOf = (c) => siteOfCode(c)): R {
  const cultures = rows.cultures.filter((c) => siteOf(c.ward) === site);
  const cultureIds = new Set(cultures.map((c) => c.cultureId));
  const patientIds = new Set(cultures.map((c) => c.patientId));
  const isolates = rows.isolates.filter((i) => cultureIds.has(i.cultureId));
  const isolateIds = new Set(isolates.map((i) => i.isolateId));
  return {
    ...rows,
    patients: rows.patients.filter((p) => patientIds.has(p.patientId)),
    cultures,
    isolates,
    susceptibility: rows.susceptibility.filter((s) => isolateIds.has(s.isolateId)),
  };
}

/** What a site's feed has sent since the server started (wall-clock times). */
export interface FeedStatus {
  messages: number;
  lastAt: string | null;
  lastFormat: "hl7v2" | "fhir" | "csv" | null;
  lastAccepted: number;
  warnings: number;
  unregistered: number;
  rejected: number;
}

export interface FeedLog {
  /** One message: its format (null if not recognised), cultures accepted, warnings and unregistered units. */
  record(
    site: SiteId,
    message: { format: FeedStatus["lastFormat"]; accepted: number; warnings: number; unregistered: number; at?: Date },
  ): void;
  status(site: SiteId): FeedStatus;
}

/** A running count of each site's messages; a message with no format or no accepted culture counts as rejected. */
export function createFeedLog(): FeedLog {
  const log = new Map<SiteId, FeedStatus>();
  const empty = (): FeedStatus => ({
    messages: 0,
    lastAt: null,
    lastFormat: null,
    lastAccepted: 0,
    warnings: 0,
    unregistered: 0,
    rejected: 0,
  });
  return {
    record(site, m) {
      const s = log.get(site) ?? empty();
      s.messages++;
      s.lastAt = (m.at ?? new Date()).toISOString();
      s.lastFormat = m.format;
      s.lastAccepted = m.accepted;
      s.warnings += m.warnings;
      s.unregistered += m.unregistered;
      if (!m.format || m.accepted === 0) s.rejected++;
      log.set(site, s);
    },
    status: (site) => ({ ...(log.get(site) ?? empty()) }),
  };
}
