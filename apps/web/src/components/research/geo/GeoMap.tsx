import type { Alert, CountiesResponse, RegionalResponse, RegionalSeries, RegionalSignal, RelationsResponse } from "@aei/contract";
import { WARDS, type WardCode } from "@aei/domain";
import { formatMonth, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { nextUnits, undirectedFlows } from "@aei/relations";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AsOf } from "../../AsOf.tsx";
import { HOSPITALS, LINKS } from "../../intro/surface.ts";
import { tubeWidth } from "../../Network.tsx";
import type { PanelProps } from "../board.ts";
import { centroidOf, pathOf } from "../map/geo.ts";
import { badgeText, KIND_GLYPH, shiftDays, signalsOf } from "../network/model.ts";
import "./geo.css";
import { arc, bendPath, cone, type Layout, layoutFor, mapPoint, NODE_HALF_H, NODE_HALF_W, unitPoint } from "./layout.ts";
import { useLoad } from "./useLoad.ts";

// One geographic panel (redesign D2): Finland's wellbeing counties filled by
// the THL rate of the replay month, the referral tree of the university and
// central hospitals as a graph on top, and Tyks magnified into an inset with
// its nine units, patient flow, the last 28 days of alerts, where the patients
// of a lit unit go next, and the phenotype trail.

const DEFAULT_GROUP = "MRSA carriage";
const NATIONAL = "Finland (all counties)";
const WINDOW_DAYS = 28;
const MAX_SPREAD = 3;

const shortName = (region: string) => region.replace(/ hyvinvointialue$/, "");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fmt = (locale: Locale, v: number, digits = 1) =>
  new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: digits }).format(v);
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

type Net = { relations: RelationsResponse; alerts: Alert[] };

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

