import { formatDate, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { type DoctorFilters, num, pct } from "./filters.ts";
import { type Item, recentText } from "./reason.ts";

// The top of the coverage window, before any control: what to start with, then the others in rows of one shape
// (glyph, name, share). The list below is the evidence.

/** "nitrofurantoin 94 %, fosfomycin 93 %": the drugs of one standing, names and shares in a row. */
const listed = (locale: Locale, items: readonly Item[]) => items.map((i) => `${i.name} ${pct(i.share ?? 0)} %`).join(", ");

export function DoctorAnswer({
  locale,
  filters,
  items,
  bar,
  loading,
  failed,
  editing,
  onEdit,
  showCase = true,
  asOf,
  windowDays,
}: {
  locale: Locale;
  filters: DoctorFilters;
  items: readonly Item[];
  /** The bar the list is judged against, in percent. */
  bar: number;
  loading: boolean;
  /** The coverage call failed and there is nothing to show: say so instead of claiming an answer. */
  failed: boolean;
  editing: boolean;
  onEdit: () => void;
  /** The case summary and its change button; off when the case panel is already open beside the answer. */
  showCase?: boolean;
  /** The last day of results the answer rests on, and how many days back it looks: said under the answer so a doctor knows it is current. */
  asOf?: string | null;
  windowDays?: number;
}) {
  const singles = items.filter((i) => i.row !== null);
  const clears = singles.filter((i) => i.standing === "clears");
  const below = singles.filter((i) => i.standing === "below");
  const first = clears[0] ?? null;
  const chips = [
    wardName(locale, filters.unit as never),
    specimenName(locale, filters.site).toLowerCase(),
    t(locale, filters.sev === "severe" ? "drSevSevereShort" : "drSevMildShort"),
  ];
  return (
    <section className="dr-answer" aria-label={t(locale, "drAnswerLabel")} aria-busy={loading || undefined}>
      <div className="dr-answer-case" hidden={!showCase}>
        <span className="dr-answer-for">{t(locale, "drAnswerFor")}</span>
        <ul className="dr-answer-chips" aria-label={t(locale, "drAnswerParams")}>
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
        <button type="button" className="dr-answer-change" aria-expanded={editing} onClick={onEdit}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              d="M2.5 13.5l.7-3L11 2.7l2.3 2.3-7.8 7.8zM9.7 4l2.3 2.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          {t(locale, editing ? "drAnswerDone" : "drAnswerChange")}
        </button>
      </div>
      {failed ? (
        <p className="dr-answer-head">{t(locale, "drAnswerFailed")}</p>
      ) : loading ? (
        <p className="dr-answer-head">…</p>
      ) : first ? (
        <>
          <p className="dr-answer-kicker">
            <span aria-hidden="true">✓</span> {t(locale, "drAnswerKicker", { bar })}
          </p>
          <p className="dr-answer-head">
            {t(locale, "drAnswerStart", { name: "\u0000" })
              .split("\u0000")
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <span key="name" className="dr-good">
                        {first.name}
                      </span>,
                      part,
                    ],
              )}
          </p>
          <p className="dr-answer-line">
            {t(locale, "drAnswerCovers", { share: pct(first.share ?? 0), n: num(locale, first.n) })}
            {first.recent ? <span className="dr-answer-recent"> · {recentText(locale, first.recent)}</span> : null}
          </p>
          {/* The rest of the list in one breath each; the table below has the bars and the details. */}
          {clears.length > 1 ? (
            <p className="dr-answer-alt">
              <b>{t(locale, "drAnswerAlsoHead", { bar })}:</b> {listed(locale, clears.slice(1))}
            </p>
          ) : null}
          {below.length ? (
            <p className="dr-answer-alt dr-answer-low">
              <b>{t(locale, "drAnswerBelowHead", { bar })}:</b> {listed(locale, below)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="dr-answer-head">{t(locale, "drAnswerNone", { bar })}</p>
      )}
      {asOf && !loading && !failed ? (
        <p className="dr-answer-when">
          {t(locale, "drAnswerWhen", {
            date: formatDate(locale, asOf, "long"),
            days: windowDays ?? 365,
            unit: wardName(locale, filters.unit as never),
          })}{" "}
          {/* The doctor's view hands the board its ward: one click to this unit's signals. */}
          <a className="dr-answer-pivot" href={`#research?unit=${encodeURIComponent(filters.unit)}`}>
            {t(locale, "drAnswerBoard", { unit: wardName(locale, filters.unit as never) })}
          </a>
        </p>
      ) : null}
      <p className="dr-answer-note">{t(locale, "drAnswerNote")}</p>
    </section>
  );
}
