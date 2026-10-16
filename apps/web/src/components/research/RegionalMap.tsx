import { ApiError, type CountiesResponse, type RegionalResponse, type RegionalSeries, type RegionalSignal } from "@aei/contract";
import { formatDate, formatMonth, type Locale, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import { AsOf } from "../AsOf.tsx";
import type { PanelProps } from "./board.ts";
import { centroidOf, MAP_H, MAP_W, PAD, pathOf, TYKS } from "./map/geo.ts";
import "./RegionalMap.css";

// The researcher's regional map (spec-research.md, RegionalMap): THL notified
// cases per county as a stepped choropleth, with a count-based second view,
// signal glyphs, a focus panel and a month slider that never moves the clock.

const DEFAULT_GROUP = "MRSA carriage";
const NATIONAL = "Finland (all counties)";
const FIRST_MONTH_COL = 2021;

type View = "rate" | "certainty";
type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "404" } | { state: "error" };

function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[], attempt: number): Load<T> {
  const [res, setRes] = useState<Load<T>>({ state: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher is rebuilt each render; deps say when to refetch
  useEffect(() => {
    let live = true;
    fetcher().then(
      (data) => live && setRes({ state: "ok", data }),
      (e) => live && setRes(e instanceof ApiError && e.status === 404 ? { state: "404" } : { state: "error" }),
    );
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return res;
}

const shortName = (region: string) => region.replace(/ hyvinvointialue$/, "");
const monthDate = (m: string) => `${m}-01`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function fmt(locale: Locale, v: number, digits = 1): string {
  return new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: digits }).format(v);
}

function fmtP(locale: Locale, p: number): string {
  // Plain decimals, never scientific notation; very small values read "< 0,001".
  if (p < 0.001) return `< ${fmt(locale, 0.001, 3)}`;
  return fmt(locale, p, 3);
}

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

export function RegionalMap({ client, locale, asOf }: PanelProps) {
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [view, setView] = useState<View>("rate");
  const [pick, setPick] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const regional = useLoad<RegionalResponse>(() => client.regional({ group }), [client, group, asOf], attempt);
  const counties = useLoad<CountiesResponse>(() => client.counties(), [client], attempt);

  const geo: CountyShape[] = useMemo(() => {
    if (counties.state !== "ok") return [];
    return counties.data.features
      .map((f) => {
        const [cx, cy] = centroidOf(f.geometry);
        return { name: f.properties.nimi, d: pathOf(f.geometry), cx, cy };
      })
      .sort((a, b) => a.cy - b.cy);
  }, [counties]);

  const data = regional.state === "ok" ? regional.data : null;
  const months = data?.months ?? [];
  const latest = months.length - 1;
  const idx = pick !== null && months.includes(pick) ? months.indexOf(pick) : latest;
  const month = months[idx] ?? null;
  const minCases = data?.settings.minCases ?? 5;

  const byRegion = useMemo(() => new Map((data?.series ?? []).map((s) => [s.region, s])), [data]);
  const countySeries = useMemo(() => (data?.series ?? []).filter((s) => s.region !== NATIONAL), [data]);
  const edges = useMemo(() => stepEdges(countySeries), [countySeries]);

  const signals = useMemo(() => {
    if (!data || !month) return [] as RegionalSignal[];
    return data.signals.filter((s) => s.month <= month).sort((a, b) => Number(b.strong) - Number(a.strong) || a.p - b.p);
  }, [data, month]);
  const signalOf = useMemo(() => {
    const m = new Map<string, RegionalSignal>();
    for (const s of signals) if (!m.has(s.region)) m.set(s.region, s);
    return m;
  }, [signals]);

  const casesAt = (region: string): number | null => {
    const s = byRegion.get(region);
    return s && idx >= 0 ? (s.cases[idx] ?? null) : null;
  };
  const rateAt = (region: string): number | null => {
    const s = byRegion.get(region);
    return s?.incidencePer100k && idx >= 0 ? (s.incidencePer100k[idx] ?? null) : null;
  };
  const rateText = (region: string) => {
    const r = rateAt(region);
    return r === null ? t(locale, "mapNoRate") : t(locale, "mapRateValue", { rate: fmt(locale, r) });
  };
  const monthLong = (m: string) => formatMonth(locale, monthDate(m), true);
  const fillFor = (region: string): string => {
    if (!byRegion.has(region)) return "none";
    if (view === "certainty") return (casesAt(region) ?? 0) < minCases ? "few" : "plain";
    const r = rateAt(region);
    return r === null ? "norate" : `s${stepOf(r, edges)}`;
  };

  const focusName = chosen;
  const focusSeries = focusName ? byRegion.get(focusName) : undefined;
  const hasGeo = counties.state === "ok";
  const loading = regional.state === "loading" || counties.state === "loading";
  const noMonths = data !== null && months.length === 0;

  const retry = () => {
    setAttempt((n) => n + 1);
  };

  const header = (
    <header className="map-head">
      <h2 className="map-title">{t(locale, "mapTitle")}</h2>
      {data ? (
        <span className="map-asof">
          <AsOf locale={locale} date={data.asOf} pending={asOf !== null && asOf !== data.asOf} clockDate={asOf ?? undefined} />
          {month ? <span className="map-monthshown">{t(locale, "mapMonthShown", { month: monthLong(month) })}</span> : null}
        </span>
      ) : null}
    </header>
  );

  const quantity = <p className="map-quantity">{t(locale, "mapQuantity")}</p>;

  if (regional.state === "404" || counties.state === "404") {
    return (
      <section className="board-panel map" aria-label={t(locale, "mapTitle")}>
        {header}
        {quantity}
        <div className="map-state" role="alert">
          {regional.state === "404" ? <p>{t(locale, "mapNoFileRegional")}</p> : null}
          {counties.state === "404" ? <p>{t(locale, "mapNoFileCounties")}</p> : null}
        </div>
      </section>
    );
  }
  if (regional.state === "error" || counties.state === "error") {
    return (
      <section className="board-panel map" aria-label={t(locale, "mapTitle")}>
        {header}
        {quantity}
        <div className="map-state" role="alert">
          <p>{t(locale, "mapError")}</p>
          <button type="button" className="map-btn" onClick={retry}>
            {t(locale, "mapRetry")}
          </button>
        </div>
      </section>
    );
  }

  const national = byRegion.get(NATIONAL);
  const legendSteps = [
    { cls: "s0", label: t(locale, "mapLegendZero") },
    { cls: "s1", label: `>0–${fmt(locale, edges[0] as number)}` },
    { cls: "s2", label: `${fmt(locale, edges[0] as number)}–${fmt(locale, edges[1] as number)}` },
    { cls: "s3", label: `${fmt(locale, edges[1] as number)}–${fmt(locale, edges[2] as number)}` },
    { cls: "s4", label: `>${fmt(locale, edges[2] as number)}` },
  ];

  return (
    <section className="board-panel map" aria-label={t(locale, "mapTitle")} aria-busy={loading}>
      {header}
      {quantity}

      <div className="map-controls">
        <label className="map-field">
          <span>{t(locale, "mapGroup")}</span>
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setChosen(null);
            }}
          >
            {(data?.groups ?? [DEFAULT_GROUP]).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <div className="map-field">
          <span id="map-view-label">{t(locale, "mapViewLabel")}</span>
          <div className="map-seg" role="radiogroup" aria-labelledby="map-view-label">
            {(["rate", "certainty"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} className="map-seg-btn" onClick={() => setView(v)}>
                {t(locale, v === "rate" ? "mapViewRate" : "mapViewCertainty")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {noMonths ? (
        <div className="map-state">
          <p>{t(locale, "mapNoMonths", { date: formatDate(locale, data?.asOf ?? asOf ?? "", "long") })}</p>
        </div>
      ) : (
        <>
          <div className="map-slider" data-browsing={idx !== latest}>
            <p className="map-slider-hint" id="map-month-hint">
              {t(locale, "mapBrowseHint", { month: months[latest] ? monthLong(months[latest] as string) : "…" })}
            </p>
            <label htmlFor="map-month">
              <span className="map-slider-label">{t(locale, "mapMonth")}</span>
              <strong className="map-slider-value">{month ? monthLong(month) : "…"}</strong>
            </label>
            <input
              id="map-month"
              type="range"
              min={0}
              max={Math.max(0, latest)}
              step={1}
              value={Math.max(0, idx)}
              disabled={!data}
              aria-label={t(locale, "mapSlider")}
              aria-describedby="map-month-hint"
              aria-valuetext={month ? monthLong(month) : undefined}
              onChange={(e) => {
                const i = Number(e.target.value);
                setPick(i >= latest ? null : (months[i] ?? null));
              }}
            />
            {idx !== latest ? (
              <button type="button" className="map-btn map-back" onClick={() => setPick(null)}>
                {t(locale, "mapBackToReplay")}
              </button>
            ) : null}
          </div>

          <div className="map-body">
            <figure className="map-figure">
              <svg
                className="map-svg"
                viewBox={`0 0 ${MAP_W + 2 * PAD} ${MAP_H + 2 * PAD}`}
                role="group"
                aria-label={t(locale, "mapTitle")}
              >
                <defs>
                  <pattern id="map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" className="map-hatch-bg" />
                    <line x1="0" y1="0" x2="0" y2="6" className="map-hatch-line" />
                  </pattern>
                </defs>
                {geo.map((c) => {
                  const fill = data ? fillFor(c.name) : "loading";
                  const cases = casesAt(c.name);
                  const label =
                    data && month
                      ? t(locale, "mapCountyLabel", {
                          region: shortName(c.name),
                          cases: cases ?? 0,
                          month: monthLong(month),
                          rate: rateText(c.name),
                        })
                      : shortName(c.name);
                  return (
                    <path
                      key={c.name}
                      d={c.d}
                      className={`map-county map-fill-${fill}`}
                      data-selected={focusName === c.name}
                      role="button"
                      tabIndex={data ? 0 : -1}
                      aria-label={label}
                      aria-pressed={focusName === c.name}
                      onClick={() => setChosen(c.name)}
                      onFocus={() => setChosen(c.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setChosen(c.name);
                        }
                      }}
                    />
                  );
                })}
                {geo
                  .filter((c) => signalOf.has(c.name))
                  .map((c) => {
                    const s = signalOf.get(c.name) as RegionalSignal;
                    return (
                      <circle
                        key={`sig-${c.name}`}
                        cx={c.cx}
                        cy={c.cy}
                        r={7}
                        className={s.strong ? "map-glyph map-glyph-strong" : "map-glyph map-glyph-weak"}
                        pointerEvents="none"
                      >
                        <title>
                          {t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}
                        </title>
                      </circle>
                    );
                  })}
                {hasGeo ? (
                  <g pointerEvents="none">
                    <circle cx={TYKS[0]} cy={TYKS[1]} r={4.5} className="map-tyks" />
                    <text x={TYKS[0] - 9} y={TYKS[1] + 4} textAnchor="end" className="map-tyks-label">
                      {t(locale, "mapTyks")}
                    </text>
                  </g>
                ) : null}
              </svg>
              {!hasGeo || !data ? <figcaption className="map-loading">{t(locale, "mapLoading")}</figcaption> : null}
            </figure>

            <div className="map-side">
              <div className="map-legend">
                {view === "rate" ? (
                  <>
                    <h3>{t(locale, "mapLegendRate")}</h3>
                    <ul className="map-legend-row">
                      {legendSteps.map((s) => (
                        <li key={s.cls}>
                          <span className={`map-swatch map-fill-${s.cls}`} aria-hidden="true" />
                          {s.label}
                        </li>
                      ))}
                      <li>
                        <span className="map-swatch map-fill-norate" aria-hidden="true" />
                        {t(locale, "mapNoRate")}
                      </li>
                    </ul>
                    <p className="map-note">{t(locale, "mapLegendSteps", { from: FIRST_MONTH_COL })}</p>
                  </>
                ) : (
                  <>
                    <h3>{t(locale, "mapViewCertainty")}</h3>
                    <ul className="map-legend-row">
                      <li>
                        <span className="map-swatch map-fill-few" aria-hidden="true" />
                        {t(locale, "mapTooFew", { n: minCases })}
                      </li>
                      <li>
                        <span className="map-swatch map-fill-plain" aria-hidden="true" />
                        {t(locale, "mapRatedPlain", { n: minCases })}
                      </li>
                    </ul>
                    <p className="map-note">{t(locale, "mapLegendCertainty", { n: minCases })}</p>
                  </>
                )}
                <ul className="map-legend-row map-glyph-key">
                  <li>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" className="map-glyph map-glyph-strong" />
                    </svg>
                    {t(locale, "mapGlyphStrong")}
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" className="map-glyph map-glyph-weak" />
                    </svg>
                    {t(locale, "mapGlyphWeak")}
                  </li>
                </ul>
                {national && month ? (
                  <p className="map-national">
                    {t(locale, "mapNationalTotal", { n: fmt(locale, national.cases[idx] ?? 0, 0), month: monthLong(month) })}
                  </p>
                ) : null}
              </div>

              <div className="map-focus" aria-live="polite">
                <h3>{t(locale, "mapFocusTitle")}</h3>
                {focusName && focusSeries && month ? (
                  <>
                    <p className="map-focus-name">{shortName(focusName)}</p>
                    <dl>
                      <div>
                        <dt>{t(locale, "mapFocusCases", { month: monthLong(month) })}</dt>
                        <dd>{fmt(locale, focusSeries.cases[idx] ?? 0, 0)}</dd>
                      </div>
                      <div>
                        <dt>{t(locale, "mapFocusRate")}</dt>
                        <dd>{rateAt(focusName) === null ? t(locale, "mapNoRate") : fmt(locale, rateAt(focusName) as number)}</dd>
                      </div>
                    </dl>
                    <p className="map-focus-line">
                      {t(locale, "mapFocusTwelve", {
                        n: fmt(locale, sum(focusSeries.cases.slice(Math.max(0, idx - 11), idx + 1)), 0),
                        month: monthLong(month),
                      })}
                    </p>
                    <p className="map-focus-line">
                      {t(locale, "mapFocusSignal")}:{" "}
                      {signalOf.has(focusName)
                        ? (() => {
                            const s = signalOf.get(focusName) as RegionalSignal;
                            return `${t(locale, s.strong ? "mapSignalStrong" : "mapSignalWeak")}, ${monthLong(s.month)}: ${t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}`;
                          })()
                        : t(locale, "mapFocusNoSignal")}
                    </p>
                  </>
                ) : (
                  <p className="map-note">{t(locale, "mapFocusHint")}</p>
                )}
              </div>

              <div className="map-signals">
                <h3>{t(locale, "mapSignalsTitle")}</h3>
                {signals.length === 0 ? (
                  <p className="map-note">{t(locale, "mapSignalsNone")}</p>
                ) : (
                  <ul>
                    {signals.map((s) => (
                      <li key={`${s.region}-${s.month}`}>
                        <button type="button" className="map-signal-row" onClick={() => setChosen(s.region)}>
                          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                            <circle cx="8" cy="8" r="6" className={s.strong ? "map-glyph map-glyph-strong" : "map-glyph map-glyph-weak"} />
                          </svg>
                          <span>
                            <strong>{shortName(s.region)}</strong>, {monthLong(s.month)}
                            <br />
                            <span className="map-note">
                              {t(locale, s.strong ? "mapSignalStrong" : "mapSignalWeak")}:{" "}
                              {t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {data ? (
        <footer className="map-foot">
          <span>
            {t(locale, "mapSource")}: {data.source}
          </span>
          <span>{t(locale, "mapFetched", { date: formatDate(locale, data.fetched, "long") })}</span>
          <span>{t(locale, "mapGeometryCredit")}</span>
        </footer>
      ) : null}
    </section>
  );
}
