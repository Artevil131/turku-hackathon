import type { CountiesResponse, RegionalResponse, RegionalSeries, RegionalSignal, WeeklyResponse } from "@aei/contract";
import { countyName, formatMonth, type Locale, phenotypeName, t } from "@aei/i18n";
import { addDaysIso } from "@aei/viz";
import { useEffect, useMemo, useRef, useState } from "react";
import { AsOf } from "../../AsOf.tsx";
import { InfoButton } from "../../Info.tsx";
import { HOSPITALS, LINKS } from "../../intro/surface.ts";
import type { PanelProps } from "../board.ts";
import { centroidOf, pathOf } from "../map/geo.ts";
import "./geo.css";
import { allSites, currentSite, homeSite, isMulti } from "../../../sites.ts";
import { CountyDetail } from "./CountyDetail.tsx";
import { CountyForecasts } from "./CountyForecasts.tsx";
import { type Layout, MAP_LAYOUT, mapPoint } from "./layout.ts";
import { TyksCompare } from "./TyksCompare.tsx";
import { useLoad } from "./useLoad.ts";

// Finland's wellbeing counties filled by the THL rate of the replay month.
// The hospital referral hierarchy is a hand-drawn diagram, not patient data;
// the separate unit graph shows Tyks's own (synthetic demo) data.

const DEFAULT_GROUP = "MRSA carriage";
/** Narrower than this the map is not drawn: its window shows the title and "Open larger". */
const NARROW_PX = 190;
const NATIONAL = "Finland (all counties)";
/** The selected hospital's county (D-051); the home site's, Varsinais-Suomi, with one hospital or all. */
const siteCounty = () => (allSites().find((s) => s.id === currentSite()) ?? homeSite()).county;

/** The API's series name stays the key; the label is translated. */
const SERIES_KEY = {
  "CPE carriage, E. cloacae": "mapSeriesCpeEcl",
  "CPE carriage, E. coli": "mapSeriesCpeEco",
  "CPE carriage, K. pneumoniae": "mapSeriesCpeKpn",
  "ESBL blood/CSF, E. coli": "mapSeriesEsblBloodEco",
  "ESBL blood/CSF, K. pneumoniae": "mapSeriesEsblBloodKpn",
  "ESBL carriage, E. coli": "mapSeriesEsblCarrEco",
  "ESBL carriage, K. pneumoniae": "mapSeriesEsblCarrKpn",
  "MRSA blood/CSF": "mapSeriesMrsaBlood",
  "MRSA carriage": "mapSeriesMrsaCarr",
  "VRE blood/CSF": "mapSeriesVreBlood",
  "VRE carriage": "mapSeriesVreCarr",
} as const;
/**
 * The THL series closest to a hospital signal, and what it was matched on: the signal's phenotype where it has one
 * (carriage series, the organism where THL has it), else its organism (an E. coli profile cluster has no phenotype,
 * and the ESBL E. coli series is the nearest national picture). Null when nothing is close.
 */
export function matchSeries(
  phenotypes: readonly string[],
  organism?: string,
): { group: string; basis: "phenotype" | "organism"; phenotype?: string } | null {
  const kpn = organism?.includes("pneumoniae");
  if (phenotypes.includes("cpe"))
    return {
      group: organism?.includes("cloacae") ? "CPE carriage, E. cloacae" : kpn ? "CPE carriage, K. pneumoniae" : "CPE carriage, E. coli",
      basis: "phenotype",
      phenotype: "cpe",
    };
  if (phenotypes.includes("esbl"))
    return { group: kpn ? "ESBL carriage, K. pneumoniae" : "ESBL carriage, E. coli", basis: "phenotype", phenotype: "esbl" };
  if (phenotypes.includes("mrsa")) return { group: "MRSA carriage", basis: "phenotype", phenotype: "mrsa" };
  if (phenotypes.includes("vre")) return { group: "VRE carriage", basis: "phenotype", phenotype: "vre" };
  if (!organism) return null;
  if (organism.includes("coli")) return { group: "ESBL carriage, E. coli", basis: "organism" };
  if (kpn || organism.includes("Klebsiella")) return { group: "ESBL carriage, K. pneumoniae", basis: "organism" };
  if (organism.includes("cloacae")) return { group: "CPE carriage, E. cloacae", basis: "organism" };
  if (organism.includes("Staphylococcus")) return { group: "MRSA carriage", basis: "organism" };
  if (organism.includes("Enterococcus")) return { group: "VRE carriage", basis: "organism" };
  return null;
}
export const seriesForSignal = (phenotypes: readonly string[], organism?: string): string | null =>
  matchSeries(phenotypes, organism)?.group ?? null;

