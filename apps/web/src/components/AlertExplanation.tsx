import type { AeiClient, Alert, ExplainResponse } from "@aei/contract";
import { formatDate, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { useEffect, useState } from "react";

export function AlertExplanation({ client, id, locale }: { client: AeiClient; id: string; locale: Locale }) {
  const [request, setRequest] = useState(0);
  const open = request > 0;
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setResult(null);
    if (!request) return;
    let stale = false;
    setPending(true);
    setError(false);
    client
      .explain(id, locale)
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
  }, [client, id, locale, request]);
  return (
    <div className="alert-explanation">
      <button type="button" className="link" aria-expanded={open} onClick={() => setRequest(open ? 0 : 1)}>
        {t(locale, open ? "hideExplanation" : "explain")}
      </button>
      {open ? (
        <div aria-live="polite">
          {pending ? <p className="field-hint">{t(locale, "explainLoading")}</p> : null}
          {error ? (
            <p className="field-hint">
              {t(locale, "explainError")}{" "}
              <button type="button" className="link" onClick={() => setRequest(request + 1)}>
                {t(locale, "retry")}
              </button>
            </p>
          ) : null}
          {result ? (
            <p>
              {result.text} {result.source === "template" ? <small className="muted">{t(locale, "templateMarker")}</small> : null}
            </p>
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

export function AlertList({ client, alerts, locale }: { client: AeiClient; alerts: Alert[]; locale: Locale }) {
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
            <AlertExplanation client={client} id={alert.id} locale={locale} />
          </li>
        ))}
      </ul>
    </details>
  );
}
