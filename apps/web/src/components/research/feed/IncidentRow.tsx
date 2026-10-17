import { formatDateNumeric, type Locale, t } from "@aei/i18n";
import { KindGlyph } from "./glyphs.tsx";
import { type Incident, oneDecimal } from "./model.ts";
import { incidentTitle, kindLabel, shortTitle, surpriseOf, surpriseShare } from "./names.ts";
import { SpanLine } from "./SpanChips.tsx";
import type { Spans } from "./spans.ts";

interface Props {
  locale: Locale;
  incident: Incident;
  selected: boolean;
  spans: Spans | null;
  onSelect: (key: string) => void;
}

/** One list row: kind glyph and name, date, the units it spans, and the surprise bar. */
export function IncidentRow({ locale, incident: inc, selected, spans, onSelect }: Props) {
  const share = surpriseShare(inc);
  const top = Math.max(...inc.members.map((a) => surpriseOf(a) ?? 0));
  const label =
    inc.kind === "sentinel" ? t(locale, "feedRuleNoTest") : share === null ? "" : `${t(locale, "feedSurprise")} ${oneDecimal(locale, top)}`;
  return (
    <button
      type="button"
      className="feed-row"
      data-kind={inc.kind}
      aria-current={selected ? "true" : undefined}
      data-key={inc.key}
      title={incidentTitle(locale, inc.lead)}
      onClick={() => onSelect(inc.key)}
    >
      <span className="feed-row-top">
        <span className="feed-kind" title={kindLabel(locale, inc.kind)}>
          <KindGlyph kind={inc.kind} />
          <span className="visually-hidden">{kindLabel(locale, inc.kind)}</span>
        </span>
        <span className="feed-name">{shortTitle(locale, inc.lead)}</span>
        {inc.members.length > 1 ? <span className="feed-n">×{inc.members.length}</span> : null}
        <time className="feed-date" dateTime={inc.date}>
          {formatDateNumeric(inc.date)}
        </time>
      </span>
      <span className="feed-row-bottom">
        <SpanLine locale={locale} spans={spans} ward={inc.ward} />
        <span className="feed-surp" title={label}>
          <span className="feed-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((share ?? 0) * 100)}%` }} data-rule={inc.kind === "sentinel"} />
          </span>
          <span className="feed-surp-n">{inc.kind === "sentinel" ? "▲" : share === null ? "–" : oneDecimal(locale, top)}</span>
          <span className="visually-hidden">{label}</span>
        </span>
      </span>
    </button>
  );
}
