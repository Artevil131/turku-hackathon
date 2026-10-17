import type { Alert, RelationsResponse } from "@aei/contract";
import { WARDS, type WardCode } from "@aei/domain";
import { phenotypeName, t, wardName } from "@aei/i18n";
import { nextUnits, undirectedFlows } from "@aei/relations";
import { type KeyboardEvent, useMemo, useState } from "react";
import { AsOf } from "../../AsOf.tsx";
import type { PanelProps } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { badgeText, shiftDays, signalsOf } from "../network/model.ts";
import "./geo.css";
import { arc, curve, GRAPH_H, GRAPH_W, NODE_HALF_H, NODE_HALF_W, nodeRect, outwardSide, placeTags, route, unitPoint } from "./layout.ts";
import { useLoad } from "./useLoad.ts";

// The Tyks unit graph (its own window): the six hospital units on an inner
// ring, the emergency department and the health centres outside it. Only the
// meaningful flows are drawn: each unit's strongest two outgoing flows plus
// every flow that touches a lit or selected unit; "all flows" adds the rest,
// faint. Edge width is the number of patients on a linear scale, edges bulge
// round the ring instead of across it, lit units get the red ring and one
// glyph per kind of signal, and accent arrows show where the patients of a lit
// unit go next, each labelled "share · n" beside the edge. Positions are
// schematic.

