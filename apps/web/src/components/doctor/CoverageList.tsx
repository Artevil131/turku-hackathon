import type { CoverageResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import { antibioticName, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { cloneElement, isValidElement, type KeyboardEvent, type ReactNode, useMemo, useRef } from "react";
import "./CoverageList.css";
import { BAR, type DoctorFilters, dmy, num, pct } from "./filters.ts";
import { InfoIcon, Popover } from "./Popover.tsx";
import { PrintSheet } from "./PrintSheet.tsx";
import { flagsOf, type Item, reasonOf, STANDING } from "./reason.ts";
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
}

const SKELETON = [0, 1, 2, 3, 4, 5];
const TICKS = [50, 60, 70, 80, 90, 100];

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
export function CoverageList({ locale, filters, asOf, status, data, signals, selected, onSelect, onRetry }: Props) {
  const headRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const bar = BAR[filters.sev];
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const cov = data?.coverage;
  const ready = status === "ready" && data && cov;
  const stale = status === "loading" && data;
  const { singles, pairs } = useMemo(() => (data ? itemsOf(data, locale) : { singles: [], pairs: [] }), [data, locale]);
  const firstBelow = singles.findIndex((s) => s.standing !== "clears");
  const all = [...singles, ...pairs];
  const focusId = selected && all.some((i) => i.id === selected) ? selected : (all[0]?.id ?? null);
  const date = data?.asOf ?? asOf;

  const ageChosen = filters.age !== "any";
  const notApplied =
    ageChosen && filters.onset ? "drNotAppliedBoth" : ageChosen ? "drNotAppliedAge" : filters.onset ? "drNotAppliedDay3" : null;

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const opts = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []);
    const i = opts.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const last = opts.length - 1;
    const next = e.key === "ArrowDown" ? Math.min(last, i + 1) : e.key === "ArrowUp" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : last;
    opts[next]?.focus();
  };

  const whyOf = (item: Item): ReactNode => {
    if (!data) return null;
    if (item.row) {
      const flags = flagsOf(item.row);
      return (
        <>
          <p>{reasonOf(locale, item.row, data, filters)}</p>
          {flags.notCovering.map((o) => (
            <p key={`n${o.organism}`}>
              <span aria-hidden="true">⊘</span> {t(locale, "drNotFor", { organism: shortOrganism(o.organism), share: pct(o.share) })}
            </p>
          ))}
          {flags.untested.map((o) => (
            <p key={`u${o.organism}`}>
              <span aria-hidden="true">?</span> {t(locale, "drUntestedOn", { organism: shortOrganism(o.organism), share: pct(o.share) })}
            </p>
          ))}
        </>
      );
    }
    const gain = Math.round((item.pair?.gain ?? 0) * 100);
    return (
      <p>
        {t(locale, gain === 1 ? "drGainOne" : "drGain", { gain })} · {t(locale, "drAccessCount", { n: item.pair?.access ?? 0 })}
      </p>
    );
  };

  const renderItem = (item: Item) => {
    const st = STANDING[item.standing];
    const assessable = item.standing !== "not assessable" && item.share !== null;
    const isSel = selected === item.id;
    const range = item.interval ? `${pct(item.interval[0])}–${pct(item.interval[1])}` : "";
    return (
      <li key={item.id} className="cl-li" role="presentation">
        <div
          role="option"
          tabIndex={focusId === item.id ? 0 : -1}
          aria-selected={isSel}
          data-row={item.id}
          className="cl-row"
          data-standing={item.standing}
          data-selected={isSel ? "" : undefined}
          onClick={() => onSelect(isSel ? null : item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(isSel ? null : item.id);
            }
          }}
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
          <span className="cl-num num" title={range ? `95 %: ${range}` : undefined}>
            {assessable && item.share !== null ? <b>{pct(item.share)} %</b> : null}
            {assessable ? <span className="cl-dot"> · </span> : null}
            <span className="cl-n">n {num(locale, item.n)}</span>
          </span>
          <span className="cl-res" data-standing={item.standing} title={t(locale, st.long)}>
            <span className="cl-glyph" aria-hidden="true">
              {st.glyph}
            </span>
            {t(locale, st.short)}
          </span>
        </div>
        <Popover className="info-btn cl-info" label={`${t(locale, "drInfo")}: ${item.name}`} content={whyOf(item)}>
          <InfoIcon />
        </Popover>
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
              {notApplied ? <p>{t(locale, notApplied)}</p> : null}
              {ready && filters.sex !== "any" && !cov.sexApplied ? <p>{t(locale, "drSexDropped")}</p> : null}
              <p>{t(locale, "drFoot", { mild: BAR.mild, severe: BAR.severe })}</p>
            </>
          }
        >
          <InfoIcon />
        </Popover>
      </header>

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
              {TICKS.map((v) =>
                v === bar ? (
                  <b key={v} className="cl-tau-label" style={{ left: `${at(v / 100)}%` }}>
                    {t(locale, "drBarName", { bar })}
                  </b>
                ) : (
                  <span key={v} style={{ left: `${at(v / 100)}%` }}>
                    {v}
                  </span>
                ),
              )}
            </span>
            <span className="cl-r">{t(locale, "drCovers")}</span>
            <span>{t(locale, "drStandingCol")}</span>
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox of rows with arrow-key movement */}
          <ul className="cl-rows" role="listbox" aria-label={t(locale, "drCoverage")} ref={listRef} onKeyDown={onKeyDown}>
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

/** The bar's divider is drawn on the first row below it (data-divider), so the listbox holds only options. */
function ListFragment({ divider, children }: { divider: string | null; children: ReactNode }) {
  if (divider && isValidElement<{ "data-divider"?: string }>(children)) return cloneElement(children, { "data-divider": divider });
  return <>{children}</>;
}
