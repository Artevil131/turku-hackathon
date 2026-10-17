import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { formatDate, formatNumber, type Locale, named, t } from "../../i18n/index.ts";
import type { Severity, Signal, SignalKind } from "../../model/types.ts";
import { DemoLabel } from "../../ui/DemoLabel.tsx";
import { store } from "../../ui/hooks.ts";
import {
  Card,
  ChipGroup,
  EmptyState,
  Icon,
  Picker,
  Segmented,
  signalKindLabel,
  ToggleChip,
  useIsDesktop,
  useReducedMotion,
} from "../../ui/index.ts";
import type { TreatPrefs } from "../Treat/index.tsx";
import { compose, type Described, describe } from "./describe.tsx";
import {
  ACTIVE_DAYS,
  type AlertFilters,
  DEFAULT_FILTERS,
  isActive,
  KINDS,
  type Period,
  passes,
  reveal,
  SEVERITIES,
  sortAlerts,
} from "./filters.ts";
import { Body, Summary, Tags } from "./parts.tsx";
import "./Alerts.css";

/*
  Alerts (route #alerts): deviations the engine found in the released results,
  for infection control, antibiotic stewardship and the laboratory.
  Phones: one card per alert, most serious first; a tap opens it in place.
  From 1024 px: the list on the left, the chosen alert on the right.
  Each alert says what happened, where and since when, how unusual it is
  (observed against what the unit's own history predicts), who should act,
  and offers the cases, "what still works here" and the timeline.
*/

const GLYPH: Record<Severity, string> = { high: "▲", medium: "◆", low: "●" };

/** Filters survive a switch to another tab (not a reload: alerts always open on the full default view). */
let remembered: AlertFilters = DEFAULT_FILTERS;

/** Right after the app opens, signals are still being computed: say so instead of "no alerts". */
const CHECKING_GRACE_MS = 3000;
let firstMountAt: number | null = null;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** How long a card opened from elsewhere stays highlighted. */
const FLASH_MS = 2200;
/** How long a newly arrived alert keeps its entrance class. */
const ENTER_MS = 900;

const EMPTY_SET: ReadonlySet<string> = new Set();

/** A DOM id for a signal id (which may contain any characters). */
function domId(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return `alert-${(h >>> 0).toString(36)}`;
}

