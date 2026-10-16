import { type IsolateRecord, PHENOTYPES, type Phenotype, WARDS, type WardCode } from "@aei/domain";
import { formatDate, phenotypeName, t } from "@aei/i18n";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsOf } from "../AsOf.tsx";
import { kindOf, type PanelProps } from "./board.ts";
import "./UnitGrid.css";

// The researcher's unit grid (spec-research.md): nine units across, ISO weeks
// down with the newest on top. A cell is the number of isolates carrying the
// selected phenotype in that unit and week. The shade is a count, not
// surprise: the API has no weekly expected count (gap R5).

const WEEK_CHOICES = [12, 26, 52] as const;
const STEPS = 5;
const DAY = 86_400_000;

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Monday of the ISO week containing `iso`, as milliseconds. */
function mondayMs(iso: string): number {
  const ms = utc(iso);
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return ms - dow * DAY;
}

function isoWeekNumber(mondayMsValue: number): number {
  const thursday = new Date(mondayMsValue + 3 * DAY);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / DAY / 7) + 1;
}

interface Loaded {
  weeks: number;
  /** The date the response was cut at (its as-of). */
  asOf: string;
  records: IsolateRecord[];
  quality: Set<string>;
  clusters: Set<string>;
}

const cellKey = (ward: string, week: number) => `${ward}|${week}`;

interface Cell {
  ward: WardCode;
  weekMs: number;
  n: number;
  quality: boolean;
  cluster: boolean;
}

