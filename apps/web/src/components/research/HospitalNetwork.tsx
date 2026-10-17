import type { Alert, RelationsResponse } from "@aei/contract";
import { WARDS, type WardCode } from "@aei/domain";
import { formatDate, phenotypeName, t, wardName } from "@aei/i18n";
import { nextUnits, previousUnits, undirectedFlows } from "@aei/relations";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { AsOf } from "../AsOf.tsx";
import { curve, H, POS, tubeWidth, W } from "../Network.tsx";
import type { PanelProps } from "./board.ts";
import "./HospitalNetwork.css";
import { alertLine, badgeText, KIND_GLYPH, shiftDays, signalsOf } from "./network/model.ts";

// The researcher's hospital network (spec-research.md, HospitalNetwork): nine
// units placed as on the home schematic, patient flow as tubes, units lit by
// the last 28 days of alerts, the units downstream of a lit unit shaded by the
// share of its patients that go there (a share of flow, never exposure: gap R3),
// and an optional layer of phenotype trails as dashed arrows.

const NODE_W = 200;
const NODE_H = 84;
const PILL_H = 26;
const VIEW_H = H + 70;
const MAX_PILLS = 2;
const WINDOW_DAYS = 28;
const TRAIL_TRIM = 104;

type Loaded = { relations: RelationsResponse; alerts: Alert[] };

/** A directed trail path from one unit's edge to the other's, bent aside so it does not sit on the tube. */
function trail(from: WardCode, to: WardCode, bend: number) {
  const [x1, y1] = POS[from] ?? [0, 0];
  const [x2, y2] = POS[to] ?? [0, 0];
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend;
  const trim = (px: number, py: number, qx: number, qy: number) => {
    const len = Math.hypot(qx - px, qy - py) || 1;
    // Leave the node box: the box is wider than tall, so trim by the direction.
    const ux = (qx - px) / len;
    const uy = (qy - py) / len;
    const k = Math.min(NODE_W / 2 / (Math.abs(ux) || 1e-6), NODE_H / 2 / (Math.abs(uy) || 1e-6)) + 8;
    return [px + ux * Math.min(k, TRAIL_TRIM), py + uy * Math.min(k, TRAIL_TRIM)] as const;
  };
  const [sx, sy] = trim(x1, y1, cx, cy);
  const [ex, ey] = trim(x2, y2, cx, cy);
  return { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, mx: 0.25 * sx + 0.5 * cx + 0.25 * ex, my: 0.25 * sy + 0.5 * cy + 0.25 * ey };
}

