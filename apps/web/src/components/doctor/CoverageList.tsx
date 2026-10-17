import type { CoverageResponse } from "@aei/contract";
import { antibioticName, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { cloneElement, isValidElement, type ReactNode, useMemo, useRef } from "react";
import "./CoverageList.css";
import { BAR, type DoctorFilters, dmy, num, pct } from "./filters.ts";
import { InfoIcon, Popover } from "./Popover.tsx";
import { PrintSheet } from "./PrintSheet.tsx";
import { type Item, STANDING } from "./reason.ts";
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
}

const SKELETON = [0, 1, 2, 3, 4, 5];

/** Position on the 50-100 % axis, as a percentage of the bar area; values below 50 sit at the left edge. */
const at = (share: number): number => Math.max(0, Math.min(100, (share - 0.5) * 200));

export function itemsOf(data: CoverageResponse, locale: Locale): { singles: Item[]; pairs: Item[] } {
  const singles = data.suggestions.map<Item>((row) => ({
    id: row.antibiotic,
    name: antibioticName(locale, row.antibiotic),
    aware: row.aware,
    standing: row.standing,
    share: row.share,
    interval: row.interval,
    n: row.basis === "spectrum" ? row.coverage.spectrum.counts.known : row.coverage.counts.known,
    row,
    pair: null,
  }));
  const pairs = data.combinationSuggestions.map<Item>((p) => ({
    id: p.antibiotics.join("+"),
    name: p.antibiotics.map((a) => antibioticName(locale, a)).join(" + "),
    aware: null,
    standing: p.standing,
    share: p.coverage.share,
    interval: p.coverage.interval,
    n: p.coverage.counts.known,
    row: null,
    pair: p,
  }));
  return { singles, pairs };
}

