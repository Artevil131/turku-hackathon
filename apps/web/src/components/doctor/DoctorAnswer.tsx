import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import { type DoctorFilters, num, pct } from "./filters.ts";
import type { Item } from "./reason.ts";

// The top of the coverage window, before any control: what to start with, in words. The list below is the evidence.

export function DoctorAnswer({
  locale,
  filters,
  items,
  bar,
  loading,
  editing,
  onEdit,
}: {
  locale: Locale;
  filters: DoctorFilters;
  items: readonly Item[];
  /** The bar the list is judged against, in percent. */
  bar: number;
  loading: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  const singles = items.filter((i) => i.row !== null);
  const clears = singles.filter((i) => i.standing === "clears");
  const below = singles.filter((i) => i.standing === "below");
  const first = clears[0] ?? null;
  const list = (rows: readonly Item[]) => rows.map((i) => `${i.name} ${pct(i.share ?? 0)} %`).join(", ");
  const where = [wardName(locale, filters.unit as never), specimenName(locale, filters.site).toLowerCase()].join(" · ");
  return (
    <section className="dr-answer" aria-label={t(locale, "drAnswerLabel")} aria-busy={loading || undefined}>
      <p className="dr-answer-case">
        {t(locale, "drAnswerCase", { where })}
        <button type="button" className="dr-answer-change" aria-expanded={editing} onClick={onEdit}>
          {t(locale, editing ? "drAnswerDone" : "drAnswerChange")}
        </button>
      </p>
      {loading ? (
        <p className="dr-answer-head">…</p>
      ) : first ? (
        <>
          <p className="dr-answer-head">
            {t(locale, "drAnswerStart", { name: first.name, share: pct(first.share ?? 0), n: num(locale, first.n) })}
          </p>
          {clears.length > 1 ? <p className="dr-answer-line">{t(locale, "drAnswerAlso", { bar, list: list(clears.slice(1)) })}</p> : null}
          {below.length ? <p className="dr-answer-line dr-answer-low">{t(locale, "drAnswerBelow", { bar, list: list(below) })}</p> : null}
        </>
      ) : (
        <p className="dr-answer-head">{t(locale, "drAnswerNone", { bar })}</p>
      )}
      <p className="dr-answer-note">{t(locale, "drAnswerNote")}</p>
    </section>
  );
}
