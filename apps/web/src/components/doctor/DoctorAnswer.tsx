import { formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { type DoctorFilters, dmy, num, pct, periodDuring } from "./filters.ts";
import { type Item, nothingAssessable } from "./reason.ts";

// The top of the coverage window, before any control: the antibiotic with the highest coverage among those that clear
// the bar, then the others in rows of one shape (name, share, n). The list below is the evidence. It supports the
// decision, it does not make it (AUDIENCE.md): no imperative, and the figure carries the interval the standing uses.

/** The drugs of one standing as pills: the name, then its share and the n behind it. */
function Pills({ items, lead, muted, locale }: { items: readonly Item[]; lead: string; muted?: boolean; locale: Locale }) {
  return (
    <div className={`dr-answer-pills${muted ? " dr-answer-low" : ""}`}>
      <span className="dr-answer-pills-lead">{lead}</span>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.name} <b>{pct(i.share ?? 0)}&nbsp;%</b> · n&nbsp;{num(locale, i.n)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A message with `{name}` (sent as U+0000) replaced by the name in a span, green only for a standing that clears. */
function withName(text: string, name: string, good: boolean) {
  return text.split("\u0000").flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key="name" className={good ? "dr-good" : undefined}>
            {name}
          </span>,
          part,
        ],
  );
}

/** "Covers 97 % (95 % CI 94–99) of 212 first isolates …": the share, the Wilson interval the standing rests on, and n. */
function coversLine(locale: Locale, item: Item, period: string): string {
  const params = {
    share: pct(item.share ?? 0),
    lo: item.interval ? pct(item.interval[0]) : "–",
    hi: item.interval ? pct(item.interval[1]) : "–",
    n: num(locale, item.n),
    period,
  };
  if (item.pair) return t(locale, "drAnswerPairCovers", params);
  return t(locale, item.row?.basis === "spectrum" ? "drAnswerCoversSpectrum" : "drAnswerCoversAll", params);
}

/** The clearing drugs the patient's earlier finding defeats and that would have headed the answer, grouped by phenotype. */
function skippedLine(locale: Locale, skipped: readonly Item[]): string | null {
  if (skipped.length === 0) return null;
  const byPhenotype = new Map<string, string[]>();
  for (const i of skipped) {
    if (!i.prior) continue;
    const ph = phenotypeName(i.prior.phenotype);
    byPhenotype.set(ph, [...(byPhenotype.get(ph) ?? []), i.name]);
  }
  return [...byPhenotype].map(([phenotype, names]) => t(locale, "drAnswerSkipped", { names: names.join(", "), phenotype })).join("; ");
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
  const allClears = singles.filter((i) => i.standing === "clears");
  // A drug the patient's own earlier finding makes resistant (D-050, D-052) never heads the answer or its pills.
  const clears = allClears.filter((i) => !i.prior);
  const below = singles.filter((i) => i.standing === "below");
  const first = clears[0] ?? null;
  // The server orders clearing drugs by share; a defeated drug with at least the headline's share would have headed it.
  const skipped = allClears.filter((i) => i.prior && (!first || (i.share ?? 0) >= (first.share ?? 0)));
  const skipNote = skippedLine(locale, skipped);
  // No single drug clears: the first ranked combination takes the headline, unless the patient's finding defeats it.
  // Only a combination that clears is called one that does; a borderline one is said to be near the bar.
  const pair = !first
    ? (items.find((i) => i.pair !== null && !i.prior && (i.standing === "clears" || i.standing === "borderline")) ?? null)
    : null;
  const empty = !loading && !failed && nothingAssessable(items);
  const period = periodDuring(locale, filters.period);
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
      ) : empty ? (
        <p className="dr-answer-head">
          {t(locale, "drEmpty", { site: specimenName(locale, filters.site).toLowerCase(), date: asOf ? dmy(asOf) : "–" })}
        </p>
      ) : first ? (
        <>
          {skipNote ? <p className="dr-answer-nosingle">{skipNote}</p> : null}
          <p className="dr-answer-head">{withName(t(locale, "drAnswerStart", { name: "\u0000", bar }), first.name, true)}</p>
          <p className="dr-answer-line">{coversLine(locale, first, period)}</p>
          {/* The brief's comparison on one basis, all organisms: the chosen period the ranking rests on and this unit's
              last four weeks, one quiet line (D-023; no flag between the two, D-044). With the four-week period the
              two would say the same thing, so only the first is given. */}
          {first.row ? (
            <p className="dr-answer-compare">
              {t(locale, filters.period === 28 ? "drAnswerAllOrgLineOnly" : "drAnswerAllOrgLine", {
                year: first.row.allOrganisms.share === null ? "–" : `${pct(first.row.allOrganisms.share)}\u00a0%`,
                period,
                recent:
                  first.recent && first.recent.known >= 30
                    ? `${pct(first.recent.covered / first.recent.known)}\u00a0% (${num(locale, first.recent.covered)} / ${num(locale, first.recent.known)})`
                    : first.recent && first.recent.known > 0
                      ? `${num(locale, first.recent.covered)} / ${num(locale, first.recent.known)}`
                      : "—",
              })}
            </p>
          ) : null}
          {/* The rest of the list as pills; the table below has the bars and the details. */}
          {clears.length > 1 ? <Pills locale={locale} items={clears.slice(1)} lead={t(locale, "drAnswerAlsoShort")} /> : null}
          {below.length ? <Pills locale={locale} items={below} lead={t(locale, "drAnswerBelowShort")} muted /> : null}
        </>
      ) : pair ? (
        <>
          {skipNote ? <p className="dr-answer-nosingle">{skipNote}</p> : null}
          <p className="dr-answer-nosingle">{t(locale, pair.standing === "clears" ? "drAnswerNoSingle" : "drAnswerPairNear", { bar })}</p>
          <p className="dr-answer-head">
            {pair.standing === "clears"
              ? withName(t(locale, "drAnswerStart", { name: "\u0000", bar }), pair.name, true)
              : withName(t(locale, "drAnswerNearHead", { name: "\u0000", bar }), pair.name, false)}
          </p>
          <p className="dr-answer-line">{coversLine(locale, pair, period)}</p>
        </>
      ) : skipNote ? (
        <>
          <p className="dr-answer-nosingle">{skipNote}</p>
          <p className="dr-answer-head">{t(locale, "drAnswerAllDefeated", { bar })}</p>
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
          {" · "}
          <a className="dr-answer-pivot" href={`#project?unit=${encodeURIComponent(filters.unit)}`}>
            {t(locale, "drAnswerBoard")}
          </a>
        </p>
      ) : null}
      <p className="dr-answer-note">{t(locale, "drAnswerNote")}</p>
    </section>
  );
}
