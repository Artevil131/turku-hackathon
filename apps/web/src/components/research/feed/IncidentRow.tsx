import { formatDateNumeric, incidentPriority, incidentResponsibility, type Locale, t } from "@aei/i18n";
import type { MouseEvent } from "react";
import { Gloss } from "../../Gloss.tsx";
import { KindGlyph } from "./glyphs.tsx";
import type { Incident } from "./model.ts";
import { measureLine, signalTitle } from "./names.ts";
import { SpanLine } from "./SpanChips.tsx";
import type { Spans } from "./spans.ts";

const TITLE_TERM = /\b(ESBL|MRSA|VRE|CPE)\b/;

/** A title with its first resistance abbreviation glossed; the rest stays plain text. */
export function GlossedTitle({ locale, title }: { locale: Locale; title: string }) {
  const m = TITLE_TERM.exec(title);
  if (!m || m.index === undefined) return <>{title}</>;
  const term = m[1] as "ESBL" | "MRSA" | "VRE" | "CPE";
  return (
    <>
      {title.slice(0, m.index)}
      <Gloss term={term} locale={locale} />
      {title.slice(m.index + term.length)}
    </>
  );
}

interface Props {
  locale: Locale;
  incident: Incident;
  selected: boolean;
  /** Another appearance of the selected signal's reach: a unit it touches. */
  kin?: boolean;
  spans: Spans | null;
  onSelect: (key: string) => void;
  /** "Open the card": brings the signal card into view. Without it the link is not shown. */
  onOpenCard?: () => void;
}

/**
 * One line per signal (signals-redesign.md §2.2): glyph · title · date, and the measure under it.
 * Selected, the row adds only the reach chips and "Open the card"; the card holds the rest.
 * The article takes the click, so a click anywhere on the row (or the smoke's `.feed-row.click()`) selects.
 */
export function IncidentRow({ locale, incident: inc, selected, kin = false, spans, onSelect, onOpenCard }: Props) {
  const high = incidentPriority(inc.members) === "high";
  const title = signalTitle(locale, inc.kind, inc.lead);
  const owner = incidentResponsibility(locale, inc.members);
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest(".feed-open")) return;
    onSelect(inc.key);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row holds a button and a link, so it cannot be one button itself
    // biome-ignore lint/a11y/noStaticElementInteractions: the click is delegated from the row's own button
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter and Space reach the button inside, whose click bubbles here
    <article
      className={`feed-row${kin ? " is-kin" : ""}`}
      data-kind={inc.kind}
      data-key={inc.key}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
    >
      <button type="button" className="feed-row-main" aria-expanded={selected} aria-label={`${title}, ${formatDateNumeric(inc.date)}`}>
        <span className="feed-row-top">
          <span className="feed-kind" aria-hidden="true">
            <KindGlyph kind={inc.kind} />
          </span>
          <span className="feed-name">
            {high ? (
              <span className="feed-dot" title={owner}>
                <span className="visually-hidden">{t(locale, "feedSeverityHigh")}. </span>
              </span>
            ) : null}
            <GlossedTitle locale={locale} title={title} />
          </span>
          <time className="feed-date" dateTime={inc.date}>
            {formatDateNumeric(inc.date)}
          </time>
        </span>
        <span className="feed-measure">{measureLine(locale, inc.lead)}</span>
      </button>
      {/* The details ease open: the wrapper is always there, its row grows from 0fr to 1fr. */}
      <div className="feed-more" data-open={selected}>
        <div className="feed-more-in">
          {selected ? (
            <>
              <span className="feed-summary">
                {t(locale, inc.members.length === 1 ? "feedIncidentOne" : "feedIncidentMany", { n: inc.members.length })}
              </span>
              {spans ? (
                <span className="feed-row-bottom">
                  <SpanLine locale={locale} spans={spans} ward={inc.ward} />
                </span>
              ) : null}
              {onOpenCard ? (
                <button type="button" className="feed-open" onClick={onOpenCard}>
                  {t(locale, "feedOpenCard")} →
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
