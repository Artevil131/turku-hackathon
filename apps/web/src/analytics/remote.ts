import type { CoverageResult, MonthPoint, PatientQuery, ReportMatrix, ReportTable } from "@aei/empiric";
import type { Signal } from "@aei/signals";
import type { AnalyticsSource, Rank } from "./types.ts";

/*
  The analysis on the server: the same AnalyticsSource over HTTP, for when the
  backend is ready (VITE_AEI_ANALYTICS=remote). Not used yet.

  Routes, relative to the page's origin (Vite proxies /api to the feed). Each
  is a GET; the server computes over its own copy of the feed: every result
  released with sampleDate <= asOf. Each answer is exactly the gear's type as
  JSON, so a route is one call of the same gear:

    GET /api/analytics/coverage
        ?asOf=YYYY-MM-DD &ward= &specimen= [&sex=] [&age=under65|65plus]
        [&onset=community|hospital] [&organism=] &rank=access-first|coverage
        -> CoverageResult   coverage(released, asOf, query, catalog, { rank })   (@aei/empiric)

    GET /api/analytics/monthly
        ?asOf= &ward= &specimen= [&sex=] [&age=] [&onset=] [&organism=] &antibiotic= &months=N
        -> MonthPoint[]     monthly(released, asOf, query, antibiotic, months, catalog)   (@aei/empiric)

    GET /api/analytics/signals?asOf=
        -> Signal[]         detectSignals(released, asOf, catalog)   (@aei/signals; the app cuts them to asOf itself)

    GET /api/analytics/report/table
        ?asOf= &ward= &specimen= [&sex=] [&age=] [&onset=] [&organism=]
        -> ReportTable      reportTable(released, asOf, query, catalog)   (@aei/empiric)

    GET /api/analytics/report/units
        ?asOf= &specimen= [&sex=] [&age=] [&onset=] [&organism=] &days=N
        -> ReportMatrix     reportMatrix(released, asOf, query, catalog, days)   (@aei/empiric)

  `ward` is always sent; empty means every unit (EVERY_UNIT). Optional filters
  are left out when not set. `catalog` is { units, antibiotics } from the
  server's own meta. An `asOf` after the server's clock (results not yet
  released there) should be refused (e.g. 409) rather than answered from
  fewer results. Errors: any non-2xx status; the screen keeps waiting and the
  app says the server did not answer, with a retry (useAnalysisFailure).

  Answers are cached per URL for the session. When the feed generation
  changes (the results were reloaded, see useFeed) the cache is emptied, so an
  answer for the same asOf from before the reload is never reused.
*/

const PREFIX = "/api/analytics";
/** Answers kept for repeated questions (switching screens, reopening a row). */
const CACHE_MAX = 200;

/** The query's filters as URL parameters; unset filters are left out, ward is always sent ("" = every unit). */
function queryParams(query: PatientQuery, withWard = true): [string, string][] {
  const out: [string, string][] = [];
  if (withWard) out.push(["ward", query.ward]);
  out.push(["specimen", query.specimen]);
  if (query.sex) out.push(["sex", query.sex]);
  if (query.age) out.push(["age", query.age]);
  if (query.onset) out.push(["onset", query.onset]);
  if (query.organism) out.push(["organism", query.organism]);
  return out;
}

/** The analysis on the server at `base` (default: this page's origin). */
export function remoteSource(base = ""): AnalyticsSource {
  const cache = new Map<string, Promise<unknown>>();
  let generation: number | null = null;

  /** A new feed generation: forget every answer from the previous one. */
  function onGeneration(next: number): void {
    if (generation !== null && next !== generation) cache.clear();
    generation = next;
  }

  function get<T>(route: string, params: [string, string][]): Promise<T> {
    const url = `${base}${PREFIX}${route}?${new URLSearchParams(params).toString()}`;
    const hit = cache.get(url);
    if (hit) {
      // Most recently used last.
      cache.delete(url);
      cache.set(url, hit);
      return hit as Promise<T>;
    }
    const answer = fetch(url, { headers: { accept: "application/json" } }).then(async (res) => {
      if (!res.ok) throw new Error(`GET ${route}: ${res.status}`);
      return (await res.json()) as T;
    });
    cache.set(url, answer);
    // A failed answer is forgotten so the next ask tries again.
    answer.catch(() => cache.delete(url));
    while (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return answer;
  }

  return {
    where: "server",
    coverage: (at, query, rank: Rank) => get<CoverageResult>("/coverage", [["asOf", at.asOf], ...queryParams(query), ["rank", rank]]),
    monthly: (at, query, antibiotic, months) =>
      get<MonthPoint[]>("/monthly", [["asOf", at.asOf], ...queryParams(query), ["antibiotic", antibiotic], ["months", String(months)]]),
    signals: (at, gen) => {
      onGeneration(gen);
      return get<Signal[]>("/signals", [["asOf", at.asOf]]);
    },
    reportTable: (at, query) => get<ReportTable>("/report/table", [["asOf", at.asOf], ...queryParams(query)]),
    reportMatrix: (at, query, days) =>
      get<ReportMatrix>("/report/units", [["asOf", at.asOf], ...queryParams(query, false), ["days", String(days)]]),
  };
}