export interface MapSignal {
  phenotypes: readonly string[];
  organism?: string;
  ward: string | null;
}

const seriesLabel = (locale: Locale, group: string) =>
  group in SERIES_KEY ? t(locale, SERIES_KEY[group as keyof typeof SERIES_KEY]) : group;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fmts = new Map<string, Intl.NumberFormat>();
const fmt = (locale: Locale, v: number, digits = 1) => {
  const key = `${locale}:${digits}`;
  let f = fmts.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: digits });
    fmts.set(key, f);
  }
  return f.format(v);
};
const fmtP = (locale: Locale, p: number) => (p < 0.001 ? `< ${fmt(locale, 0.001, 3)}` : fmt(locale, p, 3));

/** Five steps: zero, then quarters of the non-zero county-months of the series. */
function stepEdges(series: RegionalSeries[]): number[] {
  const vals: number[] = [];
  for (const s of series) for (const v of s.incidencePer100k ?? []) if (v !== null && v > 0) vals.push(v);
  vals.sort((a, b) => a - b);
  if (vals.length === 0) return [0, 0, 0];
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] as number;
  return [q(0.25), q(0.5), q(0.75)];
}

function stepOf(v: number, edges: number[]): number {
  if (v === 0) return 0;
  if (v <= (edges[0] as number)) return 1;
  if (v <= (edges[1] as number)) return 2;
  if (v <= (edges[2] as number)) return 3;
  return 4;
}

interface CountyShape {
  name: string;
  d: string;
  cx: number;
  cy: number;
}

function Glyph({ strong, size = 16 }: { strong: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="geo-glyph-svg">
      <circle cx="8" cy="8" r="5.2" className={strong ? "geo-glyph geo-glyph-strong" : "geo-glyph geo-glyph-weak"} />
    </svg>
  );
}

