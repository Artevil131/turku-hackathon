import { NEW_IN_UNIT_DAYS } from "@aei/alerts";
import type { AeiClient, Alert, ClockCommand } from "@aei/contract";
import { LIVE_SETTINGS } from "@aei/detect";
import { alertEvidence, formatDate, type GlossTerm, incidentResponsibility, type Locale, phenotypeName, t } from "@aei/i18n";
import { fillSnippet, type Method, methodOf } from "@aei/method";
import { formatNum } from "@aei/viz";
import { type ReactNode, useMemo, useState } from "react";
import type { Finding } from "../../../live.ts";
import { allSites, currentSite, homeSite } from "../../../sites.ts";
import { AlertExplanation } from "../../AlertExplanation.tsx";
import { Gloss } from "../../Gloss.tsx";
import { InfoButton } from "../../Info.tsx";
import { PoissonTail, SurpriseScale } from "../../math/index.ts";
import type { BoardState } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { IsolateList, useIsolates } from "../feed/Isolates.tsx";
import { type Incident, oneDecimal, windowOf } from "../feed/model.ts";
import { kindLabel, shortTitle, surpriseOf, unitLabel } from "../feed/names.ts";
import { SpanGroups } from "../feed/SpanChips.tsx";
import type { Spans } from "../feed/spans.ts";
import "./math.css";

// The signal card (research-unified.md section 3): what, where, when; how much
// against usual; how sure; how we know; what it touches; the evidence; what next.
// The root keeps the `math` class for the workspace's window rules.

/** The detectors whose sentence and ⓘ figure rest on a Poisson count (D-020). */
const COUNT_DETECTORS = ["phenotype-excess", "profile-excess", "sampling-drop", "empty-run"];

const GLOSSED: readonly GlossTerm[] = ["ESBL", "MRSA", "VRE", "CPE"];

interface Props {
  client: AeiClient;
  locale: Locale;
  incident: Incident | null;
  spans: Spans | null;
  findings: Finding[];
  onChange: (patch: Partial<BoardState>) => void;
  acknowledge: (ids: string[]) => void;
  /** The list's own state, shown when nothing can be selected. */
  empty: "loading" | "none" | "pick";
  /** The replay clock's date; "Go to this day" is disabled on it. */
  asOf?: string | null;
  /** The clock command (App's `live.command`); without it the day button is disabled. */
  command?: (c: ClockCommand) => void;
  /** Opens the map window on this county. */
  onShowMap?: (county: string) => void;
}

/** The selected site's county (D-051), as the map keeps it. */
const siteCounty = () => (allSites().find((s) => s.id === currentSite()) ?? homeSite()).county;

const numberLocale = (locale: Locale) => (locale === "fi" ? "fi-FI" : "en-GB");

/** "1 in 50 000", or the capped phrase under one in a million (p below 1e-6). */
export function oddsPhrase(locale: Locale, p: number): string {
  if (p < 1e-6) return t(locale, "cardOddsCap");
  return t(locale, "cardOdds", { n: formatNum(Math.max(1, Math.round(1 / p)), numberLocale(locale)) });
}

/** The label after the surprise number: "surprise · 1 in 50 000 by chance". */
export function surpriseLabel(locale: Locale, p: number): string {
  const chance =
    p < 1e-6 ? t(locale, "cardChanceCap") : t(locale, "cardChance", { n: formatNum(Math.max(1, Math.round(1 / p)), numberLocale(locale)) });
  return `${t(locale, "cardSurprise")} · ${chance}`;
}

/** An expectation to one decimal; below 0.05 it would print as 0.0, so it says "less than 0.1". */
export function usualText(locale: Locale, expected: number): string {
  return expected > 0 && expected < 0.05 ? (locale === "fi" ? "alle 0,1" : "less than 0.1") : oneDecimal(locale, expected);
}

/** The test behind the sentence, named with its minimums, threshold and decision (MATH-REVIEW.md). */
export function howDetail(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return t(locale, "cardDetailCpe");
  if (a.kind === "new-in-unit") return t(locale, "cardDetailSentinel", { days: NEW_IN_UNIT_DAYS });
  if (a.kind !== "detector") return "";
  const expected = usualText(locale, a.expected ?? 0);
  switch (a.detector) {
    case "profile-excess":
      return t(locale, "cardDetailCluster", { n: a.observed, expected });
    case "phenotype-excess":
      return t(locale, "cardDetailPhenotype", { n: a.observed, expected });
    case "sampling-drop":
      return t(locale, "cardDetailData", { n: a.observed, expected });
    case "empty-run":
      return t(locale, "cardDetailEmpty", { n: a.observed, expected });
    case "rising-trend":
      return t(locale, "cardDetailTrend", { days: LIVE_SETTINGS.risingTrend.binDays });
  }
}

