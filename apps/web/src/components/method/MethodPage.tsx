import type { AeiClient, Alert, CoverageResponse, WeeklyResponse } from "@aei/contract";
import { antibioticName, formatDate, type Locale, type MessageKey, phenotypeName, t, wardName } from "@aei/i18n";
import { fillSentence, type MethodId, methods, parameterDefaults, registry } from "@aei/methods";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_UNIT, readStoredUnit } from "../doctor/filters.ts";
import { InfoButton } from "../Info.tsx";
import { CoverageShape, PoissonTail, SurpriseScale, WeeklyWindow } from "../math/index.ts";
import { addDaysIso } from "../math/mathHelpers.ts";
import { BetaBinomialMath, LiveRulesMath } from "./MethodMath.tsx";
import "./method.css";

// The Method page (#method): one compact section per ENGINE step. Left, what the tool runs now, drawn from
// the API; right, the experiment records that are candidates, as images. Every explanation sits behind an ⓘ.

type Fig = { n: "0012" | "0013" | "0014" | "0015" | "0016" | "0018" | "0019" | "0020"; ext: "png" | "svg"; w: number; h: number };
const FIGS = {
  "0012": { n: "0012", ext: "png", w: 856, h: 633 },
  "0013": { n: "0013", ext: "png", w: 900, h: 480 },
  "0014": { n: "0014", ext: "png", w: 1005, h: 472 },
  "0015": { n: "0015", ext: "png", w: 1104, h: 624 },
  "0016": { n: "0016", ext: "png", w: 1012, h: 704 },
  "0018": { n: "0018", ext: "png", w: 1012, h: 616 },
  "0019": { n: "0019", ext: "png", w: 1380, h: 708 },
  "0020": { n: "0020", ext: "svg", w: 547, h: 346 },
} satisfies Record<string, Fig>;

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

function Candidate({ fig, locale, eager, shipped }: { fig: Fig; locale: Locale; eager?: boolean; shipped?: boolean }) {
  const name = t(locale, `methodName${fig.n}` as MessageKey);
  return (
    <figure className="mt-fig">
      <span className="mt-tag">{t(locale, shipped ? "methodShipped" : "methodCandidate")}</span>
      <img
        src={`${base}/method/${fig.n}.${fig.ext}`}
        width={fig.w}
        height={fig.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        alt={t(locale, `methodAlt${fig.n}` as MessageKey)}
      />
      <figcaption>
        {t(locale, "methodCaption", { n: fig.n, name })}
        <span className="mt-result">{t(locale, `methodResult${fig.n}` as MessageKey)}</span>
      </figcaption>
    </figure>
  );
}

function Step({
  n,
  locale,
  live,
  candidates,
  math,
}: {
  n: 1 | 2 | 3 | 4;
  locale: Locale;
  live?: ReactNode;
  candidates: ReactNode;
  math?: ReactNode;
}) {
  const title = t(locale, `methodStep${n}` as MessageKey);
  return (
    <section className="mt-step" aria-labelledby={`mt-h${n}`}>
      <header className="mt-head">
        <span className="mt-num" aria-hidden="true">
          {n}
        </span>
        <h2 id={`mt-h${n}`}>{title}</h2>
        <InfoButton locale={locale} align="start">
          {n === 1
            ? fillSentence(methods.coverage, {}, locale)
            : n === 3
              ? fillSentence(methods.liveSignals, {}, locale)
              : t(locale, `methodInfo${n}` as MessageKey)}
        </InfoButton>
        <p>
          {n === 1
            ? fillSentence(methods.coverage, {}, locale)
            : n === 3
              ? fillSentence(methods.liveSignals, {}, locale)
              : t(locale, `methodSentence${n}` as MessageKey)}
        </p>
      </header>
      <div className={live ? "mt-grid" : "mt-grid mt-grid-cand"}>
        {live ? <div className="mt-live">{live}</div> : null}
        <div className="mt-cands">{candidates}</div>
      </div>
      {math ? (
        <div className="mt-mathrow">
          <h3 className="mt-label">{t(locale, "methodMath")}</h3>
          {math}
        </div>
      ) : null}
    </section>
  );
}

function useCoverage(client: AeiClient, asOf: string | null) {
  const [data, setData] = useState<CoverageResponse | null | "error">(null);
  const unit = readStoredUnit() ?? DEFAULT_UNIT;
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    client
      .coverage({ ward: unit, specimen: "urine", severity: "mild", windowDays: parameterDefaults.coverage.windowDays })
      .then((r) => !stale && setData(r))
      .catch(() => !stale && setData("error"));
    return () => {
      stale = true;
    };
  }, [client, asOf, unit]);
  return { data, unit };
}

