import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import type React from "react";
import { type DoctorFilters, num, pct } from "./filters.ts";
import { type Item, recentText } from "./reason.ts";

// The top of the coverage window, before any control: what to start with, then the others in rows of one shape
// (glyph, name, share). The list below is the evidence.

function Rows({ items, mark, bar, locale }: { items: readonly Item[]; mark: string; bar: number; locale: Locale }) {
  return (
    <ul className="dr-answer-rows">
      {items.map((i) => (
        <li key={i.id}>
          <span className="dr-mark" aria-hidden="true">
            {mark}
          </span>
          <span className="dr-name">{i.name}</span>
          <span className="dr-bar" aria-hidden="true" style={{ "--w": `${pct(i.share ?? 0)}%`, "--bar": `${bar}%` } as React.CSSProperties}>
            <i />
          </span>
          <b>{pct(i.share ?? 0)}&nbsp;%</b>
          <span className="dr-recent num">{recentText(locale, i.recent)}</span>
        </li>
      ))}
    </ul>
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
          <p className="dr-answer-line">{t(locale, "drAnswerCovers", { share: pct(first.share ?? 0), n: num(locale, first.n) })}</p>
          {clears.length > 1 ? (
            <>
              <h3 className="dr-answer-sub">{t(locale, "drAnswerAlsoHead", { bar })}</h3>
              <Rows locale={locale} items={clears.slice(1)} mark="✓" bar={bar} />
            </>
          ) : null}
          {below.length ? (
            <>
              <h3 className="dr-answer-sub dr-answer-low">{t(locale, "drAnswerBelowHead", { bar })}</h3>
              <Rows locale={locale} items={below} mark="✕" bar={bar} />
            </>
          ) : null}
        </>
      ) : (
        <p className="dr-answer-head">{t(locale, "drAnswerNone", { bar })}</p>
      )}
      <p className="dr-answer-note">{t(locale, "drAnswerNote")}</p>
    </section>
  );
}
