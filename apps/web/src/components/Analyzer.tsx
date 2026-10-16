import { type AntibioticCode, type Organism, type Specimen, shortOrganism, type WardCode } from "@aei/domain";
import { antibioticName, type Locale, specimenName, t } from "@aei/i18n";
import { useMemo } from "react";
import { COLUMNS, type Figure, type Strip, stripsFor } from "../examples.ts";
import { Tri } from "./Icons.tsx";

// The classic antibiogram for one unit and specimen: organisms against fixed
// antibiotic columns, % susceptible in each cell. Shown as the "all
// organisms" view of Treat.

type Window = "recent" | "year";
type Compare = "none" | "year" | "hospital";

export interface Selection {
  organism: Organism;
  specimen: Specimen;
  antibiotic: AntibioticCode;
}

const susceptible = (f: Figure) => Math.round(100 - f.r);

export function AntibiogramGrid(props: {
  locale: Locale;
  ward: WardCode;
  specimen: Specimen;
  window: Window;
  minIsolates: number;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const { locale, ward, specimen, window, minIsolates, selection, onSelect } = props;
  const strips = useMemo(() => stripsFor(ward, specimen), [ward, specimen]);
  const used = COLUMNS.filter((code) => strips.some((s) => s.cells.some((c) => c.antibiotic === code)));
  const compare: Compare = window === "recent" ? "year" : "hospital";
  return (
    <>
      <div className="deck">
        <table className="deck-table">
          <caption className="visually-hidden">{t(locale, "organismsBySpecimen")}</caption>
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span className="corner-text">{t(locale, "organism")}</span>
              </th>
              {used.map((code) => (
                <th key={code} scope="col" className="col-head" data-active={selection?.antibiotic === code}>
                  <span className="col-name">{antibioticName(locale, code)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strips.map((strip) => (
              <StripRow
                key={`${strip.organism}|${strip.specimen}`}
                strip={strip}
                columns={used}
                locale={locale}
                window={window}
                compare={compare}
                minIsolates={minIsolates}
                selection={selection}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Legend locale={locale} minIsolates={minIsolates} />
    </>
  );
}

function StripRow(props: {
  strip: Strip;
  columns: readonly AntibioticCode[];
  locale: Locale;
  window: Window;
  compare: Compare;
  minIsolates: number;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const { strip, columns, locale, window, compare, minIsolates, selection } = props;
  const byCode = new Map(strip.cells.map((c) => [c.antibiotic, c]));
  const n = strip.cells[0]?.[window].n ?? 0;
  const rowSelected = selection?.organism === strip.organism && selection.specimen === strip.specimen;
  const firstCell = strip.cells[0];
  return (
    <tr className="strip" data-selected={rowSelected}>
      <th scope="row" className="row-head">
        <button
          type="button"
          className="row-button"
          onClick={() =>
            firstCell && props.onSelect({ organism: strip.organism, specimen: strip.specimen, antibiotic: firstCell.antibiotic })
          }
        >
          <span className="org">{strip.organism}</span>
          <span className="org-meta">
            <span className="num" data-thin={n < minIsolates}>
              {t(locale, "isolatesN", { n })}
            </span>
          </span>
        </button>
      </th>
      {columns.map((code) => {
        const cell = byCode.get(code);
        if (!cell)
          return (
            <td key={code} className="well-cell">
              <span className="well-empty" title={t(locale, "notReported")} />
            </td>
          );
        const sel: Selection = { organism: strip.organism, specimen: strip.specimen, antibiotic: code };
        const pressed = rowSelected && selection?.antibiotic === code;
        const baseline = compare === "none" ? null : cell[compare];
        return (
          <td key={code} className="well-cell">
            <AstCell
              figure={cell[window]}
              baseline={baseline}
              minIsolates={minIsolates}
              pressed={pressed}
              label={`${shortOrganism(strip.organism)}, ${specimenName(locale, strip.specimen)}, ${antibioticName(locale, code)}: ${describe(locale, cell[window], minIsolates)}`}
              onClick={() => props.onSelect(sel)}
            />
          </td>
        );
      })}
    </tr>
  );
}

// Square-root scale so differences among low resistance shares stay visible.
const shade = (r: number) => Math.round(Math.sqrt(Math.max(0, Math.min(100, r)) / 100) * 100);

function AstCell(props: {
  figure: Figure;
  baseline: Figure | null;
  minIsolates: number;
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  const { figure, baseline, minIsolates, pressed } = props;
  const thin = figure.n < minIsolates;
  // Change in percentage points of susceptible isolates against the baseline.
  const delta = baseline && !thin && baseline.n >= minIsolates ? Math.round(baseline.r - figure.r) : null;
  const r = shade(figure.r);
  return (
    <button
      type="button"
      className={`ast${thin ? " ast-thin" : ""}`}
      aria-pressed={pressed}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      style={
        thin
          ? undefined
          : {
              background: `color-mix(in oklch, var(--resist) ${r}%, var(--well-empty))`,
              color: figure.r > 45 ? "var(--resist-ink)" : undefined,
            }
      }
    >
      <span className="ast-value num">{thin ? `n ${figure.n}` : susceptible(figure)}</span>
      {delta !== null && Math.abs(delta) >= 3 ? (
        <span className="delta" data-dir={delta < 0 ? "down" : "up"}>
          <Tri dir={delta < 0 ? "down" : "up"} />
          {Math.abs(delta)}
        </span>
      ) : null}
    </button>
  );
}

function describe(locale: Locale, f: Figure, min: number): string {
  return f.n < min
    ? t(locale, "thinData", { n: f.n, min })
    : `${t(locale, "percentSusceptible", { p: susceptible(f) })}, ${t(locale, "isolatesN", { n: f.n })}`;
}

function Legend({ locale, minIsolates }: { locale: Locale; minIsolates: number }) {
  return (
    <footer className="legend">
      <span className="legend-item">
        <span className="legend-swatch num">87</span>
        {t(locale, "legendNumber")}
      </span>
      <span className="legend-item">
        <span className="legend-ramp" aria-hidden="true" />
        {t(locale, "legendShade")}
      </span>
      <span className="legend-item">
        <span className="legend-swatch legend-thin num">n 12</span>
        {t(locale, "legendThin", { min: minIsolates })}
      </span>
      <span className="legend-item">
        <span className="delta legend-delta" data-dir="down">
          <Tri dir="down" />6
        </span>
        {t(locale, "legendDelta")}
      </span>
    </footer>
  );
}
