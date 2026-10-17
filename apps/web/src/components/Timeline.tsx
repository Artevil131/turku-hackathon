import type { AeiClient, ClockCommand, ClockState } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAlertsSinceStart } from "../alertsSince.ts";
import type { Connection } from "../live.ts";
import { compactDate, dayNumber, isoFromDay } from "./hero/geometry.ts";
import { useWeekly } from "./hero/useWeekly.ts";
import { WeeklyBand } from "./hero/WeeklyBand.tsx";
import { Chevron, Pause, Play, StepDay, StepWeek } from "./Icons.tsx";
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
}

const clampDate = (iso: string, start: string, end: string) => (iso < start ? start : iso > end ? end : iso);

type EventKey = "tlEventUro" | "tlEventGap" | "tlEventIcu";
const EVENTS: readonly { date: string; key: EventKey }[] = [
  { date: "2025-05-12", key: "tlEventUro" },
  { date: "2025-11-17", key: "tlEventGap" },
  { date: "2026-02-10", key: "tlEventIcu" },
];

type SpeedKey = "tlSpeedDay2s" | "tlSpeedDay" | "tlSpeedWeek" | "tlSpeedMonth";
const SPEEDS: readonly { key: SpeedKey; tickMs: number; daysPerTick: number }[] = [
  { key: "tlSpeedDay2s", tickMs: 2000, daysPerTick: 1 },
  { key: "tlSpeedDay", tickMs: 1000, daysPerTick: 1 },
  { key: "tlSpeedWeek", tickMs: 1000, daysPerTick: 7 },
  { key: "tlSpeedMonth", tickMs: 1000, daysPerTick: 30 },
];

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

export function Timeline({ locale, clock, connection, lastArrivals, command, reducedMotion, client }: TimelineProps) {
  const phone = useMediaQuery("(max-width: 760px)");
  const rootRef = useRef<HTMLDivElement>(null);
  const [seekingTo, setSeekingTo] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [stepStop, setStepStop] = useState(1);

  const ready = connection === "open" && clock !== null;
  const start = clock?.start ?? "";
  const end = clock?.end ?? "";
  const atEnd = clock ? clock.asOf >= clock.end : false;
  const shown = seekingTo ?? clock?.asOf ?? null;
  const alerts = useAlertsSinceStart(client, clock?.start, clock?.asOf);
  const weekly = useWeekly(client, clock?.start, clock?.asOf);

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

  const jumpToEvent = (date: string) => {
    command({ action: "pause" });
    seek(date);
    setMenu(false);
    setSheet(false);
  };

  // Keyboard shortcuts, like a video player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ready || !clock || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(IGNORED_TARGET) || rootRef.current?.contains(target)) return;
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
      title={running ? t(locale, "pause") : t(locale, "play")}
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

  const selectedSpeed = clock ? SPEEDS.findIndex((s) => s.tickMs === clock.tickMs && s.daysPerTick === clock.daysPerTick) : -1;
  const speed = (
    <select
      className="tl-select"
      aria-label={t(locale, "tlSpeed")}
      title={t(locale, "tlSpeed")}
      disabled={!ready}
      value={selectedSpeed < 0 ? "" : selectedSpeed}
      onChange={(e) => {
        const s = SPEEDS[Number(e.target.value)];
        if (s) command({ action: "configure", tickMs: s.tickMs, daysPerTick: s.daysPerTick });
      }}
    >
      {selectedSpeed < 0 ? <option value="">–</option> : null}
      {SPEEDS.map((s, i) => (
        <option key={s.key} value={i}>
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
        compact={compact}
        disabled={!ready}
        label={t(locale, "tlStream")}
        onActivate={() => setSheet(true)}
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
        setMenu(false);
        setSheet(false);
      }}
    />
  );

  const eventList = (
    <ul className="tl-event-list">
      {EVENTS.map((ev) => (
        <li key={ev.key}>
          <button type="button" className="tl-event" disabled={!ready} onClick={() => jumpToEvent(ev.date)}>
            <span className="tl-diamond" aria-hidden="true" />
            <span className="tl-event-text">{t(locale, ev.key)}</span>
            <span className="tl-event-date num">{compactDate(ev.date)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (phone) {
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
            <div className="tl-sheet-read">
              <b className="tl-readout num">{readout}</b>
              {status}
            </div>
            {note ? <p className="tl-note">{note}</p> : null}
            <div className="tl-sheet-band">{band(false)}</div>
            <div className="tl-sheet-ctl">
              {playButton}
              {steps(true)}
              {speed}
            </div>
            {eventList}
            {dateJump}
          </Sheet>
        ) : null}
      </div>
    );
  }

  return (
    <div className="timeline" ref={rootRef} aria-busy={seekingTo ? true : undefined}>
      <div className="tl-left">
        <div className="tl-ctl">
          {playButton}
          {steps(false)}
          {speed}
        </div>
        <div className="tl-read">
          <b className="tl-readout num">{readout}</b>
          <InfoPopover locale={locale}>
            <p>{note}</p>
            {arrivals ? <p>{arrivals}</p> : null}
          </InfoPopover>
          {status}
        </div>
      </div>
      {band(false)}
      <div className="tl-menu-wrap">
        <button
          type="button"
          className="tl-seg tl-events-btn"
          aria-expanded={menu}
          aria-haspopup="true"
          disabled={!ready}
          onClick={() => setMenu((m) => !m)}
        >
          {t(locale, "tlEvents")}
        </button>
        {menu ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: Esc handling for the popup
          <div
            className="tl-menu"
            onKeyDown={(e: ReactKeyboardEvent) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setMenu(false);
              }
            }}
          >
            {eventList}
            {dateJump}
          </div>
        ) : null}
      </div>
    </div>
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
