import { formatDate, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { type DoctorFilters, num, pct } from "./filters.ts";
import type { Item } from "./reason.ts";

// The top of the coverage window, before any control: what to start with, then the others in rows of one shape
// (glyph, name, share). The list below is the evidence.

/** The drugs of one standing as pills: the name, then its share. */
function Pills({ items, lead, muted }: { items: readonly Item[]; lead: string; muted?: boolean }) {
  return (
    <div className={`dr-answer-pills${muted ? " dr-answer-low" : ""}`}>
      <span className="dr-answer-pills-lead">{lead}</span>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.name} <b>{pct(i.share ?? 0)}&nbsp;%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  // No single drug clears: the first ranked combination takes the headline in the same shape, with the reason beside it.
  const pair = !first ? (items.find((i) => i.pair !== null && (i.standing === "clears" || i.standing === "borderline")) ?? null) : null;
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
          <p className="dr-answer-line">{t(locale, "drAnswerCovers", { share: pct(first.share ?? 0), n: num(locale, first.n) })}</p>
          {/* The brief's comparison on one basis, all organisms: the year the ranking rests on and this unit's last
              four weeks, labelled as a pair (D-023; no flag between them, D-044). */}
          {first.row ? (
            <div className="dr-answer-compare" role="group" aria-label={t(locale, "drAnswerAllOrg")}>
              <span className="dr-answer-compare-title">{t(locale, "drAnswerAllOrg")}</span>
              <div>
                <b>{first.row.allOrganisms.share === null ? "–" : `${pct(first.row.allOrganisms.share)}\u00a0%`}</b>
                <small>
                  {t(locale, "drAnswerFigYear")} · n {num(locale, first.row.coverage.counts.known)}
                </small>
              </div>
              <div>
                <b>
                  {first.recent && first.recent.known >= 30
                    ? `${pct(first.recent.covered / first.recent.known)}\u00a0%`
                    : first.recent && first.recent.known > 0
                      ? `${num(locale, first.recent.covered)} / ${num(locale, first.recent.known)}`
                      : "—"}
                </b>
                <small>
                  {t(locale, "drAnswerFigRecent")}
                  {first.recent && first.recent.known >= 30
                    ? ` · ${num(locale, first.recent.covered)} / ${num(locale, first.recent.known)}`
                    : ""}
                </small>
              </div>
            </div>
          ) : null}
          {/* The rest of the list as pills; the table below has the bars and the details. */}
          {clears.length > 1 ? <Pills items={clears.slice(1)} lead={t(locale, "drAnswerAlsoShort")} /> : null}
          {below.length ? <Pills items={below} lead={t(locale, "drAnswerBelowShort")} muted /> : null}
        </>
      ) : pair ? (
        <>
          <p className="dr-answer-nosingle">{t(locale, "drAnswerNoSingle", { bar })}</p>
          <p className="dr-answer-head">
            {t(locale, "drAnswerStart", { name: "\u0000" })
              .split("\u0000")
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <span key="name" className={pair.standing === "clears" ? "dr-good" : undefined}>
                        {pair.name}
                      </span>,
                      part,
                    ],
              )}
          </p>
          <p className="dr-answer-line">{t(locale, "drAnswerPairCovers", { share: pct(pair.share ?? 0), n: num(locale, pair.n) })}</p>
        </>
      ) : (
        <p className="dr-answer-head">{t(locale, "drAnswerNone", { bar })}</p>
      )}
      {asOf && !loading && !failed ? (
        <p className="dr-answer-when">
          {t(locale, "drAnswerData", { date: formatDate(locale, asOf, "long"), unit: wardName(locale, filters.unit as never) })}
          {" · "}
          <button
            type="button"
            className="dr-change-date"
            onClick={() => dispatchEvent(new CustomEvent("aei:open-window", { detail: "timeline" }))}
          >
            {t(locale, "drChangeDate")}
          </button>
        </p>
      ) : null}
      <p className="dr-answer-note">{t(locale, "drAnswerNote")}</p>
    </section>
  );
}
