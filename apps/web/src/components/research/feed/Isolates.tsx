import type { AeiClient } from "@aei/contract";
import { ANTIBIOTICS, type IsolateRecord } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import { type Incident, isolatesBehind, stayDay, windowOf } from "./model.ts";

// The isolates behind an incident (U2): one click from the signal.

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; records: IsolateRecord[] };

export function useIsolates(client: AeiClient, inc: Incident | null) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const isData = inc?.kind === "data";
  const win = inc ? windowOf(inc) : null;
  const key = inc?.key;
  const ward = inc?.ward;
  const from = win?.from;
  const to = win?.to;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger; the key and window stand for `inc`.
  useEffect(() => {
    if (!key || isData) return;
    let stale = false;
    setLoad({ status: "loading" });
    client
      .isolates({ ward: ward ?? undefined, from, to })
      .then((r) => !stale && setLoad({ status: "ready", records: r.records }))
      .catch(() => !stale && setLoad({ status: "error" }));
    return () => {
      stale = true;
    };
  }, [client, key, ward, from, to, isData, attempt]);
  const matched = useMemo(() => (inc && load.status === "ready" ? isolatesBehind(inc, load.records) : []), [load, inc]);
  return { status: isData ? ("data" as const) : load.status, matched, retry: () => setAttempt((n) => n + 1) };
}

/** The resistant drugs by name; the full profile in a disclosure, in words, never colour alone. */
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

export function IsolateList({
  locale,
  status,
  matched,
  retry,
  window: win,
  dataNote,
  limit,
}: {
  locale: Locale;
  status: "loading" | "error" | "ready" | "data";
  matched: IsolateRecord[];
  retry: () => void;
  window: { from: string; to: string };
  dataNote: string;
  /** Show only the first n rows; the count line still says how many there are. */
  limit?: number;
}) {
  if (status === "data") return <p className="feed-note">{dataNote}</p>;
  if (status === "loading")
    return (
      <p className="feed-note" role="status">
        {t(locale, "feedIsolatesLoading")}
      </p>
    );
  if (status === "error")
    return (
      <p className="feed-note" role="alert">
        {t(locale, "feedIsolatesError")}{" "}
        <button type="button" className="link" onClick={retry}>
          {t(locale, "retry")}
        </button>
      </p>
    );
  if (matched.length === 0) return <p className="feed-note">{t(locale, "feedIsolatesNone")}</p>;
  return (
    <>
      <p className="feed-note">
        {t(locale, matched.length === 1 ? "feedIsolatesCountOne" : "feedIsolatesCount", {
          n: matched.length,
          from: formatDate(locale, win.from),
          to: formatDate(locale, win.to),
        })}
      </p>
      <ul className="feed-isolates">
        {(limit === undefined ? matched : matched.slice(0, limit)).map((r) => {
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
  );
}