export function HospitalNetwork({ client, locale, asOf, state, onChange }: PanelProps) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [showTrail, setShowTrail] = useState(false);
  const [hover, setHover] = useState<WardCode | null>(null);

  useEffect(() => {
    if (!asOf) return;
    // Retry bumps `reload`; naming it here keeps the dependency honest.
    void reload;
    let live = true;
    setLoading(true);
    setError(false);
    Promise.all([client.relations({ days: WINDOW_DAYS }), client.alerts({ from: shiftDays(asOf, -(WINDOW_DAYS - 1)) })])
      .then(([relations, al]) => {
        if (!live) return;
        setData({ relations, alerts: al.alerts });
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [client, asOf, reload]);

  const rel = data?.relations ?? null;
  // A refetch keeps the previous data on screen, dimmed, with an "updating" line next to the as-of.
  const updating = !!rel && (loading || (!!asOf && asOf !== rel.asOf));
  const flows = rel?.flows ?? [];
  const pairs = useMemo(() => undirectedFlows(flows), [flows]);
  const maxPair = pairs[0]?.patients ?? 0;
  const signals = useMemo(() => signalsOf(locale, data?.alerts ?? []), [locale, data]);

  // Downstream shading: for each unit lit by a resistance signal, where its patients go next.
  const downstream = useMemo(() => {
    const map = new Map<WardCode, { from: WardCode; share: number; n: number; total: number }[]>();
    for (const [unit, s] of signals.byUnit) {
      if (!s.resistance) continue;
      for (const n of nextUnits(flows, unit, 4)) {
        const list = map.get(n.ward) ?? [];
        list.push({ from: unit, share: n.share, n: n.patients, total: n.share ? Math.round(n.patients / n.share) : n.patients });
        map.set(n.ward, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.share - a.share);
    return map;
  }, [signals, flows]);

  const sel = hover ?? state.unit;
  const pct = (share: number) => Math.round(share * 100);
  const from = rel ? formatDate(locale, rel.from) : "";
  const to = rel ? formatDate(locale, rel.to) : "";

  const select = (code: WardCode) => {
    setHover(code);
    onChange({ unit: state.unit === code ? null : code });
  };
  const onKey = (e: KeyboardEvent, code: WardCode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(code);
    }
  };

  const nodeLabel = (code: WardCode) => {
    const s = signals.byUnit.get(code);
    const ds = downstream.get(code);
    return [
      t(locale, "netNodeAria", { unit: code, name: wardName(locale, code) }),
      s
        ? t(locale, "netNodeSignals", { n: s.alerts.length, list: s.badges.map(badgeText).join("; ") })
        : data
          ? t(locale, "netNodeNoSignals")
          : null,
      ...(ds ?? []).map((d) => t(locale, "netNodeShare", { share: pct(d.share), unit: d.from, n: d.n, total: d.total })),
      state.unit === code ? t(locale, "netNodeSelected") : null,
      state.focus === code ? t(locale, "netNodeFocus") : null,
    ]
      .filter(Boolean)
      .join(". ");
  };

  const unitsLit = WARDS.filter((w) => signals.byUnit.has(w.code));

  return (
    <section className="board-panel hnet" aria-labelledby="hnet-title" aria-busy={loading} data-stale={updating}>
      <header className="hnet-head">
        <div className="hnet-titleline">
          <h2 id="hnet-title" className="hnet-title">
            {rel ? t(locale, "netTitle", { from, to }) : t(locale, "netPanelAria")}
          </h2>
          {rel ? <AsOf locale={locale} date={rel.asOf} pending={updating} clockDate={asOf ?? undefined} /> : null}
        </div>
        <p className="hnet-note">{t(locale, "netShareNote")}</p>
        <div className="hnet-controls">
          <button type="button" className="hnet-chip" aria-pressed={showTrail} onClick={() => setShowTrail((v) => !v)}>
            <svg viewBox="0 0 28 10" width="28" height="10" aria-hidden="true">
              <path d="M1 5 H27" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            {t(locale, "netTrailLayer")}
          </button>
        </div>
      </header>

      {error ? (
        <div className="hnet-state" role="alert">
          <p>{t(locale, "netError")}</p>
          <button type="button" className="btn" onClick={() => setReload((n) => n + 1)}>
            {t(locale, "retry")}
          </button>
        </div>
      ) : null}
      {!error && !data ? (
        <p className="hnet-state" role="status">
          {t(locale, "netLoading")}
        </p>
      ) : null}
      {data && flows.length === 0 ? (
        <p className="hnet-state" role="status">
          {t(locale, "netNoFlows")}
        </p>
      ) : null}

      <svg viewBox={`0 0 ${W} ${VIEW_H}`} className="hnet-svg" role="group" aria-label={t(locale, "netPanelAria")}>
        <defs>
          <marker id="hnet-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L9 5 L1 9 Z" fill="var(--resist)" />
          </marker>
        </defs>

        <g className="hnet-tubes">
          {pairs.map(({ a, b, patients }) => {
            const active = sel === a || sel === b;
            // The faintest pairs only appear when one of their units is in focus, so the map stays calm.
            if (patients < 0.2 * maxPair && !active) return null;
            return (
              <path
                key={`${a}|${b}`}
                d={curve(a, b)}
                className="hnet-tube"
                data-active={active}
                strokeWidth={tubeWidth(patients, maxPair) * 1.4}
              >
                <title>{t(locale, "netEdgeTitle", { a, b, patients, from, to })}</title>
              </path>
            );
          })}
        </g>

        {showTrail ? (
          <g className="hnet-trails">
            {(rel?.links ?? []).map((l, i, all) => {
              const sameRoute = all.filter((o, j) => j < i && o.from === l.from && o.to === l.to).length;
              const geo = trail(l.from, l.to, 0.28 + 0.14 * sameRoute);
              const label = t(locale, "netTrailEdge", {
                phenotype: phenotypeName(l.phenotype),
                patients: l.patients,
                confirmed: l.confirmed,
              });
              return (
                <g key={`${l.from}|${l.to}|${l.phenotype}`}>
                  <title>{label}</title>
                  <path d={geo.d} className="hnet-trail" strokeWidth={1.6 + Math.min(l.patients, 6) * 0.5} markerEnd="url(#hnet-arrow)" />
                  <g transform={`translate(${geo.mx},${geo.my})`}>
                    <rect x="-44" y="-12" width="88" height="24" rx="6" className="hnet-trail-tag" />
                    <text className="hnet-trail-text" textAnchor="middle" y="5">
                      {phenotypeName(l.phenotype)} · {l.patients}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        ) : null}

        {WARDS.map((w) => {
          const [cx, cy] = POS[w.code] ?? [0, 0];
          const s = signals.byUnit.get(w.code);
          const ds = downstream.get(w.code);
          const top = ds?.[0];
          const lit = s?.resistance ?? false;
          const dataOnly = !!s?.data && !lit;
          const fill = top ? `color-mix(in oklab, var(--live) ${Math.round(8 + (Math.min(top.share, 0.5) / 0.5) * 38)}%, #fff)` : undefined;
          const pills = (s?.badges ?? []).slice(0, MAX_PILLS);
          const extra = (s?.badges.length ?? 0) - pills.length;
          return (
            <g
              key={w.code}
              className="hnet-node"
              role="button"
              tabIndex={0}
              aria-pressed={state.unit === w.code}
              aria-label={nodeLabel(w.code)}
              data-lit={lit}
              data-data={s?.data ?? false}
              data-selected={state.unit === w.code}
              data-focus={state.focus === w.code}
              data-shaded={!!top}
              onClick={() => select(w.code)}
              onKeyDown={(e) => onKey(e, w.code)}
              onMouseEnter={() => setHover(w.code)}
              onFocus={() => setHover(w.code)}
            >
              <rect
                className="hnet-ring"
                x={cx - NODE_W / 2 - 7}
                y={cy - NODE_H / 2 - 7}
                width={NODE_W + 14}
                height={NODE_H + 14}
                rx="20"
              />
              <rect
                className="hnet-box"
                x={cx - NODE_W / 2}
                y={cy - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx="14"
                style={fill ? { fill } : undefined}
                strokeDasharray={dataOnly ? "9 6" : undefined}
              />
              <text className="hnet-code" x={cx} y={cy - 8} textAnchor="middle">
                {w.code}
              </text>
              <text className="hnet-name" x={cx} y={cy + 14} textAnchor="middle">
                {wardName(locale, w.code)}
              </text>
              {top ? (
                <text className="hnet-share" x={cx} y={cy + 33} textAnchor="middle">
                  {t(locale, "netShareOnNode", { share: pct(top.share), n: top.n, total: top.total })}
                </text>
              ) : null}
              {pills.map((b, i) => {
                const text = `${KIND_GLYPH[b.kind]} ${badgeText(b)}`;
                const width = Math.round(text.length * 8.8 + 22);
                const px = Math.max(4, Math.min(W - 4 - width, cx - width / 2));
                const py = cy + NODE_H / 2 + 8 + i * (PILL_H + 4);
                return (
                  <g key={b.key}>
                    <rect className="hnet-pill" data-kind={b.kind} x={px} y={py} width={width} height={PILL_H} rx="8" />
                    <text className="hnet-pill-text" x={px + width / 2} y={py + 18} textAnchor="middle">
                      {text}
                    </text>
                  </g>
                );
              })}
              {extra > 0 ? (
                <text className="hnet-more" x={cx} y={cy + NODE_H / 2 + 8 + pills.length * (PILL_H + 4) + 16} textAnchor="middle">
                  {t(locale, "netMore", { n: extra })}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {data && downstream.size > 0 ? (
        <section className="hnet-down" aria-labelledby="hnet-down-title">
          <h3 id="hnet-down-title" className="hnet-h3">
            {t(locale, "netDownHeading")}
          </h3>
          <ul className="hnet-down-list">
            {WARDS.flatMap((w) =>
              (downstream.get(w.code) ?? []).map((d) => (
                <li key={`${d.from}|${w.code}`} data-active={sel === w.code || sel === d.from}>
                  <span className="hnet-down-share">{pct(d.share)} %</span>{" "}
                  {t(locale, "netShareCount", { unit: d.from, n: d.n, total: d.total, dest: w.code })}
                </li>
              )),
            )}
          </ul>
          <p className="hnet-faint">
            {t(locale, "netShareNote")} · {from}–{to}
          </p>
        </section>
      ) : null}

      {showTrail ? (
        <ul className="hnet-sr">
          {(rel?.links ?? []).map((l) => (
            <li key={`${l.from}|${l.to}|${l.phenotype}`}>
              {t(locale, "netTrailLinkAria", {
                phenotype: phenotypeName(l.phenotype),
                from: l.from,
                to: l.to,
                patients: l.patients,
                confirmed: l.confirmed,
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="hnet-lower">
        <aside className="hnet-card" aria-live="polite">
          {sel ? (
            <FocusCard
              unit={sel}
              locale={locale}
              flows={flows}
              signals={signals.byUnit.get(sel)}
              shares={downstream.get(sel)}
              selected={state.unit === sel}
              ready={!!data}
              onFilter={() => onChange({ unit: state.unit === sel ? null : sel })}
            />
          ) : (
            <p className="hnet-hint">{t(locale, "netFocusHint")}</p>
          )}
        </aside>

        <div className="hnet-signals">
          <h3 className="hnet-h3">{t(locale, "netSignalsHeading")}</h3>
          {data && unitsLit.length === 0 ? <p className="hnet-hint">{t(locale, "netSignalsNone")}</p> : null}
          <ul className="hnet-sigs">
            {unitsLit.map((w) => (
              <li key={w.code}>
                <span className="hnet-sig-unit">{w.code}</span>
                <span className="hnet-sig-badges">
                  {signals.byUnit.get(w.code)?.badges.map((b) => (
                    <span key={b.key} className="hnet-pill-html" data-kind={b.kind}>
                      <span aria-hidden="true">{KIND_GLYPH[b.kind]}</span> {badgeText(b)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {signals.hospitalWide > 0 ? <p className="hnet-hint">{t(locale, "netHospitalWide", { n: signals.hospitalWide })}</p> : null}
        </div>
      </div>

      <section className="hnet-legend" aria-label={t(locale, "netLegendTitle")}>
        <h3 className="hnet-h3">{t(locale, "netLegendTitle")}</h3>
        <ul>
          <li>
            <svg viewBox="0 0 44 14" width="44" height="14" aria-hidden="true">
              <path d="M2 7 H42" stroke="var(--ink-3)" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
            </svg>
            {t(locale, "netLegendEdge")}
          </li>
          <li>
            <span className="hnet-sw hnet-sw-lit" aria-hidden="true" />
            {t(locale, "netLegendLit")}
          </li>
          <li>
            <span className="hnet-sw hnet-sw-data" aria-hidden="true" />
            {t(locale, "netLegendData")}
          </li>
          <li>
            <span className="hnet-sw hnet-sw-shade" aria-hidden="true" />
            {t(locale, "netLegendShade")}
          </li>
          <li>
            <svg viewBox="0 0 44 14" width="44" height="14" aria-hidden="true">
              <path d="M2 7 H36" stroke="var(--resist)" strokeWidth="2.4" strokeDasharray="6 4" />
              <path d="M34 2 L43 7 L34 12 Z" fill="var(--resist)" />
            </svg>
            {t(locale, "netLegendTrail")}
          </li>
          <li>
            <span className="hnet-sw hnet-sw-sel" aria-hidden="true" />
            {t(locale, "netLegendSelected")}
          </li>
        </ul>
      </section>
    </section>
  );
}

interface CardProps {
  unit: WardCode;
  locale: PanelProps["locale"];
  flows: RelationsResponse["flows"];
  signals: ReturnType<typeof signalsOf>["byUnit"] extends Map<WardCode, infer U> ? U | undefined : never;
  shares: { from: WardCode; share: number; n: number; total: number }[] | undefined;
  selected: boolean;
  ready: boolean;
  onFilter: () => void;
}

function FocusCard({ unit, locale, flows, signals, shares, selected, ready, onFilter }: CardProps) {
  const next = nextUnits(flows, unit, 9);
  const prev = previousUnits(flows, unit, 9);
  return (
    <>
      <div className="hnet-card-head">
        <span className="hnet-card-code">{unit}</span>
        <span className="hnet-card-name">{wardName(locale, unit)}</span>
      </div>

      {signals ? (
        <ul className="hnet-card-alerts">
          {signals.alerts.map((a) => (
            <li key={a.id}>
              <span className="hnet-card-date">{formatDate(locale, a.date)}</span> {alertLine(locale, a)}
            </li>
          ))}
        </ul>
      ) : ready ? (
        <p className="hnet-hint">{t(locale, "netNodeNoSignals")}</p>
      ) : null}

      {shares?.map((d) => (
        <p key={d.from} className="hnet-card-share">
          {t(locale, "netGoesHere", { share: Math.round(d.share * 100), unit: d.from, n: d.n, total: d.total })}{" "}
          <span className="hnet-faint">({t(locale, "netShareNote")})</span>
        </p>
      ))}

      {ready ? (
        <div className="hnet-card-flows">
          <div>
            <h3 className="hnet-h3">{t(locale, "netGoesNext")}</h3>
            {next.length === 0 ? (
              <p className="hnet-hint">{t(locale, "netNoneListed")}</p>
            ) : (
              <ul className="hnet-flowlist">
                {next.map((n) => (
                  <li key={n.ward}>
                    <span className="hnet-flow-unit">{n.ward}</span>
                    <span className="hnet-bar" aria-hidden="true">
                      <i style={{ width: `${Math.round(n.share * 100)}%` }} />
                    </span>
                    <span className="hnet-flow-n">
                      {Math.round(n.share * 100)} % · {t(locale, "netPatients", { n: n.patients })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="hnet-faint">{t(locale, "netShareNote")}</p>
          </div>
          <div>
            <h3 className="hnet-h3">{t(locale, "netComesFrom")}</h3>
            {prev.length === 0 ? (
              <p className="hnet-hint">{t(locale, "netNoneListed")}</p>
            ) : (
              <ul className="hnet-flowlist">
                {prev.map((p) => (
                  <li key={p.ward}>
                    <span className="hnet-flow-unit">{p.ward}</span>
                    <span className="hnet-flow-n">{t(locale, "netPatients", { n: p.patients })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <button type="button" className="btn hnet-filter" aria-pressed={selected} onClick={onFilter}>
        {selected ? t(locale, "netFilterFeedOn") : t(locale, "netFilterFeed")}
      </button>
    </>
  );
}
