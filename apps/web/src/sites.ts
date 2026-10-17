import type { AeiClient, Alert, Flow, LiveEvent, Meta, WeeklyResponse } from "@aei/contract";
import { HOME_SITE, type IsolateRecord, type Site, type SiteId, siteOfWard, WARDS, type Ward, type WardCode } from "@aei/domain";
import { type Locale, registerSites, registerWards, siteName, t } from "@aei/i18n";
import { createContext, useContext } from "react";

// Hospitals in the web app (D-051). The server's sites and units come with
// /api/meta; one hospital is selected at a time (or all of them, where the
// figures allow it), kept in the URL as `hospital=<id>` (`site` is the
// doctor's specimen) and remembered in localStorage. With one site nothing of
// this shows and every request is the same as before.

/** The URL parameter that holds the selected hospital; "all" for every hospital. */
export const HOSPITAL_PARAM = "hospital";
export const ALL_SITES = "all";
const STORE_KEY = "aei.hospital";

let sites: readonly Site[] = [HOME_SITE];
let wards: readonly Ward[] = WARDS;
let selected: SiteId | null = HOME_SITE.id;

/** Takes the server's sites and units (from /api/meta); names and types everywhere then read them. */
export function setRegistry(meta: Pick<Meta, "wards" | "sites">): void {
  sites = meta.sites?.length ? meta.sites : [HOME_SITE];
  wards = meta.wards.map((w) => ({ ...w, site: w.site ?? HOME_SITE.id }));
  registerWards(wards);
  registerSites(sites);
}

export const allSites = (): readonly Site[] => sites;
export const allWards = (): readonly Ward[] => wards;
export const isMulti = (): boolean => sites.length > 1;
export const homeSite = (): Site => sites.find((s) => s.home) ?? HOME_SITE;
/** The selected hospital, or null for all hospitals. */
export const currentSite = (): SiteId | null => selected;
/** The selected hospital's name, or "All hospitals"; with one hospital, its name. */
export const currentHospitalName = (locale: Locale): string => (selected === null ? t(locale, "siteAll") : siteName(locale, selected));
/** A hospital's units, or every unit for all hospitals. */
export const siteWards = (site: SiteId | null = selected): readonly Ward[] =>
  site === null ? wards : wards.filter((w) => w.site === site);
export const knownWard = (code: string): code is WardCode => wards.some((w) => w.code === code);
/** True when a unit belongs to the selected hospital (always, for all hospitals). */
export const inSite = (code: WardCode, site: SiteId | null = selected): boolean => site === null || siteOf(code) === site;
export const siteOf = (code: WardCode): SiteId => wards.find((w) => w.code === code)?.site ?? siteOfWard(code, homeSite().id);

/** The hospital to show: the URL's, else the remembered one, else the home site; "all" only with several. */
export function initialSite(): SiteId | null {
  const fromUrl = new URLSearchParams(location.hash.split("?")[1] ?? "").get(HOSPITAL_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORE_KEY);
  } catch {
    // storage blocked: the URL still carries the hospital
  }
  return validSite(fromUrl ?? stored);
}

/** A requested hospital if the server knows it, else the home site. */
export function validSite(value: string | null): SiteId | null {
  if (!isMulti()) return homeSite().id;
  if (value === ALL_SITES) return null;
  return value && sites.some((s) => s.id === value) ? value : homeSite().id;
}

/**
 * Unit names as every page shows them: with several hospitals, a unit of a hospital other than the selected one
 * carries its hospital's name ("Teho-osasto · Satasairaala"), so two hospitals' ICUs never read the same.
 */
function labelWards(): void {
  if (!isMulti()) {
    registerWards(wards);
    return;
  }
  const named = (w: Ward): Ward => {
    const s = sites.find((x) => x.id === w.site);
    return selected !== null && w.site === selected ? w : { ...w, fi: `${w.fi} · ${s?.fi ?? w.site}`, en: `${w.en} · ${s?.en ?? w.site}` };
  };
  registerWards(wards.map(named));
}

