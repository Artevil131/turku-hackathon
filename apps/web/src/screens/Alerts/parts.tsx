import { patientOverlap } from "@aei/alerts";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { formatMonth, formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { addDays, daysBetween, maxDate, minDate } from "../../model/dates.ts";
import type { Share, Signal } from "../../model/types.ts";
import { Disclosure, Icon, MIN_ISOLATES, Org, SeverityBadge, Sparkline, signalKindLabel, specimenName, unitName } from "../../ui/index.ts";
import type { TreatPrefs } from "../Treat/index.tsx";
import { AUDIENCE_ICON, type Described, dateText, describe, KIND_ICON, SPAN } from "./describe.tsx";

// The pieces of one alert: its tags and summary (list), and its body (what
// it rests on, who should act, the actions, the cases, how it was found).

/** The server's own wording of an alert (GET /api/explain, the code's template, D-029); null until it arrives. */
function useExplanation(id: string, locale: Locale): string | null {
  const [text, setText] = useState<{ key: string; text: string } | null>(null);
  const key = `${locale}|${id}`;
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/explain?${new URLSearchParams({ id, lang: locale }).toString()}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ text: string }>) : Promise.reject(new Error(String(res.status)))))
      .then((body) => setText({ key, text: body.text }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [id, locale, key]);
  return text?.key === key ? text.text : null;
}

export function Tags({ locale, s, isNew }: { locale: Locale; s: Signal; isNew: boolean }) {
  return (
    <div className="alerts-tags">
      <SeverityBadge locale={locale} severity={s.severity} size="sm" />
      <span className="alerts-kind">
        <Icon name={KIND_ICON[s.kind]} size={16} />
        {signalKindLabel(locale, s.kind)}
      </span>
      {isNew ? (
        <span className="alerts-new">
          <span className="alerts-new-dot" aria-hidden="true" />
          {t(locale, "alerts.new")}
        </span>
      ) : null}
    </div>
  );
}

/** Title (as the given control), second line, where · when, and the one-line evidence. */
export function Summary({ locale, d, control, level = 3 }: { locale: Locale; d: Described; control: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <>
      <H className={`alerts-title is-h${level}`}>{control}</H>
      {d.sub ? <p className="alerts-sub">{d.sub}</p> : null}
      <p className="alerts-meta u-num">
        <span>{d.where}</span>
        <span aria-hidden="true"> · </span>
        <span>{d.when}</span>
      </p>
      <div className="alerts-heading-facts">
        {d.short ? <p className="alerts-short u-num">{d.short}</p> : null}
        <p className="alerts-owner">
          <Icon name={AUDIENCE_ICON[d.audience]} size={16} />
          <span>
            <span className="u-sr">{t(locale, "alerts.label.who")}: </span>
            {t(locale, `alerts.who.${d.audience}`)}
          </span>
        </p>
      </div>
    </>
  );
}

// ---------- Cases ----------

function useCases(results: readonly Result[], ids: readonly string[]): { cases: Result[]; missing: number } {
  return useMemo(() => {
    const want = new Set(ids);
    if (want.size === 0) return { cases: [], missing: 0 };
    const cases = results.filter((r) => want.has(r.isolateId));
    cases.sort((a, b) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : a.isolateId < b.isolateId ? -1 : 1));
    return { cases, missing: Math.max(0, want.size - cases.length) };
  }, [results, ids]);
}

function RelatedAlert({
  locale,
  meta,
  results,
  asOf,
  related,
  above,
  complete,
}: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  related: Signal;
  above: readonly Result[];
  complete: boolean;
}) {
  const { cases, missing } = useCases(results, related.isolateIds);
  const overlap = useMemo(() => patientOverlap(above, cases), [above, cases]);
  const canCompare = complete && missing === 0 && related.isolateIds.length > 0;
  return (
    <li>
      <span className="u-num alerts-related-date">{dateText(locale, related.firstDate, asOf)}</span>{" "}
      {describe(locale, meta, related, asOf).title.node}
      <p className="u-small u-soft u-num">
        {canCompare
          ? t(locale, "alerts.related.overlap", {
              both: formatNumber(locale, overlap.both),
              above: formatNumber(locale, overlap.onlyAbove),
              related: formatNumber(locale, overlap.onlyRelated),
            })
          : t(locale, "alerts.related.unavailable")}
      </p>
    </li>
  );
}

/** Only the end of the patient code, so no one is identified on a shared screen. */
export function patientTag(id: string): string {
  return id.slice(-4);
}

function sexWord(locale: Locale, code: string): string {
  if (code === "F") return t(locale, "alerts.case.F");
  if (code === "M") return t(locale, "alerts.case.M");
  return code;
}

