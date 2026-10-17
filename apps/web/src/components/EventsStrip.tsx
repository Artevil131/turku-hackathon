import { formatDateNumeric, type Locale, t } from "@aei/i18n";
import { useRef } from "react";
import { compactDate } from "./hero/geometry.ts";
import { KindGlyph } from "./research/feed/glyphs.tsx";
import type { Incident } from "./research/feed/model.ts";
import { measureLine, signalTitle } from "./research/feed/names.ts";

// What the detectors have found since the replay started: the newest incidents
// as tiles, each appearing when its alert arrives, each with the one title and the
// one measure every signal surface shows (signals-redesign.md). Nothing here is known
// before the clock reaches it; a tile selects its signal and never moves the clock.

const SHOWN = 4;

interface Props {
  locale: Locale;
  /** Incidents up to the clock, newest first. */
  incidents: readonly Incident[];
  /** The selected incident key (`inc`), if any. */
  selected: string | null;
  disabled: boolean;
  onPick: (key: string) => void;
  /** Open the full list (the research page's feed). */
  onMore: () => void;
  /** Folded bar: a count and the newest find as one chip. */
  compact?: boolean;
  /** The replay's first day: the label reads "New since {date}". */
  since?: string | null;
}

export function EventsStrip({ locale, incidents, selected, disabled, onPick, onMore, compact, since = null }: Props) {
  // Keys seen in an earlier render: a tile that is new gets its entrance.
  const seen = useRef<Set<string> | null>(null);
  const first = seen.current === null;
  if (seen.current === null) seen.current = new Set(incidents.map((i) => i.key));
  const entering = (key: string) => !first && !(seen.current as Set<string>).has(key);
  for (const i of incidents) (seen.current as Set<string>).add(i.key);

  const newest = incidents.slice(0, SHOWN);
  const more = incidents.length - newest.length;
  const label = since
    ? t(locale, "tlNewSince", { date: formatDateNumeric(since), n: incidents.length })
    : t(locale, "tlFound", { n: incidents.length });

  if (compact) {
    const lead = newest[0];
    return (
      <span className="tl-events tl-events-compact" role="group" aria-label={label}>
        <span className="tl-ev-count">{label}</span>
        {lead ? (
          <button
            type="button"
            className={`tl-seg tl-ev-chip${lead.key === selected ? " is-current" : ""}${entering(lead.key) ? " is-entering" : ""}`}
            disabled={disabled}
            aria-pressed={lead.key === selected}
            title={`${signalTitle(locale, lead.kind, lead.lead)} · ${measureLine(locale, lead.lead)} · ${compactDate(lead.date)}`}
            onClick={() => onPick(lead.key)}
          >
            <KindGlyph kind={lead.kind} />
            {signalTitle(locale, lead.kind, lead.lead)}
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <div className={`tl-events${selected ? " has-selection" : ""}`} role="group" aria-label={label}>
      <p className="tl-events-label">
        {label}
        {more > 0 ? (
          <button type="button" className="tl-ev-more" disabled={disabled} onClick={onMore}>
            {t(locale, "tlFoundMore", { n: more })}
          </button>
        ) : null}
      </p>
      {newest.length === 0 ? <p className="tl-ev-none">{t(locale, "tlFoundNone")}</p> : null}
      <ul className="tl-events-list">
        {newest.map((i) => {
          const current = i.key === selected;
          const title = signalTitle(locale, i.kind, i.lead);
          const measure = measureLine(locale, i.lead);
          return (
            <li key={i.key}>
              <button
                type="button"
                className={`tl-ev${current ? " is-current" : ""}${entering(i.key) ? " is-entering" : ""}`}
                disabled={disabled}
                aria-pressed={current}
                aria-label={`${title}, ${measure}, ${compactDate(i.date)}`}
                title={`${title} · ${measure}`}
                onClick={() => onPick(i.key)}
              >
                <span className="tl-ev-code">
                  <KindGlyph kind={i.kind} />
                </span>
                <span className="tl-ev-name">{title}</span>
                <span className="tl-ev-what">{measure}</span>
                <span className="tl-ev-when">{compactDate(i.date)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
