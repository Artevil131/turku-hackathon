import type { IsolateRecord, Phenotype } from "@aei/domain";
import { ANTIBIOTICS, ORGANISMS, PHENOTYPES, SPECIMENS } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
  eventKey,
  type Frame,
  frameDays,
  parseEvent,
  prepare,
  type Slice,
  TOOL_IDS,
  type ToolId,
} from "./model.ts";
import { ResultCell } from "./ResultCell.tsx";
import { EditIcon } from "./ToolIcons.tsx";
import "./tools.css";

// The Tools window (D-065 engine A, D-076): the slice as one sentence, a picker of five analyses, the newest result
// under the picker, the chosen tool's few parameters with Run, the older results below. No code is typed.

export interface ToolsProps extends PanelProps {
  /** The selected signal's window; null falls back to the last 12 weeks to the clock. */
  window: { from: string; to: string; unit?: string; phenotype?: Phenotype | ""; organism?: string } | null;
  /** A slice handed over by another window (the signal's "Open in Tools"): it overrides the signal's own defaults. */
  preset?: Partial<Slice>;
  /** Adds a chart window (the Add as chart buttons). */
  onAddChart?: (spec: ChartSpec) => void;
  /** The result cells as they change, for the "+ Chart" form's sources. */
  onCells?: (cells: Cell[]) => void;
}

const DEFAULT_WEEKS = 12;
const PERIODS = [7, 14, 28] as const;

/** The defaults: the selected signal's unit, phenotype and window, else the last 12 weeks to the clock over all units. */
function initialSlice(w: ToolsProps["window"], asOf: string | null, state: PanelProps["state"], preset?: Partial<Slice>): Slice {
  const to = w?.to ?? asOf ?? new Date().toISOString().slice(0, 10);
  return {
    from: w?.from ?? shift(to, 1 - DEFAULT_WEEKS * 7),
    to,
    unit: w ? (w.unit ?? state.unit ?? state.focus ?? "") : "",
    organism: w?.organism ?? "",
    specimen: "",
    phenotype: w ? (w.phenotype ?? state.phenotype ?? "") : "",
    firstOnly: true,
    ...preset,
  };
}

const SLICE_KEYS = ["from", "to", "unit", "organism", "specimen", "phenotype", "firstOnly"] as const;
const sameSlice = (a: Slice, b: Slice) => SLICE_KEYS.every((k) => a[k] === b[k]);

/** "Urology · E. coli · urine · ESBL · 2 Apr – 30 Apr 2025 · first isolates". */
export function sliceSentence(locale: Locale, s: Slice): string {
  const parts: string[] = [s.unit ? wardName(locale, s.unit as never) : t(locale, "toolsUnitAll")];
  if (s.organism) parts.push(s.organism);
  if (s.specimen) parts.push(specimenName(locale, s.specimen as never));
  if (s.phenotype) parts.push(phenotypeName(s.phenotype));
  parts.push(`${formatDate(locale, s.from)} – ${formatDate(locale, s.to, "long")}`);
  parts.push(t(locale, s.firstOnly ? "toolsFirstYes" : "toolsFirstNo"));
  return parts.join(" · ");
}

type BMode = "previous" | "unit" | "custom";
const B_MODES: readonly BMode[] = ["previous", "unit", "custom"];