function CaseList({
  locale,
  meta,
  s,
  asOf,
  cases,
  missing,
}: {
  locale: Locale;
  meta: FeedMeta;
  s: Signal;
  asOf: IsoDate;
  cases: readonly Result[];
  missing: number;
}) {
  return (
    <>
      <ul className="alerts-cases" aria-label={t(locale, "alerts.case.list")}>
        {cases.map((r) => {
          const stay = r.admissionDate
            ? t(locale, "alerts.case.day", { n: formatNumber(locale, daysBetween(r.admissionDate, r.sampleDate) + 1) })
            : t(locale, "alerts.case.outpatient");
          const band = r.ageYears >= 65 ? t(locale, "alerts.case.65plus") : t(locale, "alerts.case.under65");
          return (
            <li key={r.isolateId} className="alerts-case">
              <span className="alerts-case-main">
                <span className="u-num">{dateText(locale, r.sampleDate, asOf)}</span>
                <span aria-hidden="true"> · </span>
                <Org name={r.organism} />
                <span aria-hidden="true"> · </span>
                {specimenName(locale, meta, r.specimen)}
                {r.ward !== s.ward ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {unitName(locale, meta, r.ward)}
                  </>
                ) : null}
              </span>
              <span className="alerts-case-sub u-num">
                {t(locale, "alerts.case.patient", { id: patientTag(r.patientId) })}
                <span aria-hidden="true"> · </span>
                {sexWord(locale, r.sex)}, {band}
                <span aria-hidden="true"> · </span>
                {stay}
              </span>
            </li>
          );
        })}
      </ul>
      {missing > 0 ? <p className="u-small u-muted">{t(locale, "alerts.case.missing", { count: formatNumber(locale, missing) })}</p> : null}
    </>
  );
}

/** Cases by day (an epidemic curve in miniature): when did they happen, together or spread out? */
function CaseStrip({ locale, s, asOf, cases }: { locale: Locale; s: Signal; asOf: IsoDate; cases: readonly Result[] }) {
  const first = cases[0];
  const last = cases[cases.length - 1];
  if (!first || !last) return null;
  const window = s.windowDays ?? 14;
  const to = maxDate(s.lastDate, last.sampleDate);
  const from = minDate(first.sampleDate, addDays(to, -(window - 1)));
  const span = daysBetween(from, to) + 1;
  const bin = span > 42 ? 7 : 1;
  const cols = Math.ceil(span / bin);
  const counts = new Array<number>(cols).fill(0);
  for (const r of cases) {
    const i = Math.min(cols - 1, Math.floor(daysBetween(from, r.sampleDate) / bin));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const label = t(locale, "alerts.case.strip", {
    count: formatNumber(locale, cases.length),
    from: dateText(locale, from, asOf),
    to: dateText(locale, to, asOf),
  });
  return (
    <figure className="alerts-strip">
      <p className="u-eyebrow" aria-hidden="true">
        {t(locale, bin === 7 ? "alerts.case.byWeek" : "alerts.case.byDay")}
      </p>
      <div
        className={`alerts-strip-plot is-${s.severity}`}
        role="img"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {counts
          .map((c, i) => ({ c, start: addDays(from, i * bin) }))
          .map(({ c, start }) => (
            <span key={start} className="alerts-strip-col">
              {c > 6 ? (
                <span className="alerts-strip-more u-num">{formatNumber(locale, c)}</span>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: identical dots; the k-th dot is only a position in the column.
                Array.from({ length: c }, (_, k) => <span key={k} className="alerts-strip-dot" />)
              )}
            </span>
          ))}
      </div>
      <figcaption className="alerts-strip-axis u-num" aria-hidden="true">
        <span>{dateText(locale, from, asOf)}</span>
        <span>{dateText(locale, to, asOf)}</span>
      </figcaption>
    </figure>
  );
}

// ---------- Results per week from a unit (data gap) ----------

const GAP_WEEKS = 13;

function GapChart({ locale, results, ward, asOf }: { locale: Locale; results: readonly Result[]; ward: string; asOf: IsoDate }) {
  const weeks = useMemo(() => {
    const counts = new Array<number>(GAP_WEEKS).fill(0);
    const from = addDays(asOf, -(GAP_WEEKS * 7 - 1));
    for (const r of results) {
      if (r.ward !== ward || r.sampleDate < from || r.sampleDate > asOf) continue;
      const i = Math.floor(daysBetween(from, r.sampleDate) / 7);
      counts[i] = (counts[i] ?? 0) + 1;
    }
    return { from, counts };
  }, [results, ward, asOf]);
  const first = weeks.counts[0] ?? 0;
  const last = weeks.counts[GAP_WEEKS - 1] ?? 0;
  const label = t(locale, "alerts.gap.spark", { weeks: GAP_WEEKS, from: formatNumber(locale, first), to: formatNumber(locale, last) });
  return (
    <figure className="alerts-gap">
      <p className="u-eyebrow" aria-hidden="true">
        {t(locale, "alerts.gap.title")}
      </p>
      <Sparkline values={weeks.counts} min={0} fluid height={44} tone="medium" label={label} />
      <figcaption className="alerts-strip-axis u-num" aria-hidden="true">
        <span>{dateText(locale, weeks.from, asOf)}</span>
        <span>{t(locale, "alerts.gap.thisWeek", { count: formatNumber(locale, last) })}</span>
      </figcaption>
    </figure>
  );
}

// ---------- Shares compared (shift, trend) ----------

type CompareMode = "works" | "fails" | "positive";

const COUNT_KEY = { works: "alerts.cmp.works", fails: "alerts.cmp.fails", positive: "alerts.cmp.positive" } as const;

function CompareRow({ locale, label, share, mode }: { locale: Locale; label: string; share: Share; mode: CompareMode }) {
  const k = mode === "works" ? share.works : share.n - share.works;
  const enough = share.n >= MIN_ISOLATES && share.n > 0;
  const count = t(locale, COUNT_KEY[mode], { works: formatNumber(locale, k), n: formatNumber(locale, share.n) });
  return (
    <div className={`alerts-cmp-row is-${mode === "works" ? "works" : "fails"}${enough ? "" : " is-few"}`}>
      <div className="alerts-cmp-top">
        <span className="alerts-cmp-label">{label}</span>
        {enough ? <span className="alerts-cmp-pct u-num">{formatShare(locale, k / share.n)}</span> : null}
      </div>
      {enough ? (
        <div className="alerts-cmp-track" aria-hidden="true">
          <span className="alerts-cmp-fill" style={{ width: `${Math.max(1.5, (k / share.n) * 100)}%` }} />
        </div>
      ) : (
        // Below the organiser's 30 isolates: no percentage, one dot per isolate.
        <div className="alerts-dots" role="img" aria-label={count}>
          {Array.from({ length: share.n }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one dot per isolate counted, identified only by its position.
            <span key={i} className={`alerts-dot${i < k ? " is-on" : ""}`} />
          ))}
        </div>
      )}
      <div className="alerts-cmp-meta u-num">
        <span>{count}</span>
        {enough ? null : <span>{t(locale, "alerts.cmp.few")}</span>}
      </div>
    </div>
  );
}

