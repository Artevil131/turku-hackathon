import type { AeiClient, ClockCommand, ClockState } from "@aei/contract";
import { isWardCode, type WardCode } from "@aei/domain";
import { type Locale, t, wardName } from "@aei/i18n";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type LiveAlerts, useAlertsSinceStart } from "../alertsSince.ts";
import type { Connection } from "../live.ts";
import { currentHospitalName, siteWards } from "../sites.ts";
import { onProjectPage, patchHashParams, sharedQuery, useHashParam } from "../url.ts";
import { EventsStrip } from "./EventsStrip.tsx";
import { Gloss } from "./Gloss.tsx";
import { compactDate, dayNumber, isoFromDay } from "./hero/geometry.ts";
import { useLayers } from "./hero/layers.ts";
import { unitOfIncident } from "./hero/selection.ts";
import { type BandRange, parseRange, rangeSentence } from "./hero/useBandRange.ts";
import { useWeekly } from "./hero/useWeekly.ts";
import { WeeklyBand } from "./hero/WeeklyBand.tsx";
import { Chevron, Pause, Play, StepDay, StepWeek } from "./Icons.tsx";
import { InfoButton } from "./Info.tsx";
import { QualityStatus } from "./quality/QualityStatus.tsx";
import { useQuality } from "./quality/useQuality.ts";
import { groupIncidents } from "./research/feed/model.ts";
import "./timeline.css";

interface TimelineProps {
  locale: Locale;
  clock: ClockState | null;
  connection: Connection;
  lastArrivals: { to: string; count: number } | null;
  command: (c: ClockCommand) => void;
  reducedMotion: boolean;
  /** The API client, for the alert history; the band shows no marks without it. */
  client?: AeiClient;
  /** The app's live alert list; the history appends from it instead of opening its own stream. */
  liveAlerts: LiveAlerts;
  /** The chart can be folded to one line of controls; the choice is remembered (folded by default). */
  collapsible?: boolean;
  /** Inside a project window: always expanded, never the phone strip (the window is the room it has). */
  variant?: "window";
}

const COLLAPSE_KEY = "aei.timeline.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Storage can be unavailable; the choice just won't persist.
  }
}

const clampDate = (iso: string, start: string, end: string) => (iso < start ? start : iso > end ? end : iso);

// Step (how far each tick moves) and speed (how often it ticks) are two controls; the clock takes them apart.
const STEPS = [
  { key: "tlStepByDay", daysPerTick: 1 },
  { key: "tlStepByWeek", daysPerTick: 7 },
  { key: "tlStepByMonth", daysPerTick: 30 },
] as const;
const SPEEDS = [
  { key: "tlSpeedSlow", tickMs: 2000 },
  { key: "tlSpeedNormal", tickMs: 1000 },
  { key: "tlSpeedFast", tickMs: 500 },
] as const;

const IGNORED_TARGET = "input, textarea, select, [contenteditable], [role=dialog]";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Moves focus between the enabled buttons of a group with the arrow keys; returns the one focused, or null. */
function roveFocus(e: ReactKeyboardEvent<HTMLElement>): HTMLElement | null {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return null;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)")];
  const at = items.indexOf(e.target as HTMLElement);
  if (at < 0) return null;
  e.preventDefault();
  const to =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? items.length - 1
        : (at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
  const next = items[to] ?? null;
  next?.focus();
  return next;
}

const Info = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);

