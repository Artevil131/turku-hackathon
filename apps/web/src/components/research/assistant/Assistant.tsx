import type { AeiClient, ExplainResponse } from "@aei/contract";
import { formatDate, type Locale, phenotypeName, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import type { Incident } from "../feed/model.ts";
import { kindLabel, shortTitle, unitLabel } from "../feed/names.ts";
import type { Spans } from "../feed/spans.ts";
import "./assistant.css";

// The assistant window: for the selected incident, one explanation per member
// alert from the server (/api/explain). The server writes every number into
// the text from the alert (D-019); this window adds none. With a model
// configured (Meta.ai) it asks for the model's wording and says so; if the
// model's wording fails the number check, or nothing is configured, the
// template is shown and labelled as such.

const MAX_ALERTS = 6;

type Entry = { status: "loading" } | { status: "error" } | { status: "ok"; response: ExplainResponse };

export function Assistant({
  client,
  locale,
  incident,
  spans,
  waiting,
}: {
  client: AeiClient;
  locale: Locale;
  incident: Incident | null;
  spans: Spans | null;
  /** The incident list is still loading. */
  waiting: boolean;
}) {
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    let stale = false;
    client
      .meta()
      .then((m) => !stale && setAi(m.ai))
      .catch(() => !stale && setAi(false));
    return () => {
      stale = true;
    };
  }, [client]);

  const alerts = useMemo(() => (incident ? incident.members.slice(0, MAX_ALERTS) : []), [incident]);
  const ids = alerts.map((a) => a.id).join("|");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `ids` stands for the alert list; `attempt` is the retry trigger.
  useEffect(() => {
    if (ai === null || alerts.length === 0) return;
    let stale = false;
    setEntries(Object.fromEntries(alerts.map((a) => [a.id, { status: "loading" } as Entry])));
    for (const a of alerts) {
      client
        .explain(a.id, locale, ai ? "model" : "template")
        .then((response) => !stale && setEntries((e) => ({ ...e, [a.id]: { status: "ok", response } })))
        .catch(() => !stale && setEntries((e) => ({ ...e, [a.id]: { status: "error" } })));
    }
    return () => {
      stale = true;
    };
  }, [client, locale, ai, ids, attempt]);

  const failed = alerts.some((a) => entries[a.id]?.status === "error");
  const units = spans && spans.units.length > 1 ? spans.units.join(", ") : null;

  return (
    <section
      className="assist"
      aria-labelledby="assist-title"
      aria-busy={ai === null || alerts.some((a) => entries[a.id]?.status === "loading")}
    >
      <h2 id="assist-title" className="assist-title">
        {t(locale, "assistIntro")}
      </h2>
      {!incident ? (
        <p className="assist-empty">{waiting ? t(locale, "assistLoading") : t(locale, "assistPick")}</p>
      ) : (
        <>
          <p className="assist-who">
            <strong>{kindLabel(locale, incident.kind)}</strong> · {unitLabel(locale, incident.ward)} · {formatDate(locale, incident.date)}
          </p>
          {units || incident.phenotypes.length > 0 ? (
            <p className="assist-spans">
              {units ? t(locale, "assistUnits", { units }) : null}
              {units && incident.phenotypes.length > 0 ? " · " : null}
              {incident.phenotypes.length > 0
                ? t(locale, "assistPhenotype", { phenotype: incident.phenotypes.map((p) => phenotypeName(p)).join(", ") })
                : null}
            </p>
          ) : null}
          <div className="assist-list" aria-live="polite">
            {alerts.map((a) => {
              const e = entries[a.id] ?? { status: "loading" };
              return (
                <article key={a.id} className="assist-item">
                  <h3 className="assist-item-title">
                    {shortTitle(locale, a)} · {formatDate(locale, a.date)}
                  </h3>
                  {e.status === "loading" ? <p className="assist-state">{t(locale, "assistLoading")}</p> : null}
                  {e.status === "error" ? <p className="assist-state">{t(locale, "assistError")}</p> : null}
                  {e.status === "ok" ? (
                    <>
                      <p className="assist-text">{e.response.text}</p>
                      <p className="assist-source" data-source={e.response.source}>
                        {t(locale, e.response.source === "model" ? "assistAi" : "assistTemplate")}
                      </p>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
          {failed ? (
            <button type="button" className="link" onClick={() => setAttempt((n) => n + 1)}>
              {t(locale, "retry")}
            </button>
          ) : null}
          <p className="assist-note">{t(locale, "assistNote")}</p>
        </>
      )}
    </section>
  );
}
