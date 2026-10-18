import type { Alert } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, t } from "@aei/i18n";
import { kindOf } from "../research/board.ts";
import { oneDecimal } from "../research/feed/model.ts";
import { unitLabel } from "../research/feed/names.ts";
import { incidentOf } from "./changes.ts";

/** The most recent open signal (up to the as-of day), or null. Later in the list wins a tie. */
export function latestSignal(asOf: string, alerts: Alert[]): Alert | null {
  let best: Alert | null = null;
  for (const a of alerts) {
    if (a.date > asOf || !kindOf(a)) continue;
    if (best === null || a.date >= best.date) best = a;
  }
  return best;
}

/** One plain sentence from the alert's own fields, with the full unit name. */
export function latestSentence(locale: Locale, a: Alert): string {
  const unit = unitLabel(locale, a.ward);
  const date = formatDate(locale, a.date, "long");
  switch (a.kind) {
    case "cpe":
      return t(locale, "homeLatestCpe", { organism: shortOrganism(a.organism), unit, date });
    case "new-in-unit": {
      const since = a.previous
        ? t(locale, "homeLatestNewSince", { date: formatDate(locale, a.previous, "long") })
        : t(locale, "homeLatestNewNone");
      return t(locale, "homeLatestNew", { phenotype: phenotypeName(a.phenotype), unit, since, date });
    }
    case "carrier":
      return "";
    case "detector": {
      const expected = oneDecimal(locale, a.expected ?? 0);
      const organism = a.organism ? shortOrganism(a.organism) : "";
      if (a.detector === "sampling-drop" || a.detector === "volume-jump" || a.detector === "empty-run")
        return t(locale, "homeLatestData", { unit, observed: a.observed, expected, date });
      if (a.detector === "resistance-shift")
        return t(locale, "detLatestShift", {
          antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
          organism,
          unit,
          observed: a.observed,
          expected,
          date,
        });
      if (a.detector === "rising-trend")
        return t(locale, "homeLatestTrend", {
          antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
          organism,
          observed: `${Math.round(a.observed * 100)} %`,
          expected: `${Math.round((a.expected ?? 0) * 100)} %`,
          date,
        });
      const what = [a.phenotype ? phenotypeName(a.phenotype) : "", organism].filter(Boolean).join(" ");
      return t(locale, a.profile ? "homeLatestCluster" : "homeLatestExcess", { n: a.observed, what, unit, expected, date });
    }
  }
}

export function Latest({ locale, alert }: { locale: Locale; alert: Alert }) {
  return (
    <section className="hm-latest glass" aria-labelledby="hm-latest-title">
      <h2 id="hm-latest-title">{t(locale, "homeLatestTitle")}</h2>
      <p>{latestSentence(locale, alert)}</p>
      <a className="hm-latest-open" href={`#research?inc=${encodeURIComponent(incidentOf(alert))}`}>
        {t(locale, "homeLatestOpen")}
      </a>
    </section>
  );
}
