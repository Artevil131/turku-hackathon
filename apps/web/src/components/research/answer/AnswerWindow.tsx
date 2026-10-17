import { type Locale, t } from "@aei/i18n";
import { latestSentence } from "../../home/Latest.tsx";
import type { Incident } from "../feed/model.ts";
import { oneDecimal, openIncidents } from "../feed/model.ts";
import { unitLabel } from "../feed/names.ts";
import "./answer.css";

// The first screen of a project: the one thing to know right now, in a sentence and two numbers, with the way
// into the evidence. Everything else on the board is the evidence; this is the answer.

export function AnswerWindow({
  locale,
  asOf,
  incidents,
  selected,
  unit,
  loading,
  onEvidence,
  onFlow,
}: {
  locale: Locale;
  asOf: string | null;
  /** The incidents the board shows (already filtered by unit and kind). */
  incidents: readonly Incident[];
  selected: Incident | null;
  unit: string | null;
  loading: boolean;
  onEvidence: (incident: Incident) => void;
  onFlow: (incident: Incident) => void;
}) {
  const open = asOf ? openIncidents([...incidents], asOf) : [];
  const headline = (selected && open.find((i) => i.key === selected.key)) ?? open[0] ?? null;
  const where = unit ? unitLabel(locale, unit) : t(locale, "answerEverywhere");
  if (loading) return <div className="answer" aria-busy="true" />;
  if (!headline)
    return (
      <div className="answer" data-state="calm">
        <p className="answer-status">
          <span className="answer-dot" aria-hidden="true" />
          {t(locale, "answerNone")}
        </p>
        <p className="answer-note">{t(locale, "answerNoneNote", { where })}</p>
      </div>
    );
  const lead = headline.lead;
  const expected = "expected" in lead && typeof lead.expected === "number" ? lead.expected : null;
  const observed = "observed" in lead && typeof lead.observed === "number" ? lead.observed : null;
  return (
    <div className="answer" data-state="alert">
      <p className="answer-status">
        <span className="answer-dot" aria-hidden="true" />
        {open.length === 1 ? t(locale, "answerOpenOne") : t(locale, "answerOpenCount", { n: open.length })}
      </p>
      <p className="answer-sentence">{latestSentence(locale, lead)}</p>
      {observed !== null && expected !== null ? (
        <dl className="answer-figures">
          <div>
            <dt>{t(locale, "answerSeen")}</dt>
            <dd>{observed}</dd>
          </div>
          <div>
            <dt>{t(locale, "answerUsual")}</dt>
            <dd>{oneDecimal(locale, expected)}</dd>
          </div>
        </dl>
      ) : null}
      <div className="answer-actions">
        <button type="button" className="answer-primary" onClick={() => onEvidence(headline)}>
          {t(locale, "answerEvidence")}
        </button>
        <button type="button" className="answer-secondary" onClick={() => onFlow(headline)}>
          {t(locale, "answerFlow")}
        </button>
      </div>
    </div>
  );
}