/** Frame B's default: the same length immediately before frame A. */
export function previousFrame(s: Slice): Frame {
  const to = shift(s.from, -1);
  return { from: shift(to, 1 - frameDays(s)), to, unit: s.unit };
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
  const { client, locale, asOf, state, window: win, preset, onAddChart, onCells } = props;
  const [slice, setSlice] = useState<Slice>(() => initialSlice(win, asOf, state, preset));
  // The selected signal's slice (or a preset handed over): the defaults, and what "Use the selected signal" restores.
  const signal = win || preset ? initialSlice(win, asOf, state, preset) : null;
  const signalKey = JSON.stringify([win, win ? [state.unit ?? state.focus, state.phenotype] : null, preset]);
  const seenSignal = useRef(signalKey);
  // A newly selected signal moves the slice to its own; the researcher's edits stay until then.
  useEffect(() => {
    if (seenSignal.current === signalKey) return;
    seenSignal.current = signalKey;
    if (signal) setSlice(signal);
  }, [signalKey, signal]);
  useEffect(() => {
    if (!win && asOf) setSlice((s) => (s.to > asOf && s.from > asOf ? initialSlice(null, asOf, state, preset) : s));
  }, [asOf, win, state, preset]);
  const differs = signal !== null && !sameSlice(slice, signal);

  const [cells, setCells] = useState<Cell[]>([]);
  useEffect(() => onCells?.(cells), [cells, onCells]);
  const next = useRef(1);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolId>("rate");
  const [editing, setEditing] = useState(false);
  const tabs = useRef<Partial<Record<ToolId, HTMLButtonElement | null>>>({});

  // Per-tool options.
  const [event, setEvent] = useState<string>(
    eventKey(slice.phenotype ? { type: "phenotype", code: slice.phenotype } : { type: "phenotype", code: "esbl" }),
  );
  // A phenotype chosen in the slice is the event the tools look at, until the researcher picks another.
  useEffect(() => {
    if (slice.phenotype) setEvent(eventKey({ type: "phenotype", code: slice.phenotype }));
  }, [slice.phenotype]);
  const [bMode, setBMode] = useState<BMode>("previous");
  const [bUnit, setBUnit] = useState("");
  const [bCustom, setBCustom] = useState<Frame>(() => ({ ...previousFrame(slice), unit: "same" }));
  const [period, setPeriod] = useState<number>(7);
  const [discounted, setDiscounted] = useState(false);
  const [delta, setDelta] = useState(0.95);
  const [m, setM] = useState(30);
  const [detector, setDetector] = useState<DetectorChoice>("phenotype");

  const wards = useMemo(() => siteWards(), []);
  const set = <K extends keyof Slice>(key: K, v: Slice[K]) => setSlice((s) => ({ ...s, [key]: v }));
  const valid = slice.from <= slice.to && asOf !== null;

  // Frame B: the same length right before frame A, the same frame in another unit, or dates of its own.
  const otherUnit = bUnit && bUnit !== slice.unit ? bUnit : (wards.find((w) => w.code !== slice.unit)?.code ?? "");
  const frameBOf = (s: Slice): Frame =>
    bMode === "previous"
      ? previousFrame(s)
      : bMode === "unit"
        ? { from: s.from, to: s.to, unit: otherUnit }
        : { ...bCustom, unit: bCustom.unit === "same" ? s.unit : bCustom.unit };
  const frameB = frameBOf(slice);
  const days = frameDays(slice);
  const bNames: Record<BMode, string> = {
    previous:
      days % 7 === 0
        ? t(locale, days === 7 ? "toolsBPrevWeek" : "toolsBPrevWeeks", { n: days / 7 })
        : t(locale, "toolsBPrevDays", { n: days }),
    unit: t(locale, "toolsBOtherUnit"),
    custom: t(locale, "toolsBCustom"),
  };

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

  const run = async (which: ToolId) => {
    if (!valid || busy !== null) return;
    setBusy(which);
    setError(null);
    try {
      const s = slice;
      let cell: Cell["result"];
      if (which === "rate") {
        cell = computeRate(prepare(await fetchFrame(s), s, s.firstOnly), s);
      } else if (which === "compare") {
        const b = frameBOf(s);
        const [ra, rb] = await Promise.all([fetchFrame(s), fetchFrame(b)]);
        cell = computeCompare(prepare(ra, s, s.firstOnly), prepare(rb, b, s.firstOnly), s, b, parseEvent(event));
      } else if (which === "shares") {
        cell = computeShares(prepare(await fetchFrame(s), s, s.firstOnly), s, parseEvent(event), period);
      } else if (which === "beta") {
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

  const pick = (id: ToolId, focus = false) => {
    setTool(id);
    if (focus) tabs.current[id]?.focus();
  };
  const onTabKey = (e: KeyboardEvent<HTMLElement>) => {
    const i = TOOL_IDS.indexOf(tool);
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? TOOL_IDS[(i + 1) % TOOL_IDS.length]
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? TOOL_IDS[(i + TOOL_IDS.length - 1) % TOOL_IDS.length]
          : e.key === "Home"
            ? TOOL_IDS[0]
            : e.key === "End"
              ? TOOL_IDS[TOOL_IDS.length - 1]
              : null;
    if (to) {
      e.preventDefault();
      pick(to, true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void run(tool);
    }
  };

  const dateField = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className="tl-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
  const unitOptions = (skip = "") =>
    wards
      .filter((w) => w.code !== skip)
      .map((w) => (
        <option key={w.code} value={w.code}>
          {wardName(locale, w.code)}
        </option>
      ));
  const name = (id: ToolId) => t(locale, `toolsPick_${id}` as "toolsPick_rate");
  const addChart =
    onAddChart &&
    ((r: Cell["result"]) => {
      const spec = specFromResult(r);
      if (spec) onAddChart(spec);
    });
  const [latest, ...older] = cells;
  const cellOf = (c: Cell, fresh: boolean) => (
    <ResultCell
      key={c.id}
      cell={c}
      locale={locale}
      fresh={fresh}
      onChart={addChart}
      onRemove={(id) => setCells((all) => all.filter((x) => x.id !== id))}
    />
  );
  const waiting = busy === "compare" ? "toolsFetchingBoth" : busy === "detector" ? "toolsFetchingBaseline" : "toolsFetching";

  return (
    <div className="tl board-panel">
      <section className="tl-slice" aria-label={t(locale, "toolsSliceTitle")}>
        <p className="tl-sentence">{sliceSentence(locale, slice)}</p>
        <div className="tl-slice-actions">
          {differs && signal && (
            <button type="button" className="tl-link" onClick={() => setSlice(signal)}>
              {t(locale, "toolsUseSignal")}
            </button>
          )}
          <button
            type="button"
            className="btn tl-act"
            aria-expanded={editing}
            aria-controls="tl-slice-fields"
            onClick={() => setEditing((v) => !v)}
          >
            <EditIcon />
            {t(locale, editing ? "toolsEditDone" : "toolsEdit")}
          </button>
        </div>
        {editing && (
          <div id="tl-slice-fields" className="tl-slice-fields">
            <div className="tl-fields">
              {dateField("tl-from", t(locale, "toolsFrom"), slice.from, (v) => set("from", v))}
              {dateField("tl-to", t(locale, "toolsTo"), slice.to, (v) => set("to", v))}
              <label className="tl-field" htmlFor="tl-unit">
                <span>{t(locale, "toolsUnit")}</span>
                <select id="tl-unit" value={slice.unit} onChange={(e) => set("unit", e.target.value)}>
                  <option value="">{t(locale, "toolsUnitAll")}</option>
                  {unitOptions()}
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
          </div>
        )}
        {!valid && <p className="tl-warn">{t(locale, asOf === null ? "toolsNoClock" : "toolsBadFrame")}</p>}
      </section>

      <div className="tl-pick">
        <div className="tl-tabs" role="tablist" aria-label={t(locale, "toolsMenu")} onKeyDown={onTabKey}>
          {TOOL_IDS.map((id) => (
            <button
              key={id}
              ref={(el) => {
                tabs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`tl-tab-${id}`}
              aria-selected={tool === id}
              aria-controls="tl-panel"
              tabIndex={tool === id ? 0 : -1}
              onClick={() => pick(id)}
            >
              {name(id)}
            </button>
          ))}
        </div>
        <select className="tl-select" aria-label={t(locale, "toolsMenu")} value={tool} onChange={(e) => pick(e.target.value as ToolId)}>
          {TOOL_IDS.map((id) => (
            <option key={id} value={id}>
              {name(id)}
            </option>
          ))}
        </select>
        <p className="tl-hint">{t(locale, `toolsHint_${tool}` as "toolsHint_rate")}</p>
      </div>

      <section className="tl-results" aria-label={t(locale, "toolsResults")} aria-live="polite">
        {busy && (
          <p className="tl-wait" role="status">
            {t(locale, waiting)}
          </p>
        )}
        {error && (
          <p className="tl-warn" role="alert">
            {t(locale, "toolsError", { error })}
          </p>
        )}
        {latest ? cellOf(latest, true) : !busy && <p className="tl-empty">{t(locale, "toolsEmpty")}</p>}
      </section>

      <form
        className="tl-params"
        role="tabpanel"
        id="tl-panel"
        aria-label={name(tool)}
        data-tool={tool}
        onSubmit={(e) => {
          e.preventDefault();
          void run(tool);
        }}
        onKeyDown={(e) => {
          // A select does not submit on Enter by itself.
          if (e.key === "Enter" && e.target instanceof HTMLSelectElement) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
        {tool === "rate" && <p className="tl-hint">{t(locale, "toolsNoParams")}</p>}
        {(tool === "compare" || tool === "shares" || tool === "beta") && (
          <div className="tl-fields">
            <label className="tl-field" htmlFor="tl-event">
              <span>{t(locale, "toolsEvent")}</span>
              <EventSelect locale={locale} id="tl-event" value={event} onChange={setEvent} />
            </label>
          </div>
        )}
        {tool === "compare" && (
          <fieldset className="tl-b">
            <legend>{t(locale, "toolsBFrame")}</legend>
            <div className="tl-choice" role="radiogroup" aria-label={t(locale, "toolsBFrame")}>
              {B_MODES.map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={bMode === mode} onClick={() => setBMode(mode)}>
                  {bNames[mode]}
                </button>
              ))}
            </div>
            {bMode === "unit" && (
              <div className="tl-fields">
                <label className="tl-field" htmlFor="tl-bunit-other">
                  <span>{t(locale, "toolsBUnit")}</span>
                  <select id="tl-bunit-other" value={otherUnit} onChange={(e) => setBUnit(e.target.value)}>
                    <option value="">{t(locale, "toolsUnitAll")}</option>
                    {unitOptions(slice.unit)}
                  </select>
                </label>
              </div>
            )}
            {bMode === "custom" && (
              <div className="tl-fields">
                {dateField("tl-bfrom", t(locale, "toolsBFrom"), bCustom.from, (v) => setBCustom((f) => ({ ...f, from: v })))}
                {dateField("tl-bto", t(locale, "toolsBTo"), bCustom.to, (v) => setBCustom((f) => ({ ...f, to: v })))}
                <label className="tl-field" htmlFor="tl-bunit">
                  <span>{t(locale, "toolsBUnit")}</span>
                  <select id="tl-bunit" value={bCustom.unit} onChange={(e) => setBCustom((f) => ({ ...f, unit: e.target.value }))}>
                    <option value="same">{t(locale, "toolsUnitSame")}</option>
                    <option value="">{t(locale, "toolsUnitAll")}</option>
                    {unitOptions()}
                  </select>
                </label>
              </div>
            )}
            <p className="tl-hint">
              {t(locale, "toolsBDates", { from: formatDate(locale, frameB.from), to: formatDate(locale, frameB.to, "long") })} ·{" "}
              {frameB.unit ? wardName(locale, frameB.unit as never) : t(locale, "toolsUnitAll")}
            </p>
          </fieldset>
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
        <div className="tl-runrow">
          <button type="submit" className="btn btn-primary tl-run" disabled={!valid || busy !== null} aria-busy={busy === tool}>
            {busy === tool ? t(locale, "toolsRunning") : t(locale, "toolsRun")}
          </button>
          {onAddChart && (tool === "shares" || tool === "beta") && (
            <button
              type="button"
              className="btn"
              disabled={!valid}
              onClick={() => onAddChart(specFromSlice(slice, event, tool === "shares" ? "share" : "beta", period))}
            >
              {t(locale, "chartAddAs")}
            </button>
          )}
        </div>
      </form>

      {older.length > 0 && (
        <section className="tl-older" aria-label={t(locale, "toolsEarlier", { n: older.length })}>
          <header>
            <h2 className="tl-h">{t(locale, "toolsEarlier", { n: older.length })}</h2>
            <button type="button" className="tl-link" onClick={() => setCells([])}>
              {t(locale, "toolsClearAll")}
            </button>
          </header>
          {older.map((c) => cellOf(c, false))}
        </section>
      )}
    </div>
  );
}
