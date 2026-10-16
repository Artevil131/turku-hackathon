import type { FeedMeta, IsoDate, Result } from "@aei/feed";
import { addDays, ageBandOf, daysBetween, maxDate, minDate, type Share } from "@aei/isolates";
import type { Signal } from "@aei/signals";
import { type ReactNode, useMemo, useState } from "react";
import { CLUSTER_WINDOW_DAYS, SHIFT_WINDOW_DAYS, SURGE_WINDOW_DAYS } from "../../analytics/helpers.ts";
import { formatMonth, formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { Disclosure, Icon, MIN_ISOLATES, Org, SeverityBadge, Sparkline, signalKindLabel, specimenName, unitName } from "../../ui/index.ts";
import type { TreatPrefs } from "../Treat/index.tsx";
import { AUDIENCE_ICON, type Described, dateText, KIND_ICON, SPAN } from "./describe.tsx";

// The pieces of one alert: its tags and summary (list), and its body (what
// it rests on, who should act, the actions, the cases, how it was found).

export function Tags({ locale, s, isNew, steps = 1 }: { locale: Locale; s: Signal; isNew: boolean; steps?: number }) {
  return (
    <div className="alerts-tags">
      <SeverityBadge locale={locale} severity={s.severity} size="sm" />
      <span className="alerts-kind">
        <Icon name={KIND_ICON[s.kind]} size={16} />
        {signalKindLabel(locale, s.kind)}
      </span>
      {steps > 1 ? (
        <span className="alerts-steps u-num">{t(locale, "alerts.story.linked", { count: formatNumber(locale, steps) })}</span>
      ) : null}
      {isNew ? (
        <span className="alerts-new">
          <span className="alerts-new-dot" aria-hidden="true" />
          {t(locale, "alerts.new")}
        </span>
      ) : null}
    </div>
  );
}

/** Title (as the given control), second line, where · when, the one-line evidence and (an episode) its story in one line. */
export function Summary({
  d,
  control,
  level = 3,
  short = true,
  extra = null,
}: {
  d: Described;
  control: ReactNode;
  level?: 2 | 3;
  short?: boolean;
  extra?: ReactNode;
}) {
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
      {short && d.short ? <p className="alerts-short u-num">{d.short}</p> : null}
      {extra}
    </>
  );
}

// ---------- Episode story ----------

const STEP_GLYPH = { high: "▲", medium: "◆", low: "●" } as const;
/** Steps named in the one-line story before "+N". */
const STORY_LINE_STEPS = 3;

/** "4 Jun Possible cluster → 7 Jun More resistant finds → 10 Jun Working less often +2": the episode at a glance. */
export function StoryLine({ locale, asOf, members }: { locale: Locale; asOf: IsoDate; members: readonly Signal[] }) {
  const shown = members.slice(0, STORY_LINE_STEPS);
  const rest = members.length - shown.length;
  return (
    <p className="alerts-storyline u-num">
      {shown.map((s, i) => (
        <span key={s.id} className="alerts-storyline-step">
          {i > 0 ? (
            <span className="alerts-storyline-arrow" aria-hidden="true">
              {" → "}
            </span>
          ) : null}
          <span className="alerts-storyline-date">{dateText(locale, s.firstDate, asOf)}</span>{" "}
          {signalKindLabel(locale, s.kind).toLocaleLowerCase(locale)}
        </span>
      ))}
      {rest > 0 ? (
        <span className="alerts-storyline-more"> {t(locale, "alerts.story.more", { count: formatNumber(locale, rest) })}</span>
      ) : null}
    </p>
  );
}