/** Cases per month for a county, signal months as filled or hollow dots with the expected count as a tick. */
function Spark({
  locale,
  series,
  months,
  signals,
}: {
  locale: Locale;
  series: RegionalSeries;
  months: string[];
  signals: RegionalSignal[];
}) {
  const W = 220;
  const H = 44;
  const cases = series.cases;
  const top = Math.max(1, ...cases, ...signals.map((s) => s.expected));
  const x = (i: number) => 4 + (i / Math.max(1, months.length - 1)) * (W - 8);
  const y = (v: number) => H - 4 - (v / top) * (H - 10);
  const label = t(locale, "geoSparkAria", {
    from: formatMonth(locale, `${months[0]}-01`, true),
    to: formatMonth(locale, `${months[months.length - 1]}-01`, true),
  });
  return (
    <svg className="geo-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      <line x1="4" x2={W - 4} y1={H - 4} y2={H - 4} className="geo-spark-base" />
      <polyline points={cases.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} className="geo-spark-line" />
      {signals.map((s) => {
        const i = months.indexOf(s.month);
        if (i < 0) return null;
        return (
          <g key={s.month}>
            <line x1={x(i) - 5} x2={x(i) + 5} y1={y(s.expected)} y2={y(s.expected)} className="geo-spark-tick" />
            <circle cx={x(i)} cy={y(s.cases)} r="4" className={s.strong ? "geo-glyph geo-glyph-strong" : "geo-glyph geo-glyph-weak"}>
              <title>
                {formatMonth(locale, `${s.month}-01`, true)}:{" "}
                {t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}
              </title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// focusCounty: the signal card's "Show on map" selects this county (set by ResearchBoard).
export function GeoMap({
  client,
  locale,
  asOf,
  reducedMotion,
  hasSelection = false,
  focusCounty = null,
  signal = null,
}: PanelProps & { focusCounty?: string | null; signal?: MapSignal | null }) {
  const TYKS_COUNTY = siteCounty();
  const [group, setGroup] = useState(DEFAULT_GROUP);
  // A selected signal switches the map to the THL series of the same phenotype; the select still overrides it.
  const match = signal ? matchSeries(signal.phenotypes, signal.organism) : null;
  const signalSeries = match?.group ?? null;
  useEffect(() => {
    if (signalSeries) setGroup(signalSeries);
  }, [signalSeries]);
  // The map shows first; the county detail replaces it in the tile once a county is picked.
  const [chosen, setChosen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (focusCounty) setChosen(focusCounty);
  }, [focusCounty]);
  // The pane slides in as it mounts (CSS @starting-style) and stays mounted while it slides out.
  const [pane, setPane] = useState<{ region: string; leaving: boolean } | null>(() => (chosen ? { region: chosen, leaving: false } : null));
  useEffect(() => {
    if (chosen) {
      setPane({ region: chosen, leaving: false });
      return;
    }
    if (reducedMotion) {
      setPane(null);
      return;
    }
    setPane((p) => (p ? { ...p, leaving: true } : null));
    const id = setTimeout(() => setPane(null), 360);
    return () => clearTimeout(id);
  }, [chosen, reducedMotion]);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const mapHeading = useRef<HTMLHeadingElement>(null);
  const wasChosen = useRef(false);
  useEffect(() => {
    if (chosen) {
      // Focus also scrolls a previously scrolled workspace tile back to its detail.
      detailHeading.current?.focus();
      wasChosen.current = true;
    } else if (wasChosen.current) {
      mapHeading.current?.focus();
      wasChosen.current = false;
    }
  }, [chosen]);

  // Too small to draw Finland: only the title and a way to a larger window (the squashed map said nothing).
  const root = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setNarrow(el.clientWidth > 0 && (el.clientWidth < NARROW_PX || (el.clientHeight > 0 && el.clientHeight < 140)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L: Layout = MAP_LAYOUT;

  const counties = useLoad<CountiesResponse>(() => client.counties(), [client], attempt);
  // Keep all phenotype-total forecasts even when the map shows one report group.
  const regional = useLoad<RegionalResponse>(() => client.regional({}), [client, asOf], attempt);
  // Tyks's own weekly counts, beside Varsinais-Suomi's county figures only: nine weeks give two four-week totals.
  const weekly = useLoad<WeeklyResponse | null>(
    () => (chosen === TYKS_COUNTY && asOf ? client.weekly({ from: addDaysIso(asOf, -7 * 9) }) : Promise.resolve(null)),
    [client, asOf, chosen === TYKS_COUNTY],
    attempt,
  );
  // Keyed on the loaded features, not the load object (a new one each render), so the paths are drawn once.
  const countyFeatures = counties.state === "ok" ? counties.data.features : null;
  const shapes: CountyShape[] = useMemo(() => {
    if (!countyFeatures) return [];
    return countyFeatures.map((f) => {
      const [cx, cy] = centroidOf(f.geometry);
      return { name: f.properties.nimi, d: pathOf(f.geometry), cx, cy };
    });
  }, [countyFeatures]);

  const data = regional.state === "ok" ? regional.data : null;
  const months = data?.months ?? [];
  const idx = months.length - 1;
  const month = months[idx] ?? null;
  const monthLong = (m: string) => formatMonth(locale, `${m}-01`, true);
  const series = useMemo(() => (data?.series ?? []).filter((s) => s.group === group), [data, group]);
  const forecasts = data?.forecasts ?? [];
  const byRegion = useMemo(() => new Map(series.map((s) => [s.region, s])), [series]);
  const edges = useMemo(() => stepEdges(series.filter((s) => s.region !== NATIONAL)), [series]);
  const signalsAll = useMemo(
    () => (data && month ? data.signals.filter((s) => s.group === group && s.month <= month) : []),
    [data, month, group],
  );
  const signalOf = useMemo(() => {
    const m = new Map<string, RegionalSignal>();
    for (const s of [...signalsAll].sort((a, b) => Number(b.strong) - Number(a.strong) || a.p - b.p))
      if (!m.has(s.region)) m.set(s.region, s);
    return m;
  }, [signalsAll]);
  const casesAt = (r: string) => byRegion.get(r)?.cases[idx] ?? null;
  const rateAt = (r: string) => byRegion.get(r)?.incidencePer100k?.[idx] ?? null;
  const rateText = (r: string) => {
    const v = rateAt(r);
    return v === null ? t(locale, "mapNoRate") : t(locale, "mapRateValue", { rate: fmt(locale, v) });
  };
  const fillOf = (r: string) => {
    if (!data || !byRegion.has(r)) return "none";
    const v = rateAt(r);
    return v === null ? "norate" : `s${stepOf(v, edges)}`;
  };

  const hospitals = useMemo(() => new Map(HOSPITALS.map((h) => [h.id, { ...h, p: mapPoint(L, h.lon, h.lat) }])), []);
  const tyks = hospitals.get("Tyks")?.p ?? [0, 0];

  const retry = () => setAttempt((n) => n + 1);

  // The map is scaled to its stage; the signal's chip is HTML over it, placed from the measured scale.
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = box ? Math.min(box.w / L.w, box.h / L.h) : 0;
  const tyksPx: [number, number] = box ? [(box.w - L.w * k) / 2 + tyks[0] * k, (box.h - L.h * k) / 2 + tyks[1] * k] : [0, 0];
  const chipTop = box ? Math.min(tyksPx[1] + 30, box.h - 76) : 0;
  const openTyks = () => {
    if (signalSeries) setGroup(signalSeries);
    setChosen(TYKS_COUNTY);
  };

  const loading = counties.state === "loading" || regional.state === "loading";
  const updating = (regional.fetching && data !== null) || (!!asOf && !!data && asOf !== data.asOf);
  const hasError = counties.state === "error" || regional.state === "error";
  const edgeMax = (edges[2] as number) ?? 0;
  const steps = [
    { cls: "s0", label: "0" },
    { cls: "s1", label: `≤${fmt(locale, edges[0] as number)}` },
    { cls: "s2", label: `≤${fmt(locale, edges[1] as number)}` },
    { cls: "s3", label: `≤${fmt(locale, edgeMax)}` },
    { cls: "s4", label: `>${fmt(locale, edgeMax)}` },
  ];

  const legendScale = (
    <div className="geo-legend">
      <div className="geo-legend-row">
        <span className="geo-legend-title">{t(locale, "geoLegendCases")}</span>
        <ul className="geo-steps">
          {steps.map((s) => (
            <li key={s.cls}>
              <span className={`geo-swatch geo-fill-${s.cls}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const legendKeys = (
    <div className="geo-legend geo-legend-keys">
      <ul className="geo-keys">
        <li>
          <Glyph strong />
          {t(locale, "mapGlyphStrong")}
        </li>
        <li>
          <Glyph strong={false} />
          {t(locale, "mapGlyphWeak")}
        </li>
        <li>
          <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
            <line x1="1" x2="21" y1="6" y2="6" className="geo-ref" />
            <circle cx="11" cy="6" r="3" className="geo-hosp" />
          </svg>
          {t(locale, "geoLegendRef")}
        </li>
      </ul>
      <p className="geo-faint">{t(locale, "geoThlCredit")}</p>
    </div>
  );

  // The pane's figures follow the region it shows, also while it slides out.
  const shownRegion = chosen ?? pane?.region ?? null;
  const fs = shownRegion ? byRegion.get(shownRegion) : undefined;
  const strongest = shownRegion
    ? ([...(data?.signals ?? [])]
        .filter((s) => s.region === shownRegion)
        .sort((a, b) => Number(b.strong) - Number(a.strong) || a.p - b.p)[0] ?? null)
    : null;

  const rows = shapes
    .map((c) => ({ ...c, rate: rateAt(c.name), cases: casesAt(c.name) }))
    .sort((x, y) => (y.rate ?? -1) - (x.rate ?? -1) || x.name.localeCompare(y.name));

  const closest = signal ? (
    <p className="geo-closest geo-faint" data-match={match ? match.basis : "none"}>
      {match
        ? t(locale, match.basis === "phenotype" ? "mapClosestPhenotype" : "mapClosestOrganism", {
            series: seriesLabel(locale, match.group),
            phenotype: match.phenotype ? phenotypeName(match.phenotype as Parameters<typeof phenotypeName>[0]) : "",
            organism: signal.organism ?? "",
          })
        : t(locale, "mapClosestNone", { series: seriesLabel(locale, group) })}
    </p>
  ) : null;

  if (narrow)
    return (
      <section className="board-panel geo geo-narrow" ref={root} aria-labelledby="geo-title">
        <h2 id="geo-title" className="geo-title" tabIndex={-1}>
          {t(locale, "geoTitle")}
        </h2>
        <button type="button" className="geo-chip" onClick={() => dispatchEvent(new CustomEvent("aei:focus-window", { detail: "map" }))}>
          {t(locale, "mapOpenLarger")}
        </button>
      </section>
    );

  return (
    <section
      ref={root}
      className={`board-panel geo${hasSelection ? " has-selection" : ""}`}
      aria-labelledby="geo-title"
      aria-busy={loading || updating}
      data-stale={updating}
      data-reduced={reducedMotion}
    >
      <header className="geo-head">
        <h2 id="geo-title" className="geo-title" tabIndex={-1} ref={mapHeading}>
          {t(locale, "geoTitle")}
        </h2>
        {data ? (
          <span className="geo-asof">
            <AsOf locale={locale} date={data.asOf} pending={updating} clockDate={asOf ?? undefined} />
            {month ? <span className="geo-month">{monthLong(month)}</span> : null}
          </span>
        ) : null}
        <InfoButton locale={locale} align="end">
          {t(locale, "geoCaption", { month: month ? monthLong(month) : "–" })} {t(locale, "geoCaptionSource")}
        </InfoButton>
        <label className="geo-field">
          <span className="visually-hidden">{t(locale, "mapGroup")}</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t(locale, "mapGroup")}>
            {(data?.groups ?? [DEFAULT_GROUP]).map((g) => (
              <option key={g} value={g}>
                {seriesLabel(locale, g)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {/* The picture comes first; what it shows is said once, under it, with the ⓘ for the long reading. */}

      {hasError ? (
        <div className="geo-state" role="alert">
          <span>{t(locale, "mapError")}</span>
          <button type="button" className="geo-chip" onClick={retry}>
            {t(locale, "mapRetry")}
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="geo-state" role="status">
          {t(locale, "mapLoading")}
        </p>
      ) : null}
      {counties.state === "404" || regional.state === "404" ? (
        <p className="geo-state" role="status">
          {t(
            locale,
            counties.state === "404" && regional.state === "404"
              ? "geoMissingBoth"
              : counties.state === "404"
                ? "geoMissingCounties"
                : "geoMissingRegional",
          )}
        </p>
      ) : null}

      {/* The county detail opens beside the map (a side pane); the map stays in view. */}
      {pane ? (
        <CountyDetail
          region={pane.region}
          signal={strongest}
          groupLabel={strongest ? seriesLabel(locale, strongest.group) : ""}
          forecasts={forecasts}
          locale={locale}
          onClose={() => setChosen(null)}
          headingRef={detailHeading}
          open={!pane.leaving}
        >
          {closest}
          {fs && month ? (
            <>
              <p className="geo-card-figs">
                {seriesLabel(locale, group)} ·{" "}
                {t(locale, "geoMonthCases", { cases: fmt(locale, casesAt(pane.region) ?? 0, 0), month: monthLong(month) })} ·{" "}
                {rateText(pane.region)}
              </p>
              <p className="geo-card-figs">
                {t(locale, "mapFocusTwelve", {
                  n: fmt(locale, sum(fs.cases.slice(Math.max(0, idx - 11), idx + 1)), 0),
                  month: monthLong(month),
                })}
              </p>
              <Spark locale={locale} series={fs} months={months} signals={signalsAll.filter((s) => s.region === pane.region)} />
              <p className="geo-faint">{t(locale, "geoExpectedTick")}</p>
            </>
          ) : null}
          {pane.region === TYKS_COUNTY && weekly.state === "ok" && weekly.data ? (
            <TyksCompare weekly={weekly.data} group={group} locale={locale} />
          ) : null}
        </CountyDetail>
      ) : null}
      {
        <>
          <div className="geo-stage" ref={stage}>
            <svg
              viewBox={`0 0 ${L.w} ${L.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="geo-svg"
              role="group"
              aria-label={t(locale, "geoTitle")}
            >
              <defs>
                <marker id="geo-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M1 1 L9 5 L1 9 Z" className="geo-spread-head" />
                </marker>
                <marker id="geo-arrow-trail" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M1 1 L9 5 L1 9 Z" className="geo-trail-head" />
                </marker>
              </defs>

              <g transform={`scale(${L.s})`}>
                {shapes.map((c) => (
                  <path
                    key={c.name}
                    d={c.d}
                    className={`geo-county geo-fill-${fillOf(c.name)}${hasSelection && c.name === TYKS_COUNTY ? " is-focus" : ""}`}
                    data-selected={chosen === c.name}
                    data-site={isMulti() && c.name === TYKS_COUNTY}
                    vectorEffect="non-scaling-stroke"
                    role="button"
                    tabIndex={0}
                    aria-label={countyName(locale, c.name)}
                    aria-pressed={chosen === c.name}
                    onClick={() => setChosen((cur) => (cur === c.name ? null : c.name))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setChosen(c.name);
                      }
                    }}
                  >
                    <title>
                      {data && month
                        ? t(locale, "mapCountyLabel", {
                            region: countyName(locale, c.name),
                            cases: casesAt(c.name) ?? 0,
                            month: monthLong(month),
                            rate: rateText(c.name),
                          })
                        : countyName(locale, c.name)}
                    </title>
                  </path>
                ))}
              </g>

              <g className="geo-refs">
                {LINKS.map(([a, b, w]) => {
                  const pa = hospitals.get(a)?.p;
                  const pb = hospitals.get(b)?.p;
                  if (!pa || !pb) return null;
                  const isTyks = a === "Tyks" || b === "Tyks";
                  return (
                    <line
                      key={`${a}|${b}`}
                      x1={pa[0]}
                      y1={pa[1]}
                      x2={pb[0]}
                      y2={pb[1]}
                      className="geo-ref"
                      data-uni={w < 1}
                      data-tyks={isTyks}
                    />
                  );
                })}
                {[...hospitals.values()].map((h) => {
                  const tipKind = t(locale, h.uni ? "geoUniHospital" : "geoCentralHospital");
                  const tip = h.to ? t(locale, "geoCentralTo", { name: h.name, kind: tipKind, to: h.to }) : `${h.name}, ${tipKind}`;
                  return (
                    <g key={h.id}>
                      <circle
                        cx={h.p[0]}
                        cy={h.p[1]}
                        r={h.id === "Tyks" ? 7 : h.uni ? 5.5 : 3.2}
                        className="geo-hosp"
                        data-uni={!!h.uni}
                        data-tyks={h.id === "Tyks"}
                      >
                        <title>{tip}</title>
                      </circle>
                      {h.uni ? (
                        <text
                          x={h.id === "Tyks" ? h.p[0] - 11 : h.p[0] + 9}
                          y={h.p[1] + 4.5}
                          textAnchor={h.id === "Tyks" ? "end" : "start"}
                          className="geo-hosp-label"
                          data-tyks={h.id === "Tyks"}
                        >
                          {h.id}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g className="geo-sigs" pointerEvents="none">
                {shapes
                  .filter((c) => signalOf.has(c.name))
                  .map((c) => {
                    const s = signalOf.get(c.name) as RegionalSignal;
                    let x = c.cx * L.s;
                    const y = c.cy * L.s - 9;
                    for (const h of hospitals.values()) if (Math.hypot(h.p[0] - x, h.p[1] - y) < 12) x += 14;
                    return (
                      <circle
                        key={c.name}
                        cx={x}
                        cy={y}
                        r={6}
                        className={s.strong ? "geo-glyph geo-glyph-strong" : "geo-glyph geo-glyph-weak"}
                      >
                        <title>
                          {countyName(locale, c.name)}:{" "}
                          {t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}
                        </title>
                      </circle>
                    );
                  })}
              </g>

              <circle cx={tyks[0]} cy={tyks[1]} r={11} className="geo-anchor" data-signal={signal && signalSeries ? "" : undefined} />
            </svg>

            {signal && signalSeries && box ? (
              <>
                <svg className="geo-callout-svg" width={box.w} height={box.h} aria-hidden="true">
                  <path d={`M${24},${chipTop} Q${24},${tyksPx[1]} ${tyksPx[0] - 12},${tyksPx[1]}`} className="geo-callout-line" />
                </svg>
                <button type="button" className="geo-callout" style={{ left: 8, top: chipTop }} onClick={openTyks}>
                  <Glyph strong size={14} />
                  <span className="geo-callout-text">
                    <strong>{signal.ward ?? ""}</strong>
                    <span>{seriesLabel(locale, signalSeries)}</span>
                  </span>
                </button>
              </>
            ) : null}
            {edgeMax > 0 ? <div className="geo-overlay-legend">{legendScale}</div> : null}
          </div>

          {signal && signalSeries ? (
            <div className="geo-signal" role="status">
              <strong>{t(locale, "geoSignalHead", { series: seriesLabel(locale, signalSeries), unit: signal.ward ?? "" })}</strong>
              <span>{t(locale, signalSeries === group ? "geoSignalBody" : "geoSignalOther", { county: TYKS_COUNTY })}</span>
              {signalSeries !== group ? (
                <button type="button" className="geo-chip" onClick={() => setGroup(signalSeries)}>
                  {t(locale, "geoSignalShow")}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="geo-foot">
            {month ? t(locale, "geoCaptionShort", { month: monthLong(month) }) : t(locale, "geoCaptionBare")}
            <InfoButton locale={locale}>
              {t(locale, "geoCaption", { month: month ? monthLong(month) : "–" })} {t(locale, "geoHowTo")} {t(locale, "geoCaptionSource")}
            </InfoButton>
          </p>

          {legendKeys}

          {forecasts.length > 0 ? (
            <section className="geo-forecast-home" aria-label={t(locale, "geoForecastHome")}>
              <h3 className="geo-h3">
                {t(locale, "geoForecastHome")}
                <InfoButton locale={locale}>
                  {t(locale, "geoForecastNote")} {t(locale, "geoForecastCaveat")}
                </InfoButton>
              </h3>
              <CountyForecasts forecasts={forecasts} region={TYKS_COUNTY} locale={locale} />
            </section>
          ) : null}

          <details className="geo-lists">
            <summary className="geo-h3">{t(locale, "geoCounties")}</summary>
            <section className="geo-counties" aria-label={t(locale, "geoCounties")}>
              {rows.length === 0 ? (
                <p className="geo-faint">
                  {counties.state === "404" ? t(locale, "geoNoCounties") : loading ? t(locale, "mapLoading") : t(locale, "geoNoCases")}
                </p>
              ) : (
                <ul className="geo-list geo-list-counties">
                  {rows.map((c) => (
                    <li key={c.name}>
                      <button
                        type="button"
                        className="geo-row"
                        aria-pressed={chosen === c.name}
                        onClick={() => setChosen(c.name)}
                        title={c.name}
                      >
                        <span className="geo-row-glyphs" aria-hidden="true">
                          {signalOf.has(c.name) ? <Glyph strong={(signalOf.get(c.name) as RegionalSignal).strong} size={14} /> : null}
                        </span>
                        <span className="geo-row-name">{countyName(locale, c.name)}</span>
                        <span className="geo-row-figs">
                          {c.rate === null ? "–" : fmt(locale, c.rate)} · n {c.cases ?? 0}
                        </span>
                      </button>
                      <CountyForecasts forecasts={forecasts} region={c.name} locale={locale} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </details>
        </>
      }
    </section>
  );
}
