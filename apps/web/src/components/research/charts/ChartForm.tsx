import { ORGANISMS, PHENOTYPES } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { useMemo, useState } from "react";
import { siteWards } from "../../../sites.ts";
import type { Cell } from "../tools/model.ts";
import { specFromResult } from "./model.ts";
import { CHART_PERIODS, CHART_TYPES, CHART_WEEKS, type ChartSpec, type ChartType, defaultSpec } from "./spec.ts";
import "./charts.css";

// The small form behind "+ Chart" in the workspace tray: a source (a result cell of the Tools window, or a
// slice of the clock's last weeks), a chart type, and Add. Everything it builds is a ChartSpec.

export function ChartForm({
  locale,
  cells,
  unit,
  phenotype,
  onAdd,
}: {
  locale: Locale;
  cells: readonly Cell[];
  /** The board's selected unit and phenotype, as the slice's starting point. */
  unit: string;
  phenotype: string;
  onAdd: (spec: ChartSpec) => void;
}) {
  const usable = cells.filter((c) => specFromResult(c.result) !== null);
  const [source, setSource] = useState("slice");
  const [type, setType] = useState<ChartType>("share");
  const [spec, setSpec] = useState<ChartSpec>(() => defaultSpec({ unit, event: `phenotype:${phenotype || "esbl"}` }));
  const wards = useMemo(() => siteWards(), []);
  const cell = source === "slice" ? null : usable.find((c) => String(c.id) === source);
  const set = <K extends keyof ChartSpec>(key: K, v: ChartSpec[K]) => setSpec((s) => ({ ...s, [key]: v }));
  const weeks = "weeks" in spec.window ? spec.window.weeks : 12;
  return (
    <form
      className="ch-form"
      aria-label={t(locale, "chartAddTitle")}
      onSubmit={(e) => {
        e.preventDefault();
        const base = cell ? specFromResult(cell.result, type) : { ...spec, type };
        if (base) onAdd(base);
      }}
    >
      <label>
        {t(locale, "chartSource")}
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="slice">{t(locale, "chartSourceSlice")}</option>
          {usable.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {t(locale, "chartSourceCell", { n: c.id, tool: t(locale, `toolsName_${c.result.kind}` as "toolsName_rate") })}
            </option>
          ))}
        </select>
      </label>
      {!cell && (
        <>
          <label>
            {t(locale, "toolsUnit")}
            <select value={spec.unit} onChange={(e) => set("unit", e.target.value)}>
              <option value="">{t(locale, "toolsUnitAll")}</option>
              {wards.map((w) => (
                <option key={w.code} value={w.code}>
                  {wardName(locale, w.code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "toolsOrganism")}
            <select value={spec.organism} onChange={(e) => set("organism", e.target.value)}>
              <option value="">{t(locale, "toolsOrganismAll")}</option>
              {ORGANISMS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "toolsPhenotype")}
            <select value={spec.event} onChange={(e) => set("event", e.target.value)}>
              {PHENOTYPES.map((p) => (
                <option key={p} value={`phenotype:${p}`}>
                  {phenotypeName(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "chartWindow")}
            <select value={weeks} onChange={(e) => set("window", { weeks: Number(e.target.value) })}>
              {CHART_WEEKS.map((w) => (
                <option key={w} value={w}>
                  {t(locale, "chartLastWeeks", { n: w })}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        {t(locale, "chartType")}
        <select value={type} onChange={(e) => setType(e.target.value as ChartType)}>
          {CHART_TYPES.map((c) => (
            <option key={c} value={c}>
              {t(locale, `chartType_${c}` as "chartType_share")}
            </option>
          ))}
        </select>
      </label>
      {type === "share" && !cell && (
        <label>
          {t(locale, "toolsPeriod")}
          <select value={spec.periodDays} onChange={(e) => set("periodDays", Number(e.target.value))}>
            {CHART_PERIODS.map((d) => (
              <option key={d} value={d}>
                {t(locale, "toolsDays", { n: d })}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="btn btn-primary ch-add">
        {t(locale, "chartAdd")}
      </button>
    </form>
  );
}
