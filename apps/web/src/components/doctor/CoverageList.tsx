import type { CoverageResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import { antibioticName, formatDate, type Locale, type MessageKey, specimenName, t, wardName } from "@aei/i18n";
import { useState } from "react";
import { AsOf } from "../AsOf.tsx";
import { AlertTri } from "../Icons.tsx";
import "./CoverageList.css";
import { BAR, certaintyOf, type DoctorFilters, halfWidth, pct, type Row, rowN } from "./filters.ts";
import { signalDate, type UnitSignal } from "./signals.ts";

export type ListStatus = "loading" | "error" | "ready";

interface Props {
  locale: Locale;
  filters: DoctorFilters;
  asOf: string | null;
  status: ListStatus;
  data: CoverageResponse | null;
  signals: UnitSignal[];
  onRetry: () => void;
}

const STANDING: Record<Row["standing"], { key: MessageKey; glyph: string }> = {
  clears: { key: "drStandingClears", glyph: "✓" },
  borderline: { key: "drStandingBorderline", glyph: "≈" },
  below: { key: "drStandingBelow", glyph: "✕" },
  "not assessable": { key: "drStandingNA", glyph: "–" },
};

const LEVEL_KEYS = {
  unit: "drLevelUnitShort",
  "ward type": "drLevelWardTypeShort",
  hospital: "drLevelHospitalShort",
} as const;

const SKELETON = [0, 1, 2, 3];

/** The bar for the interval: a thick band on a 0-100 track, a tick at the bar, a marker at the estimate. */
function IntervalBar({ interval, share, bar }: { interval: [number, number] | null; share: number | null; bar: number }) {
  return (
    <span className="cl-track" aria-hidden="true">
      <i className="cl-tick" style={{ left: `${bar}%` }} />
      {interval ? (
        <i className="cl-band" style={{ left: `${interval[0] * 100}%`, width: `max(4px, ${(interval[1] - interval[0]) * 100}%)` }} />
      ) : null}
      {share !== null ? <i className="cl-point" style={{ left: `${share * 100}%` }} /> : null}
    </span>
  );
}

export function CoverageList({ locale, filters, asOf, status, data, signals, onRetry }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const bar = BAR[filters.sev];
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const cov = data?.coverage;
  const level = cov ? certaintyOf(cov.level) : null;
  const unitSignalsHere = signals.slice(0, 2);
  const firstBelow = data ? data.suggestions.findIndex((s) => s.standing !== "clears") : -1;
  const accessClears = data?.suggestions.some((s) => s.standing === "clears" && s.aware === "Access") ?? false;
  const ready = status === "ready" && data && cov;
  const stale = status === "loading" && data;

  const reasonOf = (row: Row): string => {
    const lo = row.interval ? pct(row.interval[0]) : 0;
    const hi = row.interval ? pct(row.interval[1]) : 0;
    if (row.standing === "clears") {
      const base = t(locale, "drReasonClears", {
        bar,
        n: rowN(row),
        specimen: site.toLowerCase(),
        level: t(locale, LEVEL_KEYS[cov?.level ?? "unit"]),
        from: cov ? formatDate(locale, cov.from, "long") : "",
        tier: row.aware,
      });
      return row.aware === "Watch" && accessClears ? `${base}; ${t(locale, "drAfterAccess")}` : base;
    }
    if (row.standing === "borderline") return t(locale, "drReasonBorderline", { lo, hi, bar });
    if (row.standing === "below") return t(locale, "drReasonBelow", { share: pct(row.share ?? 0), bar });
    const untested = row.coverage.untested.reduce((s, u) => s + u.share, 0);
    return row.share === null ? t(locale, "drReasonFew") : t(locale, "drReasonUntested", { pct: pct(untested) });
  };

  // Organisms a row leaves out, as text: only the ones that are a real share of the pool.
  const flagsOf = (row: Row) => {
    const notCovering = row.coverage.notCovering.filter((o) => o.share >= 0.05);
    const untested = row.standing === "not assessable" ? [] : row.coverage.untested.filter((o) => o.share >= 0.05);
    return { notCovering, untested };
  };

  const renderRow = (row: Row) => {
    const id = row.antibiotic;
    const isOpen = open === id;
    const st = STANDING[row.standing];
    const flags = flagsOf(row);
    const n = rowN(row);
    const hidden = Math.max(0, flags.notCovering.length - 2) + Math.max(0, flags.untested.length - 2);
    const w = halfWidth(row.interval);
    const rowSignals = signals.filter((s) => "antibiotic" in s.alert && s.alert.antibiotic === row.antibiotic);
    const c = row.coverage;
    return (
      <li key={id} className="cl-row" data-standing={row.standing} data-open={isOpen}>
        <button
          type="button"
          className="cl-main"
          aria-expanded={isOpen}
          aria-controls={`cl-detail-${id}`}
          onClick={() => setOpen(isOpen ? null : id)}
        >
          <span className="cl-name">
            <b>{antibioticName(locale, row.antibiotic)}</b>
            <span className="cl-tier" data-tier={row.aware}>
              {row.aware}
            </span>
          </span>
          <span className="cl-cov">
            <b className="num">{row.share === null ? "–" : `${pct(row.share)} %`}</b>
            <small className="num">{t(locale, "drN", { n })}</small>
          </span>
          <span className="cl-barcell">
            <IntervalBar interval={row.interval} share={row.share} bar={bar} />
            <small className="num">
              {row.interval ? t(locale, "drIntervalText", { lo: pct(row.interval[0]), hi: pct(row.interval[1]) }) : ""}
            </small>
          </span>
          <span className="cl-standing" data-standing={row.standing}>
            <span className="cl-glyph" aria-hidden="true">
              {st.glyph}
            </span>
            {t(locale, st.key)}
          </span>
          <span className="cl-why">{reasonOf(row)}</span>
          <span className="cl-meta">
            {level ? (
              <span className="cl-badge" title={t(locale, level.label)}>
                <span aria-hidden="true">{level.glyph}</span> {t(locale, level.short)}
                {w !== null ? ` · ${t(locale, "drWidth", { w })}` : ""}
              </span>
            ) : null}
            {flags.notCovering.slice(0, 2).map((o) => (
              <span key={`n${o.organism}`} className="cl-flag">
                <span aria-hidden="true">⊘</span> {t(locale, "drNotFor", { organism: shortOrganism(o.organism), share: pct(o.share) })}
              </span>
            ))}
            {flags.untested.slice(0, 2).map((o) => (
              <span key={`u${o.organism}`} className="cl-flag">
                <span aria-hidden="true">?</span> {t(locale, "drUntestedOn", { organism: shortOrganism(o.organism), share: pct(o.share) })}
              </span>
            ))}
            {hidden > 0 ? <span className="cl-flag cl-flag-more">{t(locale, "drMore", { n: hidden })}</span> : null}
            {rowSignals.map((s) => (
              <span key={s.alert.id} className="cl-flag cl-flag-signal">
                <AlertTri /> {t(locale, "drSignalHere", { label: s.label, date: signalDate(locale, s) })}
              </span>
            ))}
          </span>
          <span className="cl-chev" aria-hidden="true">
            {isOpen ? "▴" : "▾"}
          </span>
        </button>
        {isOpen ? (
          <div className="cl-detail" id={`cl-detail-${id}`}>
            <dl>
              <div>
                <dt>{t(locale, "drCovers")}</dt>
                <dd className="num">
                  {t(locale, "drCoveredOf", { covered: row.basis === "spectrum" ? c.spectrum.counts.covered : c.counts.covered, known: n })}
                  <small> {row.basis === "spectrum" ? t(locale, "drBasisSpectrum") : t(locale, "drBasisAll")}</small>
                </dd>
              </div>
              <div>
                <dt>{t(locale, "drCertaintyCol")}</dt>
                <dd>{level ? `${level.glyph} ${t(locale, level.label)}` : ""}</dd>
              </div>
              {row.basis === "spectrum" ? (
                <div>
                  <dt>{t(locale, "drCovers")}</dt>
                  <dd className="num">
                    {t(locale, "drAllOrganisms", {
                      share: row.allOrganisms.share === null ? "–" : pct(row.allOrganisms.share),
                      lo: row.allOrganisms.interval ? pct(row.allOrganisms.interval[0]) : "–",
                      hi: row.allOrganisms.interval ? pct(row.allOrganisms.interval[1]) : "–",
                      n: c.counts.known,
                    })}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{t(locale, "drLabelRecent")}</dt>
                <dd className="num">{t(locale, "drRecent", { covered: c.recent.covered, known: c.recent.known })}</dd>
              </div>
              <div>
                <dt>{t(locale, "drLabelNewest")}</dt>
                <dd>{asOf ? t(locale, "drResultsTo", { date: formatDate(locale, asOf, "long") }) : ""}</dd>
              </div>
              <div>
                <dt>{t(locale, "drOrgNotCovered")}</dt>
                <dd>
                  {c.notCovering.length ? (
                    <ul className="cl-orgs">
                      {c.notCovering.map((o) => (
                        <li key={o.organism} className="num">
                          <i>{shortOrganism(o.organism)}</i> {pct(o.share)} %
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t(locale, "drOrgNone")
                  )}
                </dd>
              </div>
              <div>
                <dt>{t(locale, "drOrgUntested")}</dt>
                <dd>
                  {c.untested.length ? (
                    <ul className="cl-orgs">
                      {c.untested.map((o) => (
                        <li key={o.organism} className="num">
                          <i>{shortOrganism(o.organism)}</i> {pct(o.share)} %
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t(locale, "drOrgNone")
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section
      id="dr-list"
      className="cl glass ply-2"
      aria-labelledby="dr-list-title"
      aria-busy={status === "loading"}
      data-stale={stale ? "" : undefined}
      tabIndex={-1}
    >
      <header className="cl-head">
        <div className="cl-titleline">
          <h2 id="dr-list-title">{t(locale, "drTitle")}</h2>
          <span className="cl-where">
            {unit} · {site}
          </span>
          {asOf ? <AsOf locale={locale} date={data?.asOf ?? asOf} pending={!!data && data.asOf !== asOf} clockDate={asOf} /> : null}
        </div>
        {ready ? (
          <p className="cl-pool">
            <span className="cl-badge cl-badge-lg">
              <span aria-hidden="true">{level?.glyph}</span> {level ? t(locale, level.label) : ""}
            </span>{" "}
            <span className="num">
              {t(locale, "drPoolLine", {
                n: cov.isolates,
                level: t(locale, LEVEL_KEYS[cov.level]),
                from: formatDate(locale, cov.from, "long"),
              })}
            </span>
          </p>
        ) : (
          <p className="cl-pool" role="status">
            {status === "loading" ? t(locale, "drLoading", { unit }) : null}
          </p>
        )}
        <p className="cl-print-record print-only">
          {unit} · {site} · {filters.sex === "any" ? t(locale, "drSexAny") : filters.sex} ·{" "}
          {t(locale, filters.sev === "mild" ? "drSevMild" : "drSevSevere")} ·{" "}
          {t(locale, filters.period === 365 ? "drPeriodYear" : "drPeriodMonth")}
        </p>
        {filters.age !== "any" || filters.onset ? (
          <p className="cl-note">
            <span className="rs-tag">{t(locale, "drNotApplied")}</span> {t(locale, "drNotAppliedNote")}
          </p>
        ) : null}
        {ready && filters.sex !== "any" && !cov.sexApplied ? <p className="cl-note">{t(locale, "drSexDropped")}</p> : null}
        {unitSignalsHere.map((s) => (
          <p key={s.alert.id} className="cl-note cl-note-signal">
            <AlertTri />{" "}
            {s.feeder
              ? t(locale, "drSignalFeeder", { unit: wardName(locale, s.feeder), label: s.label, date: signalDate(locale, s) })
              : t(locale, "drSignalHere", { label: s.label, date: signalDate(locale, s) })}
          </p>
        ))}
      </header>

      {status === "error" && !data ? (
        <div className="cl-state" role="alert">
          <p>{t(locale, "drError")}</p>
          <button type="button" className="btn" onClick={onRetry}>
            {t(locale, "drRetry")}
          </button>
        </div>
      ) : null}

      {status === "loading" && !data ? (
        <ul className="cl-skeleton" aria-hidden="true">
          {SKELETON.map((i) => (
            <li key={i} />
          ))}
        </ul>
      ) : null}

      {data && cov && data.suggestions.length === 0 ? (
        <p className="cl-state">{t(locale, "drEmpty", { site: site.toLowerCase(), date: formatDate(locale, data.asOf, "long") })}</p>
      ) : null}

      {data && cov && data.suggestions.length > 0 ? (
        <>
          <div className="cl-cols" aria-hidden="true">
            <span>{t(locale, "drAntibioticCol")}</span>
            <span>{t(locale, "drCovers")}</span>
            <span>
              {t(locale, "drInterval")} · <span className="cl-barkey">{t(locale, "drBarLegend", { bar })}</span>
            </span>
            <span>{t(locale, "drStandingCol")}</span>
          </div>
          <ul className="cl-rows">
            {data.suggestions.map((row, i) => (
              <RowWithDivider key={row.antibiotic} divider={i === firstBelow ? t(locale, "drBelowDivider", { bar }) : null}>
                {renderRow(row)}
              </RowWithDivider>
            ))}
          </ul>
          {data.combinationSuggestions.length > 0 ? (
            <>
              <h3 className="cl-pairs-title">{t(locale, "drTwoTogether")}</h3>
              <ul className="cl-rows cl-pairs">
                {data.combinationSuggestions.map((p) => {
                  const st = STANDING[p.standing];
                  const c = p.coverage;
                  return (
                    <li key={p.antibiotics.join("+")} className="cl-row cl-pair" data-standing={p.standing}>
                      <div className="cl-main">
                        <span className="cl-name">
                          <b>{p.antibiotics.map((a) => antibioticName(locale, a)).join(" + ")}</b>
                        </span>
                        <span className="cl-cov">
                          <b className="num">{c.share === null ? "–" : `${pct(c.share)} %`}</b>
                          <small className="num">{t(locale, "drN", { n: c.counts.known })}</small>
                        </span>
                        <span className="cl-barcell">
                          <IntervalBar interval={c.interval} share={c.share} bar={bar} />
                          <small className="num">
                            {c.interval ? t(locale, "drIntervalText", { lo: pct(c.interval[0]), hi: pct(c.interval[1]) }) : ""}
                          </small>
                        </span>
                        <span className="cl-standing" data-standing={p.standing}>
                          <span className="cl-glyph" aria-hidden="true">
                            {st.glyph}
                          </span>
                          {t(locale, st.key)}
                        </span>
                        <span className="cl-why">
                          {t(locale, "drGain", { gain: Math.round(p.gain * 100) })} · {t(locale, "drAccessCount", { n: p.access })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      <footer className="cl-foot">
        <p>{t(locale, "drFoot")}</p>
        {asOf ? <p className="print-only">{t(locale, "drPrinted", { date: formatDate(locale, asOf, "long") })}</p> : null}
      </footer>
    </section>
  );
}

function RowWithDivider({ divider, children }: { divider: string | null; children: React.ReactNode }) {
  return (
    <>
      {divider ? (
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the spec asks for a list separator inside the ranked list
        <li role="separator" className="cl-divider">
          <span>{divider}</span>
        </li>
      ) : null}
      {children}
    </>
  );
}
