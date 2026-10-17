import { alertEvidence, formatDateNumeric, incidentPriority, incidentResponsibility, type Locale, t } from "@aei/i18n";
import { KindGlyph } from "./glyphs.tsx";
import type { Incident } from "./model.ts";
import { kindLabel, shortTitle, unitLabel } from "./names.ts";
import { SpanLine } from "./SpanChips.tsx";
import type { Spans } from "./spans.ts";

interface Props {
  locale: Locale;
  incident: Incident;
  selected: boolean;
  spans: Spans | null;
  onSelect: (key: string) => void;
}

/** Task summary first; the calculation and the dated member explanations are one action away. */
export function IncidentRow({ locale, incident: inc, selected, spans, onSelect }: Props) {
  const priority = incidentPriority(inc.members);
  return (
    <article className="feed-incident">
      <button
        type="button"
        className="feed-row"
        data-kind={inc.kind}
        aria-current={selected ? "true" : undefined}
        data-key={inc.key}
        onClick={() => onSelect(inc.key)}
        aria-label={`${t(locale, "feedMathOpen")}: ${shortTitle(locale, inc.lead)}, ${unitLabel(locale, inc.ward)}, ${formatDateNumeric(inc.date)}`}
      >
        <span className="feed-row-top">
          <span className="feed-kind" title={kindLabel(locale, inc.kind)}>
            <KindGlyph kind={inc.kind} />
            <span className="visually-hidden">{kindLabel(locale, inc.kind)}</span>
          </span>
          <span className="feed-name">{shortTitle(locale, inc.lead)}</span>
          <time className="feed-date" dateTime={inc.date}>
            {formatDateNumeric(inc.date)}
          </time>
        </span>
        <span className="feed-summary">
          {unitLabel(locale, inc.ward)} · {t(locale, priority === "high" ? "feedSeverityHigh" : "feedSeverityMedium")}
        </span>
        <span className="feed-summary">
          {t(locale, inc.members.length === 1 ? "feedIncidentOne" : "feedIncidentMany", { n: inc.members.length })}
        </span>
        <span className="feed-evidence">{t(locale, "feedLatestEvidence", { evidence: alertEvidence(locale, inc.lead) })}</span>
        <span className="feed-owner">{incidentResponsibility(locale, inc.members)}</span>
        {spans ? (
          <span className="feed-row-bottom">
            <SpanLine locale={locale} spans={spans} ward={inc.ward} />
          </span>
        ) : null}
        <span className="feed-open">{t(locale, "feedMathOpen")} →</span>
      </button>
      <details className="feed-members">
        <summary>{t(locale, "feedMembers")}</summary>
        <p>{t(locale, "feedMembersNote")}</p>
        <ul>
          {inc.members.map((a) => (
            <li key={a.id}>
              <time dateTime={a.date}>{formatDateNumeric(a.date)}</time>
              {" · "}
              {shortTitle(locale, a)} · {alertEvidence(locale, a)}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