export function AlertsScreen(p: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  signals: readonly Signal[];
  seen: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
  focus: string | null;
  onFocus: (id: string | null) => void;
  onOpenTreat: (patch: Partial<TreatPrefs>) => void;
  onOpenTimeline: (date: IsoDate) => void;
}) {
  const { locale, meta, results, asOf, signals, seen, onSeen, focus, onFocus, onOpenTreat, onOpenTimeline } = p;
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const [lastVisit] = useState(() => {
    const saved = store.get<unknown>("alertsLastOpened");
    return typeof saved === "string" && /^\d{4}-\d{2}-\d{2}T/.test(saved) && Number.isFinite(Date.parse(saved)) ? saved : null;
  });
  const visitRecorded = useRef(false);
  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;
    store.set("alertsLastOpened", new Date().toISOString());
  }, []);

  const [filters, setFilters] = useState<AlertFilters>(remembered);
  useEffect(() => {
    remembered = filters;
  }, [filters]);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [entering, setEntering] = useState<ReadonlySet<string>>(EMPTY_SET);
  const scrollTarget = useRef<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // ---------- "Checking…" right after the app opens ----------
  const [graceOver, setGraceOver] = useState(() => {
    firstMountAt ??= now();
    return now() - firstMountAt > CHECKING_GRACE_MS;
  });
  useEffect(() => {
    if (graceOver || signals.length > 0) return;
    const timer = window.setTimeout(() => setGraceOver(true), Math.max(0, CHECKING_GRACE_MS - (now() - (firstMountAt ?? 0))));
    return () => window.clearTimeout(timer);
  }, [graceOver, signals.length]);
  const checking = signals.length === 0 && !graceOver;

  // ---------- What is listed ----------
  const sorted = useMemo(
    () =>
      sortAlerts(
        signals.filter((s) => passes(s, filters, asOf)),
        asOf,
      ),
    [signals, filters, asOf],
  );
  const inPeriod = useMemo(
    () => signals.filter((s) => filters.period === "all" || isActive(s, asOf)).length,
    [signals, filters.period, asOf],
  );
  const hiddenCount = inPeriod - sorted.length;
  const newCount = sorted.reduce((k, s) => k + (seen.has(s.id) ? 0 : 1), 0);
  const counts = useMemo(() => {
    const sev: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    const kind = new Map<SignalKind, number>();
    const unit = new Map<string, number>();
    for (const s of signals) {
      if (passes(s, filters, asOf, "severity")) sev[s.severity]++;
      if (passes(s, filters, asOf, "kind")) kind.set(s.kind, (kind.get(s.kind) ?? 0) + 1);
      if (s.ward && passes(s, filters, asOf, "unit")) unit.set(s.ward, (unit.get(s.ward) ?? 0) + 1);
    }
    return { sev, kind, unit };
  }, [signals, filters, asOf]);
  const described = useMemo(
    () => new Map<string, Described>(sorted.map((s) => [s.id, describe(locale, meta, s, asOf)])),
    [sorted, locale, meta, asOf],
  );
  const current = desktop ? (sorted.find((s) => s.id === selected) ?? sorted[0] ?? null) : null;

  // ---------- Opened from elsewhere (a toast, the Treat or Timeline screen) ----------
  useEffect(() => {
    if (!focus) return;
    const s = signals.find((x) => x.id === focus);
    if (!s) {
      if (signals.length > 0) onFocus(null); // gone (e.g. after a rewind)
      return; // still computing: wait for it
    }
    setFilters((f) => reveal(f, s, asOf));
    setExpanded((e) => new Set(e).add(s.id));
    setSelected(s.id);
    setFlash(s.id);
    scrollTarget.current = s.id;
    onFocus(null);
  }, [focus, signals, asOf, onFocus]);

  // Scroll once the card is on the page, on a later frame: after the shell's own
  // route change has scrolled to the top and after the widened filters have rendered.
  const frame = useRef(0);
  useLayoutEffect(() => {
    if (!scrollTarget.current || frame.current) return;
    let tries = 0;
    const run = () => {
      const id = scrollTarget.current;
      const el = id ? document.getElementById(domId(id)) : null;
      if (id && !el && ++tries < 20) {
        frame.current = window.requestAnimationFrame(run);
        return;
      }
      frame.current = 0;
      scrollTarget.current = null;
      if (!el) return;
      el.scrollIntoView({ block: desktop ? "nearest" : "start", behavior: reduced ? "auto" : "smooth" });
      el.querySelector<HTMLElement>(".alerts-toggle")?.focus({ preventScroll: true });
    };
    frame.current = window.requestAnimationFrame(run);
  });
  useEffect(
    () => () => {
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  // ---------- New alerts while the results arrive: a gentle entrance ----------
  const known = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    if (signals.length === 0) return;
    const ids = signals.map((s) => s.id);
    const before = known.current;
    // The first set seen here, or a rewind (alerts disappeared), is the baseline: nothing in it is "arriving".
    if (!before || [...before].some((id) => !ids.includes(id))) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !before.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) before.add(id);
    setEntering(new Set(fresh));
  }, [signals]);
  useEffect(() => {
    if (entering.size === 0) return;
    const timer = window.setTimeout(() => setEntering(EMPTY_SET), ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [entering]);

  // The detail pane starts at the top for each alert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the shown alert's id is the trigger; the body only scrolls the pane.
  useEffect(() => {
    detailRef.current?.scrollTo?.({ top: 0 });
  }, [current?.id]);

  // ---------- Actions ----------
  const toggleSeverity = (sev: Severity) =>
    setFilters((f) => ({
      ...f,
      severities: f.severities.includes(sev)
        ? f.severities.filter((x) => x !== sev)
        : SEVERITIES.filter((x) => x === sev || f.severities.includes(x)),
    }));
  const showAll = () => setFilters((f) => ({ ...f, severities: [...SEVERITIES], kind: null, unit: null }));
  const markAll = () => onSeen(sorted.filter((s) => !seen.has(s.id)).map((s) => s.id));
  const toggle = (id: string) =>
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---------- Header ----------
  const num = (x: number) => formatNumber(locale, x);
  const asOfLong = formatDate(locale, asOf, "long");
  const summary =
    filters.period === "active"
      ? compose(locale, "alerts.summary.active", {
          new: { node: <strong className="alerts-newcount">{num(newCount)}</strong>, text: num(newCount) },
          count: num(sorted.length),
          weeks: num(ACTIVE_DAYS / 7),
        })
      : compose(locale, "alerts.summary.all", {
          new: { node: <strong className="alerts-newcount">{num(newCount)}</strong>, text: num(newCount) },
          count: num(sorted.length),
          date: formatDate(locale, meta.start, "long"),
        });

  const header = (
    <header className="alerts-head">
      <div className="alerts-head-row">
        <h1 className="alerts-h1">{t(locale, "alerts.title")}</h1>
        {signals.length > 0 ? (
          <button type="button" className="k-btn is-ghost is-sm alerts-markall" onClick={markAll} disabled={newCount === 0}>
            <Icon name="check" size={16} />
            {t(locale, "alerts.markAll")}
          </button>
        ) : null}
      </div>
      <DemoLabel locale={locale} />
      {signals.length > 0 ? (
        <p className="alerts-summary u-num" aria-live="polite">
          {summary.node}
        </p>
      ) : null}
      <p className="alerts-checked u-num">{t(locale, "alerts.summary.checked", { date: asOfLong })}</p>
      <p className="alerts-checked u-num">
        {lastVisit
          ? t(locale, "alerts.lastVisit", { date: formatDate(locale, lastVisit.slice(0, 10), "long") })
          : t(locale, "alerts.firstVisit")}
      </p>
      <p className="u-small alerts-region-pointer">
        <a href="#timeline">{t(locale, "alerts.regionPointer")}</a>
      </p>
    </header>
  );

  // Only the kinds present right now (and the chosen one), so the row stays short.
  const kindOptions = KINDS.filter((k) => (counts.kind.get(k) ?? 0) > 0 || filters.kind === k).map((k) => ({
    value: k,
    label: signalKindLabel(locale, k),
    count: counts.kind.get(k) ?? 0,
  }));

  const filterBar = (
    <div className="alerts-filters" role="group" aria-label={t(locale, "alerts.filters")}>
      <div className="alerts-period">
        <Segmented<Period>
          label={t(locale, "alerts.filter.period")}
          value={filters.period}
          onChange={(period) => setFilters((f) => ({ ...f, period }))}
          stretch={!desktop}
          options={[
            {
              value: "active",
              label: t(locale, "alerts.period.active"),
              hint: t(locale, "alerts.period.activeHint", { days: ACTIVE_DAYS }),
            },
            { value: "all", label: t(locale, "alerts.period.all"), hint: t(locale, "alerts.period.allHint") },
          ]}
        />
      </div>
      <div className="alerts-chiprow">
        <div className="alerts-sev" role="group" aria-label={t(locale, "alerts.filter.severity")}>
          {SEVERITIES.map((sev) => (
            <ToggleChip key={sev} pressed={filters.severities.includes(sev)} onClick={() => toggleSeverity(sev)} count={counts.sev[sev]}>
              <span className={`alerts-glyph is-${sev}`} aria-hidden="true">
                {GLYPH[sev]}
              </span>{" "}
              {t(locale, `common.severity.${sev}`)}
            </ToggleChip>
          ))}
        </div>
        <Picker<string>
          locale={locale}
          label={t(locale, "alerts.filter.unit")}
          variant="chip"
          value={filters.unit}
          nullLabel={t(locale, "common.unit.all")}
          onChange={(unit) => setFilters((f) => ({ ...f, unit }))}
          groups={[
            {
              options: meta.units.map((u) => {
                const c = counts.unit.get(u.code) ?? 0;
                return { value: u.code, label: named(locale, u, u.code), hint: c > 0 ? num(c) : undefined };
              }),
            },
          ]}
        />
      </div>
      {kindOptions.length > 0 ? (
        <div className="alerts-kinds">
          <ChipGroup<SignalKind>
            label={t(locale, "alerts.filter.kind")}
            hideLabel
            scroll
            value={filters.kind}
            anyLabel={t(locale, "alerts.filter.anyKind")}
            onChange={(kind) => setFilters((f) => ({ ...f, kind }))}
            options={kindOptions}
          />
        </div>
      ) : null}
    </div>
  );

  // ---------- Empty, checking ----------
  let empty: ReactNode = null;
  if (checking) {
    empty = <EmptyState tone="loading" icon="alerts" title={t(locale, "alerts.checking")} />;
  } else if (signals.length === 0) {
    empty = <EmptyState icon="shield" title={t(locale, "alerts.empty.title")} body={t(locale, "alerts.empty.body", { date: asOfLong })} />;
  } else if (sorted.length === 0) {
    const anyActive = signals.some((s) => isActive(s, asOf));
    if (filters.period === "active" && !anyActive) {
      const earlier = signals.filter((s) => passes(s, { ...filters, period: "all" }, asOf)).length;
      empty = (
        <EmptyState
          icon="shield"
          title={t(locale, "alerts.empty.activeTitle", { weeks: num(ACTIVE_DAYS / 7) })}
          body={
            earlier > 0
              ? t(locale, "alerts.empty.activeBody", { date: asOfLong, count: num(earlier) })
              : t(locale, "alerts.empty.body", { date: asOfLong })
          }
          action={
            earlier > 0 ? (
              <button type="button" className="k-btn is-secondary" onClick={() => setFilters((f) => ({ ...f, period: "all" }))}>
                {t(locale, "alerts.empty.showOlder")}
              </button>
            ) : undefined
          }
        />
      );
    } else {
      empty = (
        <EmptyState
          icon="filter"
          title={t(locale, "alerts.empty.filteredTitle")}
          body={t(locale, "alerts.empty.filteredBody", { date: asOfLong, count: num(hiddenCount) })}
          action={
            <button type="button" className="k-btn is-secondary" onClick={showAll}>
              {t(locale, "alerts.showAll")}
            </button>
          }
        />
      );
    }
  }

  // ---------- The list ----------
  const bodyProps = { locale, meta, results, asOf, onSeen, onOpenTreat, onOpenTimeline };

  const item = (s: Signal) => {
    const d = described.get(s.id);
    if (!d) return null;
    const id = domId(s.id);
    const isNew = !seen.has(s.id);
    const cls = `${flash === s.id ? " is-flash" : ""}${entering.has(s.id) ? " is-entering" : ""}${isNew ? " is-new" : ""}`;
    if (desktop) {
      const on = current?.id === s.id;
      return (
        <li key={s.id}>
          <Card as="article" tone={s.severity} pad="sm" id={id} className={`alerts-row${on ? " is-selected" : ""}${cls}`}>
            <div className="alerts-sum">
              <Tags locale={locale} s={s} isNew={isNew} />
              <Summary
                locale={locale}
                d={d}
                control={
                  <button
                    type="button"
                    className="alerts-toggle"
                    aria-current={on ? "true" : undefined}
                    aria-controls="alerts-detail"
                    onClick={() => setSelected(s.id)}
                  >
                    {d.title.node}
                  </button>
                }
              />
            </div>
          </Card>
        </li>
      );
    }
    const open = expanded.has(s.id);
    return (
      <li key={s.id}>
        <Card as="article" tone={s.severity} pad="md" id={id} className={`alerts-card${open ? " is-open" : ""}${cls}`}>
          <div className="alerts-sum">
            <Tags locale={locale} s={s} isNew={isNew} />
            <Summary
              locale={locale}
              d={d}
              control={
                <button
                  type="button"
                  className="alerts-toggle"
                  aria-expanded={open}
                  aria-controls={`${id}-body`}
                  onClick={() => toggle(s.id)}
                >
                  {d.title.node}
                </button>
              }
            />
            <Icon name="chevron-down" size={20} className="alerts-chev" />
          </div>
          <div id={`${id}-body`} hidden={!open}>
            {open ? <Body {...bodyProps} s={s} d={d} seen={!isNew} /> : null}
          </div>
        </Card>
      </li>
    );
  };

  const activeItems = filters.period === "all" ? sorted.filter((s) => isActive(s, asOf)) : sorted;
  const olderItems = filters.period === "all" ? sorted.filter((s) => !isActive(s, asOf)) : [];

  const hiddenLine =
    hiddenCount > 0 && sorted.length > 0 ? (
      <p className="alerts-hidden u-small">
        <span>{t(locale, "alerts.hidden", { count: num(hiddenCount) })}</span>
        <button type="button" className="k-btn is-ghost is-sm" onClick={showAll}>
          {t(locale, "alerts.showAll")}
        </button>
      </p>
    ) : null;

  const list = (
    <div className="alerts-listwrap">
      {activeItems.length > 0 ? (
        <section className="alerts-group" aria-labelledby="alerts-active-h">
          <h2 id="alerts-active-h" className={olderItems.length > 0 ? "alerts-section-h u-eyebrow" : "u-sr"}>
            {olderItems.length > 0 ? t(locale, "alerts.activeNow", { weeks: num(ACTIVE_DAYS / 7) }) : t(locale, "alerts.list")}
          </h2>
          <ol className="alerts-list">{activeItems.map(item)}</ol>
        </section>
      ) : null}
      {olderItems.length > 0 ? (
        <section className="alerts-group is-older" aria-labelledby="alerts-older-h">
          <h2 id="alerts-older-h" className="alerts-section-h u-eyebrow">
            {t(locale, "alerts.earlier")}
          </h2>
          <ol className="alerts-list">{olderItems.map(item)}</ol>
        </section>
      ) : null}
    </div>
  );

  const currentD = current ? described.get(current.id) : undefined;
  const detail =
    current && currentD ? (
      <section id="alerts-detail" className="alerts-detail" aria-label={t(locale, "alerts.detail")}>
        <div className="alerts-detail-scroll" ref={detailRef}>
          <Card key={current.id} tone={current.severity} pad="md" className={`alerts-pane${flash === current.id ? " is-flash" : ""}`}>
            <Tags locale={locale} s={current} isNew={!seen.has(current.id)} />
            <Summary locale={locale} d={currentD} control={currentD.title.node} level={2} />
            <Body {...bodyProps} s={current} d={currentD} seen={seen.has(current.id)} />
          </Card>
        </div>
      </section>
    ) : null;

  return (
    <div className={`alerts${desktop ? " is-desktop" : " is-phone"}`}>
      {header}
      {signals.length > 0 ? filterBar : null}
      {hiddenLine}
      {empty ??
        (desktop ? (
          <div className="alerts-cols">
            {list}
            {detail}
          </div>
        ) : (
          list
        ))}
    </div>
  );
}