const WINDOW_DAYS = 28;
const MAX_SPREAD = 3;
const KEEP_OUT = 2;
/** Edge width in viewBox units: linear in patients, from a hairline to 8. */
const edgeWidth = (patients: number, max: number) => 1.2 + 6.8 * (max > 0 ? patients / max : 0);
const pct = (v: number) => Math.round(v * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type Net = { relations: RelationsResponse; alerts: Alert[] };

export function UnitGraph({ client, locale, asOf, state, onChange, reducedMotion }: PanelProps) {
  const [hover, setHover] = useState<WardCode | null>(null);
  const [showTrail, setShowTrail] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
  const rel = net.state === "ok" ? net.data.relations : null;
  const flows = rel?.flows ?? [];
  const signals = useMemo(() => signalsOf(locale, net.state === "ok" ? net.data.alerts : []), [locale, net]);
  const pairs = useMemo(() => undirectedFlows(flows), [flows]);
  const maxPair = pairs[0]?.patients ?? 0;
  const sel = hover ?? state.unit ?? state.focus;

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

  const lit = useMemo(() => new Set<WardCode>([...signals.byUnit].filter(([, s]) => s.resistance).map(([unit]) => unit)), [signals]);

  // The flows worth drawing: each unit's strongest outgoing ones, and everything that touches a lit or chosen unit.
  const strongest = useMemo(() => {
    const keys = new Set<string>();
    for (const w of WARDS) {
      for (const n of nextUnits(flows, w.code, KEEP_OUT)) keys.add(w.code < n.ward ? `${w.code}|${n.ward}` : `${n.ward}|${w.code}`);
    }
    return keys;
  }, [flows]);

  const spreadTags = useMemo(() => {
    const list = [...spread]
      .sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to))
      .map((sp) => {
        const g = curve(unitPoint(sp.from), unitPoint(sp.to), route(sp.from, sp.to));
        const label = t(locale, "geoSpread", { share: pct(sp.share), n: sp.n });
        return { sp, g, label, w: Math.round(label.length * 6.8 + 18), side: outwardSide(g) };
      });
    const spots = placeTags(
      list.map((x) => ({ id: `${x.sp.from}|${x.sp.to}`, w: x.w, side: x.side, at: x.g.at, tan: x.g.tan })),
      WARDS.map((w) => nodeRect(unitPoint(w.code))),
      { x0: 0, y0: 0, x1: GRAPH_W, y1: GRAPH_H },
    );
    return list.map((x) => ({ ...x, spot: spots.get(`${x.sp.from}|${x.sp.to}`) }));
  }, [spread, locale]);

  const choose = (code: WardCode) => {
    setHover(code);
    onChange({ unit: state.unit === code ? null : code });
  };
  const onKey = (e: KeyboardEvent, code: WardCode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(code);
    }
  };
  const loading = net.state === "loading";
  const updating = net.fetching && rel !== null;

  return (
    <section
      className="board-panel ug"
      aria-labelledby="ug-title"
      aria-busy={loading || updating}
      data-stale={updating}
      data-reduced={reducedMotion}
    >
      <header className="ug-head">
        <h2 id="ug-title" className="ug-title">
          {t(locale, "graphTitle")}
        </h2>
        {rel ? <AsOf locale={locale} date={rel.to} pending={updating} clockDate={asOf ?? undefined} /> : null}
        <span className="ug-window">{t(locale, "netWindowNote")}</span>
        <button type="button" className="geo-chip" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
          {t(locale, "netAllFlows")}
        </button>
        <button type="button" className="geo-chip" aria-pressed={showTrail} onClick={() => setShowTrail((v) => !v)}>
          <svg viewBox="0 0 28 10" width="28" height="10" aria-hidden="true">
            <path d="M1 5 H27" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
          </svg>
          {t(locale, "netTrailLayer")}
        </button>
      </header>

      {net.state === "error" ? (
        <div className="geo-state" role="alert">
          <span>{t(locale, "netError")}</span>
          <button type="button" className="geo-chip" onClick={() => setAttempt((n) => n + 1)}>
            {t(locale, "mapRetry")}
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="geo-state" role="status">
          {t(locale, "netLoading")}
        </p>
      ) : null}

      <div className="ug-stage">
        <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="ug-svg" role="group" aria-label={t(locale, "graphTitle")}>
          <defs>
            <marker
              id="ug-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M1 1 L9 5 L1 9 Z" className="geo-spread-head" />
            </marker>
            <marker
              id="ug-arrow-trail"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M1 1 L9 5 L1 9 Z" className="geo-trail-head" />
            </marker>
          </defs>

          <g className="geo-tubes">
            {pairs.map(({ a, b, patients }) => {
              const active = sel === a || sel === b;
              const key = `${a}|${b}`;
              const shown = strongest.has(key) || lit.has(a) || lit.has(b) || a === state.focus || b === state.focus || active;
              if (!shown && !showAll) return null;
              return (
                <path
                  key={key}
                  d={curve(unitPoint(a), unitPoint(b), route(a, b)).d}
                  className="geo-tube"
                  data-active={active}
                  data-faint={!shown}
                  strokeWidth={edgeWidth(patients, maxPair) * (shown ? 1 : 0.6)}
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
                const g = arc(unitPoint(l.from), unitPoint(l.to), 0.3 + 0.15 * same);
                return (
                  <g key={`${l.from}|${l.to}|${l.phenotype}`}>
                    <title>
                      {t(locale, "netTrailEdge", { phenotype: phenotypeName(l.phenotype), patients: l.patients, confirmed: l.confirmed })}
                    </title>
                    <path
                      d={g.d}
                      className="geo-trail"
                      strokeWidth={1.5 + Math.min(l.patients, 6) * 0.4}
                      markerEnd="url(#ug-arrow-trail)"
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
            {spreadTags.map(({ sp, g, label, w, spot }) => (
              <g key={`${sp.from}|${sp.to}`} data-active={sel === sp.from || sel === sp.to}>
                <title>{t(locale, "geoSpreadTitle", { share: pct(sp.share), from: sp.from, n: sp.n, total: sp.total, to: sp.to })}</title>
                <path d={g.d} className="geo-spread" strokeWidth={2.4} markerEnd="url(#ug-arrow)" />
                {spot ? (
                  <>
                    {spot.from ? <line x1={spot.from[0]} y1={spot.from[1]} x2={spot.x} y2={spot.y} className="geo-leader" /> : null}
                    <rect x={spot.x - w / 2} y={spot.y - 10} width={w} height="20" rx="10" className="geo-tag" />
                    <text x={spot.x} y={spot.y + 4} textAnchor="middle" className="geo-tag-text">
                      {label}
                    </text>
                  </>
                ) : null}
              </g>
            ))}
          </g>

          {WARDS.map((w) => {
            const [x, y] = unitPoint(w.code);
            const s = signals.byUnit.get(w.code);
            const isLit = lit.has(w.code);
            const dataOnly = !!s?.data && !isLit;
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
            const bw = kinds.length * 15 + 6;
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
                onClick={() => choose(w.code)}
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
                  rx="12"
                />
                <rect
                  className={isLit ? "geo-box geo-lit" : "geo-box"}
                  x={x - NODE_HALF_W}
                  y={y - NODE_HALF_H}
                  width={NODE_HALF_W * 2}
                  height={NODE_HALF_H * 2}
                  rx="8"
                  strokeDasharray={dataOnly ? "5 3" : undefined}
                />
                <text x={x} y={y + 4.5} textAnchor="middle" className="geo-code">
                  {w.code}
                </text>
                {kinds.length > 0 ? (
                  <g transform={`translate(${x + NODE_HALF_W - bw + 8},${y - NODE_HALF_H - 12})`}>
                    <rect width={bw} height="19" rx="9.5" className="geo-badge" />
                    {kinds.map((k, i) => (
                      <g key={k} transform={`translate(${4 + i * 15},1.5) scale(0.95)`} className="geo-badge-glyph">
                        <KindGlyph kind={k} />
                      </g>
                    ))}
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="ug-keys">
        <li>
          <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
            <path d="M1 6 Q13 0 25 6" className="geo-tube" strokeWidth="5" />
          </svg>
          {t(locale, "geoLegendFlow")}
        </li>
        <li>
          <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
            <rect x="2" y="2" width="22" height="10" rx="4" className="geo-box geo-lit" />
          </svg>
          {t(locale, "geoLegendLit")}
        </li>
        <li>
          <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
            <line x1="1" x2="20" y1="6" y2="6" className="geo-spread" strokeWidth="2" />
            <path d="M17 2 L25 6 L17 10Z" className="geo-spread-head" />
          </svg>
          {t(locale, "geoLegendSpread")}
        </li>
        {showTrail ? (
          <li>
            <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
              <line x1="1" x2="25" y1="6" y2="6" className="geo-trail" strokeWidth="2" />
            </svg>
            {t(locale, "geoLegendTrail")}
          </li>
        ) : null}
        <li className="ug-schematic">{t(locale, "geoSchematic")}</li>
      </ul>
      {signals.hospitalWide > 0 ? <p className="geo-faint">{t(locale, "netHospitalWide", { n: signals.hospitalWide })}</p> : null}
      {rel && sum(flows.map((f) => f.patients)) === 0 ? <p className="geo-faint">{t(locale, "netNoFlows")}</p> : null}
    </section>
  );
}