/** Units for a view of patient flow: the selected hospital's in registry order, then other hospitals' units the flows reach, by hospital. */
export function networkUnits(flows: readonly Pick<Flow, "from" | "to">[]): WardCode[] {
  const reached = new Set(flows.flatMap((f) => [f.from, f.to]));
  const own = siteWards().map((w) => w.code);
  const order = new Map(sites.map((s, i) => [s.id, i]));
  const others = [...reached]
    .filter((c) => !own.includes(c))
    .sort((a, b) => (order.get(siteOf(a)) ?? 99) - (order.get(siteOf(b)) ?? 99) || wardIndex(a) - wardIndex(b) || a.localeCompare(b));
  return [...own, ...others];
}

const wardIndex = (code: WardCode) => {
  const i = wards.findIndex((w) => w.code === code);
  return i < 0 ? wards.length : i;
};

/** Makes `site` the selected hospital and remembers it. */
export function selectSite(site: SiteId | null): void {
  selected = isMulti() ? site : homeSite().id;
  labelWards();
  try {
    localStorage.setItem(STORE_KEY, selected ?? ALL_SITES);
  } catch {
    // storage blocked: the URL still carries the hospital
  }
}

/** The URL value for a selection: nothing for the home site, so one-hospital links stay as they were. */
export const siteParam = (site: SiteId | null): string | null => (!isMulti() || site === homeSite().id ? null : (site ?? ALL_SITES));

// ---------- filtering what the app already holds ----------

export const recordsOf = <R extends Pick<IsolateRecord, "ward">>(rows: readonly R[], site: SiteId | null): R[] =>
  site === null ? [...rows] : rows.filter((r) => siteOf(r.ward) === site);

/** The hospital an alert is about: its unit's, or the site a hospital-wide trend carries. */
export const alertSiteOf = (a: Alert): SiteId => (a.ward !== null ? siteOf(a.ward) : ((a as { site?: SiteId }).site ?? homeSite().id));

export const alertsOf = (alerts: readonly Alert[], site: SiteId | null): Alert[] =>
  site === null ? [...alerts] : alerts.filter((a) => alertSiteOf(a) === site);

/** Flows with either end at the hospital: moves within it and between it and another. */
export const flowsOf = <F extends Pick<Flow, "from" | "to">>(flows: readonly F[], site: SiteId | null): F[] =>
  site === null ? [...flows] : flows.filter((f) => siteOf(f.from) === site || siteOf(f.to) === site);

// ---------- a client that asks for one hospital ----------

/** Units of every hospital's weekly series side by side (the weeks are the same: same start, same clock). */
function mergeWeekly(parts: readonly WeeklyResponse[]): WeeklyResponse {
  const [first] = parts;
  if (!first) throw new Error("no weekly series");
  return { ...first, units: Object.assign({}, ...parts.map((p) => p.units)) };
}

/**
 * The client with the hospital added to every per-site query, and the live stream filtered to it.
 * All hospitals: the queries as they are, and the weekly series of each hospital side by side.
 * With one hospital: the client itself. A query that names its own site keeps it (the notebook's slice of another hospital).
 */
export function scopeClient(client: AeiClient, site: SiteId | null): AeiClient {
  if (!isMulti()) return client;
  if (site === null)
    return {
      ...client,
      weekly: async (q) => mergeWeekly(await Promise.all(sites.map((s) => client.weekly({ ...q, site: s.id })))),
    };
  const keep = (e: LiveEvent): LiveEvent | null => {
    if (e.type === "arrivals") return { ...e, records: recordsOf(e.records, site) };
    if (e.type === "alerts") {
      const alerts = alertsOf(e.alerts, site);
      return alerts.length ? { ...e, alerts } : null;
    }
    return e;
  };
  return {
    ...client,
    coverage: (q) => client.coverage({ site, ...q }),
    isolates: (q) => client.isolates({ site, ...q }),
    relations: (q) => client.relations({ site, ...q }),
    alerts: (q) => client.alerts({ site, ...q }),
    weekly: (q) => client.weekly({ site, ...q }),
    quality: (q) => client.quality({ site, ...q }),
    live: (onEvent, onError) =>
      client.live((e) => {
        const kept = keep(e);
        if (kept) onEvent(kept);
      }, onError),
  };
}

// ---------- React ----------

export interface SitesState {
  sites: readonly Site[];
  /** The selected hospital, or null for all. */
  site: SiteId | null;
  multi: boolean;
  setSite: (site: SiteId | null) => void;
}

export const SitesContext = createContext<SitesState>({ sites: [HOME_SITE], site: HOME_SITE.id, multi: false, setSite: () => {} });

export const useSites = (): SitesState => useContext(SitesContext);