type CountAlert = Extract<Alert, { kind: "detector" }> & { p: number; expected: number };

function useAlert(client: AeiClient, asOf: string | null) {
  const [alert, setAlert] = useState<CountAlert | null | "error">(null);
  const [weekly, setWeekly] = useState<WeeklyResponse | null>(null);
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    client
      .alerts({})
      .then(async (r) => {
        const found = r.alerts
          .filter(
            (a): a is CountAlert =>
              a.kind === "detector" &&
              a.detector !== "rising-trend" &&
              a.p !== undefined &&
              a.expected !== undefined &&
              a.ward !== undefined &&
              a.phenotype !== undefined &&
              a.date <= asOf,
          )
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        if (stale) return;
        setAlert(found ?? "error");
        if (found?.ward && found.phenotype) {
          const w = await client.weekly({ from: addDaysIso(found.date, -7 * 40) }).catch(() => null);
          if (!stale) setWeekly(w);
        } else setWeekly(null);
      })
      .catch(() => !stale && setAlert("error"));
    return () => {
      stale = true;
    };
  }, [client, asOf]);
  return { alert, weekly };
}

/** Full weeks (Monday to Sunday) up to the alert date, from the API's raw weekly counts. */
function weeksFor(w: WeeklyResponse, a: CountAlert) {
  if (!a.ward || !a.phenotype) return [];
  const counts = w.units[a.ward]?.phenotypes[a.phenotype];
  if (!counts) return [];
  return w.weeks
    .map((start, i) => ({ start, count: counts[i] ?? 0 }))
    .filter((x) => addDaysIso(x.start, 6) <= a.date && addDaysIso(x.start, 6) <= w.asOf)
    .slice(-30);
}

