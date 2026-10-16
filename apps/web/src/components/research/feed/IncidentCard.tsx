import type { AeiClient, Alert } from "@aei/contract";
import { ANTIBIOTICS, type IsolateRecord } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Finding } from "../../../live.ts";
import { AlertExplanation } from "../../AlertExplanation.tsx";
import type { BoardState, SignalKind } from "../board.ts";
import { Chevron, KindGlyph } from "./glyphs.tsx";
import { formatP, type Incident, isolatesBehind, oneDecimal, stayDay, windowOf } from "./model.ts";

const KIND_LABEL = {
  sentinel: "feedKindSentinel",
  cluster: "feedKindCluster",
  trend: "feedKindTrend",
  divergence: "feedKindDivergence",
  data: "feedKindData",
} as const;

const FIRST_STEP = {
  sentinel: "feedFirstStepSentinel",
  cluster: "feedFirstStepCluster",
  trend: "feedFirstStepTrend",
  data: "feedFirstStepData",
  divergence: "feedFirstStepCluster",
} as const;

export const kindLabel = (locale: Locale, kind: SignalKind) => t(locale, KIND_LABEL[kind]);

export function unitLabel(locale: Locale, ward: string | null): string {
  return ward ? wardName(locale, ward as never) : t(locale, "hospitalWide");
}

export function incidentTitle(locale: Locale, a: Alert): string {
  const unit = unitLabel(locale, a.ward);
  switch (a.kind) {
    case "cpe":
      return t(locale, "feedCpeTitle", { organism: a.organism });
    case "new-in-unit":
      return t(locale, "feedNewTitle", { phenotype: phenotypeName(a.phenotype) });
    case "carrier":
      return unit;
    case "detector": {
      if (a.detector === "sampling-drop" || a.detector === "empty-run")
        return t(locale, "feedDataTitle", { unit, observed: a.observed, expected: oneDecimal(locale, a.expected ?? 0) });
      if (a.detector === "rising-trend")
        return t(locale, "feedTrendTitle", {
          antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
          organism: a.organism ?? "",
          observed: `${Math.round(a.observed * 100)} %`,
        });
      return t(locale, "feedClusterTitle", {
        what: a.phenotype ? phenotypeName(a.phenotype) : (a.organism ?? ""),
        unit,
        observed: a.observed,
        expected: oneDecimal(locale, a.expected ?? 0),
      });
    }
  }
}

/** Counts and baseline of one alert, as one line. */
function baselineLine(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return t(locale, "feedCpeCounts", { organism: a.organism, specimen: specimenName(locale, a.specimen) });
  if (a.kind === "new-in-unit")
    return a.previous ? t(locale, "feedNoneSince", { date: formatDate(locale, a.previous, "long") }) : t(locale, "feedNoneBefore");
  if (a.kind !== "detector") return "";
  const parts: string[] = [];
  if (a.detector === "rising-trend") {
    parts.push(t(locale, "feedObserved", { n: `${Math.round(a.observed * 100)} %` }));
    if (a.expected !== undefined) parts.push(t(locale, "feedExpected", { n: `${Math.round(a.expected * 100)} %` }));
  } else {
    parts.push(t(locale, "feedObserved", { n: a.observed }));
    if (a.expected !== undefined) parts.push(t(locale, "feedExpected", { n: oneDecimal(locale, a.expected) }));
  }
  if (a.p !== undefined) parts.push(t(locale, "feedP", { p: formatP(locale, a.p) }));
  if (a.profile) parts.push(t(locale, "feedProfile", { profile: a.profile }));
  return parts.join(" · ");
}

function memberLabel(locale: Locale, a: Alert): string {
  const what = a.kind === "detector" ? (a.phenotype ? phenotypeName(a.phenotype) : (a.organism ?? a.detector)) : phenotypeLabel(a);
  return `${formatDate(locale, a.date)} · ${what} · ${baselineLine(locale, a)}`;
}

const phenotypeLabel = (a: Alert) => (a.kind === "cpe" ? "CPE" : "phenotype" in a && a.phenotype ? phenotypeName(a.phenotype) : a.kind);

interface Props {
  client: AeiClient;
  locale: Locale;
  incident: Incident;
  open: boolean;
  findings: Finding[];
  onToggle: (key: string | null) => void;
  onChange: (patch: Partial<BoardState>) => void;
  acknowledge: (ids: string[]) => void;
}