export function GeoMap({ client, locale, asOf, state, onChange, reducedMotion }: PanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<WardCode | null>(null);
  const [showTrail, setShowTrail] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width) || 700);
    return () => ro.disconnect();
  }, []);

  const L: Layout = useMemo(() => layoutFor(width), [width]);

  const counties = useLoad<CountiesResponse>(() => client.counties(), [client], attempt);
  const regional = useLoad<RegionalResponse>(() => client.regional({ group }), [client, group, asOf], attempt);
  const net = useLoad<Net>(
    () =>
      asOf
        ? Promise.all([client.relations({ days: WINDOW_DAYS }), client.alerts({ from: shiftDays(asOf, -(WINDOW_DAYS - 1)) })]).then(
            ([relations, al]) => ({ relations, alerts: al.alerts }),
          )
        : new Promise<Net>(() => {}),
    [client, asOf],
    attempt,
  );

  const shapes: CountyShape[] = useMemo(() => {
    if (counties.state !== "ok") return [];
    return counties.data.features.map((f) => {
      const [cx, cy] = centroidOf(f.geometry);
      return { name: f.properties.nimi, d: pathOf(f.geometry), cx, cy };
    });
  }, [counties]);

  const data = regional.state === "ok" ? regional.data : null;
  const months = data?.months ?? [];
  const idx = months.length - 1;
  const month = months[idx] ?? null;
  const monthLong = (m: string) => formatMonth(locale, `${m}-01`, true);
  const byRegion = useMemo(() => new Map((data?.series ?? []).map((s) => [s.region, s])), [data]);
  const edges = useMemo(() => stepEdges((data?.series ?? []).filter((s) => s.region !== NATIONAL)), [data]);
  const signalsAll = useMemo(() => (data && month ? data.signals.filter((s) => s.month <= month) : []), [data, month]);
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

  const rel = net.state === "ok" ? net.data.relations : null;
  const flows = rel?.flows ?? [];
  const signals = useMemo(() => signalsOf(locale, net.state === "ok" ? net.data.alerts : []), [locale, net]);
  const pairs = useMemo(() => undirectedFlows(flows), [flows]);
  const maxPair = pairs[0]?.patients ?? 0;
  const sel = hover ?? state.unit;

  const spread = useMemo(() => {
    const out: { from: WardCode; to: WardCode; share: number; n: number; total: number }[] = [];
    for (const [unit, s] of signals.byUnit) {
      if (!s.resistance) continue;
      for (const n of nextUnits(flows, unit, MAX_SPREAD)) {
        out.push({ from: unit, to: n.ward, share: n.share, n: n.patients, total: n.share ? Math.round(n.patients / n.share) : n.patients });
      }
    }
    return out;
  }, [signals, flows]);

  const inOut = (code: WardCode) => ({
    out: sum(flows.filter((f) => f.from === code).map((f) => f.patients)),
    inn: sum(flows.filter((f) => f.to === code).map((f) => f.patients)),
  });

  const hospitals = useMemo(() => new Map(HOSPITALS.map((h) => [h.id, { ...h, p: mapPoint(L, h.lon, h.lat) }])), [L]);
  const tyks = hospitals.get("Tyks")?.p ?? [0, 0];
  const pct = (v: number) => Math.round(v * 100);
  const retry = () => setAttempt((n) => n + 1);

  const chooseUnit = (code: WardCode) => {
    setHover(code);
    onChange({ unit: state.unit === code ? null : code });
  };
  const onKey = (e: KeyboardEvent, code: WardCode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      chooseUnit(code);
    }
  };

  const loading = counties.state === "loading" || regional.state === "loading" || net.state === "loading";
  const updating = (regional.fetching && data !== null) || (net.fetching && rel !== null) || (!!asOf && !!data && asOf !== data.asOf);
  const hasError = counties.state === "error" || regional.state === "error" || net.state === "error";
  const edgeMax = (edges[2] as number) ?? 0;
  const steps = [
    { cls: "s0", label: "0" },
    { cls: "s1", label: `≤${fmt(locale, edges[0] as number)}` },
    { cls: "s2", label: `≤${fmt(locale, edges[1] as number)}` },
    { cls: "s3", label: `≤${fmt(locale, edgeMax)}` },
    { cls: "s4", label: `>${fmt(locale, edgeMax)}` },
  ];

  const legend = (
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
        <li>
          <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
            <line x1="1" x2="21" y1="6" y2="6" className="geo-tube" strokeWidth="5" />
          </svg>
          {t(locale, "geoLegendFlow")}
        </li>
        <li>
          <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
            <rect x="2" y="1" width="18" height="10" rx="4" className="geo-box geo-lit" />
          </svg>
          {t(locale, "geoLegendLit")}
        </li>
        <li>
          <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
            <line x1="1" x2="19" y1="6" y2="6" className="geo-spread" strokeWidth="2" />
            <path d="M15 2 L21 6 L15 10Z" className="geo-spread-head" />
          </svg>
          {t(locale, "geoLegendSpread")}
        </li>
        {showTrail ? (
          <li>
            <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
              <line x1="1" x2="21" y1="6" y2="6" className="geo-trail" strokeWidth="2" />
            </svg>
            {t(locale, "geoLegendTrail")}
          </li>
        ) : null}
      </ul>
    </div>
  );

  const fs = chosen ? byRegion.get(chosen) : undefined;
  const card = (
    <div className="geo-card" aria-live="polite">
      {chosen && month ? (
        <>
          <p className="geo-card-name">
            <strong>{shortName(chosen)}</strong>
            {signalOf.has(chosen) ? <Glyph strong={(signalOf.get(chosen) as RegionalSignal).strong} /> : null}
          </p>
          {fs ? (
            <>
              <p className="geo-card-figs">
                {t(locale, "geoMonthCases", { cases: fmt(locale, casesAt(chosen) ?? 0, 0), month: monthLong(month) })} · {rateText(chosen)}
              </p>
              <p className="geo-card-figs">
                {t(locale, "mapFocusTwelve", {
                  n: fmt(locale, sum(fs.cases.slice(Math.max(0, idx - 11), idx + 1)), 0),
                  month: monthLong(month),
                })}
              </p>
              {signalOf.has(chosen) ? (
                <p className="geo-card-figs">
                  {t(locale, (signalOf.get(chosen) as RegionalSignal).strong ? "mapSignalStrong" : "mapSignalWeak")} ·{" "}
                  {t(locale, "mapSignalDetail", {
                    cases: (signalOf.get(chosen) as RegionalSignal).cases,
                    expected: fmt(locale, (signalOf.get(chosen) as RegionalSignal).expected),
                    p: fmtP(locale, (signalOf.get(chosen) as RegionalSignal).p),
                  })}
                </p>
              ) : null}
              <Spark locale={locale} series={fs} months={months} signals={signalsAll.filter((s) => s.region === chosen)} />
              <p className="geo-faint">{t(locale, "geoExpectedTick")}</p>
            </>
          ) : (
            <p className="geo-faint">{t(locale, "geoNoRegional")}</p>
          )}
        </>
      ) : (
        <p className="geo-faint">{t(locale, "geoPick")}</p>
      )}
    </div>
  );

  const rows = shapes
    .map((c) => ({ ...c, rate: rateAt(c.name), cases: casesAt(c.name) }))
    .sort((x, y) => (y.rate ?? -1) - (x.rate ?? -1) || x.name.localeCompare(y.name));

  const { cx: ccx, cy: ccy, r: cr } = L.circle;

  return (
    <section
      className="board-panel geo"
      aria-labelledby="geo-title"
      aria-busy={loading || updating}
      data-stale={updating}
      data-reduced={reducedMotion}
    >
      <header className="geo-head">
        <h2 id="geo-title" className="geo-title">
          {t(locale, "geoTitle")}
        </h2>
        {data ? (
          <span className="geo-asof">
            <AsOf locale={locale} date={data.asOf} pending={updating} clockDate={asOf ?? undefined} />
            {month ? <span className="geo-month">{monthLong(month)}</span> : null}
          </span>
        ) : null}
        <label className="geo-field">
          <span className="visually-hidden">{t(locale, "mapGroup")}</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t(locale, "mapGroup")}>
            {(data?.groups ?? [DEFAULT_GROUP]).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="geo-chip" aria-pressed={showTrail} onClick={() => setShowTrail((v) => !v)}>
          <svg viewBox="0 0 28 10" width="28" height="10" aria-hidden="true">
            <path d="M1 5 H27" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
          </svg>
          {t(locale, "netTrailLayer")}
        </button>
      </header>

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
          {[counties.state === "404" ? t(locale, "geoNoCounties") : null, regional.state === "404" ? t(locale, "geoNoRegional") : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {!L.wide ? legend : null}

      <div className="geo-stage" ref={wrapRef} data-wide={L.wide}>
        <svg viewBox={`0 0 ${L.w} ${L.h}`} className="geo-svg" role="group" aria-label={t(locale, "geoTitle")}>
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
                className={`geo-county geo-fill-${fillOf(c.name)}`}
                data-selected={chosen === c.name}
                vectorEffect="non-scaling-stroke"
                role="button"
                tabIndex={-1}
                aria-label={shortName(c.name)}
                aria-pressed={chosen === c.name}
                onClick={() => setChosen(c.name)}
                onKeyDown={(e) => e.key === "Enter" && setChosen(c.name)}
              >
                <title>
                  {data && month
                    ? t(locale, "mapCountyLabel", {
                        region: shortName(c.name),
                        cases: casesAt(c.name) ?? 0,
                        month: monthLong(month),
                        rate: rateText(c.name),
                      })
                    : shortName(c.name)}
                </title>
              </path>
            ))}
          </g>

          <path d={cone(tyks as [number, number], L.circle)} className="geo-cone" />

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
                  <circle key={c.name} cx={x} cy={y} r={6} className={s.strong ? "geo-glyph geo-glyph-strong" : "geo-glyph geo-glyph-weak"}>
                    <title>
                      {shortName(c.name)}:{" "}
                      {t(locale, "mapSignalDetail", { cases: s.cases, expected: fmt(locale, s.expected), p: fmtP(locale, s.p) })}
                    </title>
                  </circle>
                );
              })}
          </g>

          <circle cx={tyks[0]} cy={tyks[1]} r={11} className="geo-anchor" />

          <circle cx={ccx} cy={ccy} r={cr} className="geo-lens" />
          <text x={ccx} y={ccy - cr + 22} textAnchor="middle" className="geo-lens-title">
            Tyks
          </text>
          <text x={ccx} y={ccy + cr - 12} textAnchor="middle" className="geo-lens-note">
            {t(locale, "geoSchematic")}
          </text>

          <g className="geo-tubes">
            {pairs.map(({ a, b, patients }) => {
              const active = sel === a || sel === b;
              if (patients < 0.2 * maxPair && !active) return null;
              return (
                <path
                  key={`${a}|${b}`}
                  d={bendPath(unitPoint(L, a), unitPoint(L, b), 0.1)}
                  className="geo-tube"
                  data-active={active}
                  strokeWidth={tubeWidth(patients, maxPair) * 0.9 + 0.6}
                >
                  <title>{t(locale, "netEdgeTitle", { a, b, patients, from: rel?.from ?? "", to: rel?.to ?? "" })}</title>
                </path>
              );
            })}
          </g>

          {showTrail ? (
            <g className="geo-trails">
              {(rel?.links ?? []).map((l, i, all) => {
                const same = all.filter((o, j) => j < i && o.from === l.from && o.to === l.to).length;
                const g = arc(unitPoint(L, l.from), unitPoint(L, l.to), 0.3 + 0.15 * same);
                return (
                  <g key={`${l.from}|${l.to}|${l.phenotype}`}>
                    <title>
                      {t(locale, "netTrailEdge", { phenotype: phenotypeName(l.phenotype), patients: l.patients, confirmed: l.confirmed })}
                    </title>
                    <path
                      d={g.d}
                      className="geo-trail"
                      strokeWidth={1.5 + Math.min(l.patients, 6) * 0.4}
                      markerEnd="url(#geo-arrow-trail)"
                    />
                    <text x={g.mx} y={g.my + 4} textAnchor="middle" className="geo-tag-text">
                      {phenotypeName(l.phenotype)} · n {l.patients}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          <g className="geo-spreads">
            {spread.map((sp) => {
              const g = arc(unitPoint(L, sp.from), unitPoint(L, sp.to), -0.22);
              const label = t(locale, "geoSpread", { share: pct(sp.share), n: sp.n });
              return (
                <g key={`${sp.from}|${sp.to}`} data-active={sel === sp.from || sel === sp.to}>
                  <title>{t(locale, "geoSpreadTitle", { share: pct(sp.share), from: sp.from, n: sp.n, total: sp.total, to: sp.to })}</title>
                  <path d={g.d} className="geo-spread" strokeWidth={1.4 + sp.share * 6} markerEnd="url(#geo-arrow)" />
                  <rect x={g.mx - 33} y={g.my - 9} width="66" height="18" rx="4" className="geo-tag" />
                  <text x={g.mx} y={g.my + 4} textAnchor="middle" className="geo-tag-text">
                    {label}
                  </text>
                </g>
              );
            })}
          </g>

          {WARDS.map((w) => {
            const [x, y] = unitPoint(L, w.code);
            const s = signals.byUnit.get(w.code);
            const lit = s?.resistance ?? false;
            const dataOnly = !!s?.data && !lit;
            const kinds = [...new Set((s?.badges ?? []).map((b) => b.kind))].slice(0, 3);
            const aria = [
              t(locale, "netNodeAria", { unit: w.code, name: wardName(locale, w.code) }),
              s
                ? t(locale, "netNodeSignals", { n: s.alerts.length, list: s.badges.map(badgeText).join("; ") })
                : rel
                  ? t(locale, "netNodeNoSignals")
                  : null,
              state.unit === w.code ? t(locale, "geoUnitSelected") : null,
              state.focus === w.code ? t(locale, "geoUnitFocus") : null,
            ]
              .filter(Boolean)
              .join(". ");
            return (
              <g
                key={w.code}
                className="geo-node"
                role="button"
                tabIndex={0}
                aria-pressed={state.unit === w.code}
                aria-label={aria}
                data-selected={state.unit === w.code}
                data-focus={state.focus === w.code}
                onClick={() => chooseUnit(w.code)}
                onKeyDown={(e) => onKey(e, w.code)}
                onMouseEnter={() => setHover(w.code)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(w.code)}
                onBlur={() => setHover(null)}
              >
                <title>{aria}</title>
                <rect
                  className="geo-ring"
                  x={x - NODE_HALF_W - 5}
                  y={y - NODE_HALF_H - 5}
                  width={NODE_HALF_W * 2 + 10}
                  height={NODE_HALF_H * 2 + 10}
                  rx="11"
                />
                <rect
                  className={lit ? "geo-box geo-lit" : "geo-box"}
                  x={x - NODE_HALF_W}
                  y={y - NODE_HALF_H}
                  width={NODE_HALF_W * 2}
                  height={NODE_HALF_H * 2}
                  rx="7"
                  strokeDasharray={dataOnly ? "5 3" : undefined}
                />
                <text x={x} y={y + 4.5} textAnchor="middle" className="geo-code">
                  {w.code}
                </text>
                {kinds.length > 0 ? (
                  <g>
                    <rect
                      x={x + NODE_HALF_W - 6 - kinds.length * 10}
                      y={y - NODE_HALF_H - 11}
                      width={kinds.length * 10 + 8}
                      height="16"
                      rx="8"
                      className="geo-badge"
                    />
                    <text
                      x={x + NODE_HALF_W - 2 - (kinds.length * 10) / 2}
                      y={y - NODE_HALF_H + 1}
                      textAnchor="middle"
                      className="geo-badge-text"
                    >
                      {kinds.map((k) => KIND_GLYPH[k]).join("")}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>

        {L.wide ? (
          <div className="geo-overlay">
            {legend}
            {card}
          </div>
        ) : null}
      </div>

      {!L.wide ? card : null}

      <div className="geo-lists">
        <section aria-labelledby="geo-units-h">
          <h3 id="geo-units-h" className="geo-h3">
            {t(locale, "geoUnits")}
            {rel ? <span className="geo-faint"> · {t(locale, "netWindowNote")}</span> : null}
          </h3>
          {net.state === "error" ? (
            <p className="geo-faint">{t(locale, "netError")}</p>
          ) : (
            <ul className="geo-list">
              {WARDS.map((w) => {
                const s = signals.byUnit.get(w.code);
                const f = inOut(w.code);
                return (
                  <li key={w.code}>
                    <button
                      type="button"
                      className="geo-row"
                      aria-pressed={state.unit === w.code}
                      data-focus={state.focus === w.code}
                      data-lit={s?.resistance ?? false}
                      onClick={() => chooseUnit(w.code)}
                      onMouseEnter={() => setHover(w.code)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="geo-row-code">{w.code}</span>
                      <span className="geo-row-name">{wardName(locale, w.code)}</span>
                      <span className="geo-row-glyphs" aria-hidden="true">
                        {[...new Set((s?.badges ?? []).map((b) => b.kind))].map((k) => KIND_GLYPH[k]).join(" ")}
                      </span>
                      <span className="geo-row-figs">{rel ? t(locale, "geoFlowOutIn", { out: f.out, in: f.inn }) : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {signals.hospitalWide > 0 ? <p className="geo-faint">{t(locale, "netHospitalWide", { n: signals.hospitalWide })}</p> : null}
        </section>

        <section aria-labelledby="geo-counties-h">
          <h3 id="geo-counties-h" className="geo-h3">
            {t(locale, "geoCounties")}
          </h3>
          {rows.length === 0 ? (
            <p className="geo-faint">{counties.state === "404" ? t(locale, "geoNoCounties") : t(locale, "mapLoading")}</p>
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
                    <span className="geo-row-name">{shortName(c.name)}</span>
                    <span className="geo-row-figs">
                      {c.rate === null ? "–" : fmt(locale, c.rate)} · n {c.cases ?? 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