/** One sentence per detector with the live numbers filled in (D-020, D-044). */
export function howSentence(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return t(locale, "cardHowCpe");
  if (a.kind === "new-in-unit") return t(locale, "cardHowSentinel", { what: phenotypeName(a.phenotype), days: NEW_IN_UNIT_DAYS });
  if (a.kind !== "detector") return "";
  const expected = usualText(locale, a.expected ?? 0);
  const odds = a.p === undefined ? "" : oddsPhrase(locale, a.p);
  switch (a.detector) {
    case "profile-excess":
      return t(locale, "cardHowCluster", { days: LIVE_SETTINGS.profileExcess.windowDays, n: a.observed, expected, odds });
    case "phenotype-excess":
      return t(locale, "cardHowPhenotype", { days: LIVE_SETTINGS.phenotypeExcess.windowDays, n: a.observed, expected, odds });
    case "sampling-drop":
      return t(locale, "cardHowData", { n: a.observed, expected });
    case "empty-run":
      return t(locale, "cardHowEmpty", { n: a.observed, expected });
    case "rising-trend":
      return t(locale, "cardHowTrend", { days: LIVE_SETTINGS.risingTrend.binDays, to: `${Math.round(a.observed * 100)} %` });
  }
}

/** The title in words: "ESBL Escherichia coli in Urology", the first abbreviation glossed. */
function Title({ locale, lead, ward }: { locale: Locale; lead: Alert; ward: string | null }) {
  const what = shortTitle(locale, lead);
  const unit = unitLabel(locale, ward);
  const named = lead.kind === "detector" && lead.detector === "rising-trend" ? what : what.replace(" · ", " ");
  const text = t(locale, ward ? "cardTitleIn" : "cardTitleWide", { what: named, unit });
  const term = GLOSSED.find((g) => text.startsWith(g));
  if (!term) return <>{text}</>;
  return (
    <>
      <Gloss term={term} locale={locale} first />
      {text.slice(term.length)}
    </>
  );
}