/** The episode's steps, oldest first; each opens its own evidence below. */
export function Story({
  locale,
  asOf,
  members,
  described,
  current,
  onPick,
}: {
  locale: Locale;
  asOf: IsoDate;
  members: readonly Signal[];
  described: ReadonlyMap<string, Described>;
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <section className="alerts-story" aria-label={t(locale, "alerts.story.title")}>
      <p className="u-eyebrow">{t(locale, "alerts.story.title")}</p>
      <ol className="alerts-story-list">
        {members.map((s) => {
          const d = described.get(s.id);
          const on = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`alerts-story-step is-${s.severity}${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onPick(s.id)}
              >
                <span className="alerts-story-dot" aria-hidden="true">
                  {STEP_GLYPH[s.severity]}
                </span>
                <span className="alerts-story-text">
                  <span className="alerts-story-head u-num">
                    <span className="alerts-story-date">{dateText(locale, s.firstDate, asOf)}</span>
                    <span>{signalKindLabel(locale, s.kind)}</span>
                  </span>
                  <span className="alerts-story-what">{d ? (d.short ?? d.title.node) : null}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="u-small u-muted">{t(locale, "alerts.story.note")}</p>
    </section>
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
          const band = ageBandOf(r.ageYears) === "65plus" ? t(locale, "alerts.case.65plus") : t(locale, "alerts.case.under65");
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
  const window =
    s.kind === "surge" ? SURGE_WINDOW_DAYS : s.kind === "cluster" ? CLUSTER_WINDOW_DAYS : s.kind === "shift" ? SHIFT_WINDOW_DAYS : 14;
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
        {counts.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one column per week, positional
          <span key={i} className="alerts-strip-col">
            {c > 6 ? (
              <span className="alerts-strip-more u-num">{formatNumber(locale, c)}</span>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: identical dots, positional
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

/**
 * Seven-day blocks ending on the day the alert last fired, so the last point
 * is exactly the alert's "{observed} in 7 days" (a block ending on today would
 * mix the gap with the normal days after it).
 */
function GapChart({
  locale,
  results,
  ward,
  to,
  asOf,
}: {
  locale: Locale;
  results: readonly Result[];
  ward: string;
  to: IsoDate;
  asOf: IsoDate;
}) {
  const weeks = useMemo(() => {
    const counts = new Array<number>(GAP_WEEKS).fill(0);
    const from = addDays(to, -(GAP_WEEKS * 7 - 1));
    for (const r of results) {
      if (r.ward !== ward || r.sampleDate < from || r.sampleDate > to) continue;
      const i = Math.floor(daysBetween(from, r.sampleDate) / 7);
      counts[i] = (counts[i] ?? 0) + 1;
    }
    return { from, counts };
  }, [results, ward, to]);
  const first = weeks.counts[0] ?? 0;
  const last = weeks.counts[GAP_WEEKS - 1] ?? 0;
  const label = t(locale, "alerts.gap.spark", {
    weeks: GAP_WEEKS,
    from: formatNumber(locale, first),
    to: formatNumber(locale, last),
    date: dateText(locale, to, asOf),
  });
  return (
    <figure className="alerts-gap">
      <p className="u-eyebrow" aria-hidden="true">
        {t(locale, "alerts.gap.title")}
      </p>
      <Sparkline values={weeks.counts} min={0} fluid height={56} tone="medium" label={label} />
      <figcaption className="alerts-strip-axis u-num" aria-hidden="true">
        <span>{dateText(locale, weeks.from, asOf)}</span>
        <span>{t(locale, "alerts.gap.thisWeek", { count: formatNumber(locale, last), date: dateText(locale, to, asOf) })}</span>
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
            // biome-ignore lint/suspicious/noArrayIndexKey: identical dots, positional
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
  seenIds,
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
  /** Every signal of the card has been marked seen. */
  seen: boolean;
  /** What "Mark seen" marks (every step of an episode); default this signal. */
  seenIds?: readonly string[];
  onSeen: (ids: string[]) => void;
  onOpenTreat: (patch: Partial<TreatPrefs>) => void;
  onOpenTimeline: (date: IsoDate, id: string) => void;
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

  return (
    <div className="alerts-body">
      {d.how ? (
        <div className="alerts-fact">
          <p className="u-eyebrow">{t(locale, "alerts.label.how")}</p>
          <p className="alerts-how">
            {d.how}
            {d.chance ? <span className="alerts-chance"> {d.chance}</span> : null}
          </p>
        </div>
      ) : null}

      {showCompare ? <Compare locale={locale} s={s} screen={d.screen} /> : null}
      {!showCompare && cases.length > 0 ? <CaseStrip locale={locale} s={s} asOf={asOf} cases={cases} /> : null}
      {s.kind === "data-gap" && s.ward ? <GapChart locale={locale} results={results} ward={s.ward} to={s.lastDate} asOf={asOf} /> : null}

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
        <button type="button" className="k-btn is-ghost" onClick={() => onOpenTimeline(s.firstDate, s.id)}>
          <Icon name="timeline" size={18} />
          {t(locale, "alerts.act.timeline")}
        </button>
        {/* Stays a focusable button once seen (aria-disabled), so keyboard focus is not lost. */}
        <button
          type="button"
          className={`k-btn is-ghost alerts-seen${seen ? " is-done" : ""}`}
          onClick={() => {
            if (!seen) onSeen([...(seenIds ?? [s.id])]);
          }}
          aria-disabled={seen}
        >
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
              {d.method.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: method lines are positional and never reorder
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}
        </Disclosure>
      </div>
    </div>
  );
}
