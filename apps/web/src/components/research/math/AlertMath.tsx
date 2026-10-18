import { NEW_IN_UNIT_DAYS } from "@aei/alerts";
import type { AeiClient, Alert, ClockCommand } from "@aei/contract";
import { LIVE_SETTINGS } from "@aei/detect";
import { ANTIBIOTICS, type IsolateRecord } from "@aei/domain";
import { csv, isolateTable } from "@aei/export";
import {
  alertEvidence,
  antibioticName,
  formatDate,
  incidentPriority,
  incidentResponsibility,
  type Locale,
  phenotypeName,
  specimenName,
  t,
  wardName,
} from "@aei/i18n";
import { fillSnippet, type Method, methodOf, type SnippetValues } from "@aei/method";
import { formatNum } from "@aei/viz";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Finding } from "../../../live.ts";
import { allSites, currentSite, homeSite } from "../../../sites.ts";
import { AlertExplanation } from "../../AlertExplanation.tsx";
import { InfoButton } from "../../Info.tsx";
import { PoissonTail, SurpriseScale } from "../../math/index.ts";
import type { BoardState, SignalKind } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { GlossedTitle } from "../feed/IncidentRow.tsx";
import { IsolateTable, useIsolates } from "../feed/Isolates.tsx";
import { type Incident, oneDecimal, shift, windowOf } from "../feed/model.ts";
import { kindLabel, signalTitle } from "../feed/names.ts";
import { SpanGroups } from "../feed/SpanChips.tsx";
import type { Spans } from "../feed/spans.ts";
import type { Slice } from "../tools/model.ts";
import { SignalAnalysis } from "./SignalAnalysis.tsx";
import "./math.css";

// The signal card (research-unified.md section 3, signals-redesign.md section 2.6): the kind and the
// one title every surface shows, the window; the two bars and the surprise; the method (formula,
// this signal's numbers, constants, code in Python, R and TypeScript); the data behind it (the
// counts the test used, the isolates, copy and download); reaches, the ready analyses, the actions.
// No line restates a number in words; the prose waits in "In plain words" (Artem, 2026-10-17).
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
  empty: "loading" | "none" | "pick" | "outside";
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
  /** How often a rule alert of this kind usually fires on this unit in a year; the card shows it beside "rule". */
  usualPerYear?: number;
}

/** The selected site's county (D-051), as the map keeps it. */
const siteCounty = () => (allSites().find((s) => s.id === currentSite()) ?? homeSite()).county;

const numberLocale = (locale: Locale) => (locale === "fi" ? "fi-FI" : "en-GB");