export function Timeline({
  locale,
  clock,
  connection,
  lastArrivals,
  command,
  reducedMotion,
  client,
  liveAlerts,
  collapsible = false,
  variant,
}: TimelineProps) {
  const phone = useMediaQuery("(max-width: 760px)");
  const rootRef = useRef<HTMLDivElement>(null);
  const [seekingTo, setSeekingTo] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [stepStop, setStepStop] = useState(1);
  const [folded, setFolded] = useState(readCollapsed);
  const fold = (value: boolean) => {
    setFolded(value);
    writeCollapsed(value);
  };

  const ready = connection === "open" && clock !== null;
  const start = clock?.start ?? "";
  const end = clock?.end ?? "";
  const atEnd = clock ? clock.asOf >= clock.end : false;
  const shown = seekingTo ?? clock?.asOf ?? null;
  const alerts = useAlertsSinceStart(client, clock?.start, clock?.asOf, liveAlerts);
  const weekly = useWeekly(client, clock?.start, clock?.asOf);
  const [layers, setLayers] = useLayers();
  // The selected signal and focused unit live in the URL hash, shared with the research board; selecting never moves the clock.
  const [inc, setInc] = useHashParam("inc");
  const [unit, setUnit] = useHashParam("unit");
  const focusUnit: WardCode | null = unit && isWardCode(unit) ? unit : null;
  // The chosen weeks (`from`, `to`, both or neither) are what the research tools work on.
  const [fromParam] = useHashParam("from");
  const [toParam] = useHashParam("to");
  const range = useMemo(() => parseRange(fromParam, toParam), [fromParam, toParam]);
  const setRange = useCallback((r: BandRange | null) => patchHashParams({ from: r?.from ?? null, to: r?.to ?? null }), []);
  const selectedUnit = unitOfIncident(alerts, inc);
  const focusOn = (ward: WardCode | null) => {
    setUnit(ward);
    if (ward && selectedUnit && selectedUnit !== ward) setInc(null);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the band scrolls when the selection changes or its pill arrives
  useEffect(() => {
    if (!inc) return;
    const scroller = rootRef.current?.querySelector<HTMLElement>(".hs:not([data-compact])");
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    scroller
      .querySelector(".hs-pill.is-selected")
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [inc, alerts]);
  const quality = useQuality(client, clock?.asOf);

  // A new clock state (or reset) from the server ends "seeking".
  // biome-ignore lint/correctness/useExhaustiveDependencies: the clock object identity is the trigger
  useEffect(() => {
    setSeekingTo(null);
  }, [clock]);

  const seek = useCallback(
    (date: string) => {
      if (!clock) return;
      const target = clampDate(date, clock.start, clock.end);
      setSeekingTo(target);
      command({ action: "seek", date: target });
    },
    [clock, command],
  );

  // Moves relative to where the replay is heading, so quick repeated steps add up.
  const stepBy = useCallback(
    (n: number) => {
      if (!clock) return;
      if (n > 0) {
        if (clock.asOf >= clock.end) return;
        command({ action: "step", days: n });
      } else {
        const base = seekingTo ?? clock.asOf;
        seek(isoFromDay(dayNumber(base) + n));
      }
    },
    [clock, command, seek, seekingTo],
  );

  // What the detectors have found up to the clock, newest first; a tile selects, it never seeks.
  const incidents = useMemo(() => groupIncidents(alerts), [alerts]);
  const pickIncident = (key: string) => {
    setSheet(false);
    if (onProjectPage()) setInc(key);
    else location.hash = `project?inc=${encodeURIComponent(key)}${sharedQuery().replace("?", "&")}`;
  };
  // "n more in the list": the full list is the Signals window. Elsewhere, go to the research page;
  // there, raise it, flash it once (it may already be in view) and focus its first row.
  const openList = () => {
    setSheet(false);
    if (!onProjectPage()) {
      location.hash = `project${sharedQuery()}`;
      return;
    }
    const win = document.getElementById("ws-win-signals");
    if (!win) {
      document.querySelector<HTMLElement>("[data-add-window]")?.click();
      return;
    }
    win.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    win.classList.add("ws-flash");
    setTimeout(() => win.classList.remove("ws-flash"), 1200);
    const row = win.querySelector<HTMLElement>(".feed-row");
    (row ?? win).focus({ preventScroll: true });
  };

  const hospital = currentHospitalName(locale);
  const title = focusUnit ? (
    <h2 className="tl-title">
      <span className="tl-title-unit">{t(locale, "tlTitleUnit", { hospital, unit: wardName(locale, focusUnit as WardCode) })}</span>
      <button
        type="button"
        className="tl-title-clear"
        onClick={() => setUnit(null)}
        aria-label={t(locale, "tlClearUnit")}
        title={t(locale, "tlClearUnit")}
      >
        ×
      </button>
    </h2>
  ) : (
    <h2 className="tl-title">{t(locale, "tlTitle", { hospital, n: siteWards().length })}</h2>
  );
  const rangeLine = range ? (
    <p className="tl-range">
      <span className="num">{rangeSentence(locale, range)}</span>
      <button
        type="button"
        className="tl-title-clear"
        onClick={() => setRange(null)}
        aria-label={t(locale, "tlRangeClear")}
        title={t(locale, "tlRangeClear")}
      >
        ×
      </button>
    </p>
  ) : null;

  // Keyboard shortcuts, like a video player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ready || !clock || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      // Inside the timeline only the band's slider passes keys on (Space plays; it keeps the arrows for reading weeks).
      if (target?.closest(IGNORED_TARGET) || (rootRef.current?.contains(target) && !target?.closest(".hs-slider"))) return;
      if (e.key === " " || e.key === "Spacebar") {
        if (target?.closest("button, a, summary")) return;
        e.preventDefault();
        command({ action: clock.running ? "pause" : "play" });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBy(e.shiftKey ? -7 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepBy(e.shiftKey ? 7 : 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        seek(clock.start);
      } else if (e.key === "End") {
        e.preventDefault();
        seek(clock.end);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ready, clock, command, stepBy, seek]);

  const running = ready && Boolean(clock?.running) && !atEnd;
  const readout = clock && shown ? compactDate(shown) : "–";
  const offline = connection === "offline";

  const playButton = (
    <button
      type="button"
      className="tl-btn tl-play"
      disabled={!ready || atEnd}
      onClick={() => command({ action: running ? "pause" : "play" })}
      aria-label={running ? t(locale, "pause") : t(locale, "play")}
      title={`${running ? t(locale, "pause") : t(locale, "play")} (${t(locale, "tlShortcuts")})`}
    >
      {running ? <Pause /> : <Play />}
    </button>
  );

  const steps = (weeks: boolean) => (
    <div
      className="tl-steps"
      role="toolbar"
      aria-label={t(locale, "tlSteps")}
      data-weeks={weeks || undefined}
      onKeyDown={(e) => {
        const next = roveFocus(e);
        if (next) setStepStop(Number(next.dataset.stop));
      }}
    >
      {weeks ? (
        <button
          type="button"
          className="tl-btn tl-back"
          data-stop={0}
          tabIndex={stepStop === 0 ? 0 : -1}
          disabled={!ready}
          onClick={() => stepBy(-7)}
          aria-label={t(locale, "tlStepBackWeek")}
          title={t(locale, "tlStepBackWeek")}
        >
          <StepWeek />
        </button>
      ) : null}
      <button
        type="button"
        className="tl-btn tl-back"
        data-stop={1}
        tabIndex={stepStop === 1 ? 0 : -1}
        disabled={!ready}
        onClick={() => stepBy(-1)}
        aria-label={t(locale, "tlStepBackDay")}
        title={t(locale, "tlStepBackDay")}
      >
        <StepDay />
      </button>
      <button
        type="button"
        className="tl-btn"
        data-stop={2}
        tabIndex={stepStop === 2 ? 0 : -1}
        disabled={!ready || atEnd}
        onClick={() => stepBy(1)}
        aria-label={t(locale, "stepDay")}
        title={t(locale, "stepDay")}
      >
        <StepDay />
      </button>
      {weeks ? (
        <button
          type="button"
          className="tl-btn"
          data-stop={3}
          tabIndex={stepStop === 3 ? 0 : -1}
          disabled={!ready || atEnd}
          onClick={() => stepBy(7)}
          aria-label={t(locale, "tlStepWeek")}
          title={t(locale, "tlStepWeek")}
        >
          <StepWeek />
        </button>
      ) : null}
    </div>
  );

  // Play and the day (and week) steps read as one segmented control.
  const transport = (weeks: boolean) => (
    <div className="tl-transport">
      {playButton}
      {steps(weeks)}
    </div>
  );

  // Step and speed as two labelled segmented groups; the hover title says it in words.
  const stepNow = STEPS.find((s) => s.daysPerTick === clock?.daysPerTick);
  const speedNow = SPEEDS.find((s) => s.tickMs === clock?.tickMs);
  const hint = (speedKey: (typeof SPEEDS)[number]["key"], stepKey: (typeof STEPS)[number]["key"], ms: number) =>
    t(locale, "tlSpeedHint", { speed: t(locale, speedKey), step: t(locale, stepKey), s: ms / 1000 });
  const ctlGroups = (
    <>
      <div className="tl-ctl-group" role="group" aria-label={t(locale, "tlStep")}>
        <span className="tl-ctl-label">{t(locale, "tlStep")}</span>
        <div className="seg">
          {STEPS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={stepNow?.key === s.key}
              disabled={!ready}
              title={hint(speedNow?.key ?? "tlSpeedNormal", s.key, speedNow?.tickMs ?? 1000)}
              onClick={() => command({ action: "configure", daysPerTick: s.daysPerTick })}
            >
              {t(locale, s.key)}
            </button>
          ))}
        </div>
      </div>
      <div className="tl-ctl-group" role="group" aria-label={t(locale, "tlSpeed")}>
        <span className="tl-ctl-label">{t(locale, "tlSpeed")}</span>
        <div className="seg">
          {SPEEDS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={speedNow?.key === s.key}
              disabled={!ready}
              title={hint(s.key, stepNow?.key ?? "tlStepByDay", s.tickMs)}
              onClick={() => command({ action: "configure", tickMs: s.tickMs })}
            >
              {t(locale, s.key)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
  // The folded line has room for one small control: the step; speed waits for the expanded view.
  const speed = (
    <select
      className="tl-select"
      aria-label={t(locale, "tlStep")}
      title={t(locale, "tlStep")}
      disabled={!ready}
      value={stepNow?.key ?? ""}
      onChange={(e) => {
        const s = STEPS.find((x) => x.key === e.target.value);
        if (s) command({ action: "configure", daysPerTick: s.daysPerTick });
      }}
    >
      {stepNow ? null : <option value="">–</option>}
      {STEPS.map((s) => (
        <option key={s.key} value={s.key}>
          {t(locale, s.key)}
        </option>
      ))}
    </select>
  );

  const band = (compact: boolean) =>
    clock ? (
      <WeeklyBand
        locale={locale}
        start={clock.start}
        asOf={clock.asOf}
        weekly={weekly}
        alerts={alerts}
        layers={layers}
        onLayers={compact ? undefined : setLayers}
        compact={compact}
        roomy={variant === "window"}
        disabled={!ready}
        label={t(locale, "tlStream")}
        onActivate={() => setSheet(true)}
        selected={inc}
        selectedUnit={selectedUnit}
        focusUnit={focusUnit}
        onSelect={setInc}
        onFocusUnit={focusOn}
        onClear={() => setInc(null)}
        range={range}
        onRange={setRange}
      />
    ) : (
      <div className="tl-band-empty" />
    );

  const note = clock ? t(locale, "tlReplayNote", { from: compactDate(clock.start), to: compactDate(clock.end) }) : "";
  const arrivals = lastArrivals ? t(locale, "tlArrivalsOn", { n: lastArrivals.count, date: compactDate(lastArrivals.to) }) : null;
  const status = offline ? (
    <span className="tl-reason" role="status">
      {t(locale, "offlineShort")}
    </span>
  ) : null;

  const dateJump = (
    <DateJump
      locale={locale}
      min={start}
      max={end}
      value={shown ?? ""}
      disabled={!ready}
      onGo={(iso, keepOpen) => {
        command({ action: "pause" });
        seek(iso);
        if (keepOpen) return;
        setSheet(false);
      }}
    />
  );

  const eventsStrip = (compact = false) => (
    <EventsStrip
      locale={locale}
      incidents={incidents}
      selected={inc}
      disabled={!ready}
      onPick={pickIncident}
      onMore={openList}
      compact={compact}
      since={clock?.start ?? null}
    />
  );

  if (phone && !variant) {
    return (
      <div className="timeline timeline-phone" ref={rootRef} aria-busy={seekingTo ? true : undefined}>
        <div className="tl-strip">
          {playButton}
          <button
            type="button"
            className="tl-date num"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-label={`${t(locale, "tlOpen")}: ${readout}`}
          >
            {readout}
          </button>
          {band(true)}
          <button
            type="button"
            className="tl-btn"
            onClick={() => setSheet(true)}
            aria-label={t(locale, "tlOpen")}
            title={t(locale, "tlOpen")}
            aria-haspopup="dialog"
          >
            <Chevron />
          </button>
        </div>
        {sheet ? (
          <Sheet locale={locale} onClose={() => setSheet(false)} still={reducedMotion}>
            {title}
            {rangeLine}
            <div className="tl-sheet-read">
              <b className="tl-readout num">{readout}</b>
              {status}
            </div>
            {note ? <p className="tl-note">{note}</p> : null}
            <div className="tl-quality">
              <QualityStatus locale={locale} state={quality} />
            </div>
            <div className="tl-sheet-band">{band(false)}</div>
            {eventsStrip()}
            <div className="tl-sheet-ctl">
              {transport(true)}
              {ctlGroups}
            </div>
            {dateJump}
          </Sheet>
        ) : null}
      </div>
    );
  }

  if (collapsible && folded) {
    return (
      <div className="timeline timeline-folded" ref={rootRef} aria-busy={seekingTo ? true : undefined} data-running={running || undefined}>
        {transport(true)}
        <span className="tl-when">
          {title}
          <b className="tl-readout num">{readout}</b>
        </span>
        {speed}
        {arrivals ? <span className="tl-folded-fresh">{arrivals}</span> : null}
        {status}
        {eventsStrip(true)}
        <button
          type="button"
          className="tl-btn tl-fold"
          aria-expanded={false}
          onClick={() => fold(false)}
          aria-label={t(locale, "tlExpand")}
          title={t(locale, "tlExpand")}
        >
          <Chevron />
        </button>
      </div>
    );
  }

  return (
    <div
      className="timeline"
      ref={rootRef}
      aria-busy={seekingTo ? true : undefined}
      data-running={running || undefined}
      data-variant={variant}
    >
      <div className="tl-left">
        {title}
        {rangeLine}
        <div className="tl-ctl">
          {transport(false)}
          {variant ? null : ctlGroups}
        </div>
        {variant ? (
          <details className="tl-more">
            <summary>{t(locale, "tlMore")}</summary>
            <div className="tl-more-body">
              {ctlGroups}
              {dateJump}
            </div>
          </details>
        ) : null}
        <div className="tl-read">
          <b className="tl-readout num">{readout}</b>
          <InfoPopover locale={locale}>
            <p>{note}</p>
            {arrivals ? <p>{arrivals}</p> : null}
            <p>{t(locale, "tlShortcuts")}</p>
            <p>{t(locale, "tlRangeHint")}</p>
          </InfoPopover>
          {status}
          {collapsible ? (
            <button
              type="button"
              className="tl-btn tl-fold tl-fold-open"
              aria-expanded={true}
              onClick={() => fold(true)}
              aria-label={t(locale, "tlCollapse")}
              title={t(locale, "tlCollapse")}
            >
              <Chevron />
            </button>
          ) : null}
        </div>
        <div className="tl-foot">
          <div className="tl-quality">
            <QualityStatus locale={locale} state={quality} />
          </div>
          {variant ? null : dateJump}
        </div>
      </div>
      <div className="tl-band-col">
        {band(false)}
        <p className="tl-legend">
          {t(locale, "tlLaneLegendShort")}
          <InfoButton locale={locale}>
            <GlossedLegend locale={locale} />
          </InfoButton>
          {variant ? (
            <button type="button" className="tl-signals-link" onClick={openList}>
              {t(locale, "tlSignalsLink", { n: incidents.length })}
            </button>
          ) : null}
        </p>
      </div>
      {variant ? null : eventsStrip()}
    </div>
  );
}

/** The lane legend with its one glossary word ("usual", Finnish "tavalliseen") as a gloss; the rest is plain. */
function GlossedLegend({ locale }: { locale: Locale }) {
  const text = t(locale, "tlLaneLegend");
  const m = (locale === "fi" ? /tavalliseen/ : /\busual\b/).exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <Gloss term="usual" locale={locale}>
        {m[0]}
      </Gloss>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

/** An ⓘ button with a popover: Enter/Space/tap opens, Esc or an outside press closes, focus returns. */
function InfoPopover({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc closes the popover from anywhere inside it
    <span
      className="tl-info"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={button}
        className="tl-info-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t(locale, "tlReplayLabel")}
        title={t(locale, "tlReplayLabel")}
        onClick={() => setOpen((o) => !o)}
      >
        <Info />
      </button>
      {open ? (
        <div className="tl-pop" id={id} role="note">
          {children}
        </div>
      ) : null}
    </span>
  );
}

function DateJump({
  locale,
  min,
  max,
  value,
  disabled,
  onGo,
}: {
  locale: Locale;
  min: string;
  max: string;
  value: string;
  disabled: boolean;
  onGo: (iso: string, keepOpen?: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const current = draft || value;
  const inRange = (iso: string) => iso !== "" && iso >= min && iso <= max;
  const valid = inRange(current);
  return (
    <form
      className="tl-jump"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onGo(current);
      }}
    >
      <label className="tl-jump-label">
        <span>{t(locale, "tlJumpLabel")}</span>
        <input
          type="date"
          className="tl-jump-input"
          min={min}
          max={max}
          value={current}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            // a complete, valid date is applied at once (typed or picked); the menu stays open while typing
            if (inRange(e.target.value) && e.target.value !== value) onGo(e.target.value, true);
          }}
        />
      </label>
      <button type="submit" className="tl-seg tl-jump-go" disabled={disabled || !valid}>
        {t(locale, "tlJumpGo")}
      </button>
    </form>
  );
}

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex='0']";

function Sheet({ locale, onClose, still, children }: { locale: Locale; onClose: () => void; still: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>(".tl-play:not(:disabled)") ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => previous?.focus?.();
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click and Esc/Tab handling for the modal sheet
    <div
      className="tl-backdrop"
      data-still={still || undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={onKeyDown}
      role="presentation"
    >
      <div className="tl-sheet" ref={ref} role="dialog" aria-modal="true" aria-labelledby="tl-sheet-title">
        <h2 id="tl-sheet-title" className="tl-sheet-title">
          {t(locale, "tlScrub")}
        </h2>
        {children}
        <button type="button" className="tl-close" onClick={onClose}>
          {t(locale, "tlClose")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
