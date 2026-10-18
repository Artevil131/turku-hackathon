import type { CoverageResponse, PatientFindingsResponse } from "@aei/contract";
import type { Syndrome } from "@aei/guideline";
import { antibioticName, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { cloneElement, isValidElement, memo, type ReactNode, useMemo, useRef } from "react";
import "./CoverageList.css";
import { BAR, type Basis, barOf, basisFor, type DoctorFilters, dmy, droppedFilters, num, pct, periodName } from "./filters.ts";
import { GuideSummary, guideCodes } from "./Guide.tsx";
import { priorText, withPrior } from "./Patient.tsx";
import { InfoIcon, Popover } from "./Popover.tsx";
import { PrintSheet } from "./PrintSheet.tsx";
import { type Item, nothingAssessable, STANDING, standingOn } from "./reason.ts";
import type { UnitSignal } from "./signals.ts";

export type ListStatus = "loading" | "error" | "ready";

interface Props {
  locale: Locale;
  filters: DoctorFilters;
  asOf: string | null;
  status: ListStatus;
  data: CoverageResponse | null;
  signals: UnitSignal[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onRetry: () => void;
  source?: ReactNode;
  /** The guide's syndrome (D-047): marks its first choices and adds its line under the header; never reorders. */
  syndrome?: Syndrome | null;
  /** The patient's findings (D-050): affected rows are annotated and placed below the unaffected of their standing. */
  patient?: PatientFindingsResponse | null;
  /** The timeframe control and the comparison under it (D-082). */
  compare?: ReactNode;
  /** The doctor chose what the figures are counted on; without it the toggle is not drawn. */
  onJudge?: (basis: Basis) => void;
}

const SKELETON = [0, 1, 2, 3, 4, 5];

/** The window a figure covers, in a word or two: "year", "90 days", "4 wk". */
export const span = (locale: Locale, period: DoctorFilters["period"]) =>
  period === 365 ? t(locale, "drFigYear") : period === 28 ? t(locale, "drFigRecent") : t(locale, "drPeriodDays", { days: period });

/** Position on the 50-100 % axis, as a percentage of the bar area; values below 50 sit at the left edge. */
const at = (share: number): number => Math.max(0, Math.min(100, (share - 0.5) * 200));

export function itemsOf(
  data: CoverageResponse,
  locale: Locale,
  patient?: PatientFindingsResponse | null,
): { singles: Item[]; pairs: Item[] } {
  const singles = data.suggestions.map<Item>((row) => ({
    id: row.antibiotic,
    name: antibioticName(locale, row.antibiotic),
    standing: row.standing,
    share: row.share,
    interval: row.interval,
    n: row.basis === "spectrum" ? row.coverage.spectrum.counts.known : row.coverage.counts.known,
    row,
    pair: null,
    recent: row.coverage.recent,
  }));
  const pairs = data.combinationSuggestions.map<Item>((p) => ({
    id: p.antibiotics.join("+"),
    name: p.antibiotics.map((a) => antibioticName(locale, a)).join(" + "),
    standing: p.standing,
    share: p.coverage.share,
    interval: p.coverage.interval,
    n: p.coverage.counts.known,
    row: null,
    pair: p,
    recent: null,
  }));
  return withPrior(singles, pairs, patient);
}

/** The forest plot: one row per antibiotic, its 95 % interval against the bar line, one glance per row. */
export const CoverageList = memo(function CoverageList({
  locale,
  filters,
  asOf,
  status,
  data,
  signals,
  selected,
  onSelect,
  onRetry,
  source,
  syndrome,
  patient,
  compare,
  onJudge,
}: Props) {
  const headRef = useRef<HTMLElement>(null);
  const bar = barOf(data, filters);
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const cov = data?.coverage;
  const ready = status === "ready" && data && cov;
  const stale = status === "loading" && data;
  const { singles, pairs } = useMemo(() => (data ? itemsOf(data, locale, patient) : { singles: [], pairs: [] }), [data, locale, patient]);
  const firstBelow = singles.findIndex((s) => s.standing !== "clears");
  const all = [...singles, ...pairs];
  // No isolates, or nothing with enough results: the empty-state sentence, not a list of dashes.
  const empty = !!cov && nothingAssessable(all, cov.isolates);
  const date = data?.asOf ?? asOf;
  const guided = useMemo(() => guideCodes(syndrome), [syndrome]);
  // The figure, the tick and its colour follow the doctor's choice (the same rule applied to the shown basis,
  // `standingOn`); the order and the below-the-bar divider stay on what the server judged (own spectrum for mild,
  // everything for severe), so the divider is drawn only on that basis.
  const judged = basisFor(filters.sev);
  const view: Basis = filters.judge ?? judged;
  const basisName = (b: Basis) => t(locale, b === "own" ? "drJudgeOwn" : "drJudgeAll");

  const bestPair = filters.sev === "severe" && !singles.some((s) => s.standing === "clears") ? pairs[0] : null;
  const openPair = () => {
    if (!bestPair) return;
    onSelect(bestPair.id);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(bestPair.id)}"]`);
      row?.scrollIntoView({ block: "nearest" });
    });
  };

  // The level only when it is not the unit's own data; the year itself is the figure's label.
  const meta = cov && cov.level !== "unit" ? t(locale, cov.level === "ward type" ? "drLevelWardTypeShort" : "drLevelHospitalShort") : null;

  const renderItem = (item: Item) => {
    const standing = standingOn(item, view, bar);
    const st = STANDING[standing];
    // A single antibiotic has both bases; a combination only the one over everything that grew.
    const c = item.row ? (view === "own" ? item.row.coverage.spectrum : item.row.coverage) : null;
    const share = c ? c.share : item.share;
    const interval = c ? c.interval : item.interval;
    const assessable = standing !== "not assessable" && share !== null;
    const isSel = selected === item.id;
    return (
      <li key={item.id} className="cl-li">
        <button
          type="button"
          aria-expanded={isSel}
          aria-controls={isSel ? "dr-details" : undefined}
          data-row={item.id}
          className="cl-row"
          data-standing={standing}
          data-selected={isSel ? "" : undefined}
          onClick={() => onSelect(isSel ? null : item.id)}
        >
          <span className="cl-name">
            <b title={item.name}>{item.name}</b>
            {guided.has(item.id) ? <span className="cl-guide">{t(locale, "drGuideMark")}</span> : null}
          </span>
          <span className="cl-plot" aria-hidden="true">
            <i className="cl-axis" />
            <i className="cl-tau" style={{ left: `${at(bar / 100)}%` }} />
            {assessable && interval ? (
              <i className="cl-band" style={{ left: `${at(interval[0])}%`, width: `max(4px, ${at(interval[1]) - at(interval[0])}%)` }} />
            ) : null}
            {assessable && share !== null ? <i className="cl-point" style={{ left: `${at(share)}%` }} /> : null}
          </span>
          <span className="cl-num num">
            {/* One figure at full size, the year on the chosen basis, and under it the unit's last four weeks as a count
                (D-023; no flag between them, D-044). Every other number is in the details. */}
            <span className="cl-fig">
              <b>{assessable && share !== null ? `${pct(share)}\u00a0%` : "–"}</b>
              <span className="visually-hidden">
                {" "}
                {t(locale, item.row && view === "own" ? "drWithinSpectrum" : "drAllOrgShort")} · {span(locale, filters.period)}
              </span>
            </span>
            <small className="cl-recent" title={t(locale, "drRecentContext")}>
              {t(locale, "drLast4")} <span className="visually-hidden">({t(locale, "drAllOrgShort")}) </span>
              {item.recent && item.recent.known > 0 ? `${num(locale, item.recent.covered)} / ${num(locale, item.recent.known)}` : "—"}
            </small>
            {meta ? <span className="cl-secondary cl-basis">{meta}</span> : null}
          </span>
          <span className="cl-res" data-standing={standing} title={t(locale, st.long)}>
            <span className="cl-glyph" aria-hidden="true">
              {st.glyph}
            </span>
            <span className="visually-hidden">{t(locale, st.long)}</span>
          </span>
          <span className="cl-details">
            {t(locale, "drDetails")} <span aria-hidden="true">{isSel ? "−" : "+"}</span>
          </span>
          {item.prior ? <span className="cl-prior">{priorText(locale, item.prior)}</span> : null}
        </button>
      </li>
    );
  };

  const renderGroup = (items: Item[], dividerAt: number, divider: string | null) =>
    items.map((item, i) => (
      <ListFragment key={item.id} divider={i === dividerAt ? divider : null}>
        {renderItem(item)}
      </ListFragment>
    ));

  return (
    <section
      id="dr-list"
      className="cl dp-panel"
      aria-labelledby="dr-list-title"
      aria-busy={status === "loading"}
      data-stale={stale ? "" : undefined}
      tabIndex={-1}
    >
      <header className="cl-head" ref={headRef} tabIndex={-1}>
        <h2 id="dr-list-title">{t(locale, "drCoverage")}</h2>
        {date ? <span className="cl-date num">{dmy(date)}</span> : null}
        <span className="cl-where">
          {unit} · {site}
        </span>
        <span className="cl-status" role="status">
          {status === "loading" ? t(locale, "drLoading", { unit }) : null}
        </span>
        <Popover
          className="info-btn"
          label={t(locale, "drInfo")}
          content={
            <>
              <p>{t(locale, "drForestInfo", { period: periodName(locale, filters.period) })}</p>
              <p>{t(locale, "drRecentContext")}</p>
              {ready ? droppedFilters(filters, cov).map((d) => <p key={d.long}>{t(locale, d.long, { bar })}</p>) : null}
              <p>
                {t(locale, "drFoot", { mild: BAR.mild, severe: BAR.severe })} {t(locale, "drFootOnset", { bar: BAR.severe })}
              </p>
            </>
          }
        >
          <InfoIcon />
        </Popover>
      </header>
      {compare}
      {data && cov ? <GuideSummary locale={locale} syndrome={syndrome} singles={singles} bar={bar} /> : null}

      {/* The one disclaimer is in the answer card above; the data checks stay one click away. */}
      <details className="cl-checks">
        <summary>{t(locale, "drChecks")}</summary>
        {source}
      </details>
      {bestPair && status === "ready" ? (
        <div className="cl-pair-summary">
          <p>{t(locale, "drNoSingle")}</p>
          <button type="button" onClick={openPair}>
            {t(locale, "drBestPair", {
              name: bestPair.name,
              share: bestPair.share === null ? "–" : pct(bestPair.share),
              n: num(locale, bestPair.n),
            })}
          </button>
          {bestPair.standing !== "clears" ? (
            <p>
              {t(locale, STANDING[bestPair.standing].long)}
              {bestPair.interval ? ` · ${t(locale, "drInterval")}: ${pct(bestPair.interval[0])}–${pct(bestPair.interval[1])}\u00a0%` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {status === "error" && !data ? (
        <div className="cl-state" role="alert">
          <p>{t(locale, "drError")}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              headRef.current?.focus();
              onRetry();
            }}
          >
            {t(locale, "drRetry")}
          </button>
        </div>
      ) : null}

      {status === "loading" && !data ? (
        <ul className="cl-skeleton" aria-hidden="true" data-busy="">
          {SKELETON.map((i) => (
            <li key={i} />
          ))}
        </ul>
      ) : null}

      {data && cov && empty ? <p className="cl-state">{t(locale, "drEmpty", { site: site.toLowerCase(), date: dmy(data.asOf) })}</p> : null}

      {data && cov && !empty ? (
        <>
          {singles.length > 0 && onJudge ? (
            <div className="cl-judge">
              <span id="cl-judge-label">{t(locale, "drJudgeOn")}</span>
              <div className="cl-judge-seg" role="group" aria-labelledby="cl-judge-label">
                {(["own", "all"] as const).map((b) => (
                  <button key={b} type="button" aria-pressed={view === b} onClick={() => onJudge(b)}>
                    {basisName(b)}
                  </button>
                ))}
              </div>
              {view !== judged ? <span className="cl-judge-note">{t(locale, "drJudgeNote", { basis: basisName(judged) })}</span> : null}
            </div>
          ) : null}
          <div className="cl-scroll">
            <div className="cl-cols" aria-hidden="true">
              <span>{t(locale, "drAntibioticCol")}</span>
              <span className="cl-axis-head">
                <b className="cl-tau-label" style={{ left: `${at(bar / 100)}%` }}>
                  {t(locale, "drBarName", { bar })}
                </b>
              </span>
              <span className="cl-r" title={t(locale, "drRecentContext")}>
                {t(locale, "drCovers")}
              </span>
              <span>{t(locale, "drStandingCol")}</span>
            </div>
            <ul className="cl-rows" aria-label={t(locale, "drCoverage")}>
              {renderGroup(singles, view === judged ? firstBelow : -1, t(locale, "drBelowDivider", { bar }))}
              {pairs.length > 0 ? renderGroup(pairs, 0, t(locale, "drTwoTogether")) : null}
            </ul>
            <p className="cl-note">{t(locale, "drListNote")}</p>
          </div>
        </>
      ) : null}
      {data && cov ? (
        <PrintSheet
          locale={locale}
          filters={filters}
          data={data}
          asOf={asOf}
          signals={signals}
          singles={singles}
          pairs={pairs}
          syndrome={syndrome ?? null}
          patient={patient ?? null}
        />
      ) : null}
    </section>
  );
});

/** The divider belongs to the first row below the bar rather than adding a fake list item. */
function ListFragment({ divider, children }: { divider: string | null; children: ReactNode }) {
  if (divider && isValidElement<{ "data-divider"?: string }>(children)) return cloneElement(children, { "data-divider": divider });
  return <>{children}</>;
}
