import type { MonthPoint } from "../../engine/types.ts";
import { formatNumber, formatShare, t, type Locale } from "../../i18n/index.ts";
import { Sparkline } from "../../ui/index.ts";
import { MIN, type Cell } from "./model.ts";

/*
  Small pieces shared by the report's two views:
    Fig          one figure: "87 %" over "n = 412", or "Too few" / "Rarely tested" / "No results", never a % under MIN
    cellAria     the same figure as one sentence, with its period
    Change       4 weeks vs 12 months in percentage points, with a glyph and a sentence for screen readers
    MonthSpark   12 monthly figures as a sparkline (months under MIN are gaps) and the n range behind it
    CsvButton    "Download CSV"
    downloadCsv  saves text as a UTF-8 CSV file (with a BOM so spreadsheets read ä and ö)
    cap          first letter upper case (feed names are lower case: "urine", "ampicillin")
*/

export function cap(locale: Locale, text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text;
}

export function Fig({ locale, cell }: { locale: Locale; cell: Cell }) {
  const num = (v: number) => formatNumber(locale, v);
  if (cell.state === "ok" && cell.share) {
    return (
      <span className="report-fig">
        <span className="report-pct u-num">{formatShare(locale, cell.share.works / cell.share.n)}</span>
        <span className="report-n u-num">{t(locale, "report.n", { n: num(cell.share.n) })}</span>
      </span>
    );
  }
  let word: string;
  let sub: string | null = null;
  if (cell.state === "rare") word = t(locale, "report.cell.rare");
  else if (cell.state === "none") word = t(locale, "report.cell.none");
  else {
    // One way for every thin figure: "Too few · n < 30" (the exact count is in the cell's spoken label).
    word = t(locale, "report.cell.tooFew");
    sub = t(locale, "report.cell.under", { min: num(MIN) });
  }
  return (
    <span className={`report-fig is-${cell.state}`}>
      <span className="report-word">{word}</span>
      {sub ? <span className="report-n u-num">{sub}</span> : null}
    </span>
  );
}

export function cellAria(locale: Locale, period: string, cell: Cell): string {
  const num = (v: number) => formatNumber(locale, v);
  const s = cell.share;
  if (cell.state === "ok" && s) {
    return t(locale, "report.cell.ariaShare", { period, percent: formatShare(locale, s.works / s.n), works: num(s.works), n: num(s.n) });
  }
  if (cell.state === "few") {
    return s ? t(locale, "report.cell.ariaFew", { period, n: num(s.n) }) : t(locale, "report.cell.ariaUnder", { period, min: num(MIN) });
  }
  if (cell.state === "rare") return t(locale, "report.cell.ariaRare", { period });
  return t(locale, "report.cell.ariaNone", { period });
}

export function Change({ locale, change }: { locale: Locale; change: number | null }) {
  if (change === null) {
    return (
      <span className="report-change is-none">
        <span aria-hidden="true">–</span>
        <span className="u-sr">{t(locale, "report.change.ariaNone")}</span>
      </span>
    );
  }
  const dir = change > 0 ? "up" : change < 0 ? "down" : "same";
  const points = formatNumber(locale, Math.abs(change));
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "=";
  const sign = dir === "up" ? "+" : dir === "down" ? "−" : "±";
  const one = Math.abs(change) === 1;
  const aria =
    dir === "up"
      ? one
        ? t(locale, "report.change.ariaUpOne")
        : t(locale, "report.change.ariaUp", { points })
      : dir === "down"
        ? one
          ? t(locale, "report.change.ariaDownOne")
          : t(locale, "report.change.ariaDown", { points })
        : t(locale, "report.change.ariaSame");
  return (
    <span className={`report-change is-${dir}`}>
      <span aria-hidden="true" className="report-change-vis">
        <span className="report-change-glyph">{glyph}</span>
        <span className="u-num">{t(locale, one ? "report.change.pointsOne" : "report.change.points", { sign, points })}</span>
      </span>
      <span className="u-sr">{aria}</span>
    </span>
  );
}

/** Minimum height of the sparkline's y range (share 0-1), so a two-point wobble does not look like a cliff. */
const MIN_SPAN = 0.2;

export function MonthSpark({ locale, drug, months, fluid = false }: { locale: Locale; drug: string; months: readonly MonthPoint[]; fluid?: boolean }) {
  const values = months.map((p) => (p.share.n >= MIN && p.share.n > 0 ? p.share.works / p.share.n : null));
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return <span className="report-spark-few">{t(locale, "report.months.tooFew")}</span>;
  let lo = Math.min(...known);
  let hi = Math.max(...known);
  const dataLo = lo;
  const dataHi = hi;
  if (hi - lo < MIN_SPAN) {
    const mid = (hi + lo) / 2;
    lo = mid - MIN_SPAN / 2;
    hi = mid + MIN_SPAN / 2;
    if (lo < 0) {
      hi -= lo;
      lo = 0;
    }
    if (hi > 1) {
      lo -= hi - 1;
      hi = 1;
    }
  }
  const ns = months.filter((p) => p.share.n >= MIN).map((p) => p.share.n);
  const nLo = Math.min(...ns);
  const nHi = Math.max(...ns);
  const num = (v: number) => formatNumber(locale, v);
  return (
    <span className={`report-spark${fluid ? " is-fluid" : ""}`}>
      <Sparkline
        values={values}
        label={t(locale, "report.months.aria", { drug, lo: formatShare(locale, dataLo), hi: formatShare(locale, dataHi) })}
        min={lo}
        max={hi}
        width={112}
        height={30}
        fluid={fluid}
      />
      <span className="report-spark-n u-num">
        {nLo === nHi ? t(locale, "report.months.nOne", { n: num(nLo) }) : t(locale, "report.months.n", { lo: num(nLo), hi: num(nHi) })}
      </span>
    </span>
  );
}

export function CsvButton({ locale, onClick, disabled }: { locale: Locale; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="k-btn is-secondary is-sm report-csv" onClick={onClick} disabled={disabled} aria-label={t(locale, "report.csv.aria")}>
      <svg className="k-icon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M12 4v11 M7 10.5l5 5 5-5 M5 19.5h14" />
      </svg>
      <span>{t(locale, "report.csv.button")}</span>
    </button>
  );
}

export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
