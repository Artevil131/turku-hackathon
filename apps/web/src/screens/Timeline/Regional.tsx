import type { RegionalResponse, RegionalSignal } from "@aei/contract";
import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "../../feed/types.ts";
import { formatDate, formatMonth, formatNumber, type Locale, t } from "../../i18n/index.ts";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Sparkline } from "../../ui/Sparkline.tsx";

/*
  The region around the hospital: THL's monthly MRSA, ESBL, VRE and CPE
  notifications per wellbeing services county and the months that signal
  (GET /api/regional, experiments/0008, D-025, D-037). The server cuts the
  data at the clock, so the replay never shows a later month. A signal is
  "strong" when it survives a Bonferroni correction over every county-month
  tested; the others may be chance (0008, review round 2).
*/

const HOME = "Varsinais-Suomen hyvinvointialue";
const NATIONAL = "Finland (all counties)";
const SERIES_MONTHS = 24;

type Fetched = { status: "loading" } | { status: "missing" } | { status: "failed" } | { status: "ok"; data: RegionalResponse };

/** The regional data as of `month` (YYYY-MM); fetched again only when the month changes. */
function useRegional(month: string, base = ""): Fetched {
  const [state, setState] = useState<Fetched>({ status: "loading" });
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `month` is not in the URL, but the server cuts the data at its clock, so a new month refetches.
  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    fetch(`${base}/api/regional`, { signal: ctrl.signal })
      .then(async (res) => {
        if (id !== latest.current) return;
        if (res.status === 404) setState({ status: "missing" });
        else if (!res.ok) setState({ status: "failed" });
        else setState({ status: "ok", data: (await res.json()) as RegionalResponse });
      })
      .catch((error: unknown) => {
        if (id === latest.current && !(error instanceof DOMException && error.name === "AbortError")) setState({ status: "failed" });
      });
    return () => ctrl.abort();
  }, [month, base]);
  return state;
}

/** "CPE carriage, E. coli" -> "CPE, kantajuus, E. coli" in Finnish; English as THL's group name. */
function groupLabel(locale: Locale, group: string): string {
  if (locale === "en") return group;
  const m = /^(\w+) (carriage|blood\/CSF)(?:, (.+))?$/.exec(group);
  if (!m) return group;
  const kind = m[2] === "carriage" ? t(locale, "timeline.region.carriage") : t(locale, "timeline.region.blood");
  return [m[1], kind, m[3]].filter(Boolean).join(", ");
}

function regionLabel(locale: Locale, region: string): string {
  return region === NATIONAL ? t(locale, "timeline.region.national") : region;
}

const monthLabel = (locale: Locale, month: string) => formatMonth(locale, `${month}-01`);

export function RegionalCard({ locale, asOf }: { locale: Locale; asOf: IsoDate }) {
  const state = useRegional(asOf.slice(0, 7));
  const title = t(locale, "timeline.region.title");

  if (state.status === "loading") return null;
  if (state.status !== "ok") {
    return (
      <Card title={title} className="timeline-region">
        <EmptyState
          compact
          icon="info"
          title={t(locale, state.status === "missing" ? "timeline.region.missing" : "timeline.region.failed")}
          body={state.status === "missing" ? t(locale, "timeline.region.missingHow") : undefined}
        />
      </Card>
    );
  }

  const { data } = state;
  const last = data.months.at(-1);
  const strong = data.signals.filter((s) => s.strong).length;
  return (
    <Card
      title={title}
      eyebrow={last ? t(locale, "timeline.region.sub", { month: monthLabel(locale, last) }) : undefined}
      className="timeline-region"
      footer={t(locale, "timeline.region.source", { date: formatDate(locale, data.fetched, "long") })}
    >
      {data.signals.length === 0 ? (
        <p className="u-small u-soft">{t(locale, "timeline.region.none", { month: last ? monthLabel(locale, last) : "" })}</p>
      ) : (
        <>
          <ol className="timeline-region-list">
            {data.signals.map((s) => (
              <SignalRow key={`${s.group}|${s.region}|${s.month}`} locale={locale} signal={s} data={data} />
            ))}
          </ol>
          <p className="u-small u-soft u-num">
            {t(locale, "timeline.region.note", {
              strong: formatNumber(locale, strong),
              count: formatNumber(locale, data.signals.length),
              tested: formatNumber(locale, data.settings.testedSeriesMonths),
            })}
          </p>
        </>
      )}
    </Card>
  );
}

function SignalRow({ locale, signal: s, data }: { locale: Locale; signal: RegionalSignal; data: RegionalResponse }) {
  const series = data.series.find((x) => x.group === s.group && x.region === s.region);
  const end = data.months.length;
  const start = Math.max(0, end - SERIES_MONTHS);
  const values = series ? series.cases.slice(start, end) : [];
  const at = data.months.indexOf(s.month) - start;
  const group = groupLabel(locale, s.group);
  const region = regionLabel(locale, s.region);
  return (
    <li className="timeline-region-item">
      <div className="timeline-region-main">
        <span className="timeline-region-what">
          <span className="u-strong">{group}</span>
          <span className="u-muted"> · {region}</span>
          {s.region === HOME ? (
            <>
              {" "}
              <Badge tone="info" size="sm" glyph={false}>
                {t(locale, "timeline.region.home")}
              </Badge>
            </>
          ) : null}
        </span>
        <span className="u-small u-soft u-num">
          {t(locale, "timeline.region.signal", {
            month: monthLabel(locale, s.month),
            cases: formatNumber(locale, s.cases),
            expected: formatNumber(locale, s.expected, 1),
          })}
        </span>
      </div>
      {values.length > 1 ? (
        <Sparkline
          values={values}
          marks={at >= 0 ? [at] : undefined}
          tone={s.strong ? "high" : "medium"}
          last={false}
          width={132}
          height={32}
          label={t(locale, "timeline.region.trend", {
            group,
            region,
            months: formatNumber(locale, values.length),
            min: formatNumber(locale, Math.min(...values)),
            max: formatNumber(locale, Math.max(...values)),
          })}
        />
      ) : null}
      <span className="timeline-region-side">
        {s.strong ? (
          <Badge tone="high" size="sm">
            {t(locale, "timeline.region.strong")}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm" glyph={false}>
            {t(locale, "timeline.region.weak")}
          </Badge>
        )}
      </span>
    </li>
  );
}
