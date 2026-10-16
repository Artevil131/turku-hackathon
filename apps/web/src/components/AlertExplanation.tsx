import type { AeiClient, Alert, ExplainResponse, ExplainWording } from "@aei/contract";
import { formatDate, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { useEffect, useState } from "react";

/**
 * The code's plain-language template first (D-029). Where the server has a
 * model, an opt-in "AI wording" rewords it; every number is still filled in
 * by code, and the reworded text says it should be read against the figures.
 */
export function AlertExplanation({ client, id, locale, ai = false }: { client: AeiClient; id: string; locale: Locale; ai?: boolean }) {
  const [wording, setWording] = useState<ExplainWording | null>(null);
  const [attempt, setAttempt] = useState(0);
  const open = wording !== null;
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry button's trigger; bumping it re-runs the request.
  useEffect(() => {
    setResult(null);
    if (!wording) return;
    let stale = false;
    setPending(true);
    setError(false);
    client
      .explain(id, locale, wording)
      .then((response) => {
        if (!stale) setResult(response);
      })
      .catch(() => {
        if (!stale) setError(true);
      })
      .finally(() => {
        if (!stale) setPending(false);
      });
    return () => {
      stale = true;
    };
  }, [client, id, locale, wording, attempt]);
  const fellBack = wording === "model" && result?.source === "template";
  return (
    <div className="alert-explanation">
      <button type="button" className="link" aria-expanded={open} onClick={() => setWording(open ? null : "template")}>
        {t(locale, open ? "hideExplanation" : "explain")}
      </button>
      {open ? (
        <div aria-live="polite">
          {pending ? <p className="field-hint">{t(locale, "explainLoading")}</p> : null}
          {error ? (
            <p className="field-hint">
              {t(locale, "explainError")}{" "}
              <button type="button" className="link" onClick={() => setAttempt(attempt + 1)}>
                {t(locale, "retry")}
              </button>
            </p>
          ) : null}
          {result ? (
            <>
              <p>{result.text}</p>
              {result.source === "model" ? <p className="field-hint">{t(locale, "aiWordingNote")}</p> : null}
              {fellBack ? <p className="field-hint">{t(locale, "aiWordingUnavailable")}</p> : null}
              {ai && wording === "template" ? (
                <button type="button" className="link" onClick={() => setWording("model")}>
                  {t(locale, "aiWording")}
                </button>
              ) : null}
              {wording === "model" ? (
                <button type="button" className="link" onClick={() => setWording("template")}>
                  {t(locale, "plainWording")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const DETECTOR_LABELS = {
  "profile-excess": "alertProfileExcess",
  "phenotype-excess": "alertPhenotypeExcess",
  "sampling-drop": "alertSamplingDrop",
  "empty-run": "alertEmptyRun",
  "rising-trend": "alertRisingTrend",
} as const;

function alertLabel(alert: Alert, locale: Locale): string {
  switch (alert.kind) {
    case "cpe":
      return t(locale, "alertCpe");
    case "carrier":
      return t(locale, "alertCarrier", { phenotype: phenotypeName(alert.phenotype) });
    case "new-in-unit":
      return t(locale, "alertNewInUnit", { phenotype: phenotypeName(alert.phenotype) });
    case "detector": {
      const key = DETECTOR_LABELS[alert.detector as keyof typeof DETECTOR_LABELS] ?? "alertDetector";
      const what = alert.phenotype ? phenotypeName(alert.phenotype) : (alert.organism ?? "");
      const label = t(locale, key, { phenotype: what });
      return alert.organism && key !== "alertPhenotypeExcess" ? `${label} · ${alert.organism}` : label;
    }
    default:
      return (alert as { kind: string }).kind;
  }
}

export function AlertList({ client, alerts, locale, ai = false }: { client: AeiClient; alerts: Alert[]; locale: Locale; ai?: boolean }) {
  if (!alerts.length) return null;
  return (
    <details className="released-alerts">
      <summary className="field-label">
        {t(locale, "releasedAlerts")} · {alerts.length}
      </summary>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <span>
              {formatDate(locale, alert.date)} · {alert.ward ? wardName(locale, alert.ward) : t(locale, "hospitalWide")} ·{" "}
              {alertLabel(alert, locale)}
            </span>
            <AlertExplanation client={client} id={alert.id} locale={locale} ai={ai} />
          </li>
        ))}
      </ul>
    </details>
  );
}
