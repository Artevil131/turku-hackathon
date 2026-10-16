import type { ClockCommand, ClockState } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Connection } from "../live.ts";
import { Chevron, Pause, Play, StepDay, StepWeek } from "./Icons.tsx";
import "./timeline.css";

interface TimelineProps {
  locale: Locale;
  clock: ClockState | null;
  connection: Connection;
  lastArrivals: { to: string; count: number } | null;
  command: (c: ClockCommand) => void;
  reducedMotion: boolean;
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const isoFromDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
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

export function Timeline({ locale, clock, connection, lastArrivals, command, reducedMotion }: TimelineProps) {
  const phone = useMediaQuery("(max-width: 760px)");
  const rootRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [seekingTo, setSeekingTo] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const previewRef = useRef<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = connection === "open" && clock !== null;
  const start = clock?.start ?? "";
  const end = clock?.end ?? "";
  const days = clock ? Math.max(1, dayNumber(end) - dayNumber(start)) : 1;
  const atEnd = clock ? clock.asOf >= clock.end : false;
  const dayIndex = (iso: string) => (clock ? dayNumber(clampDate(iso, start, end)) - dayNumber(start) : 0);
  const shown = preview ?? seekingTo ?? clock?.asOf ?? null;

  // A new clock state (or reset) from the server ends "seeking".
  // biome-ignore lint/correctness/useExhaustiveDependencies: the clock object identity is the trigger
  useEffect(() => {
    setSeekingTo(null);
  }, [clock]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

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

  // Commit a drag once, on release.
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) return;
    const onChange = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        const date = previewRef.current;
        previewRef.current = null;
        setPreview(null);
        if (date) seek(date);
      }, 250);
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  });

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

  const date = (iso: string) => formatDate(locale, iso, "long");
  const running = ready && Boolean(clock?.running) && !atEnd;
  const stateWord =
    connection === "offline"
      ? t(locale, "offlineShort")
      : !clock || connection === "connecting"
        ? t(locale, "connecting")
        : atEnd
          ? t(locale, "tlAtEnd")
          : clock.running
            ? t(locale, "tlPlaying")
            : t(locale, "livePaused");
  const stateKind = connection === "offline" ? "offline" : !ready ? "connecting" : atEnd ? "end" : running ? "playing" : "paused";

  const readout = !clock
    ? t(locale, "connecting")
    : seekingTo && !preview
      ? t(locale, "tlSeeking", { date: date(seekingTo) })
      : date(shown ?? clock.asOf);

  const StateGlyph = (
    <span className="tl-state" data-kind={stateKind}>
      {stateKind === "playing" ? (
        <span className="tl-pulse" data-still={reducedMotion || undefined} aria-hidden="true" />
      ) : stateKind === "paused" ? (
        <Pause className="tl-glyph" />
      ) : stateKind === "end" ? (
        <StepDay className="tl-glyph" />
      ) : (
        <span className="tl-dot" aria-hidden="true" />
      )}
      <span className="tl-state-word">{stateWord}</span>
    </span>
  );

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

  const steps = (
    <div className="tl-steps" role="group" aria-label={t(locale, "stepDay")}>
      <button
        type="button"
        className="tl-btn tl-step-back-week"
        disabled={!ready}
        onClick={() => stepBy(-7)}
        aria-label={t(locale, "tlStepBackWeek")}
        title={t(locale, "tlStepBackWeek")}
      >
        <StepWeek />
      </button>
      <button
        type="button"
        className="tl-btn tl-step-back"
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
        disabled={!ready || atEnd}
        onClick={() => stepBy(1)}
        aria-label={t(locale, "stepDay")}
        title={t(locale, "stepDay")}
      >
        <StepDay />
      </button>
      <button
        type="button"
        className="tl-btn"
        disabled={!ready || atEnd}
        onClick={() => stepBy(7)}
        aria-label={t(locale, "tlStepWeek")}
        title={t(locale, "tlStepWeek")}
      >
        <StepWeek />
      </button>
    </div>
  );

  const selectedSpeed = clock ? SPEEDS.findIndex((s) => s.tickMs === clock.tickMs && s.daysPerTick === clock.daysPerTick) : -1;
  const speed = (
    <div className="tl-speed" role="group" aria-label={t(locale, "tlSpeed")}>
      {SPEEDS.map((s, i) => (
        <button
          key={s.key}
          type="button"
          className="tl-seg"
          disabled={!ready}
          aria-pressed={selectedSpeed === i}
          onClick={() => command({ action: "configure", tickMs: s.tickMs, daysPerTick: s.daysPerTick })}
        >
          {t(locale, s.key)}
        </button>
      ))}
    </div>
  );

  const track = (
    <div className="tl-track" data-empty={!clock || undefined}>
      <input
        ref={rangeRef}
        type="range"
        className="tl-range"
        min={0}
        max={days}
        step={1}
        value={clock && shown ? dayIndex(shown) : 0}
        disabled={!ready}
        onInput={(e) => {
          if (!clock) return;
          const iso = isoFromDay(dayNumber(clock.start) + Number(e.currentTarget.value));
          previewRef.current = iso;
          setPreview(iso);
        }}
        onChange={() => {}}
        aria-label={t(locale, "tlScrub")}
        aria-valuemin={0}
        aria-valuemax={days}
        aria-valuenow={clock && shown ? dayIndex(shown) : 0}
        aria-valuetext={shown ? date(shown) : undefined}
        title={t(locale, "tlShortcuts")}
        style={{ ["--f" as string]: clock && shown ? dayIndex(shown) / days : 0 }}
      />
      {preview ? (
        <output className="tl-tip" style={{ ["--f" as string]: dayIndex(preview) / days }}>
          {date(preview)}
        </output>
      ) : null}
      {clock ? (
        <div className="tl-markers">
          {EVENTS.filter((ev) => ev.date >= start && ev.date <= end).map((ev) => (
            <button
              key={ev.key}
              type="button"
              className="tl-marker"
              style={{ ["--f" as string]: dayIndex(ev.date) / days }}
              disabled={!ready}
              onClick={() => jumpToEvent(ev.date)}
              aria-label={`${t(locale, ev.key)}, ${date(ev.date)}`}
              title={`${t(locale, ev.key)}, ${date(ev.date)}`}
            >
              <span className="tl-diamond" aria-hidden="true" />
              <span className="tl-marker-cap" aria-hidden="true">
                {t(locale, ev.key)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const dateJump = (
    <DateJump
      locale={locale}
      min={start}
      max={end}
      value={shown ?? ""}
      disabled={!ready}
      onGo={(iso) => {
        command({ action: "pause" });
        seek(iso);
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
            <span className="tl-event-date num">{date(ev.date)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const chip = <span className="tl-chip">{t(locale, "tlReplayLabel")}</span>;

  const arrivals = lastArrivals ? (
    <span className="tl-arrivals">{t(locale, "tlArrivalsOn", { n: lastArrivals.count, date: date(lastArrivals.to) })}</span>
  ) : null;

  const offlineReason =
    connection === "offline" ? (
      <span className="tl-reason" role="status">
        {t(locale, "tlOfflineReason")}
      </span>
    ) : null;

  if (phone) {
    return (
      <div
        className="timeline timeline-phone glass ply-1"
        ref={rootRef}
        aria-busy={seekingTo ? true : undefined}
        data-still={reducedMotion || undefined}
      >
        <div className="tl-strip">
          {StateGlyph}
          <button type="button" className="tl-date num" onClick={() => setSheet(true)} aria-haspopup="dialog">
            {readout}
          </button>
          {playButton}
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
            {chip}
            <div className="tl-sheet-read">
              <b className="tl-readout num">{readout}</b>
              {StateGlyph}
            </div>
            {arrivals}
            {offlineReason}
            {track}
            {steps}
            {speed}
            {eventList}
            {dateJump}
          </Sheet>
        ) : null}
      </div>
    );
  }

  return (
    <div className="timeline glass ply-1" ref={rootRef} aria-busy={seekingTo ? true : undefined} data-still={reducedMotion || undefined}>
      {chip}
      {playButton}
      {steps}
      <div className="tl-read">
        <b className="tl-readout num">{readout}</b>
        <div className="tl-read-sub">
          {StateGlyph}
          {offlineReason ?? arrivals}
        </div>
      </div>
      {track}
      {speed}
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
            className="tl-menu glass ply-3"
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
  onGo: (iso: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const current = draft || value;
  const valid = current >= min && current <= max && current !== "";
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
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <button type="submit" className="tl-seg tl-jump-go" disabled={disabled || !valid}>
        {t(locale, "tlJumpGo")}
      </button>
      <span className="tl-jump-range num">
        {t(locale, "tlJumpRange", { from: formatDate(locale, min, "long"), to: formatDate(locale, max, "long") })}
      </span>
    </form>
  );
}

function Sheet({ locale, onClose, still, children }: { locale: Locale; onClose: () => void; still: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")?.focus();
    return () => previous?.focus?.();
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
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
      <div className="tl-sheet glass ply-3" ref={ref} role="dialog" aria-modal="true" aria-labelledby="tl-sheet-title">
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
