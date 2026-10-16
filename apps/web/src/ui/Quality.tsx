import type { QualityResponse } from "@aei/contract";
import { formatNumber, type Locale, type MessageKey, t } from "../i18n/index.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { findingCount, type QualityState } from "./useQuality.ts";

/*
  The server's data checks (GET /api/quality, D-038), in words.
    QualityLine   one sentence for a footer or the settings list
    QualityCard   the checks as a card: passed or each check with findings,
                  errors first, with its count and first example
*/

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

export function QualityLine({ locale, quality }: { locale: Locale; quality: QualityState }) {
  const { data } = quality;
  if (!data) return quality.failed ? <span>{t(locale, "common.quality.unavailable")}</span> : null;
  const count = findingCount(data);
  return (
    <span className="u-num">
      {count === 0
        ? t(locale, "common.quality.line", { rows: rows(locale, data) })
        : t(locale, "common.quality.lineFindings", { findings: findingsWord(locale, count), rows: rows(locale, data) })}
    </span>
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
          {count > 0 ? (
            <ul className="k-quality-list">
              {data.summary.map((c) => (
                <li key={c.check}>
                  <span className="k-quality-check">
                    <span className="u-strong">{t(locale, `common.quality.check.${c.check}` as MessageKey)}</span>
                    <span className="u-small u-muted">
                      {t(locale, c.severity === "error" ? "common.quality.error" : "common.quality.suspect")} ·{" "}
                      <span className="u-num">{formatNumber(locale, c.count)}</span>
                    </span>
                  </span>
                  {c.examples[0] ? (
                    <span className="u-small u-soft">{t(locale, "common.quality.example", { message: c.examples[0].message })}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="u-small u-muted">{t(locale, "common.quality.about")}</p>
        </>
      ) : (
        <p className="u-small u-muted">{quality.failed ? t(locale, "common.quality.unavailable") : t(locale, "common.quality.about")}</p>
      )}
    </Card>
  );
}
