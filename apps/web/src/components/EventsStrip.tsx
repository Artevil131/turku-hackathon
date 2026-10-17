import { type Locale, t, wardName } from "@aei/i18n";
import type { ResolvedEvent } from "./events.ts";

const monthYear = (locale: Locale, iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });

interface Props {
  locale: Locale;
  events: readonly ResolvedEvent[];
  /** The replay clock's day; a tile is past once the clock has reached its date. */
  asOf: string | null;
  /** The selected incident key (`inc`), if any. */
  selected: string | null;
  disabled: boolean;
  onPick: (ev: ResolvedEvent) => void;
  /** Folded bar: four small chips (code and unit), the full text in the title. */
  compact?: boolean;
}

/** The four planted events as visible tiles: click seeks the clock and selects the incident. */
export function EventsStrip({ locale, events, asOf, selected, disabled, onPick, compact }: Props) {
  const isCurrent = (ev: ResolvedEvent) => ev.incident !== null && ev.incident === selected;
  const unit = (ev: ResolvedEvent) => (ev.unit ? wardName(locale, ev.unit) : t(locale, "tlEvHospital"));
  const past = (ev: ResolvedEvent) => (asOf !== null && asOf >= ev.date ? ` (${t(locale, "tlEventPast")})` : "");

  if (compact) {
    return (
      <span className="tl-events tl-events-compact" role="group" aria-label={t(locale, "tlEvents")}>
        {events.map((ev) => (
          <button
            key={ev.code}
            type="button"
            className={`tl-seg tl-ev-chip${isCurrent(ev) ? " is-current" : ""}${asOf !== null && asOf >= ev.date ? " is-past" : ""}`}
            disabled={disabled}
            aria-pressed={isCurrent(ev)}
            title={`${ev.code} · ${t(locale, ev.name)} · ${monthYear(locale, ev.date)}${past(ev)}`}
            onClick={() => onPick(ev)}
          >
            {ev.code}
          </button>
        ))}
      </span>
    );
  }

  return (
    <div className={`tl-events${selected ? " has-selection" : ""}`} role="group" aria-label={t(locale, "tlEvents")}>
      <p className="tl-events-label">{t(locale, "tlEvents")}</p>
      <ul className="tl-events-list">
        {events.map((ev) => {
          const done = asOf !== null && asOf >= ev.date;
          return (
            <li key={ev.code}>
              <button
                type="button"
                className={`tl-ev${isCurrent(ev) ? " is-current" : ""}${done ? " is-past" : ""}`}
                disabled={disabled}
                aria-pressed={isCurrent(ev)}
                title={done ? t(locale, "tlEventPast") : undefined}
                onClick={() => onPick(ev)}
              >
                <span className="tl-ev-code">{ev.code}</span>
                <span className="tl-ev-when">{monthYear(locale, ev.date)}</span>
                <span className="tl-ev-unit">{unit(ev)}</span>
                <span className="tl-ev-name">{t(locale, ev.name)}</span>
                <span className="tl-ev-what">{t(locale, ev.what)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
