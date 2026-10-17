import { alertEvidence, type Locale, t } from "@aei/i18n";
import { useRef } from "react";
import { compactDate } from "./hero/geometry.ts";
import { KindGlyph } from "./research/feed/glyphs.tsx";
import type { Incident } from "./research/feed/model.ts";
import { shortTitle, unitLabel } from "./research/feed/names.ts";

// What the detectors have found so far, as the replay runs: the newest incidents
// as tiles, each appearing when its alert arrives. Nothing here is known before
// the clock reaches it; a tile selects its signal and never moves the clock.

const SHOWN = 6;

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
}

export function EventsStrip({ locale, incidents, selected, disabled, onPick, onMore, compact }: Props) {
  // Keys seen in an earlier render: a tile that is new gets its entrance.
  const seen = useRef<Set<string> | null>(null);
  const first = seen.current === null;
  if (seen.current === null) seen.current = new Set(incidents.map((i) => i.key));
  const entering = (key: string) => !first && !(seen.current as Set<string>).has(key);
  for (const i of incidents) (seen.current as Set<string>).add(i.key);

  const newest = incidents.slice(0, SHOWN);
  const more = incidents.length - newest.length;
  const label = t(locale, "tlFound", { n: incidents.length });

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
            title={`${shortTitle(locale, lead.lead)} · ${unitLabel(locale, lead.ward)} · ${compactDate(lead.date)}`}
            onClick={() => onPick(lead.key)}
          >
            <KindGlyph kind={lead.kind} />
            {shortTitle(locale, lead.lead)}
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <div className={`tl-events${selected ? " has-selection" : ""}`} role="group" aria-label={label}>
      <p className="tl-events-label">{label}</p>
      {newest.length === 0 ? <p className="tl-ev-none">{t(locale, "tlFoundNone")}</p> : null}
      <ul className="tl-events-list">
        {newest.map((i) => {
          const current = i.key === selected;
          return (
            <li key={i.key}>
              <button
                type="button"
                className={`tl-ev${current ? " is-current" : ""}${entering(i.key) ? " is-entering" : ""}`}
                disabled={disabled}
                aria-pressed={current}
                onClick={() => onPick(i.key)}
              >
                <span className="tl-ev-code">
                  <KindGlyph kind={i.kind} />
                </span>
                <span className="tl-ev-when">{compactDate(i.date)}</span>
                <span className="tl-ev-unit">{unitLabel(locale, i.ward)}</span>
                <span className="tl-ev-name">{shortTitle(locale, i.lead)}</span>
                <span className="tl-ev-what">{alertEvidence(locale, i.lead)}</span>
              </button>
            </li>
          );
        })}
        {more > 0 ? (
          <li>
            <button type="button" className="tl-ev tl-ev-more" disabled={disabled} onClick={onMore}>
              <span className="tl-ev-name">{t(locale, "tlFoundMore", { n: more })}</span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
