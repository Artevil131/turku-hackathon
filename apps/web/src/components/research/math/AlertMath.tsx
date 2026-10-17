import { NEW_IN_UNIT_DAYS } from "@aei/alerts";
import type { AeiClient, Alert, ClockCommand } from "@aei/contract";
import { LIVE_SETTINGS } from "@aei/detect";
import {
  alertEvidence,
  antibioticName,
  formatDate,
  incidentPriority,
  incidentResponsibility,
  type Locale,
  phenotypeName,
  t,
} from "@aei/i18n";
import { fillSnippet, type Method, methodOf } from "@aei/method";
import { formatNum } from "@aei/viz";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Finding } from "../../../live.ts";
import { allSites, currentSite, homeSite } from "../../../sites.ts";
import { AlertExplanation } from "../../AlertExplanation.tsx";
import { InfoButton } from "../../Info.tsx";
import { PoissonTail, SurpriseScale } from "../../math/index.ts";
import { Assistant } from "../assistant/Assistant.tsx";
import type { BoardState } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { GlossedTitle } from "../feed/IncidentRow.tsx";
import { IsolateList, useIsolates } from "../feed/Isolates.tsx";
import { type Incident, oneDecimal, windowOf } from "../feed/model.ts";
import { signalTitle, surpriseOf } from "../feed/names.ts";
import { SpanGroups } from "../feed/SpanChips.tsx";
import type { Spans } from "../feed/spans.ts";
import type { Slice } from "../tools/model.ts";
import { SignalAnalysis } from "./SignalAnalysis.tsx";
import "./math.css";

// The signal card (research-unified.md section 3, signals-redesign.md section 2.6): the one
// title every surface shows, the window; the two bars and the surprise; one sentence in words;
// then the collapsed sections (how we calculate it, reaches, isolates, explain) and the actions.
// The root keeps the `math` class for the workspace's window rules.

/** The detectors whose sentence and ⓘ figure rest on a Poisson count (D-020). */
const COUNT_DETECTORS = ["phenotype-excess", "profile-excess", "sampling-drop", "empty-run"];

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
  /** Each new positive value opens "How we calculate it" and the explanation (the row's "Open calculation and explanation"). */
  explain?: number;
  /** As a layer inside the Signals window: a Back control, the signal's title as the heading. */
  onBack?: () => void;
  /** "Open in Tools": the Tools window takes this signal's slice and comes forward. */
  onOpenTools?: (slice: Slice) => void;
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

