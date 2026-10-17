import { type CoverageResponse, type NationalResponse, nationalCell } from "@aei/contract";
import type { AntibioticCode, Specimen } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { num } from "./filters.ts";

// The national reference beside a row (D-048): THL's Finres figure per genus for the row's antibiotic and specimen.
// The headline share stays the hospital's own; this is context, never a prior.

/** Points of difference between the national figure for the leading organism and the row's own resistance that earn a sentence. */
const DIFFERENCE = 10;

const oneDecimal = (locale: Locale, x: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(x);

/**
 * One line per genus among the pool's organisms with at least 5 % of it that Finres has a figure for, in the pool's
 * order; and, when the leading organism's national figure differs from the row's own resistance (1 − share) by 10
 * points or more, the sentence that says which way.
 */
export function nationalLines(
  locale: Locale,
  national: NationalResponse,
  data: CoverageResponse,
  antibiotic: AntibioticCode,
  specimen: Specimen,
  share: number | null,
): { lines: string[]; difference: string | null } {
  const seen = new Set<string>();
  const lines: string[] = [];
  let leading: number | null = null;
  for (const [i, o] of data.coverage.organisms.entries()) {
    if (o.share < 0.05) continue;
    const cell = nationalCell(national, o.organism, antibiotic, specimen);
    if (!cell || cell.pctR === null) continue;
    if (i === 0) leading = cell.pctR;
    if (seen.has(cell.genus)) continue;
    seen.add(cell.genus);
    lines.push(
      t(locale, "drNational", {
        year: national.year,
        genus: cell.genus,
        pct: oneDecimal(locale, cell.pctR),
        tests: cell.tests === null ? "–" : num(locale, cell.tests),
      }),
    );
  }
  let difference: string | null = null;
  if (leading !== null && share !== null) {
    const here = (1 - share) * 100;
    const gap = here - leading;
    if (Math.abs(gap) >= DIFFERENCE) {
      const vars = { here: Math.round(here), national: oneDecimal(locale, leading) };
      difference = t(locale, gap > 0 ? "drNationalMore" : "drNationalLess", vars);
    }
  }
  return { lines, difference };
}

/** The national lines in a row's details with the source in small print; nothing when Finres has no figure. */
export function NationalLines(props: {
  locale: Locale;
  national: NationalResponse | null;
  data: CoverageResponse;
  antibiotic: AntibioticCode;
  specimen: Specimen;
  share: number | null;
}) {
  const { locale, national } = props;
  if (!national) return null;
  const { lines, difference } = nationalLines(locale, national, props.data, props.antibiotic, props.specimen, props.share);
  if (lines.length === 0) return null;
  return (
    <div className="dt-national">
      {lines.map((line) => (
        <p key={line} className="num">
          {line}
        </p>
      ))}
      {difference ? <p>{difference}</p> : null}
      <small>{t(locale, "drNationalSource", { source: national.source, licence: national.licence })}</small>
    </div>
  );
}
