import type { ClockCommand, ClockState } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Connection } from "../../live.ts";
import { dayNumber, isoFromDay } from "../hero/geometry.ts";
import { Pause, Play, StepDay } from "../Icons.tsx";
import { clampDate, DateJump, SPEEDS } from "../Timeline.tsx";

// The replay clock (D-066): one compact control above the open project, because it drives every window and
// the server's replay. Play or pause, a day back or forward, and the date, which opens the speed and a date
// to jump to. Like a video player, Space plays and the arrow keys step (Shift: a week) from anywhere outside
// a field or a widget that uses those keys itself.

const IGNORED =
  "input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox], [role=slider], [role=separator], [role=toolbar], [role=grid], [role=tablist], .hs-slider, .ws-title";

export function ReplayClock({
  locale,
  clock,
  connection,
  command,
}: {
  locale: Locale;
  clock: ClockState | null;
  connection: Connection;
  command: (c: ClockCommand) => void;
}) {
  const [seekingTo, setSeekingTo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const wasOpen = useRef(false);
  const ready = connection === "open" && clock !== null;
  const atEnd = clock ? clock.asOf >= clock.end : false;
  const running = ready && Boolean(clock?.running) && !atEnd;
  const shown = seekingTo ?? clock?.asOf ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the clock object identity is the trigger
  useEffect(() => setSeekingTo(null), [clock]);

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
      } else seek(isoFromDay(dayNumber(seekingTo ?? clock.asOf) + n));
    },
    [clock, command, seek, seekingTo],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!ready || !clock || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(IGNORED)) return;
      if (e.key === " " || e.key === "Spacebar") {
        if (target?.closest("button, a, summary")) return;
        e.preventDefault();
        command({ action: clock.running ? "pause" : "play" });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        stepBy((e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 7 : 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ready, clock, command, stepBy]);

  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    el.showPopover?.();
    const r = trigger.current?.getBoundingClientRect();
    if (r) {
      el.style.top = `${Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8)}px`;
      el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`;
    }
    el.querySelector<HTMLElement>("[aria-checked=true], button, input")?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target instanceof HTMLInputElement) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitemradio]")];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const selectedSpeed = clock ? SPEEDS.findIndex((s) => s.tickMs === clock.tickMs && s.daysPerTick === clock.daysPerTick) : -1;
  const label = shown ? formatDate(locale, shown, "long") : "–";
  return (
    <div
      className="clock"
      role="group"
      aria-label={t(locale, "clockLabel")}
      aria-busy={seekingTo ? true : undefined}
      data-running={running || undefined}
    >
      <button
        type="button"
        className="clock-btn clock-back"
        data-step="-1"
        disabled={!ready}
        onClick={() => stepBy(-1)}
        aria-label={t(locale, "tlStepBackDay")}
        title={t(locale, "tlStepBackDay")}
      >
        <StepDay />
      </button>
      <button
        type="button"
        className="clock-btn clock-play"
        disabled={!ready || atEnd}
        onClick={() => command({ action: running ? "pause" : "play" })}
        aria-label={running ? t(locale, "pause") : t(locale, "play")}
        title={`${running ? t(locale, "pause") : t(locale, "play")} (${t(locale, "tlShortcuts")})`}
      >
        {running ? <Pause /> : <Play />}
      </button>
      <button
        type="button"
        className="clock-btn"
        data-step="1"
        disabled={!ready || atEnd}
        onClick={() => stepBy(1)}
        aria-label={t(locale, "stepDay")}
        title={t(locale, "stepDay")}
      >
        <StepDay />
      </button>
      <button
        ref={trigger}
        type="button"
        className="clock-date"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={t(locale, "clockOptions", { date: label })}
        disabled={!clock}
        onPointerDown={() => {
          wasOpen.current = open;
        }}
        onClick={() => {
          const was = open || wasOpen.current;
          wasOpen.current = false;
          setOpen(!was);
        }}
      >
        <span className="clock-readout num">{label}</span>
        {running ? <span className="clock-live" aria-hidden="true" /> : null}
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && clock ? (
        <div
          ref={pop}
          id={popId}
          role="menu"
          aria-label={t(locale, "clockLabel")}
          tabIndex={-1}
          popover="auto"
          className="sb-pop clock-pop"
          onKeyDown={onPopKey}
          onToggle={(e) => {
            if ((e as unknown as { newState?: string }).newState === "closed") setOpen(false);
          }}
        >
          <p className="sb-pop-label" role="presentation">
            {t(locale, "clockSpeed")}
          </p>
          {SPEEDS.map((s, i) => (
            <button
              type="button"
              role="menuitemradio"
              key={s.key}
              className="sb-pop-item sb-pop-check"
              aria-checked={i === selectedSpeed}
              data-speed={i}
              disabled={!ready}
              onClick={() => command({ action: "configure", tickMs: s.tickMs, daysPerTick: s.daysPerTick })}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                {i === selectedSpeed ? <circle cx="8" cy="8" r="2.6" fill="currentColor" /> : null}
              </svg>
              <span>{t(locale, s.key)}</span>
            </button>
          ))}
          <hr className="sb-pop-sep" />
          <DateJump
            locale={locale}
            min={clock.start}
            max={clock.end}
            value={shown ?? ""}
            disabled={!ready}
            onGo={(iso, keepOpen) => {
              command({ action: "pause" });
              seek(iso);
              if (!keepOpen) close();
            }}
          />
          <p className="sb-pop-foot">{t(locale, "clockDemo")}</p>
          <p className="sb-pop-foot">{t(locale, "tlShortcuts")}</p>
        </div>
      ) : null}
    </div>
  );
}
