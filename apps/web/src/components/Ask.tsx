import { AGE_GROUP_LABELS } from "@aei/ask";
import { susceptibilityCounts } from "@aei/counting";
import type { IsolateRecord } from "@aei/domain";
import { antibioticName, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { useId, useMemo, useState } from "react";
import type { FilterChip, Question } from "../ai.ts";

export function Ask({ locale, question }: { locale: Locale; question: Question }) {
  const [text, setText] = useState("");
  const id = useId();
  const answer = question.answer;
  const filters = answer?.filters;
  const parsed = question.parsed?.filters;
  const chips: [FilterChip, string][] = [];
  if (filters && parsed) {
    if (parsed.ward && filters.ward) chips.push(["ward", wardName(locale, filters.ward)]);
    if (parsed.specimen && filters.specimen) chips.push(["specimen", specimenName(locale, filters.specimen)]);
    if (parsed.organism && filters.organism) chips.push(["organism", filters.organism]);
    if (filters.sex) chips.push(["sex", t(locale, filters.sex === "F" ? "female" : "male")]);
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      const range = `${filters.ageMin ?? 0}${filters.ageMax === undefined ? "+" : `–${filters.ageMax}`} ${t(locale, "yearsShort")}`;
      chips.push(["age", `${answer?.ageGroup ? `${AGE_GROUP_LABELS[answer.ageGroup][locale]} · ` : ""}${range}`]);
    }
    if (filters.from || filters.to) chips.push(["dates", `${filters.from ?? "…"} – ${filters.to ?? "…"}`]);
  }
  if (!question.available && !question.active && !question.error) return null;
  return (
    <div className="ask-box">
      {question.available ? (
        <>
          <label className="field-label" htmlFor={id}>
            {t(locale, "askLabel")}
          </label>
          <div className="ask-entry">
            <input
              id={id}
              className="select"
              value={text}
              placeholder={t(locale, "askPlaceholder")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (text.trim() && !question.pending) void question.ask(text, locale);
                }
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={!text.trim() || question.pending}
              onClick={() => void question.ask(text, locale)}
            >
              {t(locale, question.pending ? "askLoading" : "askSubmit")}
            </button>
          </div>
        </>
      ) : null}
      {question.error ? (
        <p role="alert" className="field-hint">
          {t(locale, "askUnavailable")}
        </p>
      ) : null}
      <div className="ask-chips">
        {chips.map(([key, label]) => (
          <button
            type="button"
            className="chip"
            key={key}
            aria-label={t(locale, "removeFilter", { filter: label })}
            onClick={() => question.remove(key)}
          >
            {label}
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ))}
        {question.active ? (
          <button type="button" className="link" onClick={question.clear}>
            {t(locale, "clearQuestion")}
          </button>
        ) : null}
      </div>
      {answer?.unmatched.length ? <p className="field-hint">{t(locale, "askUnmatched", { words: answer.unmatched.join(", ") })}</p> : null}
    </div>
  );
}

/** Same first-isolate gear as spread counts; the assistant supplies no figures. */
export function AskedResults({
  locale,
  records,
  loading,
  error,
  minIsolates,
}: {
  locale: Locale;
  records: IsolateRecord[];
  loading: boolean;
  error: boolean;
  minIsolates: number;
}) {
  const rows = useMemo(() => susceptibilityCounts(records), [records]);
  if (loading)
    return (
      <p className="empty" role="status">
        {t(locale, "dataLoading")}
      </p>
    );
  if (error)
    return (
      <p className="empty" role="alert">
        {t(locale, "dataLoadError")}
      </p>
    );
  if (!rows.length) return <p className="empty">{t(locale, "noQueryRecords")}</p>;
  return (
    <div className="asked-results">
      <p className="field-hint">{t(locale, "queryCountNote")}</p>
      <table className="signal-table">
        <caption className="visually-hidden">{t(locale, "askResults")}</caption>
        <thead>
          <tr>
            <th scope="col">{t(locale, "organism")}</th>
            <th scope="col">{t(locale, "specimen")}</th>
            <th scope="col">{t(locale, "antibiotic")}</th>
            <th scope="col">{t(locale, "susceptibleHead")}</th>
            <th scope="col">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.organism}:${row.specimen}:${row.antibiotic}`}>
              <td>
                <em>{row.organism}</em>
              </td>
              <td>{specimenName(locale, row.specimen)}</td>
              <td>{antibioticName(locale, row.antibiotic)}</td>
              <td className="num">{row.n >= minIsolates ? `${Math.round((100 * row.susceptible) / row.n)} %` : "–"}</td>
              <td className="num">{row.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="result-foot">{t(locale, "worksFoot", { min: minIsolates })}</p>
    </div>
  );
}
