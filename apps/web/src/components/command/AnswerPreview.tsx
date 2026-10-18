import type { AeiClient, Alert, CoverageQuery, CoverageResponse } from "@aei/contract";
import { antibioticName, formatDate, type Locale, t } from "@aei/i18n";
import { useEffect, useState } from "react";
import { barOf, coverageQuery, filtersFromUrl, num, pct } from "../doctor/filters.ts";
import { recentText } from "../doctor/reason.ts";
import { signalLabel } from "../doctor/signals.ts";

// The live answer under a compound-query result in the palette: the drug with
// the highest coverage that clears the bar (or the named drug) for "urology e. coli", the newest matching
// signal for "med-a esbl". It sits inside the option, so it is part of the
// option's accessible name. Numbers come from the API; this file only picks
// and phrases them.

/** The params of a palette href: "#doctor?unit=URO&site=urine" gives unit, site. */
function paramsOf(href: string): URLSearchParams {
  const i = href.indexOf("?");
  return new URLSearchParams(i < 0 ? "" : href.slice(i + 1));
}

/** The coverage query the doctor's page would ask for this link (the page's own filters, defaults included). */
export function queryFromHref(href: string): CoverageQuery | null {
  return href.startsWith("#doctor") ? coverageQuery(filtersFromUrl(paramsOf(href))) : null;
}

/** The drug a doctor link names, or null. */
export const drugOf = (href: string): string | null => paramsOf(href).get("ab");

/** The newest alert of the board link's unit (unit=) and phenotype (ph=); either may be absent. */
export function pickSignal(alerts: readonly Alert[], href: string): Alert | null {
  if (!href.startsWith("#research")) return null;
  const p = paramsOf(href);
  const unit = p.get("unit");
  const ph = p.get("ph");
  const hits = alerts.filter((a) => {
    if (unit && a.ward !== unit) return false;
    if (!ph) return true;
    return a.kind === "cpe" ? ph === "cpe" : "phenotype" in a && a.phenotype === ph;
  });
  return hits.reduce<Alert | null>((best, a) => (!best || a.date > best.date ? a : best), null);
}

/** One line for a coverage response: the named drug's row, else the highest-coverage drug that clears the bar. */
export function coverageLine(locale: Locale, data: CoverageResponse, href: string): string {
  const filters = filtersFromUrl(paramsOf(href));
  const bar = barOf(data, filters);
  const ab = drugOf(href);
  const row = ab ? data.suggestions.find((s) => s.antibiotic === ab) : data.suggestions.find((s) => s.standing === "clears");
  if (!row) return t(locale, ab ? "cmdPvNoRow" : "cmdPvNone", { bar });
  const name = antibioticName(locale, row.antibiotic);
  const n = row.basis === "spectrum" ? row.coverage.spectrum.counts.known : row.coverage.counts.known;
  // Same wording as the doctor's answer card: the highest coverage among drugs that clear the bar, with the Wilson
  // interval the standing rests on and n; never an order to start a drug.
  const parts = [
    ab ? name : t(locale, "cmdPvStart", { name, bar }),
    row.share === null
      ? t(locale, "cmdPvFew")
      : row.interval
        ? t(locale, "cmdPvShare", { share: pct(row.share), lo: pct(row.interval[0]), hi: pct(row.interval[1]), n: num(locale, n) })
        : `${pct(row.share)} % (n ${num(locale, n)})`,
    row.standing === "below" ? t(locale, "cmdPvBelow", { bar }) : row.standing === "borderline" ? t(locale, "cmdPvBorderline") : null,
    recentText(locale, row.coverage.recent),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** One line for a board link: the newest matching signal, or "No open signal". */
export function signalLine(locale: Locale, alerts: readonly Alert[], href: string): string {
  const a = pickSignal(alerts, href);
  if (!a) return t(locale, "cmdPvNoSignal");
  const evidence =
    a.kind === "detector" && a.expected !== undefined
      ? ` · ${t(locale, "cmdPvEvidence", { observed: num(locale, a.observed), expected: num(locale, Math.round(a.expected * 10) / 10) })}`
      : "";
  return `${signalLabel(a, locale)}${evidence}, ${formatDate(locale, a.date, "long")}`;
}

/** Answers by href, for the palette's lifetime: one request per distinct link. */
export type AnswerCache = Map<string, Promise<CoverageResponse>>;

const DEBOUNCE_MS = 250;

interface Props {
  href: string;
  locale: Locale;
  client?: Pick<AeiClient, "coverage">;
  alerts?: readonly Alert[];
  cache: AnswerCache;
}

type State = { href: string; data: CoverageResponse | "error" } | null;

export function AnswerPreview({ href, locale, client, alerts, cache }: Props) {
  const [state, setState] = useState<State>(null);
  const isDoctor = href.startsWith("#doctor");
  useEffect(() => {
    if (!isDoctor || !client) return;
    const q = queryFromHref(href);
    if (!q) return;
    let live = true;
    const wait = cache.has(href) ? 0 : DEBOUNCE_MS;
    const timer = setTimeout(() => {
      let p = cache.get(href);
      if (!p) {
        p = client.coverage(q);
        cache.set(href, p);
        p.catch(() => cache.delete(href));
      }
      p.then(
        (data) => live && setState({ href, data }),
        () => live && setState({ href, data: "error" }),
      );
    }, wait);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [href, isDoctor, client, cache]);

  let text: string | null = null;
  if (isDoctor) {
    const mine = state?.href === href ? state.data : null;
    if (mine === null) text = "…";
    else if (mine !== "error") text = coverageLine(locale, mine, href);
  } else if (alerts) text = signalLine(locale, alerts, href);

  return (
    <span className="cmd-answer" data-pending={text === "…" ? "" : undefined}>
      {text}
    </span>
  );
}
