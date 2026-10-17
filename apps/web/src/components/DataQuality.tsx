import type { AeiClient, CheckName, QualityResponse } from "@aei/contract";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { useEffect, useState } from "react";

const CHECK_LABELS: Record<CheckName, MessageKey> = {
  "duplicate-id": "qualityDuplicateId",
  "duplicate-result": "qualityDuplicateResult",
  "missing-link": "qualityMissingLink",
  "isolate-count": "qualityIsolateCount",
  "sample-before-birth": "qualitySampleBeforeBirth",
  "admission-after-sample": "qualityAdmissionAfterSample",
  "future-sample": "qualityFutureSample",
  "age-mismatch": "qualityAgeMismatch",
  "ward-type": "qualityWardType",
  "intrinsic-susceptible": "qualityIntrinsic",
  "no-breakpoint-reported": "qualityBreakpoint",
  "specimen-antibiotic": "qualitySpecimen",
  "inferred-contradiction": "qualityInference",
  "phenotype-organism": "qualityPhenotypeOrganism",
  "phenotype-result": "qualityPhenotypeResult",
};

export function QualityResult({ locale, data, expanded = false }: { locale: Locale; data: QualityResponse; expanded?: boolean }) {
  const n = data.summary.reduce((sum, check) => sum + check.count, 0);
  const fmt = (value: number) => new Intl.NumberFormat(locale).format(value);
  if (!expanded)
    return (
      <a className="link" href="#data?section=quality">
        {t(locale, "qualityLink", { n: fmt(n) })}
      </a>
    );
  return (
    <div className="quality-results">
      <p>{t(locale, "qualityScope", Object.fromEntries(Object.entries(data.checked).map(([key, value]) => [key, fmt(value)])))}</p>
      <p>{t(locale, "qualityNote")}</p>
      {data.summary.length === 0 ? <p>{t(locale, "qualityNone")}</p> : null}
      <ul className="quality-checks">
        {(Object.entries(CHECK_LABELS) as [CheckName, MessageKey][]).map(([name, label]) => {
          const check = data.summary.find((entry) => entry.check === name);
          return (
            <li key={name}>
              {check ? (
                <>
                  <b>{t(locale, check.severity === "error" ? "qualityErrors" : "qualitySuspects")}</b>
                  {" · "}
                </>
              ) : null}
              {t(locale, "qualityCount", { check: t(locale, label), n: fmt(check?.count ?? 0) })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The endpoint reports data plausibility, separately from coverage or clinical validation. */
export function DataQuality({ client, locale, expanded = false }: { client: AeiClient; locale: Locale; expanded?: boolean }) {
  const [data, setData] = useState<QualityResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the explicit retry trigger.
  useEffect(() => {
    let stale = false;
    setError(false);
    setData(null);
    client
      .quality()
      .then((response) => {
        if (!stale) setData(response);
      })
      .catch(() => {
        if (!stale) setError(true);
      });
    return () => {
      stale = true;
    };
  }, [client, attempt]);
  return (
    <div className="data-quality" aria-live="polite">
      {data ? (
        <QualityResult locale={locale} data={data} expanded={expanded} />
      ) : error ? (
        <>
          <span>{t(locale, "qualityError")}</span>{" "}
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            {t(locale, "drRetry")}
          </button>
        </>
      ) : (
        <span>{t(locale, "qualityLoading")}</span>
      )}
    </div>
  );
}
