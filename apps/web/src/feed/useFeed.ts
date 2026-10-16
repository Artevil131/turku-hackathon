import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { httpFeed } from "./http.ts";
import type { Feed, FeedClock, FeedCommand, FeedEvent, FeedMeta, IsoDate, Result } from "./types.ts";

// The one place the app talks to the feed.
//
//   connect: subscribe first (events are held back), then meta, clock and the
//   full released history from meta.start up to the clock; then the held-back
//   events are applied. From then on:
//     clock     -> clock updates
//     arrivals  -> new results appended (a new array; the old one is a prefix,
//                  which lets the engine's caches extend instead of recompute)
//     reset     -> everything reloaded (the clock went backwards)
//   When the stream drops: status "offline", reconnect with backoff (1 s, 2 s,
//   4 s ... 15 s). On reconnect only the missing days are fetched.
//
// `asOf` is the day the loaded results are complete up to. It trails the
// feed clock until that day's results are in, so a screen never computes a
// day from half of its results.

export type FeedStatus = "connecting" | "live" | "offline";

export interface Arrival {
  /** The day the results were released up to. */
  to: IsoDate;
  /** New results in this release (0 on a day without results). */
  count: number;
  /** Increases with every arrival, so equal {to, count} pairs are still new. */
  seq: number;
}

export interface SyncState {
  status: FeedStatus;
  meta: FeedMeta | null;
  clock: FeedClock | null;
  /** Every released result; append-only between reloads (new array identity on each change). */
  results: readonly Result[];
  /** Results are complete up to this day (null until loaded). */
  asOf: IsoDate | null;
  /** Bumped on every full reload (first load, reset, reconnect after a rewind). */
  generation: number;
  lastArrival: Arrival | null;
  /** When offline: epoch ms of the next reconnect attempt. */
  retryAt: number | null;
}

export interface FeedState extends SyncState {
  /** Demo controls (a live hospital feed would not offer them). Resolves to the feed's clock. */
  control: (command: FeedCommand) => Promise<FeedClock>;
  /** Reconnect now instead of waiting for the backoff. */
  retry: () => void;
}

export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;
/** If the clock moves but no arrivals event follows within this time, fetch the missing days. */
export const CATCH_UP_MS = 1500;

export const INITIAL_SYNC: SyncState = {
  status: "connecting",
  meta: null,
  clock: null,
  results: [],
  asOf: null,
  generation: 0,
  lastArrival: null,
  retryAt: null,
};

const nextDay = (iso: IsoDate): IsoDate => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Keeps a copy of the feed's released results in step with it, outside React
 * (so it can be tested without a DOM). `emit` receives every state change.
 */
export interface FeedSync {
  retry: () => void;
  stop: () => void;
  /** The clock a control command returned: running state and speed apply at once. */
  noteControl: (clock: FeedClock) => void;
}

