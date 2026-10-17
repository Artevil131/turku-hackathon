import { toCsv } from "@aei/export";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { formatNum, formatP } from "@aei/viz";
import { type ReactNode, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import { BetaCurve, ShareLine } from "./Charts.tsx";
import {
  type BetaResult,
  type Cell,
  type CompareResult,
  cellTable,
  type DetectorResult,
  type EventSpec,
  poissonInterval,
  pythonCall,
  type RateResult,
  type SharesResult,
} from "./model.ts";

// One result cell: a title in words, the numbers, one method line, Copy as Python, Export CSV, remove.
// Everything shown is a field of the gear's result; nothing is computed here but formatting.

const ok = Number.isFinite;

export function eventName(locale: Locale, e: EventSpec): string {
  return e.type === "phenotype" ? phenotypeName(e.code) : antibioticName(locale, e.code);
}

const pct = (v: number, locale: Locale) => (ok(v) ? `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %` : "–");
const num = (v: number, locale: Locale) => (ok(v) ? formatNum(v, locale) : "–");
const ratioNum = (v: number, locale: Locale) => (ok(v) ? v.toLocaleString(locale, { maximumSignificantDigits: 3 }) : "–");
const span = (lo: number, hi: number, f: (v: number) => string) => `${f(lo)}–${f(hi)}`;

function sliceWords(locale: Locale, r: Cell["result"]): string {
  const s = r.slice;
  const parts = [s.unit ? wardName(locale, s.unit as never) : t(locale, "toolsUnitAll")];
  if (s.organism) parts.push(s.organism);
  if (s.specimen) parts.push(specimenName(locale, s.specimen as never));
  parts.push(`${formatDate(locale, s.from)}–${formatDate(locale, s.to, "long")}`);
  return parts.join(" · ");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tl-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Rate({ r, locale }: { r: RateResult; locale: Locale }) {
  const c = poissonInterval(r.count);
  const first = t(locale, r.slice.firstOnly ? "toolsFirstYes" : "toolsFirstNo");
  return (
    <>
      <dl className="tl-nums">
        <Row
          label={t(locale, r.slice.phenotype ? "toolsRateCountPh" : "toolsRateCount", {
            ph: r.slice.phenotype ? phenotypeName(r.slice.phenotype) : "",
          })}
        >
          <b>{r.count}</b> <span className="tl-ci">{t(locale, "toolsCi", { range: span(c.lo, c.hi, (v) => num(v, locale)) })}</span>
        </Row>
        <Row label={t(locale, "toolsRatePerWeek")}>
          <b>{num(r.perWeek, locale)}</b>{" "}
          <span className="tl-ci">
            {t(locale, "toolsCi", { range: span(r.perWeekInterval.lo, r.perWeekInterval.hi, (v) => num(v, locale)) })}
          </span>
        </Row>
        <Row label={t(locale, "toolsRatePer100")}>
          <b>{num(r.per100Cultures, locale)}</b> <span className="tl-ci">{t(locale, "toolsRateCultures", { n: r.cultures })}</span>
        </Row>
        {r.share && (
          <Row label={t(locale, "toolsRateShare", { ph: phenotypeName(r.slice.phenotype as never) })}>
            <b>{pct(r.share.share, locale)}</b>{" "}
            <span className="tl-ci">
              {r.share.k}/{r.share.n} ·{" "}
              {t(locale, "toolsCi", { range: span(r.share.interval.lo, r.share.interval.hi, (v) => pct(v, locale)) })}
            </span>
          </Row>
        )}
      </dl>
      <p className="tl-method">{t(locale, "toolsMethodRate", { first })}</p>
    </>
  );
}

function Compare({ r, locale }: { r: CompareResult; locale: Locale }) {
  const d = r.difference;
  const name = eventName(locale, r.event);
  const frame = (f: CompareResult["a"]) =>
    `${formatDate(locale, f.frame.from)}–${formatDate(locale, f.frame.to)} · ${f.frame.unit ? wardName(locale, f.frame.unit as never) : t(locale, "toolsUnitAll")}`;
  return (
    <>
      <dl className="tl-nums">
        <Row label={t(locale, "toolsFrameA", { frame: frame(r.a) })}>
          <b>{pct(d?.p1 ?? Number.NaN, locale)}</b>{" "}
          <span className="tl-ci">
            {r.a.k}/{r.a.n}
          </span>
        </Row>
        <Row label={t(locale, "toolsFrameB", { frame: frame(r.b) })}>
          <b>{pct(d?.p2 ?? Number.NaN, locale)}</b>{" "}
          <span className="tl-ci">
            {r.b.k}/{r.b.n}
          </span>
        </Row>
        {d && (
          <Row label={t(locale, "toolsCmpDiff")}>
            <b>
              {ok(d.diff)
                ? `${(d.diff * 100).toLocaleString(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" })} ${t(locale, "toolsPoints")}`
                : "–"}
            </b>{" "}
            <span className="tl-ci">
              {t(locale, "toolsCi", {
                range: span(d.interval.lo * 100, d.interval.hi * 100, (v) =>
                  v.toLocaleString(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }),
                ),
              })}{" "}
              · p {formatP(d.p, locale)}
            </span>
          </Row>
        )}
        {r.ratio && (
          <Row label={t(locale, "toolsCmpRatio")}>
            <b>{ratioNum(r.ratio.ratio, locale)}</b>{" "}
            <span className="tl-ci">
              {t(locale, "toolsCi", { range: span(r.ratio.interval.lo, r.ratio.interval.hi, (v) => ratioNum(v, locale)) })} · p{" "}
              {formatP(r.ratio.p, locale)}
            </span>
          </Row>
        )}
        <Row label={t(locale, "toolsCmpTrend")}>
          {r.trend ? (
            <>
              <b>p {formatP(r.trend.p, locale)}</b> <span className="tl-ci">{t(locale, "toolsCmpTrendOf", { n: r.trend.periods })}</span>
            </>
          ) : (
            <span className="tl-ci">{t(locale, "toolsCmpTrendNone")}</span>
          )}
        </Row>
      </dl>
      {d && (
        <p className="tl-words">
          {t(locale, r.higher === "same" ? "toolsCmpSame" : r.higher === "a" ? "toolsCmpHigherA" : "toolsCmpHigherB", { event: name })}{" "}
          {t(locale, r.excludesZero ? "toolsCmpExcludes" : "toolsCmpIncludes")}
        </p>
      )}
      <p className="tl-method">{t(locale, "toolsMethodCompare")}</p>
    </>
  );
}

function Shares({ r, locale }: { r: SharesResult; locale: Locale }) {
  const name = eventName(locale, r.event);
  // Periods without a denominator carry a null share and interval; they are left out of the summary.
  const known = r.points.filter(
    (p): p is typeof p & { share: number; interval: { lo: number; hi: number } } => p.share !== null && p.interval !== null && ok(p.share),
  );
  const summary = known
    .map((p) => `${formatDate(locale, p.from)} ${pct(p.share, locale)} (${pct(p.interval.lo, locale)}–${pct(p.interval.hi, locale)})`)
    .join("; ");
  return (
    <>
      <ShareLine points={r.points} locale={locale} aria={t(locale, "toolsSharesAria", { event: name, days: r.periodDays, summary })} />
      <p className="tl-words">
        {t(locale, "toolsSharesSummary", {
          n: known.length,
          event: name,
          first: pct(known[0]?.share ?? Number.NaN, locale),
          last: pct(known[known.length - 1]?.share ?? Number.NaN, locale),
        })}
      </p>
      <p className="tl-method">{t(locale, "toolsMethodShares", { days: r.periodDays })}</p>
    </>
  );
}

function Beta({ r, locale }: { r: BetaResult; locale: Locale }) {
  const p = r.posterior;
  const dsc = r.discounted;
  const aria = t(locale, "toolsBetaAria", {
    k: r.k,
    n: r.n,
    mean: pct(p.mean, locale),
    range: span(p.interval.lo, p.interval.hi, (v) => pct(v, locale)),
  });
  return (
    <>
      <BetaCurve flat={p} discounted={dsc?.posterior ?? null} locale={locale} aria={aria} />
      <dl className="tl-nums">
        <Row label={t(locale, "toolsBetaFlat", { k: r.k, n: r.n })}>
          <b>{pct(p.mean, locale)}</b>{" "}
          <span className="tl-ci">{t(locale, "toolsCredible", { range: span(p.interval.lo, p.interval.hi, (v) => pct(v, locale)) })}</span>
        </Row>
        {dsc && (
          <Row
            label={t(locale, "toolsBetaDisc", { delta: dsc.delta.toLocaleString(locale), m: dsc.m, parent: pct(dsc.parentShare, locale) })}
          >
            <b>{pct(dsc.posterior.mean, locale)}</b>{" "}
            <span className="tl-ci">
              {t(locale, "toolsCredible", { range: span(dsc.posterior.interval.lo, dsc.posterior.interval.hi, (v) => pct(v, locale)) })} ·{" "}
              {t(locale, "toolsEffectiveN", { n: num(dsc.posterior.effectiveN, locale) })}
            </span>
          </Row>
        )}
      </dl>
      {dsc && <p className="tl-badge">{t(locale, "toolsBetaAccepted")}</p>}
      <p className="tl-method">{t(locale, dsc ? "toolsMethodBetaDisc" : "toolsMethodBeta")}</p>
    </>
  );
}

function Detector({ r, locale }: { r: DetectorResult; locale: Locale }) {
  return (
    <>
      <p className="tl-badge">{t(locale, "toolsExploratory")}</p>
      {r.rows.length === 0 ? (
        <p className="tl-words">{t(locale, "toolsDetNone", { n: r.fetched })}</p>
      ) : (
        <table className="tl-table">
          <thead>
            <tr>
              <th>{t(locale, "toolsColUnit")}</th>
              <th>{t(locale, "toolsColWhat")}</th>
              <th>{t(locale, "toolsColWhen")}</th>
              <th>{t(locale, "toolsColObserved")}</th>
              <th>{t(locale, "toolsColExpected")}</th>
              <th>p</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((e) => (
              <tr key={`${e.key}|${e.first}`}>
                <td>{e.unit ? wardName(locale, e.unit as never) : t(locale, "toolsUnitAll")}</td>
                <td>{[e.label ? e.label.toUpperCase() : "", e.organism ?? ""].filter(Boolean).join(" · ")}</td>
                <td>
                  {formatDate(locale, e.first)}
                  {e.last !== e.first ? `–${formatDate(locale, e.last)}` : ""}
                </td>
                <td>{e.observed}</td>
                <td>{e.expected === null ? "–" : e.expected < 0.1 ? `<${(0.1).toLocaleString(locale)}` : num(e.expected, locale)}</td>
                <td>{e.p === null ? "–" : formatP(e.p, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="tl-method">{t(locale, r.detector === "profile" ? "toolsMethodProfile" : "toolsMethodPhenotype")}</p>
    </>
  );
}

export function ResultCell({ cell, locale, onRemove }: { cell: Cell; locale: Locale; onRemove?: (id: number) => void }) {
  const r = cell.result;
  const [copied, setCopied] = useState(false);
  const event =
    r.kind === "compare" || r.kind === "shares" || r.kind === "beta"
      ? eventName(locale, r.event)
      : r.kind === "rate" && r.slice.phenotype
        ? phenotypeName(r.slice.phenotype)
        : "";
  const title = t(locale, (r.kind === "rate" && !event ? "toolsTitle_rateAll" : `toolsTitle_${r.kind}`) as "toolsTitle_rate", { event });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pythonCall(r));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <article className="tl-cell" aria-label={title} data-kind={r.kind}>
      <header className="tl-cell-head">
        <div>
          <h3>{title}</h3>
          <p className="tl-slice">{sliceWords(locale, r)}</p>
        </div>
        <button
          type="button"
          className="tl-x"
          aria-label={t(locale, "toolsRemove")}
          title={t(locale, "toolsRemove")}
          onClick={() => onRemove?.(cell.id)}
        >
          ×
        </button>
      </header>
      {r.kind === "rate" && <Rate r={r} locale={locale} />}
      {r.kind === "compare" && <Compare r={r} locale={locale} />}
      {r.kind === "shares" && <Shares r={r} locale={locale} />}
      {r.kind === "beta" && <Beta r={r} locale={locale} />}
      {r.kind === "detector" && <Detector r={r} locale={locale} />}
      <footer className="tl-cell-foot">
        <button type="button" className="btn" onClick={copy}>
          {copied ? t(locale, "toolsCopied") : t(locale, "toolsCopyPython")}
        </button>
        <button type="button" className="btn" onClick={() => downloadFile(toCsv(cellTable(r)))}>
          {t(locale, "toolsExportCsv")}
        </button>
      </footer>
    </article>
  );
}
