import type { ClockCommand, ClockState } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";

// Step (how far each tick moves) and speed (how often it ticks) are two controls; the clock takes them apart.
export const STEPS = [
  { key: "tlStepByDay", daysPerTick: 1 },
  { key: "tlStepByWeek", daysPerTick: 7 },
  { key: "tlStepByMonth", daysPerTick: 30 },
] as const;
export const SPEEDS = [
  { key: "tlSpeedSlow", tickMs: 2000 },
  { key: "tlSpeedNormal", tickMs: 1000 },
  { key: "tlSpeedFast", tickMs: 500 },
] as const;

/** Step and speed as two labelled segmented groups; the hover title says it in words. The timeline and the date chip share them. */
export function PlaybackControls({
  locale,
  clock,
  ready,
  command,
}: {
  locale: Locale;
  clock: ClockState | null;
  ready: boolean;
  command: (c: ClockCommand) => void;
}) {
  const stepNow = STEPS.find((s) => s.daysPerTick === clock?.daysPerTick);
  const speedNow = SPEEDS.find((s) => s.tickMs === clock?.tickMs);
  const hint = (speedKey: (typeof SPEEDS)[number]["key"], stepKey: (typeof STEPS)[number]["key"], ms: number) =>
    t(locale, "tlSpeedHint", { speed: t(locale, speedKey), step: t(locale, stepKey), s: ms / 1000 });
  return (
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
}