/** "1 in 50 000", or the capped phrase under one in a million (p below 1e-6). */
export function oddsPhrase(locale: Locale, p: number): string {
  if (p < 1e-6) return t(locale, "cardOddsCap");
  return t(locale, "cardOdds", { n: formatNum(Math.max(1, Math.round(1 / p)), numberLocale(locale)) });
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
    case "resistance-shift":
      return t(locale, "cardDetailShift", { n: a.observed, expected });
    case "volume-jump":
      return t(locale, "cardDetailVolume", { n: a.observed, expected });
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
    case "resistance-shift":
      return t(locale, "cardHowShift", { n: a.observed, expected, odds });
    case "volume-jump":
      return t(locale, "cardHowVolume", { n: a.observed, expected });
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
  usualPerYear,
}: Props) {
  const key = inc?.key ?? null;
  const how = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    if (explain <= 0 || !how.current) return;
    how.current.open = true;
    // The explanation lives in the "In plain words" fold; the request opens it too.
    const fold = how.current.querySelector<HTMLDetailsElement>(".sig-plain");
    if (fold) fold.open = true;
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
        <p className="sig-empty" role={empty === "outside" ? "status" : undefined}>
          {empty === "loading" ? t(locale, "feedIsolatesLoading") : t(locale, empty === "outside" ? "cardOutside" : "cardEmpty")}
        </p>
      </aside>
    );

  const mine = findings.filter((f) => ids.has(f.record.isolateId) && (inc.phenotypes.length === 0 || inc.phenotypes.includes(f.phenotype)));
  const unseen = mine.filter((f) => !f.seen);
  const lead = inc.lead;
  const win = windowOf(inc);
  const specimen = lead.kind === "cpe" ? lead.specimen : null;
  const doctor = `#doctor?${new URLSearchParams({ ...(inc.ward ? { unit: inc.ward } : {}), ...(specimen ? { site: specimen } : {}) }).toString()}`;
  const onDay = asOf === lead.date;
  const method = methodOf(lead);
  const test = testWindows(lead);
  const snippetValues: SnippetValues = {
    ward: inc.ward ?? "",
    organism: "organism" in lead ? (lead.organism ?? "") : "",
    from: win.from,
    to: win.to,
    phenotype: "phenotype" in lead ? (lead.phenotype ?? "") : "",
    profile: lead.kind === "detector" ? (lead.profile ?? "") : "",
    antibiotic: lead.kind === "detector" ? (lead.antibiotic ?? "") : "",
    ...(test ? { testFrom: test.window[0], testTo: test.window[1] } : {}),
    ...(lead.kind === "detector" ? { observed: String(lead.observed) } : {}),
    ...(lead.kind === "detector" && lead.expected !== undefined ? { expected: String(lead.expected) } : {}),
  };
  const plain = (
    <>
      <p className="sig-how-text">{howSentence(locale, lead)}</p>
      {howDetail(locale, lead) ? <p className="sig-detail">{howDetail(locale, lead)}</p> : null}
      <p className="feed-evidence">{t(locale, "feedLatestEvidence", { evidence: alertEvidence(locale, lead) })}</p>
      <p className="feed-owner">{incidentResponsibility(locale, inc.members)}</p>
    </>
  );
  const explanation = (
    <div className="math-explain">
      <AlertExplanation client={client} id={lead.id} locale={locale} openKey={explain} />
    </div>
  );

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
          {/* The board hands the doctor's view its ward: one click, the case already set to this unit. */}
          {inc.ward ? (
            <a className="sig-pivot" href={`#doctor?unit=${encodeURIComponent(inc.ward)}`}>
              {t(locale, "cardTreatHere", { unit: wardName(locale, inc.ward as never) })}
            </a>
          ) : null}
        </div>

        <Numbers locale={locale} alert={lead} kind={inc.kind} perYear={usualPerYear} />
        <p className="sig-where">{whereLine(locale, inc, win)}</p>

        {/* The method stands open in the layer; the row's "Open calculation and explanation" opens it in the window too. */}
        <section className="sig-how-section" aria-labelledby={`sig-how-${inc.key}`}>
          <details className="sig-how" ref={how} open={onBack ? true : undefined}>
            <summary className="sig-how-head">
              <h3 className="sig-section-title" id={`sig-how-${inc.key}`}>
                {t(locale, "cardHow")}
              </h3>
            </summary>
            {method ? (
              <MethodEntry locale={locale} method={method} values={snippetValues} alert={lead} plain={plain} explain={explanation} />
            ) : (
              <details className="sig-plain">
                <summary>{t(locale, "cardPlainWords")}</summary>
                {plain}
                {explanation}
              </details>
            )}
          </details>
        </section>

        <DataBehind
          locale={locale}
          incident={inc}
          method={method}
          status={iso.status}
          matched={iso.matched}
          retry={iso.retry}
          asOf={asOf ?? lead.date}
        />

        {spans ? (
          <details className="sig-reach">
            <summary>{t(locale, "cardReachCount", { n: spans.next.length + spans.trail.length + spans.also.length })}</summary>
            <SpanGroups locale={locale} spans={spans} onUnit={(u) => onChange({ focus: u as BoardState["focus"] })} />
          </details>
        ) : null}

        {/* Two ready results on the signal's own slice, from the Tools model; "Open in Tools" continues there. */}
        <details className="sig-analyse" open>
          <summary>{t(locale, "cardAnalyse")}</summary>
          <SignalAnalysis client={client} locale={locale} incident={inc} onOpenTools={onOpenTools} />
        </details>
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

