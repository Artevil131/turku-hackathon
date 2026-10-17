import type { AeiClient, ClockCommand, ClockState } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { type LiveAlerts, useAlertsSinceStart } from "../alertsSince.ts";
import type { Connection } from "../live.ts";
import { compactDate } from "./hero/geometry.ts";
import { useLayers } from "./hero/layers.ts";
import { useWeekly } from "./hero/useWeekly.ts";
import { WeeklyBand } from "./hero/WeeklyBand.tsx";
import { QualityStatus } from "./quality/QualityStatus.tsx";
import { useQuality } from "./quality/useQuality.ts";
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
  /** Kept for callers of the old strip; the timeline is a workspace window now (D-066). */
  variant?: "window";
}

export const clampDate = (iso: string, start: string, end: string) => (iso < start ? start : iso > end ? end : iso);

type EventKey = "tlEventUro" | "tlEventGap" | "tlEventIcu";
export const EVENTS: readonly { date: string; key: EventKey }[] = [
  { date: "2025-05-12", key: "tlEventUro" },
  { date: "2025-11-17", key: "tlEventGap" },
  { date: "2026-02-10", key: "tlEventIcu" },
];

type SpeedKey = "tlSpeedDay2s" | "tlSpeedDay" | "tlSpeedWeek" | "tlSpeedMonth";
export const SPEEDS: readonly { key: SpeedKey; tickMs: number; daysPerTick: number }[] = [
  { key: "tlSpeedDay2s", tickMs: 2000, daysPerTick: 1 },
  { key: "tlSpeedDay", tickMs: 1000, daysPerTick: 1 },
  { key: "tlSpeedWeek", tickMs: 1000, daysPerTick: 7 },
  { key: "tlSpeedMonth", tickMs: 1000, daysPerTick: 30 },
];

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

/**
 * The timeline window (D-066): the weekly band with its unit lanes and signal pills, the replay's date, the
 * data checks and the demo jumps. It shows and seeks the one replay clock; play, step and speed stay in the
 * clock above the project, since they drive every window and the server's replay.
 */
export function Timeline({ locale, clock, connection, lastArrivals, command, client, liveAlerts }: TimelineProps) {
  const [seekingTo, setSeekingTo] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const ready = connection === "open" && clock !== null;
  const start = clock?.start ?? "";
  const end = clock?.end ?? "";
  const shown = seekingTo ?? clock?.asOf ?? null;
  const alerts = useAlertsSinceStart(client, clock?.start, clock?.asOf, liveAlerts);
  const weekly = useWeekly(client, clock?.start, clock?.asOf);
  const [layers, setLayers] = useLayers();
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
      command({ action: "pause" });
      command({ action: "seek", date: target });
    },
    [clock, command],
  );

  const running = ready && Boolean(clock?.running) && !(clock ? clock.asOf >= clock.end : false);
  const readout = clock && shown ? compactDate(shown) : "–";
  const note = clock ? t(locale, "tlReplayNote", { from: compactDate(clock.start), to: compactDate(clock.end) }) : "";
  const arrivals = lastArrivals ? t(locale, "tlArrivalsOn", { n: lastArrivals.count, date: compactDate(lastArrivals.to) }) : null;

  return (
    <div className="timeline timeline-window" aria-busy={seekingTo ? true : undefined} data-running={running || undefined}>
      <div className="tl-win-head">
        <span className="tl-when">
          <b className="tl-readout num">{readout}</b>
          <InfoPopover locale={locale}>
            <p>{note}</p>
            {arrivals ? <p>{arrivals}</p> : null}
            <p>{t(locale, "tlShortcuts")}</p>
          </InfoPopover>
        </span>
        {connection === "offline" ? (
          <span className="tl-reason" role="status">
            {t(locale, "offlineShort")}
          </span>
        ) : null}
        <div className="tl-quality">
          <QualityStatus locale={locale} state={quality} />
        </div>
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
              <ul className="tl-event-list">
                {EVENTS.map((ev) => (
                  <li key={ev.key}>
                    <button
                      type="button"
                      className="tl-event"
                      disabled={!ready}
                      onClick={() => {
                        seek(ev.date);
                        setMenu(false);
                      }}
                    >
                      <span className="tl-diamond" aria-hidden="true" />
                      <span className="tl-event-text">{t(locale, ev.key)}</span>
                      <span className="tl-event-date num">{compactDate(ev.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <DateJump
                locale={locale}
                min={start}
                max={end}
                value={shown ?? ""}
                disabled={!ready}
                onGo={(iso, keepOpen) => {
                  seek(iso);
                  if (!keepOpen) setMenu(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      {clock ? (
        <WeeklyBand
          locale={locale}
          start={clock.start}
          asOf={clock.asOf}
          weekly={weekly}
          alerts={alerts}
          layers={layers}
          onLayers={setLayers}
          disabled={!ready}
          label={t(locale, "tlStream")}
        />
      ) : (
        <div className="tl-band-empty" />
      )}
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

export function DateJump({
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
