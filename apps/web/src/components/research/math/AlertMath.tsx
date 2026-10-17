import type { AeiClient, Alert } from "@aei/contract";
import { alertEvidence, formatDate, formatDateNumeric, incidentResponsibility, type Locale, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import type { Finding } from "../../../live.ts";
import { AlertExplanation } from "../../AlertExplanation.tsx";
import { InfoButton } from "../../Info.tsx";
import type { BoardState } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { IsolateList, useIsolates } from "../feed/Isolates.tsx";
import { formatP, type Incident, oneDecimal, windowOf } from "../feed/model.ts";
import { kindLabel, resistantFromProfile, shortTitle, surpriseOf, unitLabel } from "../feed/names.ts";
import { SpanGroups } from "../feed/SpanChips.tsx";
import type { Spans } from "../feed/spans.ts";
import "./math.css";

// The alert-math panel (spec-v2 5 and 6.2): observed against usual as two
// bars, the surprise (−log10 p) as the big number, the test named in one
// line, "rule, no test" for sentinels, and the isolates one click away.

/** Isolates shown in the panel itself (U2: one click, not two); the rest open in the full list. */
const INLINE_ISOLATES = 3;

const TEST = {
  "phenotype-excess": "feedTestPhenotype",
  "profile-excess": "feedTestProfile",
  "rising-trend": "feedTestTrend",
  "sampling-drop": "feedTestSampling",
  "empty-run": "feedTestSampling",
} as const;

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
}