export function AlertMath({
  client,
  locale,
  incident: inc,
  spans,
  findings,
  onChange,
  acknowledge,
  empty,
  asOf = null,
  command,
  onShowMap,
}: Props) {
  const key = inc?.key ?? null;
  // The body of a new incident fades in (keyed, so it remounts; the class leaves on animationend); the frame and the action row stay put.
  const [entered, setEntered] = useState<string | null>(null);
  const iso = useIsolates(client, inc);

  const ids = useMemo(() => {
    const s = new Set(iso.matched.map((r) => r.isolateId));
    if (inc) for (const a of inc.members) if ("isolateId" in a) s.add(a.isolateId);
    return s;
  }, [iso.matched, inc]);

  if (!inc)
    return (
      <aside className="sig math" aria-labelledby="sig-title" aria-busy={empty === "loading"}>
        <header className="sig-head">
          <h2 id="sig-title">{t(locale, "cardTitle")}</h2>
        </header>
        <p className="sig-empty">{empty === "loading" ? t(locale, "feedIsolatesLoading") : t(locale, "cardEmpty")}</p>
      </aside>
    );

  const mine = findings.filter((f) => ids.has(f.record.isolateId) && (inc.phenotypes.length === 0 || inc.phenotypes.includes(f.phenotype)));
  const unseen = mine.filter((f) => !f.seen);
  const lead = inc.lead;
  const win = windowOf(inc);
  const specimen = lead.kind === "cpe" ? lead.specimen : null;
  const doctor = `#doctor?${new URLSearchParams({ ...(inc.ward ? { unit: inc.ward } : {}), ...(specimen ? { site: specimen } : {}) }).toString()}`;
  const dataNote =
    lead.kind === "detector"
      ? t(locale, "feedNoIsolatesData", { observed: lead.observed, expected: oneDecimal(locale, lead.expected ?? 0) })
      : "";
  const onDay = asOf === lead.date;
  const snippetValues = {
    ward: inc.ward ?? "",
    organism: "organism" in lead ? (lead.organism ?? "") : "",
    from: win.from,
    to: win.to,
  };

  return (
    <aside className="sig math" aria-labelledby="sig-title" data-kind={inc.kind}>
      <header className="sig-head">
        <h2 id="sig-title">{t(locale, "cardTitle")}</h2>
        <InfoButton locale={locale} align="end">
          {t(locale, "feedMathHelp")}
        </InfoButton>
      </header>

      <div
        key={inc.key}
        className={`sig-body${entered === key ? "" : " is-entering"}`}
        onAnimationEnd={(e) => (e.target === e.currentTarget ? setEntered(key) : undefined)}
      >
        <div>
          <span className="sig-kind">
            <KindGlyph kind={inc.kind} />
            {kindLabel(locale, inc.kind)}
          </span>
          <h3 className="sig-title">
            <Title locale={locale} lead={lead} ward={inc.ward} />
          </h3>
          <p className="sig-where">{whereLine(locale, inc, win)}</p>
        </div>

        <Numbers locale={locale} alert={lead} />

        {/* Concise first: the method opens on request (Artem, 2026-10-17: detail only when the researcher asks). */}
        <details className="sig-how">
          <summary className="sig-how-head">{t(locale, "cardHow")}</summary>
          <p className="sig-how-text">{howSentence(locale, lead)}</p>
          <HowFigure locale={locale} alert={lead} values={snippetValues} />
          <p className="feed-evidence">{t(locale, "feedLatestEvidence", { evidence: alertEvidence(locale, lead) })}</p>
          <p className="feed-owner">{incidentResponsibility(locale, inc.members)}</p>
        </details>

        <div className="math-explain">
          <AlertExplanation client={client} id={lead.id} locale={locale} />
        </div>

        {spans ? (
          <div className="sig-reach">
            <span className="sig-reach-label">{t(locale, "cardReach")}</span>
            <SpanGroups locale={locale} spans={spans} onUnit={(u) => onChange({ focus: u as BoardState["focus"] })} />
          </div>
        ) : null}

        {inc.kind !== "data" ? (
          <details className="sig-isolates">
            <summary>{t(locale, "cardIsolates", { n: iso.status === "ready" ? iso.matched.length : "…" })}</summary>
            <IsolateList locale={locale} status={iso.status} matched={iso.matched} retry={iso.retry} window={win} dataNote={dataNote} />
          </details>
        ) : null}
      </div>

      <footer className="sig-actions">
        <button
          type="button"
          className="sig-primary"
          disabled={onDay || !command}
          title={onDay ? t(locale, "cardGoToDayHere") : undefined}
          onClick={() => command?.({ action: "seek", date: lead.date })}
        >
          {t(locale, "cardGoToDay")}
        </button>
        <button type="button" className="sig-btn" onClick={() => onShowMap?.(siteCounty())}>
          {t(locale, "cardShowMap")}
        </button>
        <a className="sig-btn" href="#method">
          {t(locale, "cardMethod")}
        </a>
        <a className="sig-btn" href={doctor}>
          {t(locale, "feedOpenInDoctor")}
        </a>
        <button
          type="button"
          className="sig-btn"
          disabled={unseen.length === 0}
          title={mine.length === 0 ? t(locale, "feedSeenNone") : undefined}
          onClick={() => acknowledge(unseen.map((f) => f.id))}
        >
          {mine.length > 0 && unseen.length === 0 ? t(locale, "feedSeen") : t(locale, "feedMarkSeen")}
          {unseen.length > 0 ? ` (${unseen.length})` : ""}
        </button>
      </footer>
    </aside>
  );
}

/** "5 patients · 2 Jun – 29 Jun · fired 9 Jun": the count and window where the alert has them. */
function whereLine(locale: Locale, inc: Incident, win: { from: string; to: string }): string {
  const a = inc.lead;
  const parts: string[] = [];
  if (a.kind === "detector" && (a.detector === "profile-excess" || a.detector === "phenotype-excess"))
    parts.push(t(locale, a.observed === 1 ? "cardPatientOne" : "cardPatients", { n: a.observed }));
  if (a.kind === "detector" && a.detector !== "rising-trend") parts.push(`${formatDate(locale, win.from)} – ${formatDate(locale, win.to)}`);
  parts.push(t(locale, "cardFired", { date: formatDate(locale, a.date) }));
  return parts.join(" · ");
}

/** The ⓘ of the how-section: the Poisson tail for the count detectors; sentinels and trends have none. The registry entry follows (D-070). */
function HowFigure({ locale, alert: a, values }: { locale: Locale; alert: Alert; values: SnippetValues }): ReactNode {
  const detail = howDetail(locale, a);
  if (!detail) return null;
  const figure = a.kind === "detector" && COUNT_DETECTORS.includes(a.detector) && a.p !== undefined && a.expected !== undefined;
  const method = methodOf(a);
  return (
    <InfoButton locale={locale} align="end" label={t(locale, "cardHowInfo")}>
      <p className="sig-detail">{detail}</p>
      {figure && a.kind === "detector" ? (
        <PoissonTail observed={a.observed} expected={a.expected as number} p={a.p as number} detector={a.detector} locale={locale} />
      ) : null}
      {method ? <MethodEntry locale={locale} method={method} values={values} /> : null}
    </InfoButton>
  );
}