export function IncidentCard({ client, locale, incident: inc, open, findings, onToggle, onChange, acknowledge }: Props) {
  const ref = useRef<HTMLElement>(null);
  const headId = `feed-head-${inc.key}`;
  const bodyId = `feed-body-${inc.key}`;

  // An incident opened from the URL scrolls into view once.
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when `open` first becomes true on mount only.
  useEffect(() => {
    if (open && first.current) ref.current?.scrollIntoView({ block: "start" });
    first.current = false;
  }, []);

  // A card opened by click scrolls so its header and the isolates are in view.
  const prevOpen = useRef(open);
  useEffect(() => {
    const was = prevOpen.current;
    prevOpen.current = open;
    if (!open || was) return;
    const id = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = () => {
    onToggle(null);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(".feed-head")?.focus());
  };

  const date = formatDate(locale, inc.date, "long");
  const multi = inc.members.length > 1;
  return (
    <article
      ref={ref}
      className="feed-card"
      data-kind={inc.kind}
      data-open={open}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        id={headId}
        className="feed-head"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => onToggle(open ? null : inc.key)}
      >
        <span className="feed-kind">
          <KindGlyph kind={inc.kind} />
          {kindLabel(locale, inc.kind)}
        </span>
        <span className="feed-title">{incidentTitle(locale, inc.lead)}</span>
        <span className="feed-meta">
          <span>{unitLabel(locale, inc.ward)}</span>
          <span>{date}</span>
          {multi ? <span>{t(locale, "feedFirstSeen", { date: formatDate(locale, inc.firstDate) })}</span> : null}
          {multi ? <span>{t(locale, "feedAlerts", { n: inc.members.length })}</span> : null}
        </span>
        <span className="feed-base">{baselineLine(locale, inc.lead)}</span>
        <Chevron />
      </button>
      {open ? (
        <section id={bodyId} className="feed-body" aria-labelledby={headId}>
          <IncidentBody client={client} locale={locale} incident={inc} findings={findings} onChange={onChange} acknowledge={acknowledge} />
        </section>
      ) : null}
    </article>
  );
}

/** The resistant drugs by name; the full profile sits in a disclosure, in words, never colour alone. */
function ResistanceLine({ locale, record: r }: { locale: Locale; record: IsolateRecord }) {
  const resistant = ANTIBIOTICS.filter((a) => r.results[a.code] === "R");
  const word = (code: (typeof ANTIBIOTICS)[number]["code"]) =>
    r.results[code] === "R" ? t(locale, "feedResR") : r.results[code] === "S" ? t(locale, "feedResS") : t(locale, "feedResNone");
  return (
    <details className="feed-res">
      <summary>
        <span className="feed-res-line">
          {resistant.length > 0
            ? t(locale, "feedResistantTo", { names: resistant.map((a) => antibioticName(locale, a.code)).join(", ") })
            : t(locale, "feedResistantNone")}
        </span>
      </summary>
      <p className="feed-note">{t(locale, "feedFullProfile")}</p>
      <ul className="feed-profile">
        {ANTIBIOTICS.map((a) => (
          <li key={a.code} data-result={r.results[a.code] ?? "none"}>
            <span>{antibioticName(locale, a.code)}</span>
            <b>{word(a.code)}</b>
          </li>
        ))}
      </ul>
    </details>
  );
}

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; records: IsolateRecord[] };

