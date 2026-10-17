import type { Alert, RelationsResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { t, wardName } from "@aei/i18n";
import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { currentHospitalName, networkUnits } from "../../../sites.ts";
import { AsOf } from "../../AsOf.tsx";
import { InfoButton } from "../../Info.tsx";
import { kindOf, type PanelProps, type SignalKind } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { badgeText, shiftDays, signalsOf, type UnitSignals } from "../network/model.ts";
import "./geo.css";
import { FlowMatrix } from "./FlowMatrix.tsx";
import { bandOpacity, bandPath, groupFlows, type Item, layoutFlow, type Placed } from "./flowLayout.ts";
import { useLoad } from "./useLoad.ts";

// The researcher's unit graph: one unit at a time, as a small three-column
// Sankey. The unit in focus stands in the middle, the units that sent patients
// to it on the left, the units its patients went to next on the right, each
// band as thick as the number of patients. Clicking a side unit moves the focus
// there. Beside a wide panel the columns sit side by side; on a narrow one they
// stack (in-flows above, out-flows below). Positions are schematic. Bands are
// shaded on one ramp by patients; bands to or from a unit with a resistance
// signal use the accent. A second view lists all units as a flow matrix.

const WINDOW_DAYS = 28;
const NARROW = 560;
const PAD = 8;
const LABEL_W = 132;
const BAR = 8;
const CENTRE_W = 92;
const pct = (v: number) => Math.round(v * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type Net = { relations: RelationsResponse; alerts: Alert[] };

/** The glyph kind of a unit's signals: a resistance kind first, else the data problem. */
function glyphKind(s: UnitSignals | undefined): SignalKind | null {
  if (!s) return null;
  return s.badges.find((b) => b.kind !== "data")?.kind ?? s.badges[0]?.kind ?? null;
}

interface Size {
  w: number;
  h: number;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 640, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () =>
      setSize((p) =>
        Math.round(el.clientWidth) === p.w && Math.round(el.clientHeight) === p.h
          ? p
          : { w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) },
      );
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

export function UnitGraph({ client, locale, asOf, state, onChange, reducedMotion, kin = [], hasSelection = false }: PanelProps) {
  const [hover, setHover] = useState<WardCode | null>(null);
  const [mode, setMode] = useState<"around" | "all">("around");
  const [attempt, setAttempt] = useState(0);
  const { ref: stage, size } = useSize();

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
  const lit = useMemo(() => new Set<WardCode>([...signals.byUnit].filter(([, s]) => s.resistance).map(([unit]) => unit)), [signals]);

  // Where the view opens: the open signal's unit, else the unit chosen for the feed, else the unit of the newest
  // resistance signal of the window, else the unit with the most patients moving through it.
  const newest = useMemo(() => {
    let best: Alert | null = null;
    for (const a of net.state === "ok" ? net.data.alerts : []) {
      const kind = kindOf(a);
      if (!kind || kind === "data" || !a.ward) continue;
      if (!best || a.date > best.date) best = a;
    }
    return best?.ward ?? null;
  }, [net]);
  const busiest = useMemo(() => {
    const load = new Map<WardCode, number>();
    for (const f of flows) {
      load.set(f.from, (load.get(f.from) ?? 0) + f.patients);
      load.set(f.to, (load.get(f.to) ?? 0) + f.patients);
    }
    return networkUnits(flows).sort((a, b) => (load.get(b) ?? 0) - (load.get(a) ?? 0) || a.localeCompare(b))[0] ?? null;
  }, [flows]);

  // The signal's own unit, remembered: a click here moves `focus`, which is also where the signal's unit lives.
  const mine = useRef<WardCode | null>(null);
  const [open, setOpen] = useState<WardCode | null>(state.focus);
  useEffect(() => {
    if (state.focus !== mine.current) setOpen(state.focus);
  }, [state.focus]);
  const home = open ?? state.unit ?? newest ?? busiest;
  const centre = state.focus ?? state.unit ?? newest ?? busiest;

  const recentre = (unit: WardCode) => {
    mine.current = unit;
    onChange({ focus: unit });
  };

  const narrow = size.w < NARROW;
  const view = useMemo(() => {
    if (!centre) return null;
    const ins = groupFlows(
      flows.filter((f) => f.to === centre).map((f) => ({ unit: f.from, patients: f.patients })),
      narrow ? { maxItems: 5 } : {},
    );
    const outs = groupFlows(
      flows.filter((f) => f.from === centre).map((f) => ({ unit: f.to, patients: f.patients })),
      narrow ? { maxItems: 5 } : {},
    );
    const nIn = sum(ins.map((i) => i.patients));
    const nOut = sum(outs.map((i) => i.patients));
    const max = Math.max(1, ...ins.map((i) => i.patients), ...outs.map((i) => i.patients));
    return { ins, outs, nIn, nOut, max };
  }, [centre, flows, narrow]);

  const W = Math.max(size.w, 280);
  // Wide: the stage's own height, within bounds; narrow: the stack's fixed height.
  const ZONE = 46;
  const ROW = 60;
  const CH = 88;
  const H = narrow ? ZONE + BAR + ROW + CH + ROW + BAR + ZONE + 4 : Math.min(Math.max(size.h, 160), 480);
  const geom = useMemo(() => {
    if (!view) return null;
    const lay = narrow
      ? layoutFlow(view.ins, view.outs, { span: W - 2 * PAD, minNode: 48, gap: 4, margin: 0, centreMin: W * 0.5 })
      : layoutFlow(view.ins, view.outs, { span: H - 2 * PAD, minNode: 28, gap: 6, margin: 0, centreMin: 64 });
    return lay;
  }, [view, narrow, W, H]);

  const loading = net.state === "loading";
  const updating = net.fetching && rel !== null;
  const showBack = centre !== null && home !== null && centre !== home;

  const aria = (unit: WardCode, item: Item, dir: "in" | "out") => {
    const s = signals.byUnit.get(unit);
    return [
      dir === "in"
        ? t(locale, "netBandIn", { from: unit, to: centre ?? "", n: item.patients, share: pct(item.share) })
        : t(locale, "netBandOut", { from: centre ?? "", to: unit, n: item.patients, share: pct(item.share) }),
      wardName(locale, unit),
      s ? t(locale, "netNodeSignals", { n: s.alerts.length, list: s.badges.map(badgeText).join("; ") }) : null,
      t(locale, "netFlowRecentre"),
    ]
      .filter(Boolean)
      .join(". ");
  };

  const bandAria = (item: Item, dir: "in" | "out") => {
    const list = item.units.join(", ");
    const share = pct(item.share);
    const c = centre ?? "";
    if (item.unit === null) {
      return dir === "in"
        ? t(locale, "netBandOthers", { list, to: c, n: item.patients, share })
        : t(locale, "netBandOthersOut", { list, from: c, n: item.patients, share });
    }
    return dir === "in"
      ? t(locale, "netBandIn", { from: item.unit, to: c, n: item.patients, share })
      : t(locale, "netBandOut", { from: c, to: item.unit, n: item.patients, share });
  };

  // Geometry of the columns (wide) or rows (narrow).
  const xa = PAD + LABEL_W + 6 + BAR; // where the left bands leave their bars
  const xb = W - PAD - LABEL_W - 6 - BAR; // where the right bands reach theirs
  const cx0 = W / 2 - CENTRE_W / 2;
  const cx1 = cx0 + CENTRE_W;
  const yIn = ZONE + BAR; // narrow: where the upper bands leave their bars
  const yC0 = yIn + ROW;
  const yC1 = yC0 + CH;
  const yOut = yC1 + ROW; // narrow: where the lower bands reach their bars

  const cS = centre ? signals.byUnit.get(centre) : undefined;
  const cLit = centre ? lit.has(centre) : false;
  const cKind = glyphKind(cS);
  const cChip = cS ? `${cS.badges[0]?.text ?? ""}${cS.badges.length > 1 ? ` +${cS.badges.length - 1}` : ""}` : "";

  const onKey = (e: KeyboardEvent, unit: WardCode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      recentre(unit);
    }
  };

  const renderSide = (items: Placed[], dir: "in" | "out") =>
    items.map((p) => {
      const unit = p.unit;
      const s = unit ? signals.byUnit.get(unit) : undefined;
      const isLit = unit ? lit.has(unit) : false;
      const gk = glyphKind(s);
      const accent = isLit;
      const o = accent ? bandOpacity(p.patients, view?.max ?? 1, 0.25, 0.7) : bandOpacity(p.patients, view?.max ?? 1, 0.1, 0.5);
      const bandStyle = { "--o": o.toFixed(3), "--o-hi": Math.min(0.9, o + 0.3).toFixed(3) } as CSSProperties;
      const label = `${unit ?? t(locale, "netOthers")} · ${pct(p.share)} % · n ${p.patients}`;
      const d = narrow
        ? dir === "in"
          ? bandPath(yIn, PAD + p.b0, PAD + p.b1, yC0, PAD + p.c0, PAD + p.c1, true)
          : bandPath(yC1, PAD + p.c0, PAD + p.c1, yOut, PAD + p.b0, PAD + p.b1, true)
        : dir === "in"
          ? bandPath(xa, PAD + p.b0, PAD + p.b1, cx0, PAD + p.c0, PAD + p.c1)
          : bandPath(cx1, PAD + p.c0, PAD + p.c1, xb, PAD + p.b0, PAD + p.b1);
      // The bar of the unit node and its label.
      const mid = PAD + (p.n0 + p.n1) / 2;
      const bar = narrow
        ? { x: PAD + p.b0, y: dir === "in" ? ZONE : yOut, w: p.t, h: BAR }
        : { x: dir === "in" ? xa - BAR : xb, y: PAD + p.b0, w: BAR, h: p.t };
      const ring = 3;
      const box = narrow
        ? { x: PAD + p.n0, y: dir === "in" ? 0 : yOut - 2, w: p.n1 - p.n0, h: ZONE + BAR + 2 }
        : dir === "in"
          ? { x: PAD, y: PAD + p.n0, w: xa - PAD, h: p.n1 - p.n0 }
          : { x: xb, y: PAD + p.n0, w: W - PAD - xb, h: p.n1 - p.n0 };
      const nodeKey = `${dir}|${p.key}`;
      const active = hover !== null && hover === unit;
      const labelEl = narrow ? (
        <text className="ug-label" textAnchor="middle" x={PAD + (p.n0 + p.n1) / 2}>
          {[unit ?? t(locale, "netOthers"), `${pct(p.share)} %`, `n ${p.patients}`].map((line, i) => (
            <tspan
              key={line}
              x={PAD + (p.n0 + p.n1) / 2}
              y={(dir === "in" ? 12 : yOut + BAR + 14) + i * 13}
              className={i === 0 ? "ug-code" : undefined}
            >
              {line}
            </tspan>
          ))}
        </text>
      ) : (
        <text className="ug-label" x={dir === "in" ? xa - BAR - 8 : xb + BAR + 8} y={mid + 4} textAnchor={dir === "in" ? "end" : "start"}>
          {label}
        </text>
      );
      const glyph =
        gk && unit ? (
          <g
            className="ug-glyph"
            transform={
              narrow
                ? `translate(${PAD + (p.n0 + p.n1) / 2 + 14},${dir === "in" ? 0 : yOut + BAR + 2}) scale(0.8)`
                : dir === "in"
                  ? `translate(${xa - BAR - 8 - label.length * 6.1 - 20},${mid - 8})`
                  : `translate(${xb + BAR + 8 + label.length * 6.1 + 4},${mid - 8})`
            }
            data-kind={gk}
          >
            <KindGlyph kind={gk} />
          </g>
        ) : null;
      const content = (
        <>
          <path d={d} className="ug-band" style={bandStyle} data-dir={dir} data-accent={accent} data-active={active}>
            <title>{bandAria(p, dir)}</title>
          </path>
          <rect
            className="ug-bar"
            data-lit={isLit}
            data-data={!!s?.data && !isLit}
            data-active={active}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx="2"
          />
          {isLit ? (
            <rect className="ug-ring" x={bar.x - ring} y={bar.y - ring} width={bar.w + 2 * ring} height={bar.h + 2 * ring} rx="5" />
          ) : null}
          {labelEl}
          {glyph}
        </>
      );
      if (!unit) {
        return (
          // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: a labelled SVG group, not an interactive element
          <g key={nodeKey} className="ug-others" role="img" aria-label={bandAria(p, dir)}>
            {content}
          </g>
        );
      }
      return (
        <g
          key={nodeKey}
          className={`ug-node${kin.includes(unit) ? " is-kin" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={aria(unit, p, dir)}
          onClick={() => recentre(unit)}
          onKeyDown={(e) => onKey(e, unit)}
          onMouseEnter={() => setHover(unit)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(unit)}
          onBlur={() => setHover(null)}
        >
          <rect className="ug-hit" x={box.x} y={box.y} width={box.w} height={box.h} rx="6" />
          <rect className="ug-focus" x={box.x} y={box.y} width={box.w} height={box.h} rx="6" />
          {content}
        </g>
      );
    });

  const cTop = narrow ? yC0 : PAD + (geom?.centre.c0 ?? 0);
  const cBottom = narrow ? yC1 : PAD + (geom?.centre.c1 ?? 0);
  const cLeft = narrow ? PAD + (geom?.centre.c0 ?? 0) : cx0;
  const cRight = narrow ? PAD + (geom?.centre.c1 ?? 0) : cx1;
  const cMidX = (cLeft + cRight) / 2;
  const cMidY = (cTop + cBottom) / 2;
  const chipW = Math.round(cChip.length * 6.4 + 34);

  return (
    <section
      className={`board-panel ug${hasSelection ? " has-selection" : ""}`}
      aria-labelledby="ug-title"
      aria-busy={loading || updating}
      data-stale={updating}
      data-reduced={reducedMotion}
    >
      <header className="ug-head">
        <h2 id="ug-title" className="ug-title">
          {centre ? t(locale, "netGraphHeading", { unit: centre }) : t(locale, "graphTitle")}
        </h2>
        {rel ? <AsOf locale={locale} date={rel.to} pending={updating} clockDate={asOf ?? undefined} /> : null}
        <p className="ug-caption">{t(locale, "geoTyksSource", { hospital: currentHospitalName(locale) })}</p>
        <p className="ug-caption">{t(locale, "netFlowCaption")}</p>
        <InfoButton locale={locale} label={t(locale, "netFlowInfoLabel")} align="end">
          {t(locale, "netFlowInfo")}
        </InfoButton>
        <fieldset className="ug-seg" aria-label={t(locale, "netViewAria")}>
          {(["around", "all"] as const).map((m) => (
            <button key={m} type="button" className="ug-seg-btn" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "around" ? t(locale, "netViewAround", { unit: centre ?? "" }).trim() : t(locale, "netViewAll")}
            </button>
          ))}
        </fieldset>
        {showBack && home ? (
          <button
            type="button"
            className="ug-back"
            onClick={() => {
              mine.current = home;
              onChange({ focus: home });
            }}
          >
            ← {t(locale, "netBackToSignal")}
          </button>
        ) : null}
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

      {mode === "around" && view && centre ? (
        <p className="ug-story">
          {t(locale, "netStory", { unit: centre, nIn: view.nIn, nOut: view.nOut })} {(() => {
            const top = (xs: typeof view.ins) => xs.filter((x) => x.unit).sort((a, b) => b.patients - a.patients)[0];
            const a = top(view.ins);
            const b = top(view.outs);
            return [
              a ? t(locale, "netStoryFrom", { unit: a.unit ?? "", share: pct(a.share) }) : null,
              b ? t(locale, "netStoryTo", { unit: b.unit ?? "", share: pct(b.share) }) : null,
              cLit ? t(locale, "netStorySignal", { unit: centre }) : null,
            ]
              .filter(Boolean)
              .join(" ");
          })()}
        </p>
      ) : null}
      {mode === "around" && view && centre && narrow ? (
        <p className="ug-dir" data-side="in">
          ↓ {t(locale, "netDirIn", { unit: centre })}
        </p>
      ) : null}
      {mode === "around" && view && centre && !narrow ? (
        <p className="ug-dir ug-dir-row">
          <span>→ {t(locale, "netDirIn", { unit: centre })}</span>
          <span>{t(locale, "netDirOut", { unit: centre })} →</span>
        </p>
      ) : null}
      <div className="ug-stage" ref={stage} data-narrow={narrow} data-view={mode}>
        {mode === "all" ? (
          rel ? (
            <FlowMatrix
              locale={locale}
              flows={flows}
              focus={centre}
              kindOf={(u) => glyphKind(signals.byUnit.get(u))}
              signalText={(u) => {
                const sg = signals.byUnit.get(u);
                return sg ? t(locale, "netNodeSignals", { n: sg.alerts.length, list: sg.badges.map(badgeText).join("; ") }) : null;
              }}
              onPick={(u) => {
                recentre(u);
                setMode("around");
              }}
            />
          ) : null
        ) : view && geom && centre && (view.ins.length > 0 || view.outs.length > 0) ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            // The drawing is laid out at the stage's measured size and then scales with the box, so a window
            // smaller than the layout's minimums shrinks the figure instead of cropping it.
            width="100%"
            height={narrow ? H : "100%"}
            preserveAspectRatio="xMidYMid meet"
            className="ug-svg"
            data-hover={hover !== null}
            role="group"
            aria-label={t(locale, "graphTitle")}
          >
            <g key={centre} className="ug-flow">
              <g className="ug-bands">
                {renderSide(geom.ins, "in")}
                {renderSide(geom.outs, "out")}
              </g>
              {/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: a labelled SVG group, not an interactive element */}
              <g
                className="ug-centre"
                role="group"
                aria-label={[
                  t(locale, "netCentreAria", { unit: centre, name: wardName(locale, centre), nIn: view.nIn, nOut: view.nOut }),
                  cS ? t(locale, "netNodeSignals", { n: cS.alerts.length, list: cS.badges.map(badgeText).join("; ") }) : null,
                ]
                  .filter(Boolean)
                  .join(". ")}
              >
                {cLit ? (
                  <rect className="ug-ring" x={cLeft - 4} y={cTop - 4} width={cRight - cLeft + 8} height={cBottom - cTop + 8} rx="12" />
                ) : null}
                <rect
                  className="ug-centre-box"
                  data-hover={hover !== null}
                  data-data={!!cS?.data && !cLit}
                  x={cLeft}
                  y={cTop}
                  width={cRight - cLeft}
                  height={cBottom - cTop}
                  rx="8"
                />
                <text className="ug-centre-code" x={cMidX} y={narrow ? cTop + 22 : cMidY - 8} textAnchor="middle">
                  {centre}
                </text>
                <text className="ug-centre-n" x={cMidX} y={narrow ? cTop + 39 : cMidY + 10} textAnchor="middle">
                  {t(locale, "netFlowIn", { n: view.nIn })} · {t(locale, "netFlowOut", { n: view.nOut })}
                </text>
                <text className="ug-centre-name" x={cMidX} y={narrow ? cTop + 55 : cBottom + 20} textAnchor="middle" data-in={narrow}>
                  {wardName(locale, centre)}
                </text>
                {cKind ? (
                  <g
                    transform={`translate(${cMidX - chipW / 2},${narrow ? cBottom - 30 : Math.max(2, cTop - 32)})`}
                    className="ug-chip"
                    data-lit={cLit}
                  >
                    <rect width={chipW} height="24" rx="12" />
                    <g transform="translate(8,4)" className="ug-glyph" data-kind={cKind}>
                      <KindGlyph kind={cKind} />
                    </g>
                    <text x="30" y="16">
                      {cChip}
                    </text>
                  </g>
                ) : null}
              </g>
            </g>
          </svg>
        ) : rel ? (
          <p className="geo-faint ug-empty">{t(locale, "netFlowEmpty", { unit: centre ?? "" })}</p>
        ) : null}
      </div>

      {mode === "around" && view && centre && narrow ? (
        <p className="ug-dir" data-side="out">
          ↓ {t(locale, "netDirOut", { unit: centre })}
        </p>
      ) : null}
      {signals.hospitalWide > 0 ? <p className="geo-faint">{t(locale, "netHospitalWide", { n: signals.hospitalWide })}</p> : null}
    </section>
  );
}
