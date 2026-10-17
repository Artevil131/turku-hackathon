import type { CombinationSuggestion, CoverageResponse, Suggestion } from "@aei/contract";
import { useId, useState } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { formatDate, formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import type { AwareGroup, Share } from "../../model/types.ts";
import {
  AwareBadge,
  Card,
  Disclosure,
  EmptyState,
  Icon,
  ShareBar,
  sexLabel,
  shortOrganism,
  specimenName,
  unitByCode,
  unitName,
} from "../../ui/index.ts";
import { capFirst, THRESHOLDS, type TreatChoice } from "./model.ts";
import { drugName, figText, listText, MONTHS, WEEKS } from "./text.tsx";

// The answer, as the server computes it (GET /api/coverage): what it rests
// on, the top suggestion, the other antibiotics by standing, and pairs for a
// severe infection when no single antibiotic reaches the bar. Every figure is
// the server's; this file only lays it out.

type Standing = Suggestion["standing"];

const aware = (a: Suggestion["aware"]): AwareGroup => (a === "Access" ? "access" : "watch");
const asShare = (c: { covered: number; known: number }): Share => ({ works: c.covered, n: c.known });
const pct = (locale: Locale, x: number) => formatShare(locale, x);

export function ResultView({
  locale,
  meta,
  prefs,
  data,
  failed,
  min,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  data: CoverageResponse | null;
  failed: boolean;
  min: number;
}) {
  if (!data) {
    return failed ? (
      <Card>
        <EmptyState compact icon="wifi-off" title={t(locale, "treat.error.title")} body={t(locale, "treat.error.body")} />
      </Card>
    ) : null;
  }
  const { coverage, suggestions, combinationSuggestions, severity } = data;
  const threshold = pct(locale, THRESHOLDS[severity]);
  const top = suggestions[0];
  const combinationFirst = severity === "severe" && !suggestions.some((s) => s.standing === "clears");
  const rest = combinationFirst ? suggestions : suggestions.slice(1);

  const pair = combinationFirst ? combinationSuggestions[0] : undefined;
  const live = pair
    ? `${pair.antibiotics.map((a) => drugName(locale, meta, a)).join(" + ")}. ${pair.coverage.share === null ? t(locale, "treat.live.few") : pct(locale, pair.coverage.share)}`
    : top
      ? top.share !== null
        ? t(locale, "treat.live.summary", { name: drugName(locale, meta, top.antibiotic), percent: pct(locale, top.share) })
        : `${drugName(locale, meta, top.antibiotic)}. ${t(locale, "treat.live.few")}`
      : t(locale, "treat.empty.title");

  return (
    <section className="treat-result" aria-label={t(locale, "treat.result.label")}>
      <p className="u-sr" aria-live="polite" aria-atomic="true">
        {live}
      </p>

      {combinationFirst && top && coverage.isolates > 0 ? (
        <Pairs locale={locale} meta={meta} pairs={combinationSuggestions} threshold={threshold} />
      ) : null}
      <Basis locale={locale} meta={meta} prefs={prefs} data={data} min={min} />

      {!top || coverage.isolates === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="inbox"
            title={t(locale, "treat.empty.title")}
            body={t(locale, "treat.empty.body", {
              specimen: specimenName(locale, meta, prefs.specimen),
              unit: unitName(locale, meta, prefs.ward),
            })}
          />
        </Card>
      ) : (
        <>
          {!combinationFirst ? (
            <TopMatch
              key={`${prefs.ward}|${prefs.specimen}|${prefs.severity}|${prefs.sex ?? ""}|${top.antibiotic}`}
              locale={locale}
              meta={meta}
              s={top}
              threshold={threshold}
              min={min}
            />
          ) : null}
          {rest.length > 0 ? (
            <DrugList locale={locale} meta={meta} rest={rest} threshold={threshold} min={min} singles={combinationFirst} />
          ) : (
            <HowCounted locale={locale} min={min} />
          )}
        </>
      )}
    </section>
  );
}

// ---------- Basis ----------

