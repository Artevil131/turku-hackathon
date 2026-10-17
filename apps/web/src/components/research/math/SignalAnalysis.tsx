import type { AeiClient, Alert } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { formatDate, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { formatNum } from "@aei/viz";
import { useEffect, useState } from "react";
import { type Incident, shift, windowOf } from "../feed/model.ts";
import { ShareLine } from "../tools/Charts.tsx";
import { computeRate, computeShares, type EventSpec, prepare, type RateResult, type SharesResult, type Slice } from "../tools/model.ts";
import { eventName } from "../tools/ResultCell.tsx";

// "Analyse this signal": two ready results on the signal's own slice, computed by the Tools model
// (research/tools/model.ts, D-076): the event's share by week over the last 26 weeks with its chart, and the
// rate in the signal's window with its interval. Every number is a field of a gear's result; "Open in Tools"
// hands the same slice to the Tools window.

const WEEKS = 26;
const PERIOD_DAYS = 7;

/** The slice the Tools window would start from for this signal: its unit, phenotype or organism, its window. */
export function sliceOf(inc: Incident): Slice {
  const lead = inc.lead;
  const win = windowOf(inc);
  return {
    from: win.from,
    to: win.to,
    unit: inc.ward ?? "",
    organism: "organism" in lead && lead.organism && !("phenotype" in lead && lead.phenotype) ? lead.organism : "",
    specimen: "",
    phenotype: inc.phenotypes[0] ?? "",
    firstOnly: true,
  };
}

/** What the signal counts, as a Tools event: its phenotype, or the trend's antibiotic; null for a sampling gap. */
export function eventOf(lead: Alert, slice: Slice): EventSpec | null {
  if (slice.phenotype) return { type: "phenotype", code: slice.phenotype };
  if (lead.kind === "detector" && lead.detector === "rising-trend" && lead.antibiotic) return { type: "antibiotic", code: lead.antibiotic };
  return null;
}

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; shares: SharesResult | null; rate: RateResult; rows: number };

const ok = Number.isFinite;
const pct = (v: number, locale: Locale) => (ok(v) ? `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %` : "–");
const num = (v: number, locale: Locale) => (ok(v) ? formatNum(v, locale) : "–");
const range = (lo: number, hi: number, f: (v: number) => string) => `${f(lo)}–${f(hi)}`;

export function SignalAnalysis({
  client,
  locale,
  incident: inc,
  onOpenTools,
}: {
  client: AeiClient;
  locale: Locale;
  incident: Incident;
  /** Sets the Tools window's slice to this signal's and reveals it. */
  onOpenTools?: (slice: Slice) => void;
}) {
  const slice = sliceOf(inc);
  const event = eventOf(inc.lead, slice);
  const long = { ...slice, from: shift(slice.to, 1 - WEEKS * PERIOD_DAYS) };
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const key = `${inc.key}|${long.from}|${long.to}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the incident and its slice.
  useEffect(() => {
    let stale = false;
    setLoad({ status: "loading" });
    client
      .isolates({
        from: long.from,
        to: long.to,
        ...(slice.unit ? { ward: slice.unit as never } : {}),
        ...(slice.organism ? { organism: slice.organism as never } : {}),
      })
      .then((r) => {
        if (stale) return;
        const records: IsolateRecord[] = r.records;
        const rate = computeRate(prepare(records, slice, true), slice);
        const shares = event ? computeShares(prepare(records, long, true), long, event, PERIOD_DAYS) : null;
        setLoad({ status: "ready", shares, rate, rows: records.length });
      })
      .catch(() => !stale && setLoad({ status: "error" }));
    return () => {
      stale = true;
    };
  }, [client, key]);

  const where = slice.unit ? wardName(locale, slice.unit as never) : t(locale, "feedUnitHospital");
  const ph = slice.phenotype ? phenotypeName(slice.phenotype) : "";
  const last =
    load.status === "ready" && load.shares ? [...load.shares.points].reverse().find((p) => p.share !== null && p.interval !== null) : null;

  return (
    <div className="sig-analysis">
      {load.status === "loading" ? (
        <p className="sig-note" aria-busy="true">
          {t(locale, "cardAnalyseLoading")}
        </p>
      ) : null}
      {load.status === "error" ? <p className="sig-note">{t(locale, "cardAnalyseError")}</p> : null}
      {load.status === "ready" && load.rows === 0 ? <p className="sig-note">{t(locale, "cardAnalyseNone")}</p> : null}
      {load.status === "ready" && load.rows > 0 ? (
        <>
          {load.shares && event ? (
            <section className="sig-result" aria-label={t(locale, "toolsName_shares")}>
              <h4 className="sig-result-title">
                {t(locale, "cardAnalyseShares", { event: eventName(locale, event), weeks: WEEKS, where })}
              </h4>
              <ShareLine
                points={load.shares.points}
                locale={locale}
                aria={t(locale, "toolsSharesAria", {
                  event: eventName(locale, event),
                  days: PERIOD_DAYS,
                  summary: last ? t(locale, "cardAnalyseSharesLast", sharesWords(last, locale)) : "",
                })}
              />
              {last ? <p className="sig-result-words">{t(locale, "cardAnalyseSharesLast", sharesWords(last, locale))}</p> : null}
            </section>
          ) : null}
          <section className="sig-result" aria-label={t(locale, "toolsName_rate")}>
            <h4 className="sig-result-title">
              {t(locale, "cardAnalyseRate", { from: formatDate(locale, slice.from), to: formatDate(locale, slice.to), where })}
            </h4>
            <p className="sig-result-words">
              {t(locale, ph ? "cardAnalyseRateCountPh" : "cardAnalyseRateCount", {
                n: load.rate.count,
                ph,
                perWeek: num(load.rate.perWeek, locale),
                range: range(load.rate.perWeekInterval.lo, load.rate.perWeekInterval.hi, (v) => num(v, locale)),
              })}
              {load.rate.share ? (
                <>
                  <br />
                  {t(locale, "cardAnalyseRateShare", {
                    ph,
                    share: pct(load.rate.share.share, locale),
                    range: range(load.rate.share.interval.lo, load.rate.share.interval.hi, (v) => pct(v, locale)),
                    k: load.rate.share.k,
                    n: load.rate.share.n,
                  })}
                </>
              ) : null}
            </p>
          </section>
          <p className="sig-note">{t(locale, "cardAnalyseMethod")}</p>
        </>
      ) : null}
      {onOpenTools ? (
        <button type="button" className="sig-btn sig-tools" onClick={() => onOpenTools(slice)}>
          {t(locale, "cardOpenTools")} →
        </button>
      ) : null}
    </div>
  );
}

function sharesWords(p: { share: number | null; interval: { lo: number; hi: number } | null; k: number; n: number }, locale: Locale) {
  return {
    share: pct(p.share ?? Number.NaN, locale),
    range: p.interval ? range(p.interval.lo, p.interval.hi, (v) => pct(v, locale)) : "–",
    k: p.k,
    n: p.n,
  };
}
