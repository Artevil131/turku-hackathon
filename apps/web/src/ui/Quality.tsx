import type { QualityResponse } from "@aei/contract";
import { formatNumber, type Locale, type MessageKey, t } from "../i18n/index.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { Disclosure } from "./Disclosure.tsx";
import { findingCount, type QualityState } from "./useQuality.ts";

// Every D-038 check, including checks with no findings in GET /api/quality.
// The record is exhaustive against the contract's CheckName union.
const CHECKS: Record<QualityResponse["summary"][number]["check"], MessageKey> = {
  "duplicate-id": "common.quality.check.duplicate-id",
  "duplicate-result": "common.quality.check.duplicate-result",
  "missing-link": "common.quality.check.missing-link",
  "isolate-count": "common.quality.check.isolate-count",
  "sample-before-birth": "common.quality.check.sample-before-birth",
  "admission-after-sample": "common.quality.check.admission-after-sample",
  "future-sample": "common.quality.check.future-sample",
  "age-mismatch": "common.quality.check.age-mismatch",
  "ward-type": "common.quality.check.ward-type",
  "intrinsic-susceptible": "common.quality.check.intrinsic-susceptible",
  "no-breakpoint-reported": "common.quality.check.no-breakpoint-reported",
  "specimen-antibiotic": "common.quality.check.specimen-antibiotic",
  "inferred-contradiction": "common.quality.check.inferred-contradiction",
  "phenotype-organism": "common.quality.check.phenotype-organism",
  "phenotype-result": "common.quality.check.phenotype-result",
};

function rows(locale: Locale, data: QualityResponse): string {
  const n = (v: number) => formatNumber(locale, v);
  return t(locale, "common.quality.rows", {
    patients: n(data.checked.patients),
    cultures: n(data.checked.cultures),
    isolates: n(data.checked.isolates),
    results: n(data.checked.results),
  });
}

function findingsWord(locale: Locale, count: number): string {
  return count === 1
    ? t(locale, "common.quality.findingsOne")
    : t(locale, "common.quality.findings", { count: formatNumber(locale, count) });
}

function CheckList({ locale, data }: { locale: Locale; data: QualityResponse }) {
  return (
    <>
      <ul className="k-quality-list">
        {Object.entries(CHECKS).map(([check, label]) => {
          const finding = data.summary.find((c) => c.check === check && c.count > 0);
          return (
            <li key={check}>
              <span className="k-quality-check">
                <span className="u-strong">{t(locale, label)}</span>
                <span className="u-small u-soft u-num">
                  {finding
                    ? t(locale, "common.quality.checkResult", {
                        result: t(locale, finding.severity === "error" ? "common.quality.error" : "common.quality.suspect"),
                        findings: findingsWord(locale, finding.count),
                      })
                    : t(locale, "common.quality.checkPassed")}
                </span>
              </span>
              {finding?.examples[0] ? (
                <span className="u-small u-soft">{t(locale, "common.quality.example", { message: finding.examples[0].message })}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="u-small u-muted">{t(locale, "common.quality.about")}</p>
    </>
  );
}

export function QualityLine({ locale, quality }: { locale: Locale; quality: QualityState }) {
  const { data } = quality;
  if (!data) return quality.failed ? <span>{t(locale, "common.quality.unavailable")}</span> : null;
  const count = findingCount(data);
  return (
    <Disclosure
      summary={
        <span className="u-num">
          {count === 0
            ? t(locale, "common.quality.line", { rows: rows(locale, data) })
            : t(locale, "common.quality.lineFindings", { findings: findingsWord(locale, count), rows: rows(locale, data) })}
        </span>
      }
    >
      <CheckList locale={locale} data={data} />
    </Disclosure>
  );
}

export function QualityCard({ locale, quality }: { locale: Locale; quality: QualityState }) {
  const { data } = quality;
  const count = data ? findingCount(data) : 0;
  return (
    <Card title={t(locale, "common.quality.title")} level={2} className="k-quality">
      {data ? (
        <>
          <p className="k-quality-status">
            {count === 0 ? (
              <Badge tone="live">{t(locale, "common.quality.passed")}</Badge>
            ) : (
              <Badge tone={data.summary.some((c) => c.severity === "error") ? "high" : "medium"}>{findingsWord(locale, count)}</Badge>
            )}
          </p>
          <p className="u-small u-soft u-num">{rows(locale, data)}</p>
          <Disclosure summary={t(locale, "common.quality.showChecks")}>
            <CheckList locale={locale} data={data} />
          </Disclosure>
        </>
      ) : (
        <p className="u-small u-muted">{quality.failed ? t(locale, "common.quality.unavailable") : t(locale, "common.quality.about")}</p>
      )}
    </Card>
  );
}
