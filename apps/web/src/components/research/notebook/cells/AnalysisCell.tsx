import type { AeiClient } from "@aei/contract";
import { ANTIBIOTICS, PHENOTYPES } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { useState } from "react";
import { type CellResult, type DetectorChoice, frameDays, type Slice } from "../../tools/model.ts";
import { ResultCell } from "../../tools/ResultCell.tsx";
import { runTool } from "../../tools/run.ts";
import { type AnalysisCell, type AnalysisParams, type BMode, frameBOf, runInputs, sameSlice } from "../model.ts";
import { MethodBlock } from "./MethodBlock.tsx";

// An analysis cell: one of the five tools on the slice above, its few parameters inline, Run, the result as the
// rail renders it, and the method under it. A result whose slice no longer matches the slice above says so.

const PERIODS = [7, 14, 28] as const;
const B_MODES: readonly BMode[] = ["previous", "unit", "custom"];

export function AnalysisCellBody({
  cell,
  locale,
  client,
  asOf,
  slice,
  sliceN,
  wards,
  onChange,
  onChart,
  onAddSlice,
}: {
  cell: AnalysisCell;
  locale: Locale;
  client: AeiClient;
  asOf: string | null;
  /** The slice this cell reads (the nearest slice cell above), or null. */
  slice: Slice | null;
  sliceN: number;
  wards: readonly string[];
  onChange: (patch: Partial<AnalysisCell>) => void;
  onChart: (r: CellResult) => void;
  onAddSlice: () => void;
}) {
  const { id, tool, params: p, result } = cell;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AnalysisParams>(key: K, v: AnalysisParams[K]) => onChange({ params: { ...p, [key]: v } });
  if (!slice)
    return (
      <div className="nb-analysis">
        <p className="tl-warn">{t(locale, "nbNoSlice")}</p>
        <button type="button" className="btn" onClick={onAddSlice}>
          {t(locale, "nbAddSliceAbove")}
        </button>
      </div>
    );
  const valid = slice.from <= slice.to && asOf !== null;
  const run = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange({ result: await runTool(client, tool, slice, runInputs(slice, p, wards)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const stale = result !== null && !sameSlice(result.slice, slice);
  const frameB = frameBOf(slice, p, wards);
  const fid = (k: string) => `${id}-${k}`;
  const days = frameDays(slice);
  const prevName =
    days % 7 === 0
      ? t(locale, days === 7 ? "toolsBPrevWeek" : "toolsBPrevWeeks", { n: days / 7 })
      : t(locale, "toolsBPrevDays", { n: days });
  return (
    <div className="nb-analysis">
      <form
        className="nb-params"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {(tool === "compare" || tool === "shares" || tool === "beta") && (
          <label className="tl-field" htmlFor={fid("event")}>
            <span>{t(locale, "toolsEvent")}</span>
            <select id={fid("event")} value={p.event} onChange={(e) => set("event", e.target.value)}>
              <optgroup label={t(locale, "toolsEventPh")}>
                {PHENOTYPES.map((ph) => (
                  <option key={ph} value={`phenotype:${ph}`}>
                    {phenotypeName(ph)}
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
          </label>
        )}
        {tool === "compare" && (
          <>
            <label className="tl-field" htmlFor={fid("bmode")}>
              <span>{t(locale, "toolsBFrame")}</span>
              <select id={fid("bmode")} value={p.bMode} onChange={(e) => set("bMode", e.target.value as BMode)}>
                {B_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "previous" ? prevName : t(locale, mode === "unit" ? "toolsBOtherUnit" : "toolsBCustom")}
                  </option>
                ))}
              </select>
            </label>
            {p.bMode === "unit" && (
              <label className="tl-field" htmlFor={fid("bunit")}>
                <span>{t(locale, "toolsBUnit")}</span>
                <select id={fid("bunit")} value={frameB.unit} onChange={(e) => set("bUnit", e.target.value)}>
                  <option value="">{t(locale, "toolsUnitAll")}</option>
                  {wards
                    .filter((w) => w !== slice.unit)
                    .map((w) => (
                      <option key={w} value={w}>
                        {wardName(locale, w as never)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {p.bMode === "custom" && (
              <>
                <label className="tl-field" htmlFor={fid("bfrom")}>
                  <span>{t(locale, "toolsBFrom")}</span>
                  <input
                    id={fid("bfrom")}
                    type="date"
                    value={frameB.from}
                    onChange={(e) => e.target.value && set("bFrom", e.target.value)}
                  />
                </label>
                <label className="tl-field" htmlFor={fid("bto")}>
                  <span>{t(locale, "toolsBTo")}</span>
                  <input id={fid("bto")} type="date" value={frameB.to} onChange={(e) => e.target.value && set("bTo", e.target.value)} />
                </label>
              </>
            )}
          </>
        )}
        {tool === "shares" && (
          <label className="tl-field" htmlFor={fid("period")}>
            <span>{t(locale, "toolsPeriod")}</span>
            <select id={fid("period")} value={p.period} onChange={(e) => set("period", Number(e.target.value))}>
              {PERIODS.map((d) => (
                <option key={d} value={d}>
                  {t(locale, "toolsDays", { n: d })}
                </option>
              ))}
            </select>
          </label>
        )}
        {tool === "beta" && (
          <>
            <label className="tl-check">
              <input type="checkbox" checked={p.discounted} onChange={(e) => set("discounted", e.target.checked)} />
              <span>{t(locale, "toolsDiscounted")}</span>
            </label>
            {p.discounted && (
              <>
                <label className="tl-field nb-narrow" htmlFor={fid("delta")}>
                  <span>{t(locale, "toolsDelta")}</span>
                  <input
                    id={fid("delta")}
                    type="number"
                    min={0.9}
                    max={1}
                    step={0.01}
                    value={p.delta}
                    onChange={(e) => set("delta", Math.min(1, Math.max(0.9, Number(e.target.value) || 0.95)))}
                  />
                </label>
                <label className="tl-field nb-narrow" htmlFor={fid("m")}>
                  <span>{t(locale, "toolsM")}</span>
                  <input
                    id={fid("m")}
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={p.m}
                    onChange={(e) => set("m", Math.min(1000, Math.max(1, Number(e.target.value) || 30)))}
                  />
                </label>
              </>
            )}
          </>
        )}
        {tool === "detector" && (
          <label className="tl-field" htmlFor={fid("detector")}>
            <span>{t(locale, "toolsDetector")}</span>
            <select id={fid("detector")} value={p.detector} onChange={(e) => set("detector", e.target.value as DetectorChoice)}>
              <option value="phenotype">{t(locale, "toolsDetPhenotype")}</option>
              <option value="profile">{t(locale, "toolsDetProfile")}</option>
            </select>
          </label>
        )}
        <button type="submit" className="btn btn-primary nb-run" disabled={!valid || busy} aria-busy={busy}>
          {busy ? t(locale, "toolsRunning") : t(locale, "toolsRun")}
        </button>
      </form>
      {tool === "compare" && (
        <p className="nb-muted">
          B: {formatDate(locale, frameB.from)} – {formatDate(locale, frameB.to, "long")} ·{" "}
          {frameB.unit ? wardName(locale, frameB.unit as never) : t(locale, "toolsUnitAll")}
        </p>
      )}
      {!valid && <p className="tl-warn">{t(locale, asOf === null ? "toolsNoClock" : "toolsBadFrame")}</p>}
      {error && (
        <p className="tl-warn" role="alert">
          {t(locale, "toolsError", { error })}
        </p>
      )}
      <div aria-live="polite">
        {busy && (
          <p className="tl-wait">
            {t(locale, tool === "compare" ? "toolsFetchingBoth" : tool === "detector" ? "toolsFetchingBaseline" : "toolsFetching")}
          </p>
        )}
        {stale && <p className="tl-warn">{t(locale, "nbStale", { n: sliceN })}</p>}
        {!result && !busy && <p className="nb-muted">{t(locale, "nbNotRun")}</p>}
      </div>
      {result && (
        <>
          <ResultCell cell={{ id: 0, result }} locale={locale} removable={false} inNotebook onChart={onChart} />
          <MethodBlock id={id} locale={locale} result={result} />
        </>
      )}
    </div>
  );
}