/** The forest plot: one row per antibiotic, its 95 % interval against the bar line, one glance per row. */
export function CoverageList({ locale, filters, asOf, status, data, signals, selected, onSelect, onRetry, source }: Props) {
  const headRef = useRef<HTMLElement>(null);
  const bar = BAR[filters.sev];
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const cov = data?.coverage;
  const ready = status === "ready" && data && cov;
  const stale = status === "loading" && data;
  const { singles, pairs } = useMemo(() => (data ? itemsOf(data, locale) : { singles: [], pairs: [] }), [data, locale]);
  const firstBelow = singles.findIndex((s) => s.standing !== "clears");
  const all = [...singles, ...pairs];
  const date = data?.asOf ?? asOf;

  const bestPair = filters.sev === "severe" && !singles.some((s) => s.standing === "clears") ? pairs[0] : null;
  const openPair = () => {
    if (!bestPair) return;
    onSelect(bestPair.id);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(bestPair.id)}"]`);
      row?.scrollIntoView({ block: "nearest" });
    });
  };

  const renderItem = (item: Item) => {
    const st = STANDING[item.standing];
    const assessable = item.standing !== "not assessable" && item.share !== null;
    const isSel = selected === item.id;
    const range = item.interval ? `${pct(item.interval[0])}–${pct(item.interval[1])}` : "";
    return (
      <li key={item.id} className="cl-li">
        <button
          type="button"
          aria-expanded={isSel}
          aria-controls={isSel ? "dr-details" : undefined}
          data-row={item.id}
          className="cl-row"
          data-standing={item.standing}
          data-selected={isSel ? "" : undefined}
          onClick={() => onSelect(isSel ? null : item.id)}
        >
          <span className="cl-name">
            <b title={item.name}>{item.name}</b>
            {item.aware ? (
              <span className="cl-tier" data-tier={item.aware} title={item.aware === "Access" ? "AWaRe Access" : "AWaRe Watch"}>
                {item.aware[0]}
              </span>
            ) : null}
          </span>
          <span className="cl-plot" aria-hidden="true">
            <i className="cl-axis" />
            <i className="cl-tau" style={{ left: `${at(bar / 100)}%` }} />
            {assessable && item.interval ? (
              <i
                className="cl-band"
                style={{ left: `${at(item.interval[0])}%`, width: `max(4px, ${at(item.interval[1]) - at(item.interval[0])}%)` }}
              />
            ) : null}
            {assessable && item.share !== null ? <i className="cl-point" style={{ left: `${at(item.share)}%` }} /> : null}
          </span>
          <span className="cl-num num">
            <span>
              {t(locale, item.row?.basis === "spectrum" ? "drTargetMicrobes" : "drAllGrowing")}{" "}
              <b>{assessable && item.share !== null ? `${pct(item.share)} %` : "–"}</b>
              {item.standing === "borderline" && range ? ` (${range} %)` : ""}
              <span className="cl-n"> · n {num(locale, item.n)}</span>
            </span>
            {item.row?.basis === "spectrum" ? (
              <span className="cl-secondary">
                {t(locale, "drAllGrowing")} {item.row.allOrganisms.share === null ? "–" : `${pct(item.row.allOrganisms.share)} %`}
                <span className="cl-n"> · n {num(locale, item.row.coverage.counts.known)}</span>
              </span>
            ) : null}
          </span>
          <span className="cl-res" data-standing={item.standing} title={t(locale, st.long)}>
            <span className="cl-glyph" aria-hidden="true">
              {st.glyph}
            </span>
            {t(locale, st.short)}
          </span>
          <span className="cl-details">
            {t(locale, "drDetails")} <span aria-hidden="true">{isSel ? "−" : "+"}</span>
          </span>
          {item.standing === "borderline" ? <span className="cl-why">{t(locale, "drBorderlineWhy", { bar })}</span> : null}
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
        <h1 id="dr-list-title">{t(locale, "drCoverage")}</h1>
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
              <p>{t(locale, "drForestInfo", { period: t(locale, filters.period === 365 ? "drPeriodYear" : "drPeriodMonth") })}</p>
              {ready && filters.sex !== "any" && !cov.sexApplied ? <p>{t(locale, "drSexDropped")}</p> : null}
              <p>{t(locale, "drFoot", { mild: BAR.mild, severe: BAR.severe })}</p>
            </>
          }
        >
          <InfoIcon />
        </Popover>
      </header>

      <div className="cl-disclosure">
        <p>{t(locale, "drDemo")}</p>
        <p>{t(locale, "drDecisionSupport")}</p>
        {source}
      </div>
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
              {bestPair.interval ? ` · ${t(locale, "drInterval")}: ${pct(bestPair.interval[0])}–${pct(bestPair.interval[1])} %` : ""}
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

      {data && cov && all.length === 0 ? (
        <p className="cl-state">{t(locale, "drEmpty", { site: site.toLowerCase(), date: dmy(data.asOf) })}</p>
      ) : null}

      {data && cov && all.length > 0 ? (
        <div className="cl-scroll">
          <div className="cl-cols" aria-hidden="true">
            <span>{t(locale, "drAntibioticCol")}</span>
            <span className="cl-axis-head">
              <b className="cl-tau-label" style={{ left: `${at(bar / 100)}%` }}>
                {t(locale, "drBarName", { bar })}
              </b>
            </span>
            <span className="cl-r">{t(locale, "drCovers")}</span>
            <span>{t(locale, "drStandingCol")}</span>
          </div>
          <ul className="cl-rows" aria-label={t(locale, "drCoverage")}>
            {renderGroup(singles, firstBelow, t(locale, "drBelowDivider", { bar }))}
            {pairs.length > 0 ? renderGroup(pairs, 0, t(locale, "drTwoTogether")) : null}
          </ul>
        </div>
      ) : null}
      {data && cov ? (
        <PrintSheet locale={locale} filters={filters} data={data} asOf={asOf} signals={signals} singles={singles} pairs={pairs} />
      ) : null}
    </section>
  );
}

/** The divider belongs to the first row below the bar rather than adding a fake list item. */
function ListFragment({ divider, children }: { divider: string | null; children: ReactNode }) {
  if (divider && isValidElement<{ "data-divider"?: string }>(children)) return cloneElement(children, { "data-divider": divider });
  return <>{children}</>;
}
