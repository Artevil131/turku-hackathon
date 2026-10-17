import type { IsolateRecord, Phenotype } from "@aei/domain";
import { ANTIBIOTICS, ORGANISMS, PHENOTYPES, SPECIMENS } from "@aei/domain";
import { antibioticName, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { siteWards } from "../../../sites.ts";
import type { PanelProps } from "../board.ts";
import { specFromResult, specFromSlice } from "../charts/model.ts";
import type { ChartSpec } from "../charts/spec.ts";
import { shift } from "../feed/model.ts";
import {
  baselineStart,
  type Cell,
  computeBeta,
  computeCompare,
  computeDetector,
  computeRate,
  computeShares,
  type DetectorChoice,
  type EventSpec,
  eventKey,
  type Frame,
  parseEvent,
  prepare,
  type Slice,
  TOOL_IDS,
  type ToolId,
} from "./model.ts";
import { ResultCell } from "./ResultCell.tsx";
import "./tools.css";

// The Tools window (D-065 engine A, D-076): the slice at the top, a menu of five analyses under it, each a
// form with a Run button; a run adds a result cell above the older ones. No code is typed.

export interface ToolsProps extends PanelProps {
  /** The selected signal's window; null falls back to the last 12 weeks to the clock. */
  window: { from: string; to: string } | null;
  /** Adds a chart window (the Add as chart buttons). */
  onAddChart?: (spec: ChartSpec) => void;
  /** The result cells as they change, for the "+ Chart" form's sources. */
  onCells?: (cells: Cell[]) => void;
}

const DEFAULT_WEEKS = 12;
const PERIODS = [7, 14, 28] as const;

function initialSlice(w: ToolsProps["window"], asOf: string | null, state: PanelProps["state"]): Slice {
  const to = w?.to ?? asOf ?? new Date().toISOString().slice(0, 10);
  return {
    from: w?.from ?? shift(to, 1 - DEFAULT_WEEKS * 7),
    to,
    unit: state.unit ?? state.focus ?? "",
    organism: "",
    specimen: "",
    phenotype: state.phenotype ?? "",
    firstOnly: true,
  };
}

function EventSelect({ locale, id, value, onChange }: { locale: Locale; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label={t(locale, "toolsEventPh")}>
        {PHENOTYPES.map((p) => (
          <option key={p} value={`phenotype:${p}`}>
            {phenotypeName(p)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t(locale, "toolsEventAbx")}>
        {ANTIBIOTICS.map((a) => (
          <option key={a.code} value={`antibiotic:${a.code}`}>
            {antibioticName(locale, a.code)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function ToolsWindow(props: ToolsProps) {
  const { client, locale, asOf, state, window: win, onAddChart, onCells } = props;
  const [slice, setSlice] = useState<Slice>(() => initialSlice(win, asOf, state));
  const winKey = win ? `${win.from}|${win.to}` : "";
  const firstKey = useRef(winKey);
  // A newly selected signal moves the frame to its window; the researcher's own edits stay until then.
  useEffect(() => {
    if (firstKey.current === winKey) return;
    firstKey.current = winKey;
    if (win) setSlice((s) => ({ ...s, from: win.from, to: win.to }));
  }, [winKey, win]);
  useEffect(() => {
    if (!win && asOf) setSlice((s) => (s.to > asOf && s.from > asOf ? initialSlice(null, asOf, state) : s));
  }, [asOf, win, state]);

  const [cells, setCells] = useState<Cell[]>([]);
  useEffect(() => onCells?.(cells), [cells, onCells]);
  const next = useRef(1);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-tool options.
  const defaultEvent: EventSpec = slice.phenotype ? { type: "phenotype", code: slice.phenotype } : { type: "phenotype", code: "esbl" };
  const [event, setEvent] = useState<string>(eventKey(defaultEvent));
  const [frameB, setFrameB] = useState<Frame>(() => {
    const to = shift(slice.from, -1);
    return { from: shift(to, -(Math.round((Date.parse(slice.to) - Date.parse(slice.from)) / 86_400_000) + 1) + 1), to, unit: "" };
  });
  const [bSameUnit, setBSameUnit] = useState(true);
  const [period, setPeriod] = useState<number>(7);
  const [discounted, setDiscounted] = useState(false);
  const [delta, setDelta] = useState(0.95);
  const [m, setM] = useState(30);
  const [detector, setDetector] = useState<DetectorChoice>("phenotype");

  const wards = useMemo(() => siteWards(), []);
  const set = <K extends keyof Slice>(key: K, v: Slice[K]) => setSlice((s) => ({ ...s, [key]: v }));
  const valid = slice.from <= slice.to && asOf !== null;

  const fetchFrame = async (f: Frame, wide = false): Promise<IsolateRecord[]> =>
    (
      await client.isolates({
        from: f.from,
        to: f.to,
        ...(f.unit && !wide ? { ward: f.unit } : {}),
        ...(slice.organism && !wide ? { organism: slice.organism as never } : {}),
        ...(slice.specimen && !wide ? { specimen: slice.specimen as never } : {}),
      })
    ).records;

  const run = async (tool: ToolId) => {
    setBusy(tool);
    setError(null);
    try {
      const s = slice;
      let cell: Cell["result"];
      if (tool === "rate") {
        cell = computeRate(prepare(await fetchFrame(s), s, s.firstOnly), s);
      } else if (tool === "compare") {
        const b: Frame = { ...frameB, unit: bSameUnit ? s.unit : frameB.unit };
        const [ra, rb] = await Promise.all([fetchFrame(s), fetchFrame(b)]);
        cell = computeCompare(prepare(ra, s, s.firstOnly), prepare(rb, b, s.firstOnly), s, b, parseEvent(event));
      } else if (tool === "shares") {
        cell = computeShares(prepare(await fetchFrame(s), s, s.firstOnly), s, parseEvent(event), period);
      } else if (tool === "beta") {
        const own = prepare(await fetchFrame(s), s, s.firstOnly);
        const parent = discounted ? prepare(await fetchFrame({ ...s, unit: "" }, true), s, s.firstOnly) : null;
        cell = computeBeta(own, parent, s, parseEvent(event), discounted ? { delta, m } : null);
      } else {
        // The baseline is the live detector's: every unit and organism, 365 days before the frame.
        const all = await fetchFrame({ from: baselineStart(s.from), to: s.to, unit: "" }, true);
        const phs: Phenotype[] = s.phenotype ? [s.phenotype] : [...PHENOTYPES];
        cell = computeDetector(all, s, detector, phs);
      }
      setCells((c) => [{ id: next.current++, result: cell }, ...c]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const dateField = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className="tl-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
  const runButton = (tool: ToolId) => (
    <button
      type="button"
      className="btn btn-primary tl-run"
      disabled={!valid || busy !== null}
      aria-busy={busy === tool}
      onClick={() => run(tool)}
    >
      {busy === tool ? t(locale, "toolsRunning") : t(locale, "toolsRun")}
    </button>
  );

  return (
    <div className="tl board-panel">
      <section className="tl-slice-form" aria-label={t(locale, "toolsSliceTitle")}>
        <h2 className="tl-h">{t(locale, "toolsSliceTitle")}</h2>
        <div className="tl-fields">
          {dateField("tl-from", t(locale, "toolsFrom"), slice.from, (v) => set("from", v))}
          {dateField("tl-to", t(locale, "toolsTo"), slice.to, (v) => set("to", v))}
          <label className="tl-field" htmlFor="tl-unit">
            <span>{t(locale, "toolsUnit")}</span>
            <select id="tl-unit" value={slice.unit} onChange={(e) => set("unit", e.target.value)}>
              <option value="">{t(locale, "toolsUnitAll")}</option>
              {wards.map((w) => (
                <option key={w.code} value={w.code}>
                  {wardName(locale, w.code)}
                </option>
              ))}
            </select>
          </label>
          <label className="tl-field" htmlFor="tl-organism">
            <span>{t(locale, "toolsOrganism")}</span>
            <select id="tl-organism" value={slice.organism} onChange={(e) => set("organism", e.target.value)}>
              <option value="">{t(locale, "toolsOrganismAll")}</option>
              {ORGANISMS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="tl-field" htmlFor="tl-specimen">
            <span>{t(locale, "toolsSpecimen")}</span>
            <select id="tl-specimen" value={slice.specimen} onChange={(e) => set("specimen", e.target.value)}>
              <option value="">{t(locale, "toolsSpecimenAll")}</option>
              {SPECIMENS.map((sp) => (
                <option key={sp.code} value={sp.code}>
                  {specimenName(locale, sp.code)}
                </option>
              ))}
            </select>
          </label>
          <label className="tl-field" htmlFor="tl-phenotype">
            <span>{t(locale, "toolsPhenotype")}</span>
            <select id="tl-phenotype" value={slice.phenotype} onChange={(e) => set("phenotype", e.target.value as Phenotype | "")}>
              <option value="">{t(locale, "toolsPhenotypeNone")}</option>
              {PHENOTYPES.map((p) => (
                <option key={p} value={p}>
                  {phenotypeName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="tl-check">
          <input type="checkbox" checked={slice.firstOnly} onChange={(e) => set("firstOnly", e.target.checked)} />
          <span>{t(locale, "toolsFirstOnly")}</span>
        </label>
        {!valid && <p className="tl-warn">{t(locale, asOf === null ? "toolsNoClock" : "toolsBadFrame")}</p>}
      </section>

      {error && (
        <p className="tl-warn" role="alert">
          {t(locale, "toolsError", { error })}
        </p>
      )}

      <section className="tl-results" aria-label={t(locale, "toolsResults")} aria-live="polite">
        {cells.length === 0 ? (
          <p className="tl-empty">{t(locale, "toolsEmpty")}</p>
        ) : (
          cells.map((c) => (
            <ResultCell
              key={c.id}
              cell={c}
              locale={locale}
              onChart={
                onAddChart &&
                ((r) => {
                  const spec = specFromResult(r);
                  if (spec) onAddChart(spec);
                })
              }
              onRemove={(id) => setCells((all) => all.filter((x) => x.id !== id))}
            />
          ))
        )}
      </section>

      <section className="tl-menu" aria-label={t(locale, "toolsMenu")}>
        <h2 className="tl-h">{t(locale, "toolsMenu")}</h2>
        {TOOL_IDS.map((tool) => (
          <form
            key={tool}
            className="tl-tool"
            data-tool={tool}
            onSubmit={(e) => {
              e.preventDefault();
              void run(tool);
            }}
          >
            <h3>{t(locale, `toolsName_${tool}` as "toolsName_rate")}</h3>
            <p className="tl-hint">{t(locale, `toolsHint_${tool}` as "toolsHint_rate")}</p>
            {(tool === "compare" || tool === "shares" || tool === "beta") && (
              <div className="tl-fields">
                <label className="tl-field" htmlFor={`tl-event-${tool}`}>
                  <span>{t(locale, "toolsEvent")}</span>
                  <EventSelect locale={locale} id={`tl-event-${tool}`} value={event} onChange={setEvent} />
                </label>
              </div>
            )}
            {tool === "compare" && (
              <div className="tl-fields">
                {dateField("tl-bfrom", t(locale, "toolsBFrom"), frameB.from, (v) => setFrameB((f) => ({ ...f, from: v })))}
                {dateField("tl-bto", t(locale, "toolsBTo"), frameB.to, (v) => setFrameB((f) => ({ ...f, to: v })))}
                <label className="tl-field" htmlFor="tl-bunit">
                  <span>{t(locale, "toolsBUnit")}</span>
                  <select
                    id="tl-bunit"
                    value={bSameUnit ? "same" : frameB.unit}
                    onChange={(e) => {
                      setBSameUnit(e.target.value === "same");
                      if (e.target.value !== "same") setFrameB((f) => ({ ...f, unit: e.target.value }));
                    }}
                  >
                    <option value="same">{t(locale, "toolsUnitSame")}</option>
                    <option value="">{t(locale, "toolsUnitAll")}</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {wardName(locale, w.code)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {tool === "shares" && (
              <div className="tl-fields">
                <label className="tl-field" htmlFor="tl-period">
                  <span>{t(locale, "toolsPeriod")}</span>
                  <select id="tl-period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                    {PERIODS.map((d) => (
                      <option key={d} value={d}>
                        {t(locale, "toolsDays", { n: d })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {tool === "beta" && (
              <>
                <label className="tl-check">
                  <input type="checkbox" checked={discounted} onChange={(e) => setDiscounted(e.target.checked)} />
                  <span>{t(locale, "toolsDiscounted")}</span>
                </label>
                {discounted && (
                  <div className="tl-fields">
                    <label className="tl-field" htmlFor="tl-delta">
                      <span>{t(locale, "toolsDelta")}</span>
                      <input
                        id="tl-delta"
                        type="number"
                        min={0.9}
                        max={1}
                        step={0.01}
                        value={delta}
                        onChange={(e) => setDelta(Math.min(1, Math.max(0.9, Number(e.target.value) || 0.95)))}
                      />
                    </label>
                    <label className="tl-field" htmlFor="tl-m">
                      <span>{t(locale, "toolsM")}</span>
                      <input
                        id="tl-m"
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={m}
                        onChange={(e) => setM(Math.min(1000, Math.max(1, Number(e.target.value) || 30)))}
                      />
                    </label>
                  </div>
                )}
              </>
            )}
            {tool === "detector" && (
              <div className="tl-fields">
                <label className="tl-field" htmlFor="tl-detector">
                  <span>{t(locale, "toolsDetector")}</span>
                  <select id="tl-detector" value={detector} onChange={(e) => setDetector(e.target.value as DetectorChoice)}>
                    <option value="phenotype">{t(locale, "toolsDetPhenotype")}</option>
                    <option value="profile">{t(locale, "toolsDetProfile")}</option>
                  </select>
                </label>
              </div>
            )}
            {runButton(tool)}
            {onAddChart && (tool === "shares" || tool === "beta") && (
              <button
                type="button"
                className="btn tl-run"
                disabled={!valid}
                onClick={() => onAddChart(specFromSlice(slice, event, tool === "shares" ? "share" : "beta", period))}
              >
                {t(locale, "chartAddAs")}
              </button>
            )}
          </form>
        ))}
      </section>
    </div>
  );
}
