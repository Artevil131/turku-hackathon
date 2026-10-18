import type { ClockCommand, ClockState } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "../../Icons.tsx";
import { PlaybackControls } from "../../PlaybackControls.tsx";

// The data's "today", always in view: the replay clock's day (D-005), or the day a frozen project stands at.
// A chip in the toolbar shows the date and whether it moves. Open, it is a month with that day marked and the days
// after it muted (no results have arrived for them yet), one sentence on what the date means here and, while the
// clock moves: any day of the data can be picked to move the clock there, the months page back and forth, Play
// shows time moving, and the replay's step and speed sit below (the same controls as the timeline's).

/** The replay clock and how to command it; absent, the chip only shows the date. */
export interface ChipReplay {
  clock: ClockState | null;
  ready: boolean;
  command: (c: ClockCommand) => void;
}

const LOCALE_TAG: Record<Locale, string> = { fi: "fi-FI", en: "en-GB" };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const monthOf = (date: string) => {
  const [y = 2025, m = 1] = date.split("-").map(Number);
  return { y, m };
};
const shift = ({ y, m }: { y: number; m: number }, by: number) => {
  const n = y * 12 + (m - 1) + by;
  return { y: Math.floor(n / 12), m: (n % 12) + 1 };
};

/** The month grid: six weeks at most, from the Monday on or before the 1st. */
function monthGrid(y: number, m: number): (number | null)[] {
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function DateChip({ locale, date, frozen, replay }: { locale: Locale; date: string | null; frozen: boolean; replay?: ChipReplay }) {
  // The month on show: the clock's own, until the reader pages away; a new clock day brings it back.
  const [view, setView] = useState(() => monthOf(date ?? "2025-01-01"));
  useEffect(() => {
    if (date) setView(monthOf(date));
  }, [date]);
  // A <details> stays open until its summary is pressed again; this one also closes on Esc or a press outside.
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = root.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = root.current;
      if (e.key !== "Escape" || !el?.open) return;
      el.open = false;
      el.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  if (!date) return null;
  const tag = LOCALE_TAG[locale];
  const live = replay && !frozen ? replay : null;
  const clock = live?.clock ?? null;
  const canPick = !!live?.ready && clock !== null;
  const cells = monthGrid(view.y, view.m);
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(new Date(Date.UTC(view.y, view.m - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  const today = new Date().toISOString().slice(0, 10);
  // Paging stops at the data's first and last months.
  const first = clock ? monthOf(clock.start) : view;
  const last = clock ? monthOf(clock.end) : view;
  const atFirst = view.y * 12 + view.m <= first.y * 12 + first.m;
  const atLast = view.y * 12 + view.m >= last.y * 12 + last.m;
  const atEnd = clock ? clock.asOf >= clock.end : true;
  const seek = (to: string) => live?.command({ action: "seek", date: to });

  return (
    <details className="ws-date" ref={root}>
      <summary className="ws-date-chip" title={t(locale, "wsDateTitle")}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 6.5h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <b>{formatDate(locale, date, "long")}</b>
        <span className="ws-date-tag" data-frozen={frozen || undefined} data-running={clock?.running || undefined}>
          {t(locale, frozen ? "wsDateFrozenTag" : "wsDateLiveTag")}
        </span>
      </summary>
      <div className="ws-date-pop" role="dialog" aria-label={t(locale, "wsDateTitle")}>
        <p className="ws-date-head">{t(locale, "wsDateTitle")}</p>
        <div className="ws-date-now">
          <p className="ws-date-big">{formatDate(locale, date, "long")}</p>
          {live ? (
            <button
              type="button"
              className="ws-date-playbtn"
              title={t(locale, "wsDatePlayHint")}
              aria-pressed={clock?.running ?? false}
              disabled={!canPick || (!clock?.running && atEnd)}
              onClick={() => live.command({ action: clock?.running ? "pause" : "play" })}
            >
              {clock?.running ? <Pause width={14} height={14} /> : <Play width={14} height={14} />}
              {t(locale, clock?.running ? "wsDatePause" : "wsDatePlay")}
            </button>
          ) : null}
        </div>
        <p className="ws-date-why">
          {t(locale, frozen ? "wsDateFrozen" : "wsDateLive", {
            date: formatDate(locale, date, "long"),
            today: formatDate(locale, today, "long"),
          })}
        </p>
        <div className="ws-cal" role="group" aria-label={monthName}>
          <div className="ws-cal-head">
            {live ? (
              <button
                type="button"
                className="ws-cal-nav"
                aria-label={t(locale, "wsCalPrev")}
                title={t(locale, "wsCalPrev")}
                disabled={atFirst}
                onClick={() => setView(shift(view, -1))}
              >
                ‹
              </button>
            ) : null}
            <p className="ws-cal-month">{monthName}</p>
            {live ? (
              <button
                type="button"
                className="ws-cal-nav"
                aria-label={t(locale, "wsCalNext")}
                title={t(locale, "wsCalNext")}
                disabled={atLast}
                onClick={() => setView(shift(view, 1))}
              >
                ›
              </button>
            ) : null}
          </div>
          <div className="ws-cal-grid">
            {weekdays.map((w) => (
              <span key={w} className="ws-cal-wd">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              const key = `${view.y}-${view.m}-${i}`;
              if (d === null) return <span key={key} className="ws-cal-day" />;
              const day = iso(view.y, view.m, d);
              const isToday = day === date;
              const future = day > date;
              if (!live)
                return (
                  <span
                    key={key}
                    className="ws-cal-day"
                    data-today={isToday || undefined}
                    data-future={future ? "" : undefined}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {d}
                  </span>
                );
              const inData = clock ? day >= clock.start && day <= clock.end : false;
              const label = formatDate(locale, day, "long");
              const hint = inData ? t(locale, "wsCalGo", { date: label }) : `${label}: ${t(locale, "wsDateOutside")}`;
              return (
                <button
                  key={key}
                  type="button"
                  className="ws-cal-day"
                  data-today={isToday || undefined}
                  data-future={future ? "" : undefined}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={hint}
                  title={hint}
                  disabled={!canPick || !inData}
                  onClick={() => seek(day)}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="ws-cal-foot">
            <p className="ws-cal-note">{t(locale, live ? "wsDatePickNote" : "wsDateFutureNote")}</p>
            {live && clock ? (
              <button
                type="button"
                className="ws-cal-latest"
                disabled={!canPick || atEnd}
                onClick={() => {
                  seek(clock.end);
                  setView(monthOf(clock.end));
                }}
              >
                {t(locale, "wsDateLatest")}
              </button>
            ) : null}
          </div>
        </div>
        {live ? (
          <div className="ws-date-play">
            <PlaybackControls locale={locale} clock={live.clock} ready={live.ready} command={live.command} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
