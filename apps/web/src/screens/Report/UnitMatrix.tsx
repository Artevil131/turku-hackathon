import { type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { Card, EmptyState, Icon, Segmented } from "../../ui/index.ts";
import { type Cell, type MatrixModel, type MatrixRow, MIN, tintOf } from "./model.ts";
import { cap, cellAria } from "./parts.tsx";

/*
  Compare units: units (rows) x antibiotics (columns), how often each
  antibiotic worked in the period, with every unit's own first isolates.
  One hue, stronger = works less often, always with the number; under MIN a
  hatched "–" with its n. Tap a figure: Treat for that unit. Tap a unit: its
  own antibiotic table. The first column stays put while the table scrolls
  sideways inside its card on phones; arrow keys move between figures.
*/

export type Period = "year" | "recent";
export const PERIODS: readonly Period[] = ["year", "recent"];

const SCALE_STEPS = [1, 0.9, 0.75, 0.5, 0] as const;

function tintStyle(cell: Cell): CSSProperties | undefined {
  if (cell.state !== "ok" || !cell.share) return undefined;
  return { ["--report-tint" as string]: `${tintOf(cell.share.works / cell.share.n)}%` } as CSSProperties;
}

function CellBody({ locale, cell }: { locale: Locale; cell: Cell }) {
  const num = (v: number) => formatNumber(locale, v);
  if (cell.state === "ok" && cell.share) {
    return (
      <>
        <span className="report-mx-pct u-num">{formatShare(locale, cell.share.works / cell.share.n)}</span>
        <span className="report-mx-n u-num">{t(locale, "report.units.n", { n: num(cell.share.n) })}</span>
      </>
    );
  }
  let sub: string;
  if (cell.state === "rare") sub = t(locale, "report.cell.rare");
  else if (cell.share) sub = t(locale, "report.units.n", { n: num(cell.share.n) });
  else if (cell.state === "few") sub = t(locale, "report.cell.under", { min: num(MIN) });
  else sub = t(locale, "report.units.n", { n: num(0) });
  return (
    <>
      <span className="report-mx-pct" aria-hidden="true">
        –
      </span>
      <span className="report-mx-n u-num">{sub}</span>
    </>
  );
}

export function UnitMatrix({
  locale,
  model,
  selected,
  period,
  onPeriod,
  onOpenCell,
  onOpenUnit,
  unitName,
  allUnits,
  drugName,
  actions,
}: {
  locale: Locale;
  model: MatrixModel;
  /** The unit chosen in the filters (its row is marked), or null. */
  selected: string | null;
  period: Period;
  onPeriod: (p: Period) => void;
  onOpenCell: (ward: string) => void;
  onOpenUnit: (ward: string) => void;
  unitName: (code: string) => string;
  allUnits: string;
  drugName: (code: string) => string;
  actions: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const describeId = useId();
  const mineId = useId();
  const [edge, setEdge] = useState({ overflow: false, start: true, end: true });
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const rowsN = model.rows.length;
  const colsN = model.columns.length;
  const ar = Math.max(0, Math.min(active[0], rowsN - 1));
  const ac = Math.max(0, Math.min(active[1], colsN - 1));
  const periodLabel = t(locale, period === "year" ? "report.units.year" : "report.units.recent");

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((prev) => (prev.overflow === overflow && prev.start === start && prev.end === end ? prev : { overflow, start, end }));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new model changes the table's width, so the scroll edges are measured again.
  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, model]);

  function focusCell(r: number, c: number) {
    scrollRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${r}:${c}"]`)?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLTableSectionElement>) {
    if (!(e.target instanceof HTMLElement) || !e.target.dataset.cell) return;
    let r = ar;
    let c = ac;
    switch (e.key) {
      case "ArrowRight":
        c += 1;
        break;
      case "ArrowLeft":
        c -= 1;
        break;
      case "ArrowDown":
        r += 1;
        break;
      case "ArrowUp":
        r -= 1;
        break;
      case "Home":
        c = 0;
        if (e.ctrlKey) r = 0;
        break;
      case "End":
        c = colsN - 1;
        if (e.ctrlKey) r = rowsN - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    r = Math.max(0, Math.min(rowsN - 1, r));
    c = Math.max(0, Math.min(colsN - 1, c));
    setActive([r, c]);
    focusCell(r, c);
  }

  const legend = (
    <div className="report-legend">
      <span className="report-legend-item">
        <span className="report-legend-end u-num">{formatShare(locale, 1)}</span>
        <span className="report-legend-scale" aria-hidden="true">
          {SCALE_STEPS.map((v) => (
            <span key={v} className="report-legend-swatch" style={{ ["--report-tint" as string]: `${tintOf(v)}%` } as CSSProperties} />
          ))}
        </span>
        <span className="report-legend-end u-num">{formatShare(locale, 0)}</span>
        <span>{t(locale, "report.units.legendScale")}</span>
      </span>
      <span className="report-legend-item">
        <span className="report-legend-few" aria-hidden="true" />
        <span>{t(locale, "report.units.legendFew", { min: formatNumber(locale, MIN) })}</span>
      </span>
      <span className="report-legend-item">{t(locale, "report.units.legendN")}</span>
    </div>
  );

  const rowHeader = (row: MatrixRow, interactive: boolean, mine = false) => {
    const name = row.ward ? unitName(row.ward) : allUnits;
    const inner = (
      <>
        <span className="report-mx-unitname">{name}</span>
        <span className="report-mx-n u-num">{t(locale, "report.units.n", { n: formatNumber(locale, row.n) })}</span>
      </>
    );
    return (
      <th scope="row" className="report-mx-unit">
        {interactive ? (
          <button
            type="button"
            className="report-mx-unitbtn"
            onClick={() => onOpenUnit(row.ward)}
            aria-describedby={mine ? `${describeId} ${mineId}` : describeId}
            title={t(locale, "report.units.rowOpen", { unit: name })}
          >
            {inner}
          </button>
        ) : (
          <span className="report-mx-unitbtn is-static">{inner}</span>
        )}
      </th>
    );
  };

  return (
    <Card className="report-card" title={t(locale, "report.units.title")} actions={actions}>
      <p className="report-lede">{t(locale, "report.units.lede")}</p>
      <div className="report-toolbar">
        <Segmented
          label={t(locale, "report.units.period")}
          value={period}
          options={PERIODS.map((p) => ({ value: p, label: t(locale, p === "year" ? "report.units.year" : "report.units.recent") }))}
          onChange={onPeriod}
          size="sm"
          stretch={false}
          showLabel
        />
        {legend}
      </div>

      {colsN === 0 ? (
        <EmptyState compact icon="inbox" title={t(locale, "report.units.empty")} />
      ) : (
        <>
          <p className={`report-mx-hint${edge.overflow ? (edge.end ? " is-done" : "") : " is-off"}`} aria-hidden="true">
            {t(locale, "report.units.scroll")}
            <Icon name="arrow-right" size={16} />
          </p>
          <div className={`report-mx-frame${edge.overflow && !edge.end ? " has-more" : ""}${edge.start ? "" : " is-scrolled"}`}>
            <div className="report-mx-scroll" ref={scrollRef} onScroll={measure}>
              <table className="report-matrix">
                <caption className="u-sr">{t(locale, "report.units.caption", { period: periodLabel })}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="report-mx-corner">
                      {t(locale, "report.filter.unit")}
                    </th>
                    {model.columns.map((c) => (
                      <th scope="col" key={c.code} className="report-mx-drug">
                        <span>{cap(locale, drugName(c.code))}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody onKeyDown={onKey}>
                  {model.rows.map((row, ri) => {
                    const name = unitName(row.ward);
                    const mine = row.ward === selected;
                    return (
                      <tr key={row.ward} className={mine ? "is-mine" : undefined} aria-current={mine ? "true" : undefined}>
                        {rowHeader(row, true, mine)}
                        {model.columns.map((c, ci) => {
                          const cell = row.cells.get(c.code) ?? { state: "none" as const, share: null };
                          const label = t(locale, "report.units.cellOpen", {
                            unit: name,
                            drug: drugName(c.code),
                            value: cellAria(locale, periodLabel, cell),
                          });
                          return (
                            <td key={c.code} className="report-mx-td">
                              <button
                                type="button"
                                className={`report-mx-cell is-${cell.state}`}
                                style={tintStyle(cell)}
                                data-cell={`${ri}:${ci}`}
                                tabIndex={ri === ar && ci === ac ? 0 : -1}
                                onFocus={() => setActive([ri, ci])}
                                onClick={() => onOpenCell(row.ward)}
                                aria-label={label}
                                title={label}
                              >
                                <CellBody locale={locale} cell={cell} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    {rowHeader(model.all, false)}
                    {model.columns.map((c) => {
                      const cell = model.all.cells.get(c.code) ?? { state: "none" as const, share: null };
                      const label = t(locale, "report.units.cell", {
                        unit: allUnits,
                        drug: drugName(c.code),
                        value: cellAria(locale, periodLabel, cell),
                      });
                      return (
                        <td key={c.code} className="report-mx-td">
                          <span className={`report-mx-cell is-static is-${cell.state}`} style={tintStyle(cell)} title={label}>
                            <CellBody locale={locale} cell={cell} />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="report-mx-tap">{t(locale, "report.units.tap")}</p>
          <span id={describeId} hidden>
            {t(locale, "report.units.rowHint")}
          </span>
          <span id={mineId} hidden>
            {t(locale, "report.units.mine")}
          </span>
        </>
      )}
    </Card>
  );
}