export function AlertMath({ client, locale, incident: inc, spans, findings, onChange, acknowledge, empty }: Props) {
  const [view, setView] = useState<"math" | "isolates">("math");
  const key = inc?.key;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new incident returns to the numbers.
  useEffect(() => setView("math"), [key]);
  const iso = useIsolates(client, inc);

  const ids = useMemo(() => {
    const s = new Set(iso.matched.map((r) => r.isolateId));
    if (inc) for (const a of inc.members) if ("isolateId" in a) s.add(a.isolateId);
    return s;
  }, [iso.matched, inc]);
  if (!inc)
    return (
      <aside className="math" aria-labelledby="math-title" aria-busy={empty === "loading"}>
        <header className="math-head">
          <h2 id="math-title">{t(locale, "feedMathTitle")}</h2>
        </header>
        <p className="math-empty">{empty === "loading" ? t(locale, "feedIsolatesLoading") : t(locale, "feedPickSignal")}</p>
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

  return (
    <aside className="math" aria-labelledby="math-title" data-kind={inc.kind}>
      <header className="math-head">
        <h2 id="math-title">{t(locale, "feedMathTitle")}</h2>
        <InfoButton locale={locale} align="end">
          {t(locale, "feedMathHelp")}
        </InfoButton>
      </header>

      {view === "isolates" ? (
        <div className="math-scroll">
          <button type="button" className="math-back" onClick={() => setView("math")}>
            ← {t(locale, "feedBack")}
          </button>
          <h3 className="math-sub">{t(locale, "feedIsolatesBehind")}</h3>
          <IsolateList locale={locale} status={iso.status} matched={iso.matched} retry={iso.retry} window={win} dataNote={dataNote} />
        </div>
      ) : (
        <div className="math-scroll">
          <div className="math-who">
            <span className="math-kind">
              <KindGlyph kind={inc.kind} />
              {kindLabel(locale, inc.kind)}
            </span>
            <b className="math-name">{shortTitle(locale, lead)}</b>
            <span className="math-meta">
              {unitLabel(locale, inc.ward)} · {formatDateNumeric(inc.date)}
            </span>
            <span>{t(locale, inc.members.length === 1 ? "feedIncidentOne" : "feedIncidentMany", { n: inc.members.length })}</span>
            <span className="feed-evidence">{t(locale, "feedLatestEvidence", { evidence: alertEvidence(locale, lead) })}</span>
            <span className="feed-owner">{incidentResponsibility(locale, inc.members)}</span>
          </div>

          <div className="math-explain">
            <AlertExplanation client={client} id={lead.id} locale={locale} />
          </div>

          <AlertNumbers locale={locale} alert={lead} />

          <ul className="math-members" aria-label={t(locale, "feedMembers")}>
            {inc.members.map((a) => (
              <li key={a.id} aria-current={a.id === lead.id ? "true" : undefined}>
                <time dateTime={a.date}>{formatDateNumeric(a.date)}</time>
                <span className="math-mem-what">
                  {shortTitle(locale, a)} · {alertEvidence(locale, a)}
                </span>
              </li>
            ))}
          </ul>
          <p className="feed-note">{t(locale, "feedMembersNote")}</p>

          {spans ? (
            <section className="math-spans" aria-labelledby="math-spans-title">
              <h3 id="math-spans-title" className="math-sub">
                {t(locale, "feedSpans")}
                <InfoButton locale={locale} align="end">
                  {t(locale, "feedSpanNote")}
                </InfoButton>
              </h3>
              <SpanGroups locale={locale} spans={spans} onUnit={(u) => onChange({ focus: u as BoardState["focus"] })} />
            </section>
          ) : null}

          {inc.kind !== "data" ? (
            <section className="math-isolates" aria-labelledby="math-iso-title">
              <h3 id="math-iso-title" className="math-sub">
                {t(locale, "feedIsolatesBehind")}
              </h3>
              <IsolateList
                locale={locale}
                status={iso.status}
                matched={iso.matched}
                retry={iso.retry}
                window={win}
                dataNote={dataNote}
                limit={INLINE_ISOLATES}
              />
            </section>
          ) : null}
        </div>
      )}

      <footer className="math-actions">
        {view === "math" ? (
          <button type="button" className="math-primary" onClick={() => setView("isolates")}>
            {inc.kind === "data"
              ? t(locale, "feedIsolates")
              : iso.status === "ready" && iso.matched.length > INLINE_ISOLATES
                ? t(locale, "feedIsolatesAll", { n: iso.matched.length })
                : t(locale, "feedIsolatesOpen", { n: iso.status === "ready" ? iso.matched.length : "…" })}{" "}
            →
          </button>
        ) : null}
        <a className="math-btn" href={doctor}>
          {t(locale, "feedOpenInDoctor")}
        </a>
        <button type="button" className="math-btn" onClick={() => onChange({ panel: "grid", phenotype: inc.phenotypes[0] ?? null })}>
          {t(locale, "feedShowInGrid")}
        </button>
        <button
          type="button"
          className="math-btn"
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

/** One alert's numbers: two bars, the big surprise number, the test in one line. */
function AlertNumbers({ locale, alert: a }: { locale: Locale; alert: Alert }) {
  if (a.kind !== "detector") {
    return (
      <div className="math-block">
        <p className="math-rule">{t(locale, "feedRuleNoTest")}</p>
        <p className="math-line">
          {a.kind === "new-in-unit"
            ? a.previous
              ? t(locale, "feedPrevious", { date: formatDate(locale, a.previous) })
              : t(locale, "feedNoneBefore")
            : a.kind === "cpe"
              ? `${a.organism}`
              : ""}
        </p>
      </div>
    );
  }
  const trend = a.detector === "rising-trend";
  const fmt = (n: number) => (trend ? `${Math.round(n * 100)} %` : oneDecimal(locale, n));
  const fmtObs = (n: number) => (trend ? fmt(n) : String(n));
  const obs = a.observed;
  const exp = a.expected;
  // A share is already on a 0 to 1 scale; counts are scaled to the larger of the two.
  const max = trend ? 1 : Math.max(obs, exp ?? 0) || 1;
  const s = surpriseOf(a);
  // An empty-run alert has two facts in two units (days without cultures, cultures per day):
  // no shared bar, each fact in a sentence.
  const empty = a.detector === "empty-run";
  return (
    <div className="math-block">
      <div className="math-big">
        {s !== null ? (
          <>
            <b className="math-bignum">{oneDecimal(locale, s)}</b>
            <span className="math-biglabel">
              {t(locale, "feedSurprise")}
              {a.p !== undefined ? <span className="math-p"> · p {formatP(locale, a.p).replace("= ", "")}</span> : null}
            </span>
          </>
        ) : null}
      </div>
      {empty ? (
        <p className="math-line">
          {t(locale, "feedEmptyRun", {
            days: obs,
            rate: oneDecimal(locale, exp ?? 0),
            p: a.p !== undefined ? formatP(locale, a.p).replace("= ", "") : "",
          })}
        </p>
      ) : (
        <div
          className="math-bars"
          role="group"
          aria-label={`${t(locale, "feedBarObserved")} ${fmtObs(obs)}${exp !== undefined ? `, ${t(locale, "feedUsual")} ${fmt(exp)}` : ""}`}
        >
          <Bar label={t(locale, "feedBarObserved")} value={fmtObs(obs)} share={obs / max} tone="obs" />
          {exp !== undefined ? <Bar label={t(locale, "feedUsual")} value={fmt(exp)} share={exp / max} tone="usual" /> : null}
        </div>
      )}
      {empty ? null : <p className="math-line">{t(locale, TEST[a.detector])}</p>}
      {a.detector === "profile-excess" && a.profile ? (
        <p className="math-line">{t(locale, "feedResistantTo", { names: resistantFromProfile(locale, a.profile).join(", ") })}</p>
      ) : null}
    </div>
  );
}

function Bar({ label, value, share, tone }: { label: string; value: string; share: number; tone: "obs" | "usual" }) {
  return (
    <div className="math-bar" data-tone={tone}>
      <span className="math-bar-label">{label}</span>
      <span className="math-bar-track" aria-hidden="true">
        <i style={{ width: `${Math.max(2, Math.round(share * 100))}%` }} />
      </span>
      <b className="math-bar-value">{value}</b>
    </div>
  );
}