function Compare({ locale, s, screen }: { locale: Locale; s: Signal; screen: boolean }) {
  if (!s.recent || !s.baseline) return null;
  if (s.kind === "shift") {
    const heading = t(locale, screen ? "alerts.cmp.headingScreen" : "alerts.cmp.headingShift");
    const mode: CompareMode = screen ? "positive" : "works";
    return (
      <section className="alerts-cmp" aria-label={heading}>
        <p className="alerts-cmp-h u-eyebrow">{heading}</p>
        <CompareRow locale={locale} label={t(locale, "alerts.cmp.recentWeeks", { weeks: SPAN.shiftWeeks })} share={s.recent} mode={mode} />
        <CompareRow
          locale={locale}
          label={t(locale, "alerts.cmp.beforeMonths", { months: SPAN.shiftBeforeMonths })}
          share={s.baseline}
          mode={mode}
        />
      </section>
    );
  }
  const heading = t(locale, screen ? "alerts.cmp.headingScreen" : "alerts.cmp.headingTrend");
  const mode: CompareMode = screen ? "positive" : "fails";
  const series = (s.series ?? []).filter((p) => p.share.n > 0);
  const values = series.map((p) => (p.share.n >= MIN_ISOLATES ? (p.share.n - p.share.works) / p.share.n : null));
  const known = values.filter((v): v is number => v !== null);
  const firstPoint = series[0];
  const lastPoint = series[series.length - 1];
  return (
    <section className="alerts-cmp" aria-label={heading}>
      <p className="alerts-cmp-h u-eyebrow">{heading}</p>
      <CompareRow locale={locale} label={t(locale, "alerts.cmp.recentMonths", { months: SPAN.trendMonths })} share={s.recent} mode={mode} />
      <CompareRow locale={locale} label={t(locale, "alerts.cmp.before")} share={s.baseline} mode={mode} />
      {known.length >= 2 && firstPoint && lastPoint ? (
        <div className="alerts-spark">
          <Sparkline
            values={values}
            fluid
            height={44}
            tone="medium"
            label={t(locale, screen ? "alerts.cmp.sparkScreen" : "alerts.cmp.spark", {
              from: formatShare(locale, known[0] ?? 0),
              to: formatShare(locale, known[known.length - 1] ?? 0),
            })}
          />
          <p className="alerts-spark-note u-small u-muted">
            {t(locale, "alerts.cmp.sparkNote", {
              first: formatMonth(locale, firstPoint.period),
              last: formatMonth(locale, lastPoint.period),
              min: formatNumber(locale, MIN_ISOLATES),
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

// ---------- The body ----------

export function Body({
  locale,
  meta,
  results,
  asOf,
  s,
  d,
  seen,
  onSeen,
  onOpenTreat,
  onOpenTimeline,
  casesOpen,
  onCasesOpen,
}: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  s: Signal;
  d: Described;
  seen: boolean;
  onSeen: (ids: string[]) => void;
  onOpenTreat: (patch: Partial<TreatPrefs>) => void;
  onOpenTimeline: (date: IsoDate) => void;
  casesOpen?: boolean;
  onCasesOpen?: (open: boolean) => void;
}) {
  const [ownCases, setOwnCases] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const open = casesOpen ?? ownCases;
  const setOpen = (o: boolean) => {
    setOwnCases(o);
    onCasesOpen?.(o);
  };
  const { cases, missing } = useCases(results, s.isolateIds);
  const showCompare = (s.kind === "shift" || s.kind === "trend") && s.recent && s.baseline;
  const explained = useExplanation(s.id, locale);

  return (
    <div className="alerts-body">
      {d.how || explained ? (
        <div className="alerts-fact">
          <p className="u-eyebrow">{t(locale, "alerts.label.how")}</p>
          {explained ? <p className="alerts-how">{explained}</p> : null}
          {d.how ? (
            <p className={explained ? "alerts-how-more" : "alerts-how"}>
              {d.how}
              {d.chance ? <span className="alerts-chance"> {d.chance}</span> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {s.related.length > 0 ? (
        <div className="alerts-fact">
          <p className="u-eyebrow">{t(locale, "alerts.label.incident")}</p>
          <ul className="alerts-related">
            {s.related.map((r) => (
              <RelatedAlert
                key={r.id}
                locale={locale}
                meta={meta}
                results={results}
                asOf={asOf}
                related={r}
                above={cases}
                complete={missing === 0 && s.isolateIds.length > 0}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {showCompare ? <Compare locale={locale} s={s} screen={d.screen} /> : null}
      {!showCompare && cases.length > 0 ? <CaseStrip locale={locale} s={s} asOf={asOf} cases={cases} /> : null}
      {s.kind === "data-gap" && s.ward ? <GapChart locale={locale} results={results} ward={s.ward} asOf={asOf} /> : null}

      <div className={`alerts-who is-${d.audience}`}>
        <span className="alerts-who-icon" aria-hidden="true">
          <Icon name={AUDIENCE_ICON[d.audience]} size={20} />
        </span>
        <div className="alerts-who-text">
          <p className="u-eyebrow">{t(locale, "alerts.label.who")}</p>
          <p className="alerts-who-name">{t(locale, `alerts.who.${d.audience}`)}</p>
          <p className="alerts-who-why">{t(locale, `alerts.who.${d.audience}Why`)}</p>
        </div>
      </div>

      <div className="alerts-actions">
        {d.treat ? (
          <button type="button" className="k-btn is-secondary" onClick={() => d.treat && onOpenTreat(d.treat)}>
            <Icon name="treat" size={18} />
            {t(locale, "alerts.act.treat")}
          </button>
        ) : null}
        <button type="button" className="k-btn is-ghost" onClick={() => onOpenTimeline(s.firstDate)}>
          <Icon name="timeline" size={18} />
          {t(locale, "alerts.act.timeline")}
        </button>
        <button type="button" className="k-btn is-ghost" onClick={() => onSeen([s.id])} disabled={seen}>
          <Icon name="check" size={18} />
          {seen ? t(locale, "alerts.seen") : t(locale, "alerts.markSeen")}
        </button>
      </div>

      <div className="alerts-more">
        {d.casesLabel ? (
          <Disclosure summary={d.casesLabel} open={open} onToggle={setOpen} className="alerts-disc">
            {open ? <CaseList locale={locale} meta={meta} s={s} asOf={asOf} cases={cases} missing={missing} /> : null}
          </Disclosure>
        ) : null}
        <Disclosure summary={t(locale, "alerts.act.method")} open={methodOpen} onToggle={setMethodOpen} className="alerts-disc">
          {methodOpen ? (
            <div className="alerts-method">
              {d.method.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </Disclosure>
      </div>
    </div>
  );
}