/** What the signal means, in one plain sentence; it adds no claim the audited how-sentence does not make. */
export function meaningSentence(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return t(locale, "cardMeansCpe");
  if (a.kind === "new-in-unit") return t(locale, "cardMeansSentinel", { phenotype: phenotypeName(a.phenotype), days: NEW_IN_UNIT_DAYS });
  if (a.kind !== "detector") return "";
  switch (a.detector) {
    case "profile-excess":
      return t(locale, "cardMeansProfile", { organism: a.organism ?? "", days: LIVE_SETTINGS.profileExcess.windowDays });
    case "phenotype-excess":
      return t(locale, "cardMeansPhenotype", {
        phenotype: a.phenotype ? phenotypeName(a.phenotype) : (a.organism ?? ""),
        days: LIVE_SETTINGS.phenotypeExcess.windowDays,
      });
    case "sampling-drop":
      return t(locale, "cardMeansData");
    case "empty-run":
      return t(locale, "cardMeansEmpty", { n: a.observed });
    case "rising-trend":
      return t(locale, "cardMeansTrend", {
        antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
        organism: a.organism ?? "",
      });
  }
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
  explain = 0,
  onBack,
  onOpenTools,
}: Props) {
  const key = inc?.key ?? null;
  const how = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    if (explain <= 0 || !how.current) return;
    how.current.open = true;
    how.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [explain]);
  // The body of a new incident fades in (keyed, so it remounts; the class leaves on animationend); the frame and the action row stay put.
  const [entered, setEntered] = useState<string | null>(null);
  const iso = useIsolates(client, inc);

  const ids = useMemo(() => {
    const s = new Set(iso.matched.map((r) => r.isolateId));
    if (inc) for (const a of inc.members) if ("isolateId" in a) s.add(a.isolateId);
    return s;
  }, [iso.matched, inc]);

  const back = onBack ? (
    <button type="button" className="sig-back" onClick={onBack}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t(locale, "feedBack")}
    </button>
  ) : null;

  if (!inc)
    return (
      <aside className="sig math" aria-labelledby="sig-title" aria-busy={empty === "loading"}>
        <header className="sig-head">
          {back}
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
  const method = methodOf(lead);
  const snippetValues = {
    ward: inc.ward ?? "",
    organism: "organism" in lead ? (lead.organism ?? "") : "",
    from: win.from,
    to: win.to,
  };

  const high = incidentPriority(inc.members) === "high";
  const title = (
    <>
      <span className="sig-title-glyph" aria-hidden="true">
        <KindGlyph kind={inc.kind} />
      </span>
      {high ? (
        <span className="feed-dot" title={incidentResponsibility(locale, inc.members)}>
          <span className="visually-hidden">{t(locale, "feedSeverityHigh")}. </span>
        </span>
      ) : null}
      <GlossedTitle locale={locale} title={signalTitle(locale, inc.kind, lead)} />
    </>
  );

  return (
    <aside className={`sig math${onBack ? " sig-layer" : ""}`} aria-labelledby="sig-title" data-kind={inc.kind}>
      <header className="sig-head">
        {back}
        {/* As a layer the row's title is the heading; as a window the window is called Signal and the title opens the body. */}
        <h2 id="sig-title" className={onBack ? "sig-title" : undefined} tabIndex={onBack ? -1 : undefined}>
          {onBack ? title : t(locale, "cardTitle")}
        </h2>
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
          {/* The same title as the row and the tile, the kind's glyph before it, the red dot for high priority. */}
          {onBack ? null : (
            <h3 className="sig-title" tabIndex={-1}>
              {title}
            </h3>
          )}
          <p className="sig-where">{whereLine(locale, inc, win)}</p>
        </div>

        <Numbers locale={locale} alert={lead} />

        <p className="sig-means">{meaningSentence(locale, lead)}</p>

        {/* The assistant's reading of this signal: template text by default, the model's wording when the API offers it (D-049). */}
        <section className="sig-section" aria-labelledby={`sig-assist-${inc.key}`}>
          <h4 className="sig-section-title" id={`sig-assist-${inc.key}`}>
            {t(locale, "wsLeadAssistant")}
          </h4>
          <Assistant client={client} locale={locale} incident={inc} spans={spans} waiting={false} inline />
        </section>

        {/* Two ready results on the signal's own slice, from the Tools model; "Open in Tools" continues there. */}
        <details className="sig-analyse" open>
          <summary>{t(locale, "cardAnalyse")}</summary>
          <SignalAnalysis client={client} locale={locale} incident={inc} onOpenTools={onOpenTools} />
        </details>

        {/* Concise first: the method opens on request (Artem, 2026-10-17: detail only when the researcher asks). */}
        <details className="sig-how" ref={how}>
          <summary className="sig-how-head">{t(locale, "cardHow")}</summary>
          {method ? (
            <MethodEntry
              locale={locale}
              method={method}
              values={snippetValues}
              alert={lead}
              plain={
                <>
                  <p className="sig-how-text">{howSentence(locale, lead)}</p>
                  {howDetail(locale, lead) ? <p className="sig-detail">{howDetail(locale, lead)}</p> : null}
                </>
              }
              explain={
                <div className="math-explain">
                  <AlertExplanation client={client} id={lead.id} locale={locale} openKey={explain} />
                </div>
              }
            />
          ) : (
            <>
              <p className="sig-how-text">{howSentence(locale, lead)}</p>
              <div className="math-explain">
                <AlertExplanation client={client} id={lead.id} locale={locale} openKey={explain} />
              </div>
            </>
          )}
          <p className="feed-evidence">{t(locale, "feedLatestEvidence", { evidence: alertEvidence(locale, lead) })}</p>
          <p className="feed-owner">{incidentResponsibility(locale, inc.members)}</p>
        </details>

        {spans ? (
          <details className="sig-reach">
            <summary>{t(locale, "cardReachCount", { n: spans.next.length + spans.trail.length + spans.also.length })}</summary>
            <SpanGroups locale={locale} spans={spans} onUnit={(u) => onChange({ focus: u as BoardState["focus"] })} />
          </details>
        ) : null}

        {inc.kind !== "data" ? (
          <details className="sig-isolates">
            <summary>{t(locale, "cardIsolates", { n: iso.status === "ready" ? iso.matched.length : "…" })}</summary>
            <IsolateList locale={locale} status={iso.status} matched={iso.matched} retry={iso.retry} window={win} dataNote={dataNote} />
          </details>
        ) : null}

        <div className="math-explain">
          <AlertExplanation client={client} id={lead.id} locale={locale} />
        </div>
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

/** "2 Jun – 29 Jun · fired 9 Jun": the window where the alert has one, and the day it fired. The count is on the bars. */
function whereLine(locale: Locale, inc: Incident, win: { from: string; to: string }): string {
  const a = inc.lead;
  const parts: string[] = [];
  if (a.kind === "detector" && a.detector !== "rising-trend") parts.push(`${formatDate(locale, win.from)} – ${formatDate(locale, win.to)}`);
  parts.push(t(locale, "cardFired", { date: formatDate(locale, a.date) }));
  return parts.join(" · ");
}

/** The ⓘ of the how-section: the Poisson tail for the count detectors; sentinels and trends have none. The registry entry follows (D-075). */
/** What the notebook snippet fills in: this card's unit, organism and window. */
type SnippetValues = Record<"ward" | "organism" | "from" | "to", string>;

/** Copies text; the state tells the button what to say. */
function useCopy(): [state: "idle" | "copied" | "manual", copy: (text: string) => void] {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const copy = (text: string) => {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clip) return setState("manual");
    clip.writeText(text).then(
      () => {
        setState("copied");
        setTimeout(() => setState("idle"), 1600);
      },
      () => setState("manual"),
    );
  };
  return [state, copy];
}

/** A p-value as a × 10^b in MathML; 1 and 0 stay plain. */
function PValue({ p }: { p: number }) {
  if (p >= 0.01) return <mn>{p.toPrecision(2)}</mn>;
  const [m, e] = p.toExponential(1).split("e");
  return (
    <mrow>
      <mn>{m}</mn>
      <mo>×</mo>
      <msup>
        <mn>10</mn>
        <mn>{Number(e)}</mn>
      </msup>
    </mrow>
  );
}

/** The signal's own numbers in the formula's letters: y, μ and the tail (or the share and p for a trend). */
function WithThisSignal({ locale, alert: a }: { locale: Locale; alert: Alert }) {
  if (a.kind !== "detector" || a.p === undefined) return null;
  const trend = a.detector === "rising-trend";
  const lower = a.detector === "sampling-drop";
  const gap = a.detector === "empty-run";
  return (
    <p className="sig-with">
      <span className="sig-method-label">{t(locale, "cardMethodWith")}</span>
      <math xmlns="http://www.w3.org/1998/Math/MathML">
        <mrow>
          {trend ? (
            <>
              <mtext>share now</mtext>
              <mo>=</mo>
              <mn>{Math.round(a.observed * 100)}</mn>
              <mo>%</mo>
            </>
          ) : (
            <>
              <mi>{gap ? "L" : "y"}</mi>
              <mo>=</mo>
              <mn>{a.observed}</mn>
              {a.expected !== undefined ? (
                <>
                  <mo>,</mo>
                  <mspace width="0.6em" />
                  <mi>{gap ? "λ" : "μ"}</mi>
                  <mo>=</mo>
                  <mn>{a.expected < 0.05 && a.expected > 0 ? a.expected.toPrecision(2) : oneDecimal(locale, a.expected)}</mn>
                </>
              ) : null}
            </>
          )}
          <mo>,</mo>
          <mspace width="0.6em" />
          {trend || gap ? (
            <mi>p</mi>
          ) : (
            <mrow>
              <mi>P</mi>
              <mo>(</mo>
              <mi>Y</mi>
              <mo>{lower ? "≤" : "≥"}</mo>
              <mn>{a.observed}</mn>
              <mo>)</mo>
            </mrow>
          )}
          <mo>=</mo>
          <PValue p={a.p} />
        </mrow>
      </math>
    </p>
  );
}

/**
 * The method block under "How we calculate it": the test's name, the formula (MathML, LaTeX one click away),
 * this signal's numbers in it, the constants with their decisions, the code that runs it in TypeScript and
 * Python with copy, and the figure. The prose waits in "In plain words".
 */
export function MethodEntry({
  locale,
  method,
  values,
  alert: a,
  plain,
  explain,
}: {
  locale: Locale;
  method: Method;
  values: SnippetValues;
  alert?: Alert;
  /** The sentence and detail in words, shown under "In plain words". */
  plain?: ReactNode;
  /** The plain explanation component (the server's template), also under "In plain words". */
  explain?: ReactNode;
}) {
  const [latexState, copyLatex] = useCopy();
  const [codeState, copyCode] = useCopy();
  const [lang, setLang] = useState<"py" | "ts">("py");
  const snippet = fillSnippet(method, values);
  const tsLine = `${method.code.fn}()  // ${method.code.ts}`;
  const figure = a?.kind === "detector" && COUNT_DETECTORS.includes(a.detector) && a.p !== undefined && a.expected !== undefined;
  const said = (s: "idle" | "copied" | "manual", idle: string) =>
    s === "copied" ? t(locale, "cardRegistryCopied") : s === "manual" ? t(locale, "cardRegistryManual") : idle;
  return (
    <div className="sig-method">
      <p className="sig-method-name">{method.name[locale]}</p>
      <div className="sig-formula-row">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the MathML is our own registry text, not user input. */}
        <div className="sig-formula" dangerouslySetInnerHTML={{ __html: method.mathml }} />
        <button type="button" className="sig-copy" onClick={() => copyLatex(method.latex)}>
          {said(latexState, t(locale, "cardCopyLatex"))}
        </button>
      </div>
      {a ? <WithThisSignal locale={locale} alert={a} /> : null}
      <dl className="sig-constants">
        {method.constants.map((k) => (
          <div key={k.name} title={k.decision}>
            <dt>{k.name}</dt>
            <dd>
              {String(k.value)} <span className="sig-decision">{k.decision}</span>
            </dd>
          </div>
        ))}
      </dl>
      {figure && a?.kind === "detector" ? (
        <PoissonTail observed={a.observed} expected={a.expected as number} p={a.p as number} detector={a.detector} locale={locale} />
      ) : null}
      <div className="sig-code">
        <div className="sig-code-head">
          <div className="sig-seg" role="group" aria-label="code">
            <button type="button" aria-pressed={lang === "py"} onClick={() => setLang("py")}>
              Python
            </button>
            <button type="button" aria-pressed={lang === "ts"} onClick={() => setLang("ts")}>
              TypeScript
            </button>
          </div>
          <button type="button" className="sig-copy" onClick={() => copyCode(lang === "py" ? snippet : tsLine)}>
            {said(codeState, t(locale, "cardCopyCode"))}
          </button>
        </div>
        <pre className="sig-snippet">{lang === "py" ? snippet : tsLine}</pre>
        <p className="sig-code-note">
          {lang === "ts" || method.code.py
            ? t(locale, "cardCodeRuns", {
                fn: lang === "py" ? method.code.py : method.code.fn,
                path: lang === "py" ? "aei" : method.code.ts,
              })
            : t(locale, "cardCodeNoPy")}
        </p>
      </div>
      {plain || explain ? (
        <details className="sig-plain">
          <summary>{t(locale, "cardPlainWords")}</summary>
          {plain}
          {explain}
        </details>
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