/** `embedded`: the Methods section of the Data page, which carries the page's one h1 and its own main. */
export function MethodPage({
  client,
  locale,
  asOf,
  embedded = false,
}: {
  client: AeiClient;
  locale: Locale;
  asOf: string | null;
  embedded?: boolean;
}) {
  const Root = embedded ? "div" : "main";
  const Title = embedded ? "h2" : "h1";
  const { data: cov, unit } = useCoverage(client, asOf);
  const { alert, weekly } = useAlert(client, asOf);
  const date = (d: string) => formatDate(locale, d);

  let coverage: ReactNode = <p className="mt-note">{t(locale, "methodLoading")}</p>;
  if (cov === "error") coverage = <p className="mt-note">{t(locale, "methodUnavailable")}</p>;
  else if (cov) {
    const s = cov.suggestions.find((x) => x.interval && x.share !== null);
    const c = s ? (s.basis === "spectrum" ? s.coverage.spectrum : s.coverage) : null;
    coverage =
      s?.interval && c ? (
        <>
          <h3 className="mt-label">{t(locale, "methodLiveRule")}</h3>
          <CoverageShape
            covered={c.counts.covered}
            known={c.counts.known}
            interval={s.interval}
            bar={parameterDefaults.suggest[cov.severity]}
            locale={locale}
          />
          <p className="mt-line">
            {t(locale, "methodCoverageLine", {
              drug: antibioticName(locale, s.antibiotic),
              unit: wardName(locale, unit),
              covered: c.counts.covered,
              known: c.counts.known,
              date: date(cov.asOf),
            })}
          </p>
        </>
      ) : (
        <p className="mt-note">{t(locale, "methodUnavailable")}</p>
      );
  }

  let detection: ReactNode = <p className="mt-note">{t(locale, "methodLoading")}</p>;
  if (alert === "error") detection = <p className="mt-note">{t(locale, "methodNoAlert")}</p>;
  else if (alert) {
    const win = weekly ? weeksFor(weekly, alert) : [];
    detection = (
      <>
        <h3 className="mt-label">{t(locale, "methodLiveTest")}</h3>
        <PoissonTail observed={alert.observed} expected={alert.expected} p={alert.p} detector={alert.detector} locale={locale} />
        <SurpriseScale p={alert.p} detector={alert.detector} locale={locale} />
        {win.length > 0 ? (
          <WeeklyWindow
            weeks={win}
            windowStart={addDaysIso(alert.date, 1 - parameterDefaults.phenotypeExcess.windowDays)}
            observed={alert.observed}
            expected={alert.expected}
            p={alert.p}
            alertDate={alert.date}
            locale={locale}
          />
        ) : null}
        <p className="mt-line">
          {t(locale, "methodAlertLine", {
            unit: alert.ward ? wardName(locale, alert.ward) : "—",
            phenotype: alert.phenotype ? phenotypeName(alert.phenotype) : alert.detector,
            date: date(alert.date),
            asOf: asOf ? date(asOf) : "—",
          })}
        </p>
      </>
    );
  }
  detection = (
    <>
      {detection}
      <p className="mt-note">{t(locale, "methodShippedFigures")}</p>
      <p className="mt-note">{t(locale, "methodPNote")}</p>
    </>
  );

  return (
    <Root className="method" id={embedded ? undefined : "main"}>
      <header className="mt-top">
        <Title>{t(locale, "methodTitle")}</Title>
        <p>
          {t(locale, "methodLead")}
          {asOf ? <span className="mt-asof"> · {date(asOf)}</span> : null}
        </p>
      </header>
      <Step
        n={1}
        locale={locale}
        live={
          <>
            {coverage}
            <RegisteredMethods locale={locale} ids={["coverage", "suggest", "suggestCombinations"]} />
          </>
        }
        math={
          <>
            <LiveRulesMath locale={locale} rules={["wilson"]} />
            <BetaBinomialMath locale={locale} />
          </>
        }
        candidates={
          <>
            <Candidate fig={FIGS["0012"]} locale={locale} eager />
            <Candidate fig={FIGS["0014"]} locale={locale} eager />
          </>
        }
      />
      <Step n={2} locale={locale} candidates={<Candidate fig={FIGS["0013"]} locale={locale} />} />
      <Step
        n={3}
        locale={locale}
        live={
          <>
            {detection}
            <RegisteredMethods locale={locale} ids={registry.filter((m) => m.kind === "detector").map((m) => m.id)} />
          </>
        }
        math={
          <>
            <LiveRulesMath locale={locale} rules={["poisson", "empty", "drop", "sentinel", "trend"]} />
            <p className="mt-math-foot">{t(locale, "methodAlsoTested")}</p>
          </>
        }
        candidates={
          <>
            <Candidate fig={FIGS["0015"]} locale={locale} />
            <Candidate fig={FIGS["0016"]} locale={locale} />
            <Candidate fig={FIGS["0018"]} locale={locale} />
          </>
        }
      />
      <Step
        n={4}
        locale={locale}
        candidates={
          <>
            <div>
              <h3 className="mt-label">{t(locale, "methodHospital")}</h3>
              <Candidate fig={FIGS["0019"]} locale={locale} />
            </div>
            <div>
              <h3 className="mt-label">{t(locale, "methodRegional")}</h3>
              <Candidate fig={FIGS["0020"]} locale={locale} shipped />
            </div>
          </>
        }
      />
      <RegisteredMethods locale={locale} ids={["isolates", "patients", "alerts"]} />
    </Root>
  );
}

function RegisteredMethods({ locale, ids }: { locale: Locale; ids: readonly MethodId[] }) {
  return (
    <div className="mt-registered">
      {ids.map((id) => {
        const method = methods[id];
        return (
          <section key={id} aria-labelledby={`method-${id}`}>
            <h3 className="mt-label" id={`method-${id}`}>
              {method.name[locale]}
            </h3>
            <p className="mt-note">{fillSentence(method, {}, locale)}</p>
            <dl>
              {method.parameters.map((parameter) => (
                <div key={parameter.name}>
                  <dt>{parameter.description[locale]}</dt>
                  <dd>
                    {typeof parameter.default === "object" ? JSON.stringify(parameter.default) : String(parameter.default)}{" "}
                    {parameter.unit ?? ""} · {parameter.decision}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-note">{[...method.decisions, ...method.experiments].join(" · ")}</p>
          </section>
        );
      })}
    </div>
  );
}
