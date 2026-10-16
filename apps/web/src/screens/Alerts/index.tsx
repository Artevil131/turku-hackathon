import type { FeedMeta, IsoDate, Result } from "@aei/feed";
import type { Episode, Severity, Signal, SignalKind } from "@aei/signals";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { episodeOf, groupEpisodes } from "../../analytics/helpers.ts";
import { formatDate, formatNumber, type Locale, named, t } from "../../i18n/index.ts";
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
import { Body, Story, StoryLine, Summary, Tags } from "./parts.tsx";
import "./Alerts.css";

/*
  Alerts (route #alerts): deviations the engine found in the released results,
  for infection control, antibiotic stewardship and the laboratory.
  Phones: one card per alert, most serious first; a tap opens it in place.
  From 1024 px: the list on the left, the chosen alert on the right.
  Each alert says what happened, where and since when, how unusual it is
  (observed against what the unit's own history predicts), who should act,
  and offers the cases, "what still works here" and the timeline.
  Signals of one outbreak (same unit, same organism or flag, close in time)
  share one card with a dated story; each step keeps its own evidence.
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
  onOpenTimeline: (date: IsoDate, id: string) => void;
  /** Opened for one unit from elsewhere (e.g. a question about something unusual there); `seq` counts each request. */
  preset?: { value: string | null; seq: number } | null;
  /** The released results were just (re)loaded and their alerts are still being computed. */
  computing?: boolean;
}) {
  const { locale, meta, results, asOf, signals, seen, onSeen, focus, onFocus, onOpenTreat, onOpenTimeline, preset, computing = false } = p;
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();

  const [filters, setFilters] = useState<AlertFilters>(remembered);
  useEffect(() => {
    remembered = filters;
  }, [filters]);

  // A request for one unit's alerts: every alert so far on that unit, any severity.
  const presetSeq = useRef(0);
  useEffect(() => {
    if (!preset || preset.seq === presetSeq.current) return;
    presetSeq.current = preset.seq;
    const unit = preset.value && meta.units.some((u) => u.code === preset.value) ? preset.value : null;
    setFilters(unit ? { ...DEFAULT_FILTERS, unit, period: "all", severities: [...SEVERITIES] } : DEFAULT_FILTERS);
  }, [preset, meta.units]);

  /** Expanded cards (phones) and the selected card (desktop), by episode id; the step each card shows, by episode id. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<Readonly<Record<string, string>>>({});
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
  const checking = signals.length === 0 && (!graceOver || computing);

  // ---------- What is listed ----------
  const sorted = useMemo(
    () =>
      sortAlerts(
        signals.filter((s) => passes(s, filters, asOf)),
        asOf,
      ),
    [signals, filters, asOf],
  );
  const episodes = useMemo(() => groupEpisodes(sorted), [sorted]);
  const inPeriod = useMemo(
    () => signals.filter((s) => filters.period === "all" || isActive(s, asOf)).length,
    [signals, filters.period, asOf],
  );
  const hiddenCount = inPeriod - sorted.length;
  const isNewEp = (e: Episode) => e.members.some((s) => !seen.has(s.id));
  const newCount = episodes.reduce((k, e) => k + (isNewEp(e) ? 1 : 0), 0);
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
  const current = desktop ? (episodes.find((e) => e.id === selected) ?? episodes[0] ?? null) : null;
  /** The step a card's body shows: the one picked in its story, else its lead. */
  const stepOf = (e: Episode): Signal => e.members.find((s) => s.id === step[e.id]) ?? e.lead;

  // ---------- Opened from elsewhere (a toast, the Treat or Timeline screen) ----------
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for each focus request, not for every filter or signal change
  useEffect(() => {
    if (!focus) return;
    const s = signals.find((x) => x.id === focus);
    if (!s) {
      if (signals.length > 0) onFocus(null); // gone (e.g. after a rewind)
      return; // still computing: wait for it
    }
    const f = reveal(filters, s, asOf);
    setFilters(f);
    // The card that holds it once the filters are widened.
    const ep = episodeOf(
      groupEpisodes(
        sortAlerts(
          signals.filter((x) => passes(x, f, asOf)),
          asOf,
        ),
      ),
      s.id,
    );
    const key = ep?.id ?? s.id;
    setExpanded((e) => new Set(e).add(key));
    setSelected(key);
    setStep((m) => ({ ...m, [key]: s.id }));
    setFlash(key);
    scrollTarget.current = key;
    onFocus(null);
  }, [focus, signals]);

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
  const isEntering = (e: Episode) => entering.size > 0 && e.members.some((s) => entering.has(s.id));
  useEffect(() => {
    if (entering.size === 0) return;
    const timer = window.setTimeout(() => setEntering(EMPTY_SET), ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [entering]);

  // The detail pane starts at the top for each alert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when another alert is opened
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
  const pickStep = (episodeId: string, signalId: string) => setStep((m) => ({ ...m, [episodeId]: signalId }));
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
          count: num(episodes.length),
          weeks: num(ACTIVE_DAYS / 7),
        })
      : compose(locale, "alerts.summary.all", {
          new: { node: <strong className="alerts-newcount">{num(newCount)}</strong>, text: num(newCount) },
          count: num(episodes.length),
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
      {signals.length > 0 ? (
        <p className="alerts-summary u-num" aria-live="polite">
          {summary.node}
        </p>
      ) : null}
      <p className="alerts-checked u-num">{t(locale, "alerts.summary.checked", { date: asOfLong })}</p>
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

  const item = (e: Episode) => {
    const lead = described.get(e.lead.id);
    const shown = stepOf(e);
    const d = described.get(shown.id);
    if (!lead || !d) return null;
    const id = domId(e.id);
    const isNew = isNewEp(e);
    const ids = e.members.map((s) => s.id);
    const many = e.members.length > 1;
    const cls = `${flash === e.id ? " is-flash" : ""}${isEntering(e) ? " is-entering" : ""}${isNew ? " is-new" : ""}`;
    const storyLine = many ? <StoryLine locale={locale} asOf={asOf} members={e.members} /> : null;
    if (desktop) {
      const on = current?.id === e.id;
      return (
        <li key={e.id}>
          <Card as="article" tone={e.severity} pad="sm" id={id} className={`alerts-row${on ? " is-selected" : ""}${cls}`}>
            <div className="alerts-sum">
              <Tags locale={locale} s={e.lead} isNew={isNew} steps={e.members.length} />
              <Summary
                d={lead}
                extra={storyLine}
                control={
                  <button
                    type="button"
                    className="alerts-toggle"
                    aria-current={on ? "true" : undefined}
                    aria-controls="alerts-detail"
                    onClick={() => setSelected(e.id)}
                  >
                    {lead.title.node}
                  </button>
                }
              />
            </div>
          </Card>
        </li>
      );
    }
    const open = expanded.has(e.id);
    return (
      <li key={e.id}>
        <Card as="article" tone={e.severity} pad="md" id={id} className={`alerts-card${open ? " is-open" : ""}${cls}`}>
          <div className="alerts-sum">
            <Tags locale={locale} s={e.lead} isNew={isNew} steps={e.members.length} />
            <Summary
              d={lead}
              extra={open ? null : storyLine}
              control={
                <button
                  type="button"
                  className="alerts-toggle"
                  aria-expanded={open}
                  aria-controls={`${id}-body`}
                  onClick={() => toggle(e.id)}
                >
                  {lead.title.node}
                </button>
              }
            />
            <Icon name="chevron-down" size={20} className="alerts-chev" />
          </div>
          <div id={`${id}-body`} hidden={!open}>
            {open ? (
              <>
                {many ? (
                  <Story
                    locale={locale}
                    asOf={asOf}
                    members={e.members}
                    described={described}
                    current={shown.id}
                    onPick={(sid) => pickStep(e.id, sid)}
                  />
                ) : null}
                <Body key={shown.id} {...bodyProps} s={shown} d={d} seen={ids.every((x) => seen.has(x))} seenIds={ids} />
              </>
            ) : null}
          </div>
        </Card>
      </li>
    );
  };

  const epActive = (e: Episode) => e.members.some((s) => isActive(s, asOf));
  const activeItems = filters.period === "all" ? episodes.filter(epActive) : episodes;
  const olderItems = filters.period === "all" ? episodes.filter((e) => !epActive(e)) : [];

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

  const currentStep = current ? stepOf(current) : null;
  const currentD = currentStep ? described.get(currentStep.id) : undefined;
  const currentLead = current ? described.get(current.lead.id) : undefined;
  const detail =
    current && currentStep && currentD && currentLead ? (
      <section id="alerts-detail" className="alerts-detail" aria-label={t(locale, "alerts.detail")}>
        <div className="alerts-detail-scroll" ref={detailRef}>
          <Card key={current.id} tone={current.severity} pad="md" className={`alerts-pane${flash === current.id ? " is-flash" : ""}`}>
            <Tags locale={locale} s={current.lead} isNew={isNewEp(current)} steps={current.members.length} />
            <Summary d={currentLead} control={currentLead.title.node} level={2} short={false} />
            {current.members.length > 1 ? (
              <Story
                locale={locale}
                asOf={asOf}
                members={current.members}
                described={described}
                current={currentStep.id}
                onPick={(sid) => pickStep(current.id, sid)}
              />
            ) : null}
            <Body
              key={currentStep.id}
              {...bodyProps}
              s={currentStep}
              d={currentD}
              seen={current.members.every((x) => seen.has(x.id))}
              seenIds={current.members.map((x) => x.id)}
            />
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