function Basis({
  locale,
  meta,
  prefs,
  data,
  min,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  data: CoverageResponse;
  min: number;
}) {
  const c = data.coverage;
  const unit = unitName(locale, meta, prefs.ward);
  const type = unitByCode(meta, prefs.ward)?.type;
  const levelText =
    c.level === "unit"
      ? unit
      : c.level === "ward type"
        ? t(locale, type === "in" ? "treat.basis.inUnits" : "treat.basis.outUnits")
        : t(locale, "treat.basis.hospital");
  const parts: string[] = [capFirst(specimenName(locale, meta, prefs.specimen))];
  if (c.sexApplied && prefs.sex) parts.push(sexLabel(locale, prefs.sex));
  parts.push(levelText);
  parts.push(
    `${t(locale, "treat.basis.year", { months: MONTHS })}, ${t(locale, "treat.basis.upTo", { date: formatDate(locale, data.asOf, "long") })}`,
  );

  return (
    <div className="treat-basis">
      <p className="treat-basis-line">
        <strong className="u-num">
          {c.isolates === 1 ? t(locale, "treat.basis.leadOne") : t(locale, "treat.basis.lead", { n: formatNumber(locale, c.isolates) })}
        </strong>
        {parts.map((p) => (
          <span key={p} className="treat-basis-part">
            <span className="treat-basis-dot" aria-hidden="true">
              ·
            </span>{" "}
            {p}
          </span>
        ))}
      </p>
      <p className="treat-basis-demo">{t(locale, "treat.basis.demo")}</p>
      {c.level !== "unit" ? (
        <p className="treat-note is-widened">
          <Icon name="alert-triangle" size={18} />
          <span>
            {c.level === "ward type"
              ? t(locale, "treat.level.wardType", { unit, min: formatNumber(locale, min), months: MONTHS, level: levelText })
              : t(locale, "treat.level.hospital", { unit })}
          </span>
        </p>
      ) : null}
      {prefs.sex && !c.sexApplied ? (
        <p className="treat-note is-widened">
          <Icon name="alert-triangle" size={18} />
          <span>{t(locale, "treat.sexDropped", { who: t(locale, prefs.sex === "M" ? "treat.who.M" : "treat.who.F"), unit })}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---------- Figures ----------

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

function standingText(locale: Locale, s: Suggestion, threshold: string, min: number): string {
  const { standing } = s;
  if (standing === "clears") return t(locale, "treat.standing.clears", { threshold });
  if (standing === "borderline")
    return t(locale, "treat.standing.borderline", {
      threshold,
      percent: pct(locale, s.share ?? 0),
      lo: s.interval ? pct(locale, s.interval[0]) : "—",
      hi: s.interval ? pct(locale, s.interval[1]) : "—",
    });
  if (standing === "below") return t(locale, "treat.standing.below", { threshold });
  return t(locale, "treat.standing.na", { min: formatNumber(locale, min) });
}

/** "E. faecalis 10 %, S. aureus 4 %": organisms as shares of the samples behind the figure. */
function organismList(locale: Locale, list: readonly { organism: string; share: number }[]): string {
  return listText(
    locale,
    list.map((o) => `${shortOrganism(o.organism)} ${pct(locale, o.share)}`),
  );
}

const interval = (locale: Locale, i: [number, number] | null) =>
  i ? t(locale, "treat.top.interval", { lo: pct(locale, i[0]), hi: pct(locale, i[1]) }) : null;

// ---------- Top match ----------

function TopMatch({ locale, meta, s, threshold, min }: { locale: Locale; meta: FeedMeta; s: Suggestion; threshold: string; min: number }) {
  const headingId = useId();
  const ok = s.standing !== "not assessable";
  const reaches = s.standing === "clears" || s.standing === "borderline";
  const c = s.coverage;
  const basisCounts = s.basis === "spectrum" ? c.spectrum.counts : c.counts;
  const name = drugName(locale, meta, s.antibiotic);
  const range = interval(locale, s.interval);
  const caption = ok
    ? `${t(locale, s.basis === "spectrum" ? "treat.top.covered" : "treat.top.coveredAll", {
        covered: formatNumber(locale, basisCounts.covered),
        known: formatNumber(locale, basisCounts.known),
      })}${range ? ` · ${range}` : ""}`
    : undefined;
  const all = s.allOrganisms.share;
  const allRange = interval(locale, s.allOrganisms.interval);

  return (
    <article className={`treat-top${ok ? "" : " is-few"}`} aria-labelledby={headingId}>
      <div className="treat-top-head">
        <h2 id={headingId} className="treat-top-name">
          {reaches ? <span className="u-sr">{t(locale, "treat.top.label")}: </span> : null}
          {name}
        </h2>
        <AwareBadge locale={locale} group={aware(s.aware)} size="md" />
      </div>
      {ok ? null : (
        <p className="treat-top-label">
          <Icon name="info" size={16} />
          {t(locale, "treat.top.labelFew")}
        </p>
      )}
      {s.basis === "spectrum" ? (
        <dl className="treat-answer-figures">
          {[
            { label: t(locale, "treat.fig.spectrum"), share: s.share, range, counts: basisCounts },
            { label: t(locale, "treat.fig.all"), share: all, range: allRange, counts: c.counts },
          ].map((figure) => (
            <div key={figure.label}>
              <dt>{figure.label}</dt>
              <dd>
                <strong className="treat-answer-percent u-num">{figure.share === null ? "—" : pct(locale, figure.share)}</strong>
                <span className="treat-answer-range">{figure.range ?? t(locale, "treat.live.few")}</span>
                <span className="u-num">
                  {formatNumber(locale, figure.counts.covered)}/{formatNumber(locale, figure.counts.known)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <ShareBar locale={locale} share={asShare(basisCounts)} min={min} size="lg" label={t(locale, "treat.fig.all")} caption={caption} />
      )}
      <p className={`treat-top-standing is-${s.standing.replace(" ", "-")}`}>{standingText(locale, s, threshold, min)}</p>
      {c.notCovering.length > 0 ? (
        <p className="treat-top-notfor">
          <Icon name="info" size={16} />
          <span>{t(locale, "treat.top.notFor", { list: organismList(locale, c.notCovering) })}</span>
        </p>
      ) : null}
      <Facts locale={locale} min={min} items={[{ label: t(locale, "treat.fig.recent", { weeks: WEEKS }), share: asShare(c.recent) }]} />
      {s.standing !== "clears" ? <p className="treat-note is-few">{t(locale, "treat.top.none", { threshold })}</p> : null}
      <p className="treat-top-decide">{t(locale, "treat.top.decide")}</p>
    </article>
  );
}

// ---------- Pairs for a severe infection (D-028) ----------

function Pairs({
  locale,
  meta,
  pairs,
  threshold,
}: {
  locale: Locale;
  meta: FeedMeta;
  pairs: readonly CombinationSuggestion[];
  threshold: string;
}) {
  const [first, ...others] = pairs;
  const gainText = (p: CombinationSuggestion) =>
    t(locale, "treat.combo.gain", {
      points: formatNumber(locale, Math.round(100 * p.gain)),
      name: drugName(locale, meta, p.antibiotics[p.coverage.alone[0] >= p.coverage.alone[1] ? 0 : 1]),
    });
  return (
    <article className="treat-top treat-pairs" aria-label={t(locale, "treat.combo.title")}>
      {first ? (
        <>
          <h2 className="treat-top-name">{first.antibiotics.map((a) => drugName(locale, meta, a)).join(" + ")}</h2>
          <ShareBar
            locale={locale}
            share={asShare(first.coverage.counts)}
            size="lg"
            label={t(locale, "treat.fig.all")}
            caption={`${formatNumber(locale, first.coverage.counts.covered)}/${formatNumber(locale, first.coverage.counts.known)} · ${interval(locale, first.coverage.interval) ?? t(locale, "treat.live.few")} · ${gainText(first)}`}
          />
        </>
      ) : (
        <h2 className="treat-top-name">{t(locale, "treat.combo.title")}</h2>
      )}
      <p className="treat-top-standing">{t(locale, "treat.top.none", { threshold })}</p>
      {first ? (
        <p className="treat-pairs-lead">{t(locale, "treat.combo.lead")}</p>
      ) : (
        <p className="treat-pairs-lead">{t(locale, "treat.combo.none")}</p>
      )}
      {others.length > 0 ? (
        <ul className="treat-rows">
          {others.map((p) => (
            <li key={p.antibiotics.join("+")} className="treat-row">
              <div className="treat-row-main">
                <span>{p.antibiotics.map((a) => drugName(locale, meta, a)).join(" + ")}</span>
                <ShareBar
                  locale={locale}
                  share={asShare(p.coverage.counts)}
                  size="sm"
                  caption={`${formatNumber(locale, p.coverage.counts.covered)}/${formatNumber(locale, p.coverage.counts.known)} · ${interval(locale, p.coverage.interval) ?? t(locale, "treat.live.few")} · ${gainText(p)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="treat-top-decide">{t(locale, "treat.top.decide")}</p>
    </article>
  );
}

// ---------- The other antibiotics ----------

const GROUPS: { standing: Standing; key: "treat.list.clears" | "treat.list.borderline" | "treat.list.below" | "treat.list.na" }[] = [
  { standing: "clears", key: "treat.list.clears" },
  { standing: "borderline", key: "treat.list.borderline" },
  { standing: "below", key: "treat.list.below" },
  { standing: "not assessable", key: "treat.list.na" },
];

function DrugList({
  locale,
  meta,
  rest,
  singles,
  threshold,
  min,
}: {
  locale: Locale;
  meta: FeedMeta;
  rest: readonly Suggestion[];
  singles: boolean;
  threshold: string;
  min: number;
}) {
  return (
    <Card
      className="treat-list"
      title={t(locale, singles ? "treat.list.singles" : "treat.list.title")}
      footer={<HowCounted locale={locale} min={min} />}
    >
      {GROUPS.map((g) => {
        const drugs = rest.filter((s) => s.standing === g.standing);
        if (drugs.length === 0) return null;
        return (
          <div
            key={g.standing}
            className={`treat-group is-${g.standing === "clears" ? "strong" : g.standing === "not assessable" ? "few" : "weak"}`}
          >
            <h3 className="treat-group-title">{t(locale, g.key, { threshold })}</h3>
            <ul className="treat-rows">
              {drugs.map((s) => (
                <DrugRow
                  key={s.antibiotic}
                  locale={locale}
                  meta={meta}
                  s={s}
                  min={min}
                  threshold={threshold}
                  weak={g.standing !== "clears"}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </Card>
  );
}

function DrugRow({
  locale,
  meta,
  s,
  min,
  threshold,
  weak,
}: {
  locale: Locale;
  meta: FeedMeta;
  s: Suggestion;
  min: number;
  threshold: string;
  weak: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const c = s.coverage;
  const basisCounts = s.basis === "spectrum" ? c.spectrum.counts : c.counts;
  const all = s.allOrganisms.share;
  return (
    <li className={`treat-row${weak ? " is-weak" : ""}${open ? " is-open" : ""}`}>
      <div className="treat-row-main">
        <div className="treat-row-head">
          <button type="button" className="treat-row-btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
            <span className="treat-row-name">{drugName(locale, meta, s.antibiotic)}</span>
            <span className="u-sr">{t(locale, "treat.row.details")}</span>
          </button>
          <AwareBadge locale={locale} group={aware(s.aware)} />
          <Icon name="chevron-down" size={18} className="treat-row-chev" />
        </div>
        <ShareBar
          locale={locale}
          share={asShare(basisCounts)}
          min={min}
          size="sm"
          aside={
            s.basis === "spectrum" && all !== null ? (
              <span className="treat-row-all u-num">{t(locale, "treat.row.all", { percent: pct(locale, all) })}</span>
            ) : undefined
          }
        />
        {s.standing === "borderline" ? <p className="treat-top-standing">{standingText(locale, s, threshold, min)}</p> : null}
      </div>
      <div id={bodyId} className="treat-row-body" hidden={!open}>
        {open ? (
          <div className="treat-detail">
            <Facts
              locale={locale}
              min={min}
              items={[
                ...(s.basis === "spectrum" ? [{ label: t(locale, "treat.fig.spectrum"), share: asShare(c.spectrum.counts) }] : []),
                { label: t(locale, "treat.fig.all"), share: asShare(c.counts) },
                { label: t(locale, "treat.fig.recent", { weeks: WEEKS }), share: asShare(c.recent) },
              ]}
            />
            {c.notCovering.length > 0 ? (
              <p className="treat-detail-note">{t(locale, "treat.row.notCovering", { list: organismList(locale, c.notCovering) })}</p>
            ) : null}
            {c.untested.length > 0 ? (
              <p className="treat-detail-note">{t(locale, "treat.row.untested", { list: organismList(locale, c.untested) })}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// ---------- How it is counted ----------

function HowCounted({ locale, min }: { locale: Locale; min: number }) {
  return (
    <Disclosure summary={t(locale, "treat.how.title")} className="treat-how">
      <ul className="treat-how-list">
        <li>{t(locale, "treat.how.first", { months: MONTHS })}</li>
        <li>{t(locale, "treat.how.level", { min: formatNumber(locale, min) })}</li>
        <li>{t(locale, "treat.how.severity")}</li>
        <li>{t(locale, "treat.how.untested")}</li>
        <li>{t(locale, "treat.how.aware")}</li>
        <li>{t(locale, "treat.how.live")}</li>
      </ul>
    </Disclosure>
  );
}
