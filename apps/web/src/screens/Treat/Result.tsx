import { useId, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_COVERAGE, EVERY_UNIT, monthly } from "../../engine/coverage.ts";
import type { Catalog, CoverageResult, DrugFigure, PatientQuery, Share } from "../../engine/types.ts";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { formatDate, formatMonth, formatNumber, formatShare, t, type Locale } from "../../i18n/index.ts";
import {
  AwareBadge,
  Card,
  Disclosure,
  EmptyState,
  Icon,
  Org,
  ShareBar,
  Sparkline,
  antibioticName,
  onsetLabel,
  sexLabel,
  specimenName,
  unitName,
} from "../../ui/index.ts";
import { capFirst, coverGap, reliable, STRONG_SHARE } from "./model.ts";
import { coverText, drugName, figText, MONTHS, WEEKS, widenedText } from "./text.tsx";

// The answer: what it rests on, the top match, then every other antibiotic.

export function ResultView({
  locale,
  meta,
  results,
  asOf,
  catalog,
  asked,
  cov,
  rank,
  min,
  onClearDetails,
  canClear,
  falling,
  onOpenSignal,
  afterTop = null,
}: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  catalog: Catalog;
  asked: PatientQuery;
  cov: CoverageResult;
  rank: "access-first" | "coverage";
  min: number;
  onClearDetails: () => void;
  canClear: boolean;
  /** Antibiotics with an active "working less often" alert here: code -> alert id. */
  falling: ReadonlyMap<string, string>;
  onOpenSignal: (id: string) => void;
  /** Shown right after the best match (phones: this unit's alerts). */
  afterTop?: ReactNode;
}) {
  const top = cov.drugs[0];
  const rest = cov.drugs.slice(1);
  const wardWidened = cov.basis.query.ward === EVERY_UNIT;

  const live = top
    ? top.main.n >= min
      ? t(locale, "treat.live.summary", {
          name: drugName(locale, meta, top.antibiotic),
          percent: formatShare(locale, top.main.works / top.main.n),
        })
      : `${drugName(locale, meta, top.antibiotic)}. ${t(locale, "treat.live.few")}`
    : t(locale, "treat.empty.title");

  return (
    <section className="treat-result" aria-label={t(locale, "treat.result.label")}>
      <p className="u-sr" aria-live="polite" aria-atomic="true">
        {live}
      </p>

      <Basis locale={locale} meta={meta} asked={asked} cov={cov} min={min} />

      {!top ? (
        <Card>
          <EmptyState
            compact
            icon="inbox"
            title={t(locale, "treat.empty.title")}
            body={t(locale, "treat.empty.body", {
              specimen: specimenName(locale, meta, asked.specimen),
              unit: unitName(locale, meta, asked.ward),
            })}
            action={
              canClear ? (
                <button type="button" className="k-btn is-secondary" onClick={onClearDetails}>
                  {t(locale, "treat.empty.clear")}
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <TopMatch
            locale={locale}
            meta={meta}
            cov={cov}
            drug={top}
            min={min}
            wardWidened={wardWidened}
            fallingId={falling.get(top.antibiotic) ?? null}
            onOpenSignal={onOpenSignal}
          />
          {afterTop}
          {rest.length > 0 ? (
            <DrugList
              locale={locale}
              meta={meta}
              results={results}
              asOf={asOf}
              catalog={catalog}
              cov={cov}
              drugs={rest}
              min={min}
              wardWidened={wardWidened}
              rank={rank}
              falling={falling}
            />
          ) : (
            <HowCounted locale={locale} rank={rank} min={min} />
          )}
        </>
      )}
    </section>
  );
}

// ---------- Basis ----------

function Basis({ locale, meta, asked, cov, min }: { locale: Locale; meta: FeedMeta; asked: PatientQuery; cov: CoverageResult; min: number }) {
  const { basis } = cov;
  const q = basis.query;
  const parts: ReactNode[] = [capFirst(specimenName(locale, meta, q.specimen))];
  if (q.organism) parts.push(<Org name={q.organism} />);
  if (q.sex) parts.push(sexLabel(locale, q.sex));
  if (q.age) parts.push(t(locale, q.age === "65plus" ? "treat.age.65plus" : "treat.age.under65"));
  if (q.onset) parts.push(onsetLabel(locale, q.onset));
  parts.push(q.ward === EVERY_UNIT ? t(locale, "common.unit.all") : unitName(locale, meta, q.ward));
  parts.push(
    `${basis.window === "recent" ? t(locale, "treat.basis.recent", { weeks: WEEKS }) : t(locale, "treat.basis.year", { months: MONTHS })}, ${t(
      locale,
      "treat.basis.upTo",
      { date: formatDate(locale, cov.asOf, "long") },
    )}`,
  );

  return (
    <div className="treat-basis">
      <p className="treat-basis-line">
        <strong className="u-num">
          {basis.n === 1 ? t(locale, "treat.basis.leadOne") : t(locale, "treat.basis.lead", { n: formatNumber(locale, basis.n) })}
        </strong>
        {parts.map((p, i) => (
          <span key={i} className="treat-basis-part">
            <span className="treat-basis-dot" aria-hidden="true">
              ·
            </span>{" "}
            {p}
          </span>
        ))}
      </p>
      {basis.widened.length > 0 ? (
        <p className="treat-note is-widened">
          <Icon name="alert-triangle" size={18} />
          <span>{widenedText(locale, meta, asked, q, basis.widened, min)}</span>
        </p>
      ) : null}
      {!basis.enough ? (
        <p className="treat-note is-few">
          <Icon name="info" size={18} />
          <span>{t(locale, "treat.basis.notEnough")}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---------- Change ----------

function Change({ locale, change, long = false }: { locale: Locale; change: number | null; long?: boolean }) {
  if (change === null) return null;
  const vars = { points: formatNumber(locale, Math.abs(change)), weeks: WEEKS, months: MONTHS };
  const full =
    change === 0
      ? t(locale, "treat.change.same", vars)
      : Math.abs(change) === 1
        ? t(locale, change < 0 ? "treat.change.downOne" : "treat.change.upOne", vars)
        : t(locale, change < 0 ? "treat.change.down" : "treat.change.up", vars);
  const glyph = change < 0 ? "▼" : change > 0 ? "▲" : "●";
  const tone = change <= -10 ? "is-drop" : change < 0 ? "is-down" : change > 0 ? "is-up" : "is-same";
  const signed = change > 0 ? `+${formatNumber(locale, change)}` : change < 0 ? `−${formatNumber(locale, -change)}` : formatNumber(locale, 0);
  if (long) {
    return (
      <p className={`treat-change is-long ${tone}`}>
        <span className="treat-change-glyph" aria-hidden="true">
          {glyph}
        </span>
        <span>{full}</span>
      </p>
    );
  }
  return (
    <span className={`treat-change ${tone}`} title={full}>
      <span className="treat-change-glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="u-num" aria-hidden="true">
        {t(locale, Math.abs(change) === 1 ? "treat.change.shortOne" : "treat.change.short", { signed })}
      </span>
      <span className="u-sr">{full}</span>
    </span>
  );
}

// ---------- Figures side by side ----------

function Facts({ locale, items, min }: { locale: Locale; items: { label: string; share: Share }[]; min: number }) {
  return (
    <dl className="treat-facts">
      {items.map((it) => (
        <div key={it.label} className={`treat-fact${it.share.n < min ? " is-few" : ""}`}>
          <dt>{it.label}</dt>
          <dd className="u-num">{figText(locale, it.share, min)}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Top match ----------

function TopMatch({
  locale,
  meta,
  cov,
  drug,
  min,
  wardWidened,
  fallingId,
  onOpenSignal,
}: {
  locale: Locale;
  meta: FeedMeta;
  cov: CoverageResult;
  drug: DrugFigure;
  min: number;
  wardWidened: boolean;
  fallingId: string | null;
  onOpenSignal: (id: string) => void;
}) {
  const gap = coverGap(drug);
  const ok = drug.main.n >= min;
  const name = drugName(locale, meta, drug.antibiotic);
  const other =
    cov.basis.window === "recent"
      ? { label: t(locale, "treat.fig.year", { months: MONTHS }), share: drug.year }
      : { label: t(locale, "treat.fig.recent", { weeks: WEEKS }), share: drug.recent };
  const reason = cov.topReason;
  // Inside a sentence the name stays as the feed writes it (drug names are not capitalised mid-sentence).
  const strongest = reason?.kind === "access-preferred" && reason.strongest ? antibioticName(locale, meta, reason.strongest) : null;
  const strongestShare = reason?.strongestShare;
  const headingId = useId();

  return (
    <article className={`treat-top${ok ? "" : " is-few"}`} aria-labelledby={headingId}>
      <div className="treat-top-eyebrow">
        <span className="treat-top-label">
          {ok ? <Icon name="check" size={16} /> : <Icon name="info" size={16} />}
          {ok ? t(locale, "treat.top.label") : t(locale, "treat.top.labelFew")}
        </span>
        <AwareBadge locale={locale} group={drug.aware} size="md" />
      </div>
      <h2 id={headingId} className="treat-top-name">
        {name}
      </h2>
      <ShareBar
        locale={locale}
        share={drug.main}
        min={min}
        size="lg"
        caption={ok ? t(locale, "treat.top.worked", { works: formatNumber(locale, drug.main.works), n: formatNumber(locale, drug.main.n) }) : undefined}
        reference={wardWidened ? undefined : { share: drug.hospitalYear, label: t(locale, "treat.top.allUnitsRef") }}
      />
      {gap && ok ? (
        <p className="treat-cover">
          <Icon name="info" size={16} />
          <span>{coverText(locale, gap)}</span>
        </p>
      ) : null}
      {fallingId ? (
        <button type="button" className="treat-falling is-button" onClick={() => onOpenSignal(fallingId)}>
          <span aria-hidden="true">▼</span>
          <span>{t(locale, "treat.falling.long")}</span>
          <Icon name="chevron-right" size={16} />
        </button>
      ) : null}
      <Facts locale={locale} min={min} items={[other]} />
      <Change locale={locale} change={drug.change} long />
      {strongest && strongestShare ? (
        <p className="treat-top-access">
          <Icon name="shield" size={18} />
          <span>
            {t(locale, "treat.top.access", {
              strongest,
              share: strongestShare.n >= min ? formatShare(locale, strongestShare.works / strongestShare.n) : figText(locale, strongestShare, min),
            })}
          </span>
        </p>
      ) : null}
      <p className="treat-top-decide">{t(locale, "treat.top.decide")}</p>
    </article>
  );
}

// ---------- The other antibiotics ----------

function DrugList({
  locale,
  meta,
  results,
  asOf,
  catalog,
  cov,
  drugs,
  min,
  wardWidened,
  rank,
  falling,
}: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  catalog: Catalog;
  cov: CoverageResult;
  drugs: readonly DrugFigure[];
  min: number;
  wardWidened: boolean;
  rank: "access-first" | "coverage";
  falling: ReadonlyMap<string, string>;
}) {
  const strong: DrugFigure[] = [];
  const weak: DrugFigure[] = [];
  const few: DrugFigure[] = [];
  for (const d of drugs) {
    const v = reliable(d.main, min);
    if (v === null) few.push(d);
    else if (v >= STRONG_SHARE) strong.push(d);
    else weak.push(d);
  }
  const limit = formatShare(locale, STRONG_SHARE);
  const groups: { key: string; title: string; drugs: DrugFigure[]; tone: "strong" | "weak" | "few" }[] = [
    { key: "strong", title: t(locale, "treat.list.strong", { limit }), drugs: strong, tone: "strong" },
    { key: "weak", title: t(locale, "treat.list.weak", { limit }), drugs: weak, tone: "weak" },
    { key: "few", title: t(locale, "treat.list.few"), drugs: few, tone: "few" },
  ];

  return (
    <Card className="treat-list" title={t(locale, "treat.list.title")} footer={<HowCounted locale={locale} rank={rank} min={min} />}>
      {groups.map((g) =>
        g.drugs.length === 0 ? null : (
          <div key={g.key} className={`treat-group is-${g.tone}`}>
            <h3 className="treat-group-title">{g.title}</h3>
            <ul className="treat-rows">
              {g.drugs.map((d) => (
                <DrugRow
                  key={d.antibiotic}
                  locale={locale}
                  meta={meta}
                  results={results}
                  asOf={asOf}
                  catalog={catalog}
                  query={cov.basis.query}
                  drug={d}
                  min={min}
                  weak={g.tone !== "strong"}
                  wardWidened={wardWidened}
                  falling={falling.has(d.antibiotic)}
                />
              ))}
            </ul>
          </div>
        ),
      )}
    </Card>
  );
}

function DrugRow({
  locale,
  meta,
  results,
  asOf,
  catalog,
  query,
  drug,
  min,
  weak,
  wardWidened,
  falling,
}: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  catalog: Catalog;
  query: PatientQuery;
  drug: DrugFigure;
  min: number;
  weak: boolean;
  wardWidened: boolean;
  falling: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const name = drugName(locale, meta, drug.antibiotic);
  const gap = coverGap(drug);
  const enough = drug.main.n >= min;
  const caption =
    enough && gap ? (
      <span className="treat-row-caption">
        {t(locale, "common.share.works", { works: formatNumber(locale, drug.main.works), n: formatNumber(locale, drug.main.n) })}
        <span aria-hidden="true"> · </span>
        <span className="treat-row-cover">{coverText(locale, gap)}</span>
      </span>
    ) : undefined;
  return (
    <li className={`treat-row${weak ? " is-weak" : ""}${open ? " is-open" : ""}`}>
      <div className="treat-row-main">
        <div className="treat-row-head">
          <button type="button" className="treat-row-btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
            <span className="treat-row-name">{name}</span>
            <span className="u-sr">{t(locale, "treat.row.details")}</span>
          </button>
          {falling ? (
            <span className="treat-falling">
              <span aria-hidden="true">▼</span> {t(locale, "treat.falling.short")}
            </span>
          ) : null}
          <AwareBadge locale={locale} group={drug.aware} />
          <Icon name="chevron-down" size={18} className="treat-row-chev" />
        </div>
        <ShareBar locale={locale} share={drug.main} min={min} size="sm" aside={<Change locale={locale} change={drug.change} />} caption={caption} />
      </div>
      <div id={bodyId} className="treat-row-body" hidden={!open}>
        {open ? (
          <RowDetail
            locale={locale}
            name={name}
            results={results}
            asOf={asOf}
            catalog={catalog}
            query={query}
            drug={drug}
            min={min}
            wardWidened={wardWidened}
          />
        ) : null}
      </div>
    </li>
  );
}

function RowDetail({
  locale,
  name,
  results,
  asOf,
  catalog,
  query,
  drug,
  min,
  wardWidened,
}: {
  locale: Locale;
  name: string;
  results: readonly Result[];
  asOf: IsoDate;
  catalog: Catalog;
  query: PatientQuery;
  drug: DrugFigure;
  min: number;
  wardWidened: boolean;
}) {
  const points = useMemo(
    () => monthly(results, asOf, query, drug.antibiotic, MONTHS, catalog),
    [results, asOf, query, drug.antibiotic, catalog],
  );
  // No percentage from fewer than `min`: thinner months are gaps, not points.
  const values = points.map((p) => reliable(p.share, min));
  const known = values.filter((v): v is number => v !== null);
  const facts = [
    { label: t(locale, "treat.fig.recent", { weeks: WEEKS }), share: drug.recent },
    { label: t(locale, "treat.fig.year", { months: MONTHS }), share: drug.year },
  ];
  if (!wardWidened) facts.push({ label: t(locale, "treat.fig.hospital"), share: drug.hospitalYear });
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="treat-detail">
      <Facts locale={locale} min={min} items={facts} />
      <div className="treat-trend">
        <p className="treat-trend-title">{t(locale, "treat.row.trend", { months: MONTHS })}</p>
        {known.length >= 2 ? (
          <>
            <div className="treat-trend-chart">
              <span className="treat-trend-axis u-num" aria-hidden="true">
                <span>{formatShare(locale, Math.max(...known))}</span>
                <span>{formatShare(locale, Math.min(...known))}</span>
              </span>
              <Sparkline
                values={values}
                fluid
                height={56}
                label={t(locale, "treat.row.trendAria", {
                  name,
                  lo: formatShare(locale, Math.min(...known)),
                  hi: formatShare(locale, Math.max(...known)),
                  count: formatNumber(locale, known.length),
                  months: formatNumber(locale, points.length),
                  min: formatNumber(locale, min),
                })}
              />
              {first && last ? (
                <span className="treat-trend-months u-num" aria-hidden="true">
                  <span>{formatMonth(locale, first.month)}</span>
                  <span>{formatMonth(locale, last.month)}</span>
                </span>
              ) : null}
            </div>
            <p className="treat-trend-note">{t(locale, "treat.row.trendNote", { min: formatNumber(locale, min) })}</p>
          </>
        ) : (
          <p className="treat-trend-note">{t(locale, "treat.row.trendFew", { min: formatNumber(locale, min) })}</p>
        )}
      </div>
    </div>
  );
}

// ---------- How it is counted ----------

function HowCounted({ locale, rank, min }: { locale: Locale; rank: "access-first" | "coverage"; min: number }) {
  return (
    <Disclosure summary={t(locale, "treat.how.title")} className="treat-how">
      <ul className="treat-how-list">
        <li>{t(locale, "treat.how.first")}</li>
        <li>{t(locale, "treat.how.min", { min: formatNumber(locale, min) })}</li>
        <li>{t(locale, "treat.how.untested")}</li>
        <li>
          {rank === "access-first"
            ? t(locale, "treat.how.rankAccess", { margin: formatNumber(locale, DEFAULT_COVERAGE.accessMargin) })
            : t(locale, "treat.how.rankCoverage")}
        </li>
        <li>{t(locale, "treat.how.aware")}</li>
        <li>{t(locale, "treat.how.live")}</li>
      </ul>
    </Disclosure>
  );
}