function IncidentBody({
  client,
  locale,
  incident: inc,
  findings,
  onChange,
  acknowledge,
}: Pick<Props, "client" | "locale" | "findings" | "onChange" | "acknowledge"> & { incident: Incident }) {
  const isData = inc.kind === "data";
  const win = windowOf(inc);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const organism = inc.lead.kind === "detector" ? inc.lead.organism : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger.
  useEffect(() => {
    if (isData) return;
    let stale = false;
    setLoad({ status: "loading" });
    client
      .isolates({ ward: inc.ward ?? undefined, from: win.from, to: win.to })
      .then((r) => !stale && setLoad({ status: "ready", records: r.records }))
      .catch(() => !stale && setLoad({ status: "error" }));
    return () => {
      stale = true;
    };
  }, [client, inc.key, inc.ward, win.from, win.to, isData, organism, attempt]);

  const matched = useMemo(() => (load.status === "ready" ? isolatesBehind(inc, load.records) : []), [load, inc]);
  const ids = useMemo(() => {
    const s = new Set(matched.map((r) => r.isolateId));
    for (const a of inc.members) if ("isolateId" in a) s.add(a.isolateId);
    return s;
  }, [matched, inc]);
  const mine = findings.filter((f) => ids.has(f.record.isolateId) && (inc.phenotypes.length === 0 || inc.phenotypes.includes(f.phenotype)));
  const unseen = mine.filter((f) => !f.seen);

  const lead = inc.lead;
  const specimen = lead.kind === "cpe" ? lead.specimen : null;
  const doctor = `#doctor?${new URLSearchParams({ ...(inc.ward ? { unit: inc.ward } : {}), ...(specimen ? { site: specimen } : {}) }).toString()}`;
  const phenotype = inc.phenotypes[0] ?? null;

  return (
    <>
      <h3 className="feed-sub">{t(locale, "feedIsolatesBehind")}</h3>
      {isData ? (
        <p className="feed-note">
          {t(locale, "feedNoIsolatesData", {
            observed: lead.kind === "detector" ? lead.observed : 0,
            expected: lead.kind === "detector" ? oneDecimal(locale, lead.expected ?? 0) : "0",
          })}
        </p>
      ) : load.status === "loading" ? (
        <p className="feed-note" role="status">
          {t(locale, "feedIsolatesLoading")}
        </p>
      ) : load.status === "error" ? (
        <p className="feed-note" role="alert">
          {t(locale, "feedIsolatesError")}{" "}
          <button type="button" className="link" onClick={() => setAttempt(attempt + 1)}>
            {t(locale, "retry")}
          </button>
        </p>
      ) : matched.length === 0 ? (
        <p className="feed-note">{t(locale, "feedIsolatesNone")}</p>
      ) : (
        <>
          <p className="feed-note">
            {t(locale, matched.length === 1 ? "feedIsolatesCountOne" : "feedIsolatesCount", {
              n: matched.length,
              from: formatDate(locale, win.from),
              to: formatDate(locale, win.to),
            })}
          </p>
          <ul className="feed-isolates">
            {matched.map((r) => {
              const day = stayDay(r);
              return (
                <li key={r.isolateId}>
                  <span className="feed-iso-main">
                    <b>{formatDate(locale, r.sampleDate)}</b>
                    <span className="mono" title={t(locale, "feedColPatient")}>
                      {r.patientId}
                    </span>
                    <i title={t(locale, "feedColOrganism")}>{r.organism}</i>
                    <span title={t(locale, "feedColSpecimen")}>{specimenName(locale, r.specimen)}</span>
                  </span>
                  <span className="feed-iso-sub">
                    <span title={t(locale, "feedColStay")}>
                      {day === null ? t(locale, "outpatient") : t(locale, "feedStayDay", { n: day })}
                    </span>
                    <span title={t(locale, "feedColPhenotypes")}>{r.phenotypes.map(phenotypeName).join(", ") || "–"}</span>
                  </span>
                  <ResistanceLine locale={locale} record={r} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <dl className="feed-facts">
        {inc.members.length > 1 ? (
          <div>
            <dt>{t(locale, "feedMembers")}</dt>
            <dd>
              <ul className="feed-members">
                {inc.members.map((a) => (
                  <li key={a.id}>
                    <span>{memberLabel(locale, a)}</span>
                    <AlertExplanation client={client} id={a.id} locale={locale} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : (
          <div>
            <AlertExplanation client={client} id={lead.id} locale={locale} />
          </div>
        )}
        <div>
          <dt>{t(locale, "feedFirstStepLabel")}</dt>
          <dd>{t(locale, FIRST_STEP[inc.kind])}</dd>
        </div>
      </dl>

      <div className="feed-actions">
        <a className="feed-btn" href={doctor}>
          {t(locale, "feedOpenInDoctor")}
        </a>
        <button type="button" className="feed-btn" onClick={() => onChange({ panel: "grid", unit: inc.ward, phenotype: phenotype })}>
          {t(locale, "feedShowInGrid")}
        </button>
        <button
          type="button"
          className="feed-btn"
          disabled={unseen.length === 0}
          title={mine.length === 0 ? t(locale, "feedSeenNone") : undefined}
          onClick={() => acknowledge(unseen.map((f) => f.id))}
        >
          {mine.length > 0 && unseen.length === 0 ? t(locale, "feedSeen") : t(locale, "feedMarkSeen")}
          {unseen.length > 0 ? ` (${unseen.length})` : ""}
        </button>
      </div>
    </>
  );
}
