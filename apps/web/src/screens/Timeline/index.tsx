import { useMemo, useRef, useState } from "react";
import type { FeedClock, FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { formatDate, formatMonth, formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { toDayNumber } from "../../model/dates.ts";
import type { Severity, Signal, SignalKind } from "../../model/types.ts";
import { Badge, SeverityBadge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { signalKindLabel, unitName } from "../../ui/defaults.ts";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { useIsDesktop } from "../../ui/hooks.ts";
import { Icon } from "../../ui/Icon.tsx";
import { QualityCard } from "../../ui/Quality.tsx";
import { MIN_ISOLATES } from "../../ui/ShareBar.tsx";
import type { QualityState } from "../../ui/useQuality.ts";
import { byMonth, type DailyStore, laneOrder, updateStore, visibleSignals, weekly } from "./aggregate.ts";
import { TimelineChart } from "./Chart.tsx";
import { KindGlyph } from "./Glyph.tsx";
import { RegionalCard } from "./Regional.tsx";
import { flagLabel, Summary, signalTitle, signalWhen, signalWhere, summaryText } from "./words.tsx";
import "./Timeline.css";

// The Timeline: the feed's whole period on one view, the story so far, and the
// place the presenter drives the simulation from. Everything after `asOf` has
// not arrived: it is drawn as an empty, hatched zone and never computed.

const SEVERITIES: readonly Severity[] = ["high", "medium", "low"];
const KINDS: readonly SignalKind[] = ["sentinel", "surge", "cluster", "data-gap", "shift", "trend"];
const MONTHS_SHOWN = 6;
const DAYS_PER_MONTH = 30.44;

export function TimelineScreen(p: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  clock: FeedClock;
  signals: readonly Signal[];
  /** The server's data checks (D-038). */
  quality: QualityState;
  onSeek: (date: IsoDate) => void;
  onOpenSignal: (id: string) => void;
}) {
  const { locale, meta, results, asOf, signals, onSeek, onOpenSignal } = p;
  const desktop = useIsDesktop();

  // Weekly aggregation: once per change of the results, extended in place as results arrive.
  const storeRef = useRef<DailyStore | null>(null);
  const store = useMemo(() => {
    storeRef.current = updateStore(storeRef.current, meta, results);
    return storeRef.current;
  }, [meta, results]);

  const shown = useMemo(() => visibleSignals(signals, asOf), [signals, asOf]);

  // The store is extended in place (same object), so `results`, not its identity, says there is new data.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  const wardKey = useMemo(() => {
    const codes = new Set(store.byWard.keys());
    for (const s of shown) if (s.ward) codes.add(s.ward);
    return [...codes].sort().join("|");
  }, [store, results, shown]);
  const groups = useMemo(() => laneOrder(meta, wardKey ? wardKey.split("|") : []), [meta, wardKey]);
  const laneCodes = useMemo(() => groups.flatMap((g) => g.codes), [groups]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the store is extended in place; `results` marks new data.
  const view = useMemo(() => weekly(store, asOf, laneCodes), [store, results, asOf, laneCodes]);

  const [highlight, setHighlight] = useState<string | null>(null);
  const [allMonths, setAllMonths] = useState(false);

  // ---------- Header numbers ----------
  const totalDays = toDayNumber(meta.end) - toDayNumber(meta.start) + 1;
  const elapsed = Math.max(0, Math.min(totalDays, toDayNumber(asOf) - toDayNumber(meta.start) + 1));
  const bySeverity = useMemo(() => {
    const c: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    for (const s of shown) c[s.severity]++;
    return c;
  }, [shown]);
  const byKind = useMemo(() => {
    const c = new Map<SignalKind, number>();
    for (const s of shown) c.set(s.kind, (c.get(s.kind) ?? 0) + 1);
    return c;
  }, [shown]);
  const months = useMemo(() => byMonth(shown), [shown]);
  const visibleMonths = allMonths ? months : months.slice(0, MONTHS_SHOWN);
  const monthsOfData = elapsed / DAYS_PER_MONTH;

  // ---------- Screen-reader summary of each lane ----------
  const signalsPerLane = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const s of shown) {
      const key = s.ward && laneCodes.includes(s.ward) ? s.ward : null;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [shown, laneCodes]);
  const latestFlag = useMemo(() => {
    for (let w = Math.min(view.nowWeek, view.flag.length - 1); w >= 0; w--) {
      const f = view.flag[w]!;
      if (f.n >= MIN_ISOLATES) return formatShare(locale, f.flagged / f.n);
    }
    return null;
  }, [view, locale]);

  const flagNames = view.phenotypes.map(flagLabel).join(", ");

  return (
    <div className="timeline u-stack-lg">
      {/* 1. Header: period, results so far, signals so far by severity */}
      <Card as="header" className="timeline-head" pad="md">
        <div className="timeline-head-top">
          <div className="u-stack-sm">
            <h1 className="timeline-title u-num">
              {t(locale, "timeline.period", { start: formatDate(locale, meta.start, "long"), end: formatDate(locale, meta.end, "long") })}
            </h1>
            <p className="u-soft timeline-lede">{t(locale, "timeline.lede")}</p>
          </div>
        </div>
        <div
          className="timeline-progress"
          role="img"
          aria-label={t(locale, "timeline.progress", { percent: formatShare(locale, elapsed / totalDays) })}
        >
          <div className="timeline-progress-fill" style={{ width: `${(100 * elapsed) / totalDays}%` }} />
          <div className="timeline-progress-rest" style={{ left: `${(100 * elapsed) / totalDays}%` }} />
        </div>
        <p className="u-xs u-muted u-num timeline-progress-cap" aria-hidden="true">
          {t(locale, "timeline.progress", { percent: formatShare(locale, elapsed / totalDays) })}
        </p>
        <dl className="timeline-stats">
          <div className="timeline-stat">
            <dt>{t(locale, "timeline.stat.results")}</dt>
            <dd className="timeline-stat-big u-num">{formatNumber(locale, view.totalSoFar)}</dd>
          </div>
          <div className="timeline-stat">
            <dt>{t(locale, "timeline.stat.upTo")}</dt>
            <dd>
              <span className="timeline-stat-big u-num">{formatDate(locale, asOf, "long")}</span>
              <span className="u-small u-muted u-num">
                {t(locale, "timeline.stat.day", { day: formatNumber(locale, elapsed), total: formatNumber(locale, totalDays) })}
              </span>
            </dd>
          </div>
          <div className="timeline-stat">
            <dt>{t(locale, "timeline.stat.signals")}</dt>
            <dd className="u-row">
              {shown.length === 0 ? (
                <span className="u-muted">{t(locale, "timeline.stat.none")}</span>
              ) : (
                SEVERITIES.map((sev) => (
                  <Badge key={sev} tone={sev}>
                    {t(locale, `common.severity.${sev}`)} <span className="u-num u-strong">{formatNumber(locale, bySeverity[sev])}</span>
                  </Badge>
                ))
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {/* 2–3. The chart */}
      <Card
        title={t(locale, "timeline.chart.title")}
        className="timeline-chart-card"
        footer={
          <div className="timeline-legend" aria-label={t(locale, "timeline.legend.title")} role="group">
            <span className="timeline-legend-item">
              <span className="timeline-swatch is-ramp" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t(locale, "timeline.legend.volume")}
            </span>
            <span className="timeline-legend-item">
              <span className="timeline-swatch is-gap" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t(locale, "timeline.legend.empty")}
            </span>
            <span className="timeline-legend-item">
              <span className="timeline-swatch is-future" aria-hidden="true" />
              {t(locale, "timeline.legend.notYet")}
            </span>
            <span className="timeline-legend-item">
              <span className="u-row timeline-legend-sev">
                {SEVERITIES.map((sev) => (
                  <SeverityBadge key={sev} locale={locale} severity={sev} size="sm" />
                ))}
              </span>
              {t(locale, "timeline.legend.severity")}
            </span>
          </div>
        }
      >
        <div className="u-sr">
          <h3>{t(locale, "timeline.sr.title")}</h3>
          <ul>
            <li>
              {t(locale, "timeline.sr.all", { count: formatNumber(locale, view.totalSoFar), max: formatNumber(locale, view.maxTotal) })}
              {latestFlag ? ` ${t(locale, "timeline.sr.flag", { value: latestFlag })}` : ""}
            </li>
            {view.lanes.map((lane) => (
              <li key={lane.code}>
                {t(locale, "timeline.sr.unit", {
                  lane: unitName(locale, meta, lane.code),
                  count: formatNumber(locale, lane.totalSoFar),
                  empty: formatNumber(locale, lane.emptyWeeks),
                  signals: formatNumber(locale, signalsPerLane.get(lane.code) ?? 0),
                })}
              </li>
            ))}
            <li>{t(locale, "timeline.sr.hospital", { signals: formatNumber(locale, signalsPerLane.get(null) ?? 0) })}</li>
          </ul>
        </div>
        <TimelineChart
          locale={locale}
          meta={meta}
          view={view}
          groups={groups}
          signals={shown}
          desktop={desktop}
          highlight={highlight}
          onSeek={onSeek}
          onOpenSignal={onOpenSignal}
        />
      </Card>

      {/* 4. Signal episodes by month, and the honest count */}
      <div className="u-cols">
        <Card title={t(locale, "timeline.list.title")} eyebrow={t(locale, "timeline.list.sub")} className="timeline-list-card">
          {months.length === 0 ? (
            <EmptyState compact icon="shield" title={t(locale, "timeline.list.empty")} />
          ) : (
            <div className="timeline-months">
              {visibleMonths.map(({ month, items }) => (
                <section key={month} className="timeline-month" aria-labelledby={`timeline-m-${month}`}>
                  <h3 className="timeline-month-head" id={`timeline-m-${month}`}>
                    <span>{formatMonth(locale, month)}</span>
                    <span className="u-xs u-muted u-num">
                      {items.length === 1 ? t(locale, "timeline.list.monthOne") : t(locale, "timeline.list.month", { count: items.length })}
                    </span>
                  </h3>
                  <ul className="timeline-items">
                    {items.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={`timeline-item is-${s.severity}`}
                          onClick={() => onOpenSignal(s.id)}
                          onMouseEnter={() => setHighlight(s.id)}
                          onMouseLeave={() => setHighlight(null)}
                          onFocus={() => setHighlight(s.id)}
                          onBlur={() => setHighlight(null)}
                          aria-label={t(locale, "timeline.list.open", {
                            title: `${signalTitle(locale, s)}, ${signalWhere(locale, meta, s)}, ${t(locale, `common.severity.${s.severity}`)}. ${summaryText(locale, meta, s)}. ${signalWhen(locale, s)}`,
                          })}
                        >
                          <KindGlyph kind={s.kind} severity={s.severity} size={20} />
                          <span className="timeline-item-main">
                            <span className="timeline-item-title">
                              <span className="u-strong">{signalTitle(locale, s)}</span>
                              <span className="u-muted"> · {signalWhere(locale, meta, s)}</span>
                            </span>
                            <span className="timeline-item-sum">
                              <Summary locale={locale} meta={meta} signal={s} short />
                            </span>
                          </span>
                          <span className="timeline-item-side">
                            <SeverityBadge locale={locale} severity={s.severity} size="sm" />
                            <span className="u-xs u-muted u-num">{formatDate(locale, s.firstDate)}</span>
                          </span>
                          <Icon name="chevron-right" size={18} className="timeline-item-chev" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {months.length > MONTHS_SHOWN ? (
                <button
                  type="button"
                  className="k-btn is-ghost timeline-more"
                  onClick={() => setAllMonths(!allMonths)}
                  aria-expanded={allMonths}
                >
                  <Icon name={allMonths ? "chevron-down" : "chevron-right"} size={18} />
                  {allMonths ? t(locale, "timeline.list.fewer") : t(locale, "timeline.list.older", { count: months.length - MONTHS_SHOWN })}
                </button>
              ) : null}
            </div>
          )}
        </Card>

        <div className="u-stack u-sticky">
          <Card title={t(locale, "timeline.volume.title")} level={2}>
            <p className="u-small u-soft u-num">
              {shown.length
                ? t(locale, "timeline.volume.body", {
                    count: formatNumber(locale, shown.length),
                    months: formatNumber(locale, monthsOfData, 0),
                    rate: formatNumber(locale, shown.length / Math.max(1, monthsOfData), 1),
                  })
                : t(locale, "timeline.volume.none", { months: formatNumber(locale, monthsOfData, 0) })}
            </p>
            <ul className="timeline-kinds">
              {KINDS.map((kind) => (
                <li key={kind} className={(byKind.get(kind) ?? 0) === 0 ? "is-zero" : undefined}>
                  <KindGlyph kind={kind} size={20} />
                  <span className="timeline-kinds-name">{signalKindLabel(locale, kind)}</span>
                  <span className="u-num u-strong">{formatNumber(locale, byKind.get(kind) ?? 0)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <QualityCard locale={locale} quality={p.quality} />
          <Card title={t(locale, "timeline.about.title")} level={2} tone="inset">
            <ul className="timeline-about u-small u-soft">
              <li>{t(locale, "timeline.about.future", { date: formatDate(locale, asOf, "long") })}</li>
              <li>{t(locale, "timeline.about.volume")}</li>
              <li>
                {flagNames
                  ? t(locale, "timeline.about.flag", { flags: flagNames, min: MIN_ISOLATES })
                  : t(locale, "timeline.about.flagNone")}
              </li>
              <li>{t(locale, "timeline.legend.empty")}</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* 5. The region around the hospital (THL county data) */}
      <RegionalCard locale={locale} asOf={asOf} />
    </div>
  );
}
