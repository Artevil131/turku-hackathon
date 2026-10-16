import { addDays, clampDate } from "./dates.ts";

// A replay clock walks an "as of" date through a fixed date range, so a
// static dataset can be shown as if results kept arriving (DECISIONS.md
// D-005). It knows nothing about the records; see release.ts for that.

export interface ClockState {
  asOf: string;
  start: string;
  end: string;
  running: boolean;
  /** Real milliseconds between ticks while running. */
  tickMs: number;
  /** Calendar days the clock advances per tick. */
  daysPerTick: number;
}

export interface Scheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface ReplayClockOptions {
  start: string;
  end: string;
  /** Where the clock starts; defaults to `start`. */
  asOf?: string;
  tickMs: number;
  daysPerTick: number;
  scheduler?: Scheduler;
}

/** Called with the state after the change and the as-of date before it. */
export type ClockListener = (state: ClockState, previousAsOf: string) => void;

export interface ReplayClock {
  state(): ClockState;
  play(): void;
  pause(): void;
  step(days?: number): void;
  seek(date: string): void;
  configure(options: { tickMs?: number; daysPerTick?: number }): void;
  subscribe(listener: ClockListener): () => void;
  dispose(): void;
}

const defaultScheduler: Scheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
};

export function createReplayClock(options: ReplayClockOptions): ReplayClock {
  if (options.start > options.end) throw new Error(`start ${options.start} is after end ${options.end}`);
  const scheduler = options.scheduler ?? defaultScheduler;
  const listeners = new Set<ClockListener>();
  let handle: unknown = null;
  let state: ClockState = {
    asOf: clampDate(options.asOf ?? options.start, options.start, options.end),
    start: options.start,
    end: options.end,
    running: false,
    tickMs: options.tickMs,
    daysPerTick: options.daysPerTick,
  };

  function emit(previousAsOf: string) {
    for (const listener of listeners) listener({ ...state }, previousAsOf);
  }

  function stopTimer() {
    if (handle !== null) scheduler.clearInterval(handle);
    handle = null;
  }

  function startTimer() {
    stopTimer();
    handle = scheduler.setInterval(() => advance(state.daysPerTick), state.tickMs);
  }

  function advance(days: number) {
    const previous = state.asOf;
    const asOf = clampDate(addDays(previous, days), state.start, state.end);
    const reachedEnd = asOf === state.end;
    if (reachedEnd && state.running) stopTimer();
    state = { ...state, asOf, running: state.running && !reachedEnd };
    if (asOf !== previous || reachedEnd) emit(previous);
  }

  return {
    state: () => ({ ...state }),
    play() {
      if (state.running || state.asOf === state.end) return;
      state = { ...state, running: true };
      startTimer();
      emit(state.asOf);
    },
    pause() {
      if (!state.running) return;
      stopTimer();
      state = { ...state, running: false };
      emit(state.asOf);
    },
    step(days = state.daysPerTick) {
      advance(days);
    },
    seek(date) {
      const previous = state.asOf;
      state = { ...state, asOf: clampDate(date, state.start, state.end) };
      emit(previous);
    },
    configure({ tickMs, daysPerTick }) {
      state = { ...state, tickMs: tickMs ?? state.tickMs, daysPerTick: daysPerTick ?? state.daysPerTick };
      if (state.running) startTimer();
      emit(state.asOf);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopTimer();
      listeners.clear();
    },
  };
}
