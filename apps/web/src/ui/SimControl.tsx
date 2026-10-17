import { useEffect, useState } from "react";
import type { FeedClock, FeedCommand } from "../feed/types.ts";
import { formatDate, type Locale, t } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";
import { Segmented } from "./Segmented.tsx";
import { Sheet } from "./Sheet.tsx";

/*
  SimControl: the DEMO SIMULATION band under the header. Clearly labelled
  "Simulation" in its own (violet) colour: a live hospital feed has no such
  control. Play / pause, +1 day, +1 week, speed and jump to a date.
  Phones: a single Simulation toggle opens a sheet with every control.
    locale    Locale
    clock     FeedClock
    onControl (command: FeedCommand) => Promise<unknown>
    desktop   boolean     full band (>= 1024 px) or the slim phone row
*/

const SPEEDS = [
  { ms: 2000, key: "common.sim.speedSlow" },
  { ms: 500, key: "common.sim.speedMid" },
  { ms: 100, key: "common.sim.speedFast" },
] as const;

export function SimControl({
  locale,
  clock,
  onControl,
  desktop,
}: {
  locale: Locale;
  clock: FeedClock;
  onControl: (command: FeedCommand) => Promise<unknown>;
  desktop: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [date, setDate] = useState(clock.asOf);
  /** The user has typed a date that is not sent yet: stop following the clock. */
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDate(clock.asOf);
  }, [clock.asOf, dirty]);

  const atEnd = clock.asOf >= clock.end;

  async function run(command: FeedCommand) {
    setBusy(true);
    setFailed(false);
    try {
      await onControl(command);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const speed = String(SPEEDS.find((s) => s.ms === clock.tickMs)?.ms ?? "");
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= clock.start && date <= clock.end;

  const playPause = (
    <button
      type="button"
      className={`k-btn is-sim${clock.running ? " is-on" : ""}`}
      onClick={() => run(clock.running ? { action: "pause" } : { action: "play" })}
      disabled={busy || (!clock.running && atEnd)}
      aria-pressed={clock.running}
    >
      <Icon name={clock.running ? "pause" : "play"} size={16} />
      {clock.running ? t(locale, "common.sim.pause") : t(locale, "common.sim.play")}
    </button>
  );
  const step = (days: 1 | 7) => (
    <button type="button" className="k-btn is-sim-ghost" onClick={() => run({ action: "step", days })} disabled={busy || atEnd}>
      {t(locale, days === 1 ? "common.sim.step1" : "common.sim.step7")}
    </button>
  );
  const speedControl = (
    <Segmented
      label={t(locale, "common.sim.speed")}
      size="sm"
      stretch={!desktop}
      value={speed}
      onChange={(v) => run({ action: "configure", tickMs: Number(v), daysPerTick: 1 })}
      options={SPEEDS.map((s) => ({ value: String(s.ms), label: <span className="u-num">{t(locale, s.key)}</span> }))}
    />
  );
  const jump = (
    <form
      className="app-sim-jump"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validDate) return;
        setDirty(false);
        void run({ action: "seek", date }).then(() => setSheet(false));
      }}
    >
      <label className="app-sim-date">
        <span className="u-sr">{t(locale, "common.sim.jump")}</span>
        <Icon name="calendar" size={16} />
        <input
          type="date"
          value={date}
          min={clock.start}
          max={clock.end}
          onChange={(e) => {
            setDirty(e.target.value !== clock.asOf);
            setDate(e.target.value);
          }}
        />
      </label>
      <button type="submit" className="k-btn is-sim-ghost" disabled={busy || !validDate || date === clock.asOf}>
        {t(locale, "common.sim.go")}
      </button>
    </form>
  );
  const status = (
    <span className="app-sim-state" aria-live="polite">
      <span className={`app-sim-led${clock.running ? " is-on" : ""}`} aria-hidden="true" />
      {atEnd ? t(locale, "common.sim.atEnd") : clock.running ? t(locale, "common.sim.running") : t(locale, "common.sim.paused")}
    </span>
  );
  const label = (
    <span className="app-sim-label" title={t(locale, "common.sim.note")}>
      <Icon name="flask" size={16} />
      {t(locale, "common.sim.label")}
    </span>
  );
  const error = failed ? (
    <span className="app-sim-error" role="alert">
      {t(locale, "common.sim.failed")}
    </span>
  ) : null;

  if (desktop) {
    return (
      <section className="app-sim is-desktop" aria-label={t(locale, "common.sim.label")}>
        <div className="app-sim-inner">
          {label}
          {status}
          <div className="app-sim-group">
            {playPause}
            {step(1)}
            {step(7)}
          </div>
          <div className="app-sim-group">{speedControl}</div>
          <div className="app-sim-group">{jump}</div>
          {error}
          <span className="app-sim-note">
            {t(locale, "common.sim.range", { start: formatDate(locale, clock.start, "long"), end: formatDate(locale, clock.end, "long") })}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="app-sim is-phone" aria-label={t(locale, "common.sim.label")}>
      <div className="app-sim-inner">
        <button
          type="button"
          className="k-btn is-sim-ghost app-sim-toggle"
          onClick={() => setSheet(true)}
          aria-expanded={sheet}
          aria-haspopup="dialog"
        >
          <Icon name="flask" size={16} />
          {t(locale, "common.sim.label")}
          <Icon name="chevron-down" size={16} />
        </button>
      </div>
      {error}
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        locale={locale}
        tone="sim"
        size="sm"
        title={
          <span className="u-row">
            <Icon name="flask" size={18} />
            {t(locale, "common.sim.label")}
          </span>
        }
        subtitle={t(locale, "common.sim.note")}
      >
        <div className="u-stack-lg">
          <div className="u-spread">
            {status}
            <span className="u-muted u-small u-num">{formatDate(locale, clock.asOf, "long")}</span>
          </div>
          <div className="app-sim-sheet-row">
            {playPause}
            {step(1)}
            {step(7)}
          </div>
          <div className="k-field">
            <span className="k-field-label" aria-hidden="true">
              {t(locale, "common.sim.speed")}
            </span>
            {speedControl}
          </div>
          <div className="k-field">
            <span className="k-field-label" aria-hidden="true">
              {t(locale, "common.sim.jump")}
            </span>
            {jump}
            {date < clock.asOf && validDate ? <p className="u-muted u-small">{t(locale, "common.sim.back")}</p> : null}
          </div>
          {error}
          <p className="u-muted u-small">
            {t(locale, "common.sim.range", { start: formatDate(locale, clock.start, "long"), end: formatDate(locale, clock.end, "long") })}
          </p>
        </div>
      </Sheet>
    </section>
  );
}