/** What the notebook snippet fills in: this card's unit, organism and window. */
type SnippetValues = Record<"ward" | "organism" | "from" | "to", string>;

/** The registry entry (@aei/method): formula, constants with their decisions, code location, and the notebook snippet. */
export function MethodEntry({ locale, method, values }: { locale: Locale; method: Method; values: SnippetValues }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const snippet = fillSnippet(method, values);
  const copy = () => {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clip) {
      setState("manual");
      return;
    }
    clip.writeText(snippet).then(
      () => setState("copied"),
      () => setState("manual"),
    );
  };
  return (
    <div className="sig-method">
      <p className="sig-method-plain">{method.plain[locale]}</p>
      <p className="sig-method-label">{t(locale, "cardRegistryFormula")}</p>
      <code className="sig-formula">{method.latex}</code>
      <p className="sig-method-label">{t(locale, "cardRegistryConstants")}</p>
      <ul className="sig-constants">
        {method.constants.map((k) => (
          <li key={k.name}>
            {k.name} = {String(k.value)} <span className="sig-decision">({k.decision})</span>
          </li>
        ))}
      </ul>
      <p className="sig-method-decisions">{t(locale, "cardRegistryDecisions", { list: method.decisions.join(", ") })}</p>
      <p className="sig-code">
        {method.code.py
          ? t(locale, "cardRegistryCode", { ts: method.code.ts, py: method.code.py })
          : t(locale, "cardRegistryCodeNoPy", { ts: method.code.ts })}
      </p>
      <button type="button" className="sig-btn" onClick={copy}>
        {state === "copied" ? t(locale, "cardRegistryCopied") : t(locale, "cardRegistryCopy")}
      </button>
      {state === "manual" ? (
        <>
          <p className="sig-note">{t(locale, "cardRegistryFallbackNote")}</p>
          <p className="sig-note">{t(locale, "cardRegistryManual")}</p>
          <pre className="sig-snippet">{snippet}</pre>
        </>
      ) : null}
    </div>
  );
}

/** Observed against usual on one scale, and the surprise as the one big number. Sentinels have neither. */
function Numbers({ locale, alert: a }: { locale: Locale; alert: Alert }) {
  if (a.kind !== "detector") return null;
  const trend = a.detector === "rising-trend";
  const data = a.detector === "sampling-drop";
  const obs = a.observed;
  const exp = a.expected;
  const fmtObs = trend
    ? `${Math.round(obs * 100)} %`
    : data
      ? t(locale, "cardCultures", { n: obs })
      : t(locale, obs === 1 ? "cardPatientOne" : "cardPatients", { n: obs });
  const fmtUsual =
    exp === undefined
      ? ""
      : exp > 0 && exp < 0.05
        ? t(locale, "cardUsualSmall")
        : t(locale, "cardUsualValue", { n: oneDecimal(locale, exp) });
  // A share is already on a 0 to 1 scale; counts are scaled to the larger of the two.
  const max = trend ? 1 : Math.max(obs, exp ?? 0) || 1;
  const s = surpriseOf(a);
  // An empty run has two facts in two units (days without cultures, cultures per day): no shared bar.
  const bars = a.detector !== "empty-run";
  return (
    <>
      {bars ? (
        <div
          className="sig-bars"
          role="group"
          aria-label={`${t(locale, "cardObserved")} ${fmtObs}${exp !== undefined ? `, ${t(locale, "cardUsual")} ${fmtUsual}` : ""}`}
        >
          <Bar label={t(locale, "cardObserved")} value={fmtObs} share={obs / max} tone="obs" />
          {exp !== undefined ? <Bar label={t(locale, "cardUsual")} value={fmtUsual} share={exp / max} tone="usual" /> : null}
        </div>
      ) : null}
      {s !== null && a.p !== undefined ? (
        <div className="sig-surprise">
          <b className="sig-num">{oneDecimal(locale, s)}</b>
          <span className="sig-surprise-label">{surpriseLabel(locale, a.p)}</span>
          <InfoButton locale={locale} align="end" label={t(locale, "cardSurpriseInfo")}>
            <SurpriseScale p={a.p} detector={a.detector} locale={locale} />
          </InfoButton>
        </div>
      ) : null}
    </>
  );
}

function Bar({ label, value, share, tone }: { label: string; value: string; share: number; tone: "obs" | "usual" }) {
  return (
    <div className="sig-bar" data-tone={tone}>
      <span className="sig-bar-label">{label}</span>
      <span className="sig-bar-track" aria-hidden="true">
        <i style={{ width: `${Math.max(2, Math.round(share * 100))}%` }} />
      </span>
      <b className="sig-bar-value">{value}</b>
    </div>
  );
}
