import type { AeiClient } from "@aei/contract";
import { ANTIBIOTICS, type IsolateRecord } from "@aei/domain";
import { type Locale, phenotypeName, specimenName, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import { type Incident, isolatesBehind, resultString, windowOf } from "./model.ts";

// The isolates behind an incident (U2): fetched once per incident, shown as rows in the card's data section.

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

/** The isolates in the window as rows: date, patient, specimen, organism, and the phenotypes or, for a profile signal, the S/R profile. */
export function IsolateTable({
  locale,
  status,
  matched,
  retry,
  profile = false,
}: {
  locale: Locale;
  status: "loading" | "error" | "ready";
  matched: IsolateRecord[];
  retry: () => void;
  /** Show the S/R profile string (antibiotic order, "." untested) instead of the phenotypes. */
  profile?: boolean;
}) {
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
    <div className="feed-iso-wrap">
      <table className="feed-iso-table">
        <caption>{t(locale, "feedIsolatesRows", { n: matched.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t(locale, "feedColDate")}</th>
            <th scope="col">{t(locale, "feedColPatient")}</th>
            <th scope="col">{t(locale, "feedColSpecimen")}</th>
            <th scope="col">{t(locale, "feedColOrganism")}</th>
            <th scope="col" title={profile ? ANTIBIOTICS.map((a) => a.code).join(" ") : undefined}>
              {t(locale, profile ? "feedColProfile" : "feedColPhenotypes")}
            </th>
          </tr>
        </thead>
        <tbody>
          {matched.map((r) => (
            <tr key={r.isolateId}>
              <td className="num">{r.sampleDate}</td>
              <td className="mono">{r.patientId}</td>
              <td>{specimenName(locale, r.specimen)}</td>
              <td>
                <i>{r.organism}</i>
              </td>
              <td className={profile ? "mono" : undefined}>
                {profile ? resultString(r) : r.phenotypes.map(phenotypeName).join(", ") || "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