export function UnitGrid({ client, locale, asOf, state, onChange }: PanelProps) {
  const phenotype: Phenotype = state.phenotype ?? "esbl";
  const [weeks, setWeeks] = useState<number>(12);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [focus, setFocus] = useState({ r: 0, c: 0 });
  const refs = useRef(new Map<string, HTMLButtonElement>());

  // One fetch per window; a clock move or a new window refetches.
  useEffect(() => {
    if (!asOf) return;
    // Retry bumps `reload`; naming it here keeps the dependency honest.
    void reload;
    let live = true;
    const from = isoOf(mondayMs(asOf) - (weeks - 1) * 7 * DAY);
    setLoading(true);
    setError(false);
    Promise.all([client.isolates({ from }), client.alerts({ from })])
      .then(([iso, al]) => {
        if (!live) return;
        const quality = new Set<string>();
        const clusters = new Set<string>();
        for (const a of al.alerts) {
          if (a.kind !== "detector" || !a.ward) continue;
          const k = kindOf(a);
          const key = cellKey(a.ward, mondayMs(a.date));
          if (k === "data") quality.add(key);
          else if (k === "cluster") clusters.add(key);
        }
        setData({ weeks, asOf: iso.asOf, records: iso.records, quality, clusters });
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
  }, [client, asOf, weeks, reload]);

  const shown = data && data.weeks === weeks ? data : null;

  const model = useMemo(() => {
    if (!shown) return null;
    const top = mondayMs(shown.asOf);
    const weekStarts = Array.from({ length: shown.weeks }, (_, i) => top - i * 7 * DAY);
    const counts = new Map<string, number>();
    for (const r of shown.records) {
      if (!r.phenotypes.includes(phenotype)) continue;
      const k = cellKey(r.ward, mondayMs(r.sampleDate));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rows: Cell[][] = weekStarts.map((weekMs) =>
      WARDS.map((w) => {
        const k = cellKey(w.code, weekMs);
        return { ward: w.code, weekMs, n: counts.get(k) ?? 0, quality: shown.quality.has(k), cluster: shown.clusters.has(k) };
      }),
    );
    const nonZero = rows
      .flat()
      .map((c) => c.n)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    // Step by the share of non-zero cells with a smaller count (quintiles); ties share a step.
    const stepOf = (n: number): number => {
      if (n <= 0 || nonZero.length === 0) return 0;
      let lo = 0;
      let hi = nonZero.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((nonZero[mid] ?? 0) < n) lo = mid + 1;
        else hi = mid;
      }
      return Math.min(STEPS, Math.floor((lo / nonZero.length) * STEPS) + 1);
    };
    const ranges: ({ min: number; max: number } | null)[] = Array.from({ length: STEPS }, () => null);
    for (const n of nonZero) {
      const s = stepOf(n) - 1;
      const cur = ranges[s];
      ranges[s] = cur ? { min: Math.min(cur.min, n), max: Math.max(cur.max, n) } : { min: n, max: n };
    }
    const colTotals = WARDS.map((_, c) => rows.reduce((sum, row) => sum + (row[c]?.n ?? 0), 0));
    const total = colTotals.reduce((a, b) => a + b, 0);
    return { rows, stepOf, ranges, colTotals, total, weekStarts };
  }, [shown, phenotype]);

  const move = useCallback((r: number, c: number) => {
    setFocus({ r, c });
    refs.current.get(`${r}|${c}`)?.focus();
  }, []);

  const onKey = (e: KeyboardEvent, r: number, c: number) => {
    const rows = model?.rows.length ?? 0;
    const cols = WARDS.length;
    const go = (nr: number, nc: number) => {
      e.preventDefault();
      move(Math.max(0, Math.min(rows - 1, nr)), Math.max(0, Math.min(cols - 1, nc)));
    };
    if (e.key === "ArrowDown") go(r + 1, c);
    else if (e.key === "ArrowUp") go(r - 1, c);
    else if (e.key === "ArrowRight") go(r, c + 1);
    else if (e.key === "ArrowLeft") go(r, c - 1);
    else if (e.key === "Home") go(r, 0);
    else if (e.key === "End") go(r, cols - 1);
    else if (e.key === "PageDown") go(r + 10, c);
    else if (e.key === "PageUp") go(r - 10, c);
  };

  const ph = phenotypeName(phenotype);
  const date = (ms: number) => formatDate(locale, isoOf(ms));
  const first = model?.weekStarts[model.weekStarts.length - 1];
  const last = model?.weekStarts[0];
  const topWeek = asOf ? mondayMs(asOf) : null;

  return (
    <section className="board-panel ugrid" aria-labelledby="ugrid-title" aria-busy={loading}>
      <header className="ugrid-head">
        <div className="ugrid-titleline">
          <h2 id="ugrid-title" className="ugrid-title">
            {t(locale, "gridTitle", { phenotype: ph })}
          </h2>
          {shown ? <AsOf locale={locale} date={shown.asOf} pending={!!asOf && asOf !== shown.asOf} clockDate={asOf ?? undefined} /> : null}
        </div>
        <p className="ugrid-note">{t(locale, "gridNote")}</p>
        {first !== undefined && last !== undefined ? (
          <p className="ugrid-window">
            {t(locale, "gridWeeks", { n: shown?.weeks ?? weeks })} ·{" "}
            {t(locale, "gridWindow", { from: date(first), to: date(last + 6 * DAY) })}
          </p>
        ) : null}
        <div className="ugrid-controls">
          <div className="ugrid-seg" role="group" aria-label={t(locale, "gridPhenotypeLabel")}>
            {PHENOTYPES.map((p) => (
              <button
                key={p}
                type="button"
                className="ugrid-segbtn"
                aria-pressed={p === phenotype}
                onClick={() => onChange({ phenotype: p })}
              >
                {phenotypeName(p)}
              </button>
            ))}
          </div>
          <div className="ugrid-seg" role="group" aria-label={t(locale, "gridWeeksLabel")}>
            {WEEK_CHOICES.map((n) => (
              <button key={n} type="button" className="ugrid-segbtn" aria-pressed={n === weeks} onClick={() => setWeeks(n)}>
                {t(locale, "gridWeeks", { n })}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? (
        <div className="ugrid-state" role="alert">
          <p>{t(locale, "gridError")}</p>
          <button type="button" className="btn" onClick={() => setReload((n) => n + 1)}>
            {t(locale, "retry")}
          </button>
        </div>
      ) : !model ? (
        <div className="ugrid-state" role="status">
          <div className="ugrid-skeleton" aria-hidden="true" />
          <p>{weeks >= 26 ? t(locale, "gridSlow", { n: weeks }) : t(locale, "gridLoading")}</p>
        </div>
      ) : model.total === 0 ? (
        <div className="ugrid-state" role="status">
          <p>{t(locale, "gridEmpty", { phenotype: ph, n: model.rows.length })}</p>
        </div>
      ) : (
        <>
          {loading && weeks >= 26 ? <p className="ugrid-slow">{t(locale, "gridSlow", { n: weeks })}</p> : null}
          <div className="ugrid-scroll">
            <table className="ugrid-table" aria-label={t(locale, "gridAria", { phenotype: ph })}>
              <thead>
                <tr>
                  <th scope="col" className="ugrid-corner">
                    {t(locale, "gridWeekHeader")}
                  </th>
                  {WARDS.map((w) => (
                    <th
                      key={w.code}
                      scope="col"
                      title={w[locale]}
                      className="ugrid-colhead"
                      data-selected={state.unit === w.code}
                      aria-label={state.unit === w.code ? `${w[locale]}, ${t(locale, "gridSelectedUnit")}` : w[locale]}
                    >
                      <span className="ugrid-code" aria-hidden="true">
                        {w.code}
                      </span>
                      <span className="ugrid-name" aria-hidden="true">
                        {w[locale].replace("Terveysasema", "Terveys\u00ADasema")}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="ugrid-total">
                    {t(locale, "gridTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row, r) => {
                  const weekMs = model.weekStarts[r] ?? 0;
                  const rowTotal = row.reduce((s, c) => s + c.n, 0);
                  return (
                    <tr key={weekMs}>
                      <th scope="row" className="ugrid-rowhead" title={topWeek === weekMs ? t(locale, "gridPartial") : undefined}>
                        <span className="ugrid-wk">{t(locale, "gridWeekNo", { n: isoWeekNumber(weekMs) })}</span> {date(weekMs)}
                        {topWeek === weekMs ? <span className="ugrid-partial"> *</span> : null}
                      </th>
                      {row.map((cell, c) => {
                        const step = cell.quality ? 0 : model.stepOf(cell.n);
                        const unitName = WARDS[c]?.[locale] ?? cell.ward;
                        const label = [
                          t(locale, "gridCell", { unit: unitName, date: date(cell.weekMs), n: cell.n }),
                          cell.quality ? t(locale, "gridQualityWeek") : null,
                          cell.cluster ? t(locale, "gridClusterWeek") : null,
                        ]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <td key={cell.ward} className="ugrid-td" data-selected={state.unit === cell.ward}>
                            <button
                              type="button"
                              className="ugrid-cell"
                              data-step={step}
                              data-quality={cell.quality}
                              data-cluster={cell.cluster}
                              aria-label={label}
                              title={label}
                              tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                              ref={(el) => {
                                if (el) refs.current.set(`${r}|${c}`, el);
                                else refs.current.delete(`${r}|${c}`);
                              }}
                              onFocus={() => setFocus({ r, c })}
                              onKeyDown={(e) => onKey(e, r, c)}
                              onClick={() => onChange({ unit: cell.ward, phenotype })}
                            >
                              <span className="ugrid-num" aria-hidden="true">
                                {cell.quality ? "!" : cell.n > 0 ? cell.n : ""}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                      <td className="ugrid-sum">{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="ugrid-rowhead">
                    {t(locale, "gridTotal")}
                  </th>
                  {model.colTotals.map((n, c) => (
                    <td key={WARDS[c]?.code} className="ugrid-sum" data-selected={state.unit === WARDS[c]?.code}>
                      {n}
                    </td>
                  ))}
                  <td className="ugrid-sum ugrid-grand">{model.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <ul className="ugrid-legend">
            <li className="ugrid-legend-count">
              <span className="ugrid-legend-label">{t(locale, "gridLegendCount")}</span>
              <span className="ugrid-swatches">
                <span className="ugrid-sw" data-step="0">
                  {t(locale, "gridLegendNone")}
                </span>
                {model.ranges.map((rg, i) =>
                  rg ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: steps are a fixed list of five
                    <span key={i} className="ugrid-sw" data-step={i + 1}>
                      {rg.min === rg.max ? rg.min : `${rg.min}–${rg.max}`}
                    </span>
                  ) : null,
                )}
              </span>
            </li>
            <li>
              <span className="ugrid-sw ugrid-sw-q" data-quality="true">
                !
              </span>
              {t(locale, "gridLegendQuality")}
            </li>
            <li>
              <span className="ugrid-sw ugrid-sw-c" data-cluster="true" />
              {t(locale, "gridLegendCluster")}
            </li>
            {topWeek !== null ? (
              <li>
                <span className="ugrid-partial">*</span> {t(locale, "gridPartial")}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
