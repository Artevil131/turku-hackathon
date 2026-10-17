import type { IsolateRecord, Phenotype } from "@aei/domain";
import { ANTIBIOTICS, ORGANISMS, PHENOTYPES, SPECIMENS } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { siteWards } from "../../../sites.ts";
import { useHashParam } from "../../../url.ts";
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
  type ToolId,
} from "./model.ts";
import { ResultCell } from "./ResultCell.tsx";
import "./tools.css";

// The body of the tool rail's inspector (D-065 engine A, D-076): the slice as one sentence, then either the slice
// editor (the Data tool) or one analysis's few parameters with Run and its results, newest first. No code is typed.
// It stays mounted while the rail is open, so the slice, the options and the results survive switching tools.

/** What the inspector shows: the slice editor or one of the five analyses. */
export type InspectorTool = "data" | ToolId;

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

export interface InspectorProps extends ToolsProps {
  tool: InspectorTool;
  /** Opens the slice editor (the sentence's Change link). */
  onEditSlice?: () => void;
  /** Each new value puts the slice back to where its frame came from (the rail's Reset). */
  resetKey?: number;
}

const DEFAULT_WEEKS = 12;
const PERIODS = [7, 14, 28] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Where the slice's frame came from, in priority order. */
export type FrameOrigin = "timeline" | "signal" | "default";

/**
 * The frame the tools read: the range dragged on the timeline (`from=` and `to=` in the hash, both present and
 * valid), else the selected signal's window, else none (the last 12 weeks to the clock).
 */
export function pickFrame(
  hashFrom: string | null,
  hashTo: string | null,
  signal: { from: string; to: string } | null,
): { frame: { from: string; to: string } | null; origin: FrameOrigin } {
  if (hashFrom && hashTo && ISO.test(hashFrom) && ISO.test(hashTo)) {
    const [from, to] = hashFrom <= hashTo ? [hashFrom, hashTo] : [hashTo, hashFrom];
    return { frame: { from, to }, origin: "timeline" };
  }
  return signal ? { frame: signal, origin: "signal" } : { frame: null, origin: "default" };
}

