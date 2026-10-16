import type { CoverageResult, MonthPoint, PatientQuery, ReportMatrix, ReportTable } from "@aei/empiric";
import type { IsoDate, Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import { type Signal, visibleSignals } from "@aei/signals";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { localSource } from "./local.ts";
import { remoteSource } from "./remote.ts";
import { type AnalyticsMode, type AnalyticsSource, type Rank, type Released, Superseded } from "./types.ts";

/*
  How the screens get their numbers. The screens and App call only these
  hooks; which AnalyticsSource answers is chosen once, at build time:

    VITE_AEI_ANALYTICS=local    (default) the gears run in this browser (local.ts)
    VITE_AEI_ANALYTICS=remote   the server answers GET /api/analytics/... (remote.ts)

  With a local source every hook answers during render, exactly as the
  screens computed before (same inputs, same memoisation). With a remote one
  a hook returns null until the first answer arrives, then keeps the last
  answer to the same question while a newer day loads; when the server fails
  to answer, useAnalysisFailure says so and retryAnalysis asks again.
*/

export { localSource } from "./local.ts";
export { remoteSource } from "./remote.ts";
export type { AnalyticsMode, AnalyticsSource, AnalyticsWhere, Rank, Released, SyncAnalytics } from "./types.ts";

function modeFrom(value: unknown): AnalyticsMode {
  if (value === undefined || value === "" || value === "local") return "local";
  if (value === "remote") return "remote";
  console.warn(`[aei] VITE_AEI_ANALYTICS=${String(value)} is not "local" or "remote"; using local.`);
  return "local";
}

/** The mode this build was configured with. */
export const ANALYTICS_MODE: AnalyticsMode = modeFrom(import.meta.env?.VITE_AEI_ANALYTICS);

/** The active source, one for the session. */
export const analytics: AnalyticsSource = ANALYTICS_MODE === "remote" ? remoteSource() : localSource();

// ---------- Failures (a remote source only) ----------

interface FailureState {
  /** The last failed request's message, or null once an answer arrived. */
  message: string | null;
  /** Bumped by retryAnalysis: every waiting question is asked again. */
  attempt: number;
}

let failure: FailureState = { message: null, attempt: 0 };
const failureListeners = new Set<() => void>();

function setFailure(next: FailureState): void {
  if (next.message === failure.message && next.attempt === failure.attempt) return;
  failure = next;
  for (const fn of failureListeners) fn();
}

function noteFailure(err: unknown): void {
  console.warn("[aei] analysis request failed", err);
  // In this browser a failure is a bug, not an outage: logged, not announced.
  if (analytics.where !== "server") return;
  setFailure({ ...failure, message: err instanceof Error ? err.message : String(err) });
}

function noteAnswer(): void {
  if (failure.message !== null) setFailure({ ...failure, message: null });
}

function subscribeFailure(fn: () => void): () => void {
  failureListeners.add(fn);
  return () => {
    failureListeners.delete(fn);
  };
}

const failureNow = () => failure;

/** The last analysis request that failed (a remote source only), or null; cleared by the next answer. */
export function useAnalysisFailure(): string | null {
  return useSyncExternalStore(subscribeFailure, failureNow, failureNow).message;
}

/** Ask every question still waiting again (after a failure). */
export function retryAnalysis(): void {
  setFailure({ message: null, attempt: failure.attempt + 1 });
}

// ---------- One answer, from whichever source ----------

interface Ask<T> {
  /** The question without its day: a remote answer to the same question for an older day stays shown while the new one loads. */
  key: string;
  now: (() => T) | null;
  later: () => Promise<T>;
}

function useAnswer<T>(ask: Ask<T> | null): T | null {
  // Local: computed during render, memoised on the question as the screens always were.
  const now = useMemo(() => (ask?.now ? ask.now() : null), [ask]);
  const [later, setLater] = useState<{ key: string; value: T } | null>(null);
  const attempt = useSyncExternalStore(subscribeFailure, failureNow, failureNow).attempt;
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt asks again after retryAnalysis
  useEffect(() => {
    if (!ask || ask.now) return;
    let live = true;
    ask.later().then(
      (value) => {
        if (!live) return;
        noteAnswer();
        setLater({ key: ask.key, value });
      },
      (err: unknown) => {
        if (live && !(err instanceof Superseded)) noteFailure(err);
      },
    );
    return () => {
      live = false;
    };
  }, [ask, attempt]);
  if (!ask) return null;
  if (ask.now) return now;
  return later && later.key === ask.key ? later.value : null;
}

const keyOf = (...parts: unknown[]) => JSON.stringify(parts);

/** The coverage list for patients like this one. Never null with a local source. */
export function useCoverage(at: Released, query: PatientQuery, rank: Rank): CoverageResult | null {
  const { results, asOf, catalog } = at;
  const ask = useMemo<Ask<CoverageResult>>(() => {
    const day: Released = { results, asOf, catalog };
    const sync = analytics.sync;
    return {
      key: keyOf("coverage", query, rank),
      now: sync ? () => sync.coverage(day, query, rank) : null,
      later: () => analytics.coverage(day, query, rank),
    };
  }, [results, asOf, query, catalog, rank]);
  return useAnswer(ask);
}

/** One antibiotic's share per calendar month, oldest first. Never null with a local source. */
export function useMonthly(at: Released, query: PatientQuery, antibiotic: string, months: number): MonthPoint[] | null {
  const { results, asOf, catalog } = at;
  const ask = useMemo<Ask<MonthPoint[]>>(() => {
    const day: Released = { results, asOf, catalog };
    const sync = analytics.sync;
    return {
      key: keyOf("monthly", query, antibiotic, months),
      now: sync ? () => sync.monthly(day, query, antibiotic, months) : null,
      later: () => analytics.monthly(day, query, antibiotic, months),
    };
  }, [results, asOf, query, antibiotic, months, catalog]);
  return useAnswer(ask);
}

/** The report's antibiotics table; null when `query` is null (view not shown). */
export function useReportTable(at: Released, query: PatientQuery | null): ReportTable | null {
  const { results, asOf, catalog } = at;
  const ask = useMemo<Ask<ReportTable> | null>(() => {
    if (!query) return null;
    const day: Released = { results, asOf, catalog };
    const sync = analytics.sync;
    return {
      key: keyOf("table", query),
      now: sync ? () => sync.reportTable(day, query) : null,
      later: () => analytics.reportTable(day, query),
    };
  }, [results, asOf, query, catalog]);
  return useAnswer(ask);
}

/** The report's unit comparison over `days`; null when `query` is null (view not shown). */
export function useReportMatrix(at: Released, query: PatientQuery | null, days: number): ReportMatrix | null {
  const { results, asOf, catalog } = at;
  const ask = useMemo<Ask<ReportMatrix> | null>(() => {
    if (!query) return null;
    const day: Released = { results, asOf, catalog };
    const sync = analytics.sync;
    return {
      key: keyOf("units", query, days),
      now: sync ? () => sync.reportMatrix(day, query, days) : null,
      later: () => analytics.reportMatrix(day, query, days),
    };
  }, [results, asOf, query, catalog, days]);
  return useAnswer(ask);
}

// ---------- Signals ----------

export interface SignalsState {
  /** Signals for the results on screen, none past the day shown (empty while the feed's current generation has none yet). */
  signals: readonly Signal[];
  /** The day the signals were computed for (null before the first answer). */
  signalsAsOf: IsoDate | null;
  /** The feed generation they belong to (see useFeed). */
  signalsGen: number;
  /** A newer day is being checked; the previous signals stay meanwhile. */
  pending: boolean;
}

const NO_SIGNALS: readonly Signal[] = [];

interface Computed {
  signals: readonly Signal[];
  signalsAsOf: IsoDate | null;
  signalsGen: number;
  pending: boolean;
}

/**
 * The signal list for the day shown. While a new day is being checked the
 * previous list stays (pending = true); an answer older than one already
 * shown is dropped. Only signals computed for the results on screen are
 * returned, cut to `asOf`: right after a rewind the old list (from a later
 * day) is never shown.
 */
export function useSignals(results: readonly Result[], asOf: IsoDate | null, generation: number, catalog: Catalog | null): SignalsState {
  const [state, setState] = useState<Computed>({ signals: NO_SIGNALS, signalsAsOf: null, signalsGen: -1, pending: false });
  const lastId = useRef(0);
  const applied = useRef(0);
  const attempt = useSyncExternalStore(subscribeFailure, failureNow, failureNow).attempt;

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt asks again after retryAnalysis
  useEffect(() => {
    if (!asOf || !catalog) return;
    const id = ++lastId.current;
    setState((st) => (st.pending ? st : { ...st, pending: true }));
    analytics.signals({ results, asOf, catalog }, generation).then(
      (signals) => {
        if (id < applied.current) return; // an older answer arriving late
        applied.current = id;
        noteAnswer();
        setState({ signals, signalsAsOf: asOf, signalsGen: generation, pending: id < lastId.current });
      },
      (err: unknown) => {
        if (err instanceof Superseded || id < applied.current) return;
        applied.current = id;
        noteFailure(err);
        setState((st) => ({ ...st, pending: id < lastId.current }));
      },
    );
  }, [results, asOf, generation, catalog, attempt]);

  const signals = useMemo(
    () => (asOf && state.signalsGen === generation ? visibleSignals(state.signals, asOf) : NO_SIGNALS),
    [state.signals, state.signalsGen, generation, asOf],
  );
  return { signals, signalsAsOf: state.signalsAsOf, signalsGen: state.signalsGen, pending: state.pending };
}