export function startFeedSync(feed: Feed, emit: (state: SyncState) => void): FeedSync {
  let state: SyncState = INITIAL_SYNC;
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch };
    emit(state);
  };

  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let catchUpTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let seq = 0;
  /** Bumped to cancel work that a newer load or a disconnect replaced. */
  let token = 0;

  let ids = new Set<string>();
  let list: Result[] = [];
  let loadedTo: IsoDate | null = null;
  let clockAsOf: IsoDate | null = null;
  /** Events held back while a load is in flight. */
  let held: FeedEvent[] | null = null;

  function replaceAll(all: readonly Result[], to: IsoDate) {
    ids = new Set(all.map((r) => r.isolateId));
    list = all.slice();
    loadedTo = to;
    set({ results: list, asOf: to, generation: state.generation + 1, lastArrival: null });
  }

  /** Appends results not seen yet; returns how many were new. */
  function append(fresh: readonly Result[], to: IsoDate, arrival: boolean): number {
    const add: Result[] = [];
    for (const r of fresh) {
      if (ids.has(r.isolateId)) continue;
      ids.add(r.isolateId);
      add.push(r);
    }
    if (add.length) list = [...list, ...add];
    if (!loadedTo || to > loadedTo) loadedTo = to;
    const patch: Partial<SyncState> = { results: list, asOf: loadedTo };
    if (arrival) {
      seq += 1;
      patch.lastArrival = { to, count: add.length, seq };
    }
    set(patch);
    return add.length;
  }

  /** Runs `work` with events held back, then applies them in order. */
  function holding(work: (my: number) => Promise<void>) {
    const my = ++token;
    held = held ?? [];
    work(my)
      .then(() => {
        if (disposed || my !== token) return;
        const pending = held ?? [];
        held = null;
        for (const e of pending) apply(e);
      })
      .catch(() => {
        if (my === token) fail();
      });
  }

  function reload(to: IsoDate) {
    holding(async (my) => {
      const meta = state.meta;
      if (!meta) return;
      const all = await feed.history({ from: meta.start, to });
      if (disposed || my !== token) return;
      replaceAll(all, to);
    });
  }

  function fetchGap(to: IsoDate, extra: readonly Result[]) {
    const from = loadedTo ? nextDay(loadedTo) : (state.meta?.start ?? to);
    holding(async (my) => {
      const more = await feed.history({ from, to });
      if (disposed || my !== token) return;
      append([...more, ...extra], to, true);
    });
  }

  function scheduleCatchUp() {
    clearTimeout(catchUpTimer);
    catchUpTimer = setTimeout(() => {
      if (disposed || held || !clockAsOf || !loadedTo || clockAsOf <= loadedTo) return;
      fetchGap(clockAsOf, []);
    }, CATCH_UP_MS);
  }

  function apply(e: FeedEvent) {
    if (disposed) return;
    if (held) {
      held.push(e);
      return;
    }
    if (e.type === "clock") {
      clockAsOf = e.clock.asOf;
      set({ clock: e.clock });
      if (loadedTo && e.clock.asOf < loadedTo)
        reload(e.clock.asOf); // went back without a reset event
      else if (loadedTo && e.clock.asOf > loadedTo) scheduleCatchUp();
    } else if (e.type === "arrivals") {
      if (loadedTo && e.to <= loadedTo && e.results.every((r) => ids.has(r.isolateId))) return; // already have it
      if (loadedTo && e.from > loadedTo)
        fetchGap(e.to, e.results); // days in between are missing
      else append(e.results, e.to, true);
    } else {
      clockAsOf = e.clock.asOf;
      set({ clock: e.clock });
      reload(e.clock.asOf);
    }
  }

  function fail() {
    if (disposed) return;
    unsubscribe?.();
    unsubscribe = null;
    token++;
    held = null;
    clearTimeout(catchUpTimer);
    const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 15000;
    attempt += 1;
    set({ status: "offline", retryAt: Date.now() + wait });
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, wait);
  }

  function connect() {
    if (disposed) return;
    clearTimeout(reconnectTimer);
    unsubscribe?.();
    unsubscribe = null;
    if (!state.meta) set({ status: "connecting" });
    holding(async (my) => {
      const close = feed.subscribe(apply, () => {
        if (unsubscribe === close) fail(); // only the current stream counts
      });
      unsubscribe = close;
      const meta = state.meta ?? (await feed.meta());
      if (disposed || my !== token) return;
      if (meta !== state.meta) set({ meta });
      const clock = await feed.clock();
      if (disposed || my !== token) return;
      clockAsOf = clock.asOf;
      set({ clock });
      if (!loadedTo || clock.asOf < loadedTo) {
        // First load, or the clock went back while we were away.
        const all = await feed.history({ from: meta.start, to: clock.asOf });
        if (disposed || my !== token) return;
        replaceAll(all, clock.asOf);
      } else if (clock.asOf > loadedTo) {
        const more = await feed.history({ from: nextDay(loadedTo), to: clock.asOf });
        if (disposed || my !== token) return;
        append(more, clock.asOf, false);
      }
      attempt = 0;
      set({ status: "live", retryAt: null });
    });
  }

  connect();

  return {
    retry() {
      attempt = 0;
      connect();
    },
    noteControl(c) {
      if (disposed) return;
      // The day itself moves with the clock and arrivals events, so results and asOf stay in step.
      set({ clock: state.clock ? { ...state.clock, running: c.running, tickMs: c.tickMs, daysPerTick: c.daysPerTick } : c });
    },
    stop() {
      disposed = true;
      token++;
      unsubscribe?.();
      clearTimeout(reconnectTimer);
      clearTimeout(catchUpTimer);
    },
  };
}

export function useFeed(feedArg?: Feed): FeedState {
  // One feed per mounted hook unless the caller passes its own.
  const feed = useMemo(() => feedArg ?? httpFeed(), [feedArg]);
  const [state, setState] = useState<SyncState>(INITIAL_SYNC);
  const sync = useRef<FeedSync | null>(null);

  useEffect(() => {
    const s = startFeedSync(feed, setState);
    sync.current = s;
    return () => {
      s.stop();
      sync.current = null;
    };
  }, [feed]);

  const control = useCallback(
    async (command: FeedCommand) => {
      const c = await feed.control(command);
      sync.current?.noteControl(c);
      return c;
    },
    [feed],
  );
  const retry = useCallback(() => sync.current?.retry(), []);

  return { ...state, control, retry };
}