/** The defaults: the frame's dates, the selected signal's unit and phenotype, else the last 12 weeks over all units. */
function initialSlice(
  frame: { from: string; to: string; unit?: string; phenotype?: Phenotype | ""; organism?: string } | null,
  hasSignal: boolean,
  asOf: string | null,
  state: PanelProps["state"],
  preset?: Partial<Slice>,
): Slice {
  const to = frame?.to ?? asOf ?? new Date().toISOString().slice(0, 10);
  return {
    from: frame?.from ?? shift(to, 1 - DEFAULT_WEEKS * 7),
    to,
    unit: hasSignal ? (frame?.unit ?? state.unit ?? state.focus ?? "") : "",
    organism: frame?.organism ?? "",
    specimen: "",
    phenotype: hasSignal ? (frame?.phenotype ?? state.phenotype ?? "") : "",
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

const ORIGIN_KEY = { timeline: "toolsFrameTimeline", signal: "toolsFrameSignal", default: "toolsFrameDefault" } as const;

export function ToolInspector(props: InspectorProps) {
  const { client, locale, asOf, state, window: win, preset, onAddChart, onCells, tool, onEditSlice, resetKey = 0 } = props;
  const [hashFrom] = useHashParam("from");
  const [hashTo] = useHashParam("to");
  const { frame, origin } = pickFrame(hashFrom, hashTo, win);
  // Where the frame came from: the defaults, and what Reset restores.
  const source = initialSlice(frame, win !== null, asOf, state, preset);
  const [slice, setSlice] = useState<Slice>(source);
  // The selected signal's own slice (its window, unit and phenotype): what "Use the signal's window" restores.
  const signal = win ? initialSlice(win, true, asOf, state, preset) : null;

  // A newly selected signal moves the whole slice to its own; a new range on the timeline moves the dates only.
  // The researcher's edits stay until then.
  const signalKey = JSON.stringify([win, win ? [state.unit ?? state.focus, state.phenotype] : null, preset]);
  const frameKey = JSON.stringify(frame);
  const seen = useRef({ signal: signalKey, frame: frameKey, reset: resetKey });
  useEffect(() => {
    const s = seen.current;
    if (s.signal !== signalKey || s.reset !== resetKey) setSlice(source);
    else if (s.frame !== frameKey) setSlice((cur) => ({ ...cur, from: source.from, to: source.to }));
    seen.current = { signal: signalKey, frame: frameKey, reset: resetKey };
  }, [signalKey, frameKey, resetKey, source]);
  useEffect(() => {
    if (!frame && asOf) setSlice((s) => (s.to > asOf && s.from > asOf ? initialSlice(null, win !== null, asOf, state, preset) : s));
  }, [asOf, frame, win, state, preset]);
  const sameDates = (f: { from: string; to: string } | null) => f !== null && slice.from === f.from && slice.to === f.to;
  // What the hint says: the source of the dates shown, or the researcher's own.
  const shownOrigin = sameDates(source) ? ORIGIN_KEY[origin] : sameDates(win) ? ORIGIN_KEY.signal : "toolsFrameOwn";
  const differs = signal !== null && !sameSlice(slice, signal);

  const [cells, setCells] = useState<Cell[]>([]);
  useEffect(() => onCells?.(cells), [cells, onCells]);
  const next = useRef(1);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const addChart =
    onAddChart &&
    ((r: Cell["result"]) => {
      const spec = specFromResult(r);
      if (spec) onAddChart(spec);
    });
  const mine = tool === "data" ? [] : cells.filter((c) => c.result.kind === tool);
  const waiting = busy === "compare" ? "toolsFetchingBoth" : busy === "detector" ? "toolsFetchingBaseline" : "toolsFetching";
  const warn = !valid && <p className="tl-warn">{t(locale, asOf === null ? "toolsNoClock" : "toolsBadFrame")}</p>;

  if (tool === "data") {
    return (
      <div className="tl tl-inspect" data-tool="data">
        <p className="tl-sentence">{sliceSentence(locale, slice)}</p>
        <p className="tl-origin">
          <span>{t(locale, shownOrigin)}</span>
          {differs && signal && (
            <button type="button" className="tl-link" onClick={() => setSlice(signal)}>
              {t(locale, "toolsUseSignalWindow")}
            </button>
          )}
        </p>
        <div id="tl-slice-fields" className="tl-slice-fields">
          <div className="tl-fields">
            {dateField("tl-from", t(locale, "toolsFrom"), slice.from, (v) => set("from", v))}
            {dateField("tl-to", t(locale, "toolsTo"), slice.to, (v) => set("to", v))}
          </div>
          <div className="tl-fields tl-fields-1">
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
        {warn}
      </div>
    );
  }

  return (
    <div className="tl tl-inspect" data-tool={tool}>
      <p className="tl-sentence">
        {sliceSentence(locale, slice)}{" "}
        {onEditSlice && (
          <button type="button" className="tl-link" onClick={onEditSlice}>
            {t(locale, "toolsChangeSlice")}
          </button>
        )}
      </p>
      {warn}
      <p className="tl-hint">{t(locale, `toolsHint_${tool}` as "toolsHint_rate")}</p>

      <form
        className="tl-params"
        id="tl-panel"
        aria-label={t(locale, `toolsRail_${tool}` as "toolsRail_rate")}
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
            <kbd>↵</kbd>
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

      <section className="tl-results" aria-label={t(locale, "toolsResults")} aria-live="polite">
        {busy === tool && (
          <p className="tl-wait" role="status">
            {t(locale, waiting)}
          </p>
        )}
        {error && (
          <p className="tl-warn" role="alert">
            {t(locale, "toolsError", { error })}
          </p>
        )}
        {mine.map((c, i) => (
          <ResultCell
            key={c.id}
            cell={c}
            locale={locale}
            fresh={i === 0}
            onChart={addChart}
            onRemove={(id) => setCells((all) => all.filter((x) => x.id !== id))}
          />
        ))}
        {mine.length > 1 && (
          <button type="button" className="tl-link tl-clear" onClick={() => setCells((all) => all.filter((x) => x.result.kind !== tool))}>
            {t(locale, "toolsClearAll")}
          </button>
        )}
      </section>
    </div>
  );
}