type CopyState = "idle" | "copied" | "manual";

/** Copies text; the state tells the button what to say. */
function useCopy(): [state: CopyState, copy: (text: string) => void] {
  const [state, setState] = useState<CopyState>("idle");
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

/** One copy button: says "Copied" on the button and in a polite live region beside it. */
function CopyButton({ locale, label, text }: { locale: Locale; label: string; text: () => string }) {
  const [state, copy] = useCopy();
  const said = state === "copied" ? t(locale, "cardRegistryCopied") : state === "manual" ? t(locale, "cardCopyManual") : "";
  return (
    <>
      <button type="button" className="sig-copy" onClick={() => copy(text())}>
        {said || label}
      </button>
      <span className="visually-hidden" role="status">
        {said}
      </span>
    </>
  );
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
      <math>
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
  const [lang, setLang] = useState<"py" | "r" | "ts">("py");
  const code = lang === "ts" ? `${method.code.fn}()  // ${method.code.ts}` : fillSnippet(method, values, lang);
  const figure = a?.kind === "detector" && COUNT_DETECTORS.includes(a.detector) && a.p !== undefined && a.expected !== undefined;
  const note =
    lang === "r"
      ? t(locale, "cardCodeRuns", { fn: "read_package(), as_amr()", path: "libs/utils/r (D-063)" })
      : lang === "ts" || method.code.py
        ? t(locale, "cardCodeRuns", { fn: lang === "py" ? method.code.py : method.code.fn, path: lang === "py" ? "aei" : method.code.ts })
        : t(locale, "cardCodeNoPy");
  return (
    <div className="sig-method">
      <p className="sig-method-name">{method.name[locale]}</p>
      <div className="sig-formula-row">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the MathML is our own registry text, not user input. */}
        <div className="sig-formula" dangerouslySetInnerHTML={{ __html: method.mathml }} />
        <CopyButton locale={locale} label={t(locale, "cardCopyLatex")} text={() => method.latex} />
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
          <div className="sig-seg" role="group" aria-label={t(locale, "cardCodeLanguage")}>
            {LANGS.map(([id, name]) => (
              <button key={id} type="button" aria-pressed={lang === id} onClick={() => setLang(id)}>
                {name}
              </button>
            ))}
          </div>
          <CopyButton locale={locale} label={t(locale, "cardCopyCode")} text={() => code} />
        </div>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the snippet scrolls sideways, so the keyboard needs to reach it. */}
        <pre className="sig-snippet" tabIndex={0}>
          {code}
        </pre>
        <p className="sig-code-note">{note}</p>
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

const LANGS = [
  ["py", "Python"],
  ["r", "R"],
  ["ts", "TypeScript"],
] as const;

/** The test's own window and baseline, as the detectors compute them (libs/utils/detect/src/detectors.ts). */
export function testWindows(a: Alert): { window: [string, string]; baseline: [string, string] } | null {
  if (a.kind !== "detector" || a.detector === "rising-trend") return null;
  const s = LIVE_SETTINGS;
  const [days, base] =
    a.detector === "profile-excess"
      ? [s.profileExcess.windowDays, s.profileExcess.baselineDays]
      : a.detector === "phenotype-excess"
        ? [s.phenotypeExcess.windowDays, s.phenotypeExcess.baselineDays]
        : a.detector === "sampling-drop"
          ? [s.samplingDrop.windowDays, s.samplingDrop.baselineDays]
          : [a.observed, s.emptyRun.baselineDays];
  const from = shift(a.date, 1 - days);
  return { window: [from, a.date], baseline: [shift(from, -base), shift(from, -1)] };
}

/** One row of the counts table: the formula's letter (if any), the quantity, the value. */
type CountRow = { sym?: string; name: string; value: string };

/** The counts the test used, read off the alert and the method's constants; nothing is computed anew. */
export function countRows(locale: Locale, a: Alert, method: Method | null): CountRow[] {
  const rows: CountRow[] = [];
  const range = ([from, to]: [string, string]) => `${from} – ${to}`;
  const alpha = method?.constants.find((k) => k.name === "alpha");
  if (a.kind === "detector") {
    const gap = a.detector === "empty-run";
    const trend = a.detector === "rising-trend";
    rows.push({
      sym: trend ? undefined : gap ? "L" : "y",
      name: t(locale, trend ? "cardRowShare" : gap ? "cardRowDays" : "cardRowObserved"),
      value: String(a.observed),
    });
    if (a.expected !== undefined)
      rows.push({
        sym: gap ? "λ" : "μ",
        name: t(locale, gap ? "cardRowRate" : "cardRowExpected"),
        value: String(Number(a.expected.toPrecision(4))),
      });
    // The p row is named by the tail it is, the formula's own words.
    const tail = trend ? t(locale, "cardRowPTrend") : gap ? "e^(−λL)" : a.detector === "sampling-drop" ? "P(Y ≤ y)" : "P(Y ≥ y)";
    if (a.p !== undefined) rows.push({ sym: "p", name: tail, value: a.p < 0.001 ? a.p.toExponential(2) : a.p.toPrecision(3) });
    if (alpha) rows.push({ sym: "α", name: `${t(locale, "cardRowAlpha")} (${alpha.decision})`, value: String(alpha.value) });
    const w = testWindows(a);
    if (w) {
      rows.push({ name: t(locale, "cardRowWindow"), value: range(w.window) });
      rows.push({ name: t(locale, "cardRowBaseline"), value: range(w.baseline) });
    }
  } else {
    rows.push({ name: t(locale, "cardRowDate"), value: a.date });
  }
  if (a.ward) rows.push({ name: t(locale, "cardRowUnit"), value: a.ward });
  if ("organism" in a && a.organism) rows.push({ name: t(locale, "feedColOrganism"), value: a.organism });
  if ("phenotype" in a && a.phenotype) rows.push({ name: t(locale, "feedColPhenotypes"), value: phenotypeName(a.phenotype) });
  if (a.kind === "detector" && a.profile) rows.push({ name: t(locale, "cardRowProfile"), value: a.profile });
  if (a.kind === "detector" && a.antibiotic)
    rows.push({ name: t(locale, "cardRowAntibiotic"), value: antibioticName(locale, a.antibiotic) });
  if ("specimen" in a && a.specimen) rows.push({ name: t(locale, "feedColSpecimen"), value: specimenName(locale, a.specimen) });
  if ("isolateId" in a && a.isolateId) rows.push({ name: t(locale, "cardRowIsolate"), value: a.isolateId });
  if (a.kind === "detector") rows.push({ name: t(locale, "cardRowDetector"), value: a.detector });
  return rows;
}

/** One line: "AEI, <method>, D-020, D-042, as of 2025-06-09, <the page's URL with its hash>". */
export function citation(method: Method | null, asOf: string, url: string): string {
  return ["AEI (Antibiotic Efficacy Indicator)", method?.name.en ?? "", ...(method?.decisions ?? []), `as of ${asOf}`, url]
    .filter(Boolean)
    .join(", ");
}

/** The data behind the signal: the counts the test used, the isolates, and copy, download and cite. */
function DataBehind({
  locale,
  incident: inc,
  method,
  status,
  matched,
  retry,
  asOf,
}: {
  locale: Locale;
  incident: Incident;
  method: Method | null;
  status: "loading" | "error" | "ready" | "data";
  matched: IsolateRecord[];
  retry: () => void;
  asOf: string;
}) {
  const a = inc.lead;
  const rows = countRows(locale, a, method);
  const id = `sig-data-${inc.key}`;
  const table = () =>
    csv(
      isolateTable(
        matched,
        ANTIBIOTICS.map((x) => x.code),
      ),
    );
  const filename = `aei-signal-${a.id.replace(/[^A-Za-z0-9-]+/g, "-")}-${asOf}.csv`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([`﻿${table()}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const csvReady = status === "ready" && matched.length > 0;
  return (
    <section className="sig-data" aria-labelledby={id}>
      <h3 className="sig-section-title" id={id}>
        {t(locale, "cardData")}
      </h3>
      <table className="sig-counts">
        <caption className="visually-hidden">{t(locale, "cardDataCounts")}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">
                {r.sym ? <i className="sig-sym">{r.sym}</i> : null}
                {r.name}
              </th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {status === "data" ? null : (
        <IsolateTable locale={locale} status={status} matched={matched} retry={retry} profile={a.kind === "detector" && !!a.profile} />
      )}
      <div className="sig-data-actions">
        {csvReady ? (
          <>
            <CopyButton locale={locale} label={t(locale, "cardCopyCsv")} text={table} />
            <button type="button" className="sig-copy" onClick={download} title={filename}>
              {t(locale, "cardDownloadCsv")}
            </button>
          </>
        ) : null}
        <CopyButton locale={locale} label={t(locale, "cardCopyJson")} text={() => JSON.stringify(a, null, 2)} />
        <CopyButton
          locale={locale}
          label={t(locale, "cardCopyCitation")}
          text={() => citation(method, asOf, typeof location === "undefined" ? "" : location.href)}
        />
      </div>
    </section>
  );
}

/**
 * The card's three numbers, each one highlighted: seen, expected, and the chance of that by luck ("1 in N"), under the
 * kind's coloured tag. Trends show "from X to Y"; rules show "rule" and the usual count a year instead of a test; a
 * detector whose gates failed (it has no p) says "too few results" rather than a number.
 */
function Numbers({ locale, alert: a, kind, perYear }: { locale: Locale; alert: Alert; kind: SignalKind; perYear?: number }) {
  if (a.kind === "carrier") return null;
  const tag = (
    <span className="sig-kind" data-kind={kind}>
      {kindLabel(locale, kind)}
    </span>
  );
  if (a.kind !== "detector") {
    return (
      <div className="sig-tiles" role="group" aria-label={t(locale, "cardRule")}>
        {tag}
        <Tile label={t(locale, "cardSeen")} value={t(locale, "cardPatientOne")} />
        {perYear === undefined ? (
          <Tile label="" value={t(locale, "cardRule")} />
        ) : (
          <Tile label={t(locale, "cardRule")} value={t(locale, "cardPerYear", { n: oneDecimal(locale, perYear) })} />
        )}
      </div>
    );
  }
  const trend = a.detector === "rising-trend";
  const exp = a.expected;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const seen = trend
    ? exp === undefined
      ? pct(a.observed)
      : t(locale, "cardFromTo", { from: pct(exp), to: pct(a.observed) })
    : a.detector === "sampling-drop" || a.detector === "volume-jump"
      ? t(locale, "cardCultures", { n: a.observed })
      : a.detector === "empty-run"
        ? t(locale, "cardDays", { n: a.observed })
        : a.detector === "resistance-shift"
          ? t(locale, "cardResults", { n: a.observed })
          : t(locale, a.observed === 1 ? "cardPatientOne" : "cardPatients", { n: a.observed });
  const chance =
    a.p !== undefined ? (
      <Tile label={t(locale, "cardByChance")} value={oddsPhrase(locale, a.p)} hot>
        <InfoButton locale={locale} align="end" label={t(locale, "cardSurpriseInfo")}>
          <SurpriseScale p={a.p} detector={a.detector} locale={locale} />
        </InfoButton>
      </Tile>
    ) : trend ? null : (
      <Tile label={t(locale, "cardByChance")} value={t(locale, "cardTooFew")} />
    );
  return (
    <div className="sig-tiles" role="group" aria-label={`${t(locale, "cardSeen")} ${seen}`}>
      {tag}
      <Tile label={t(locale, "cardSeen")} value={seen} />
      {!trend && exp !== undefined ? <Tile label={t(locale, "cardExpected")} value={usualText(locale, exp)} /> : null}
      {chance}
    </div>
  );
}

function Tile({ label, value, hot, children }: { label: string; value: string; hot?: boolean; children?: ReactNode }) {
  return (
    <div className="sig-tile" data-hot={hot || undefined}>
      <span className="sig-tile-label">{label}</span>
      <b className="sig-num">{value}</b>
      {children}
    </div>
  );
}
