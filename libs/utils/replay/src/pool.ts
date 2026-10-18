import type { ReplayClock } from "./clock.ts";

// Many replay clocks, one per key (a visitor, D-005 and D-078), with memory bounded: at most `max` clocks, and a
// clock nobody used for `idleMs` is dropped by `sweep`. A dropped clock is disposed, so its timer stops. A clock
// someone holds (an open live stream) is never dropped as idle; the cap drops it only when every clock is held.

export interface ClockPoolOptions {
  /** Makes the clock for a key the first time it is asked for. */
  create: (key: string) => ReplayClock;
  /** The most clocks kept; making one more drops the least recently used. */
  max: number;
  /** Milliseconds without use after which `sweep` drops an unheld clock. */
  idleMs: number;
  /** Milliseconds now; injectable for tests. */
  now?: () => number;
  /** Called after a clock is dropped and disposed. */
  onEvict?: (key: string, clock: ReplayClock) => void;
}

export interface ClockPool {
  /** The key's clock, made if it has none; counts as use. */
  get(key: string): ReplayClock;
  /** The key's clock if it has one, without making it; counts as use. */
  peek(key: string): ReplayClock | undefined;
  /** Makes or uses the key's clock and keeps it from idle eviction until the returned release is called. */
  hold(key: string): () => void;
  /** Every clock with its key, least recently used first; does not count as use. */
  entries(): [string, ReplayClock][];
  /** Drops the clocks unheld and unused for `idleMs`; returns their keys. */
  sweep(): string[];
  readonly size: number;
  /** Drops every clock. */
  clear(): void;
}

interface Entry {
  clock: ReplayClock;
  usedAt: number;
  holds: number;
}

export function createClockPool(options: ClockPoolOptions): ClockPool {
  if (!(options.max >= 1)) throw new Error(`max must be at least 1, not ${options.max}`);
  const now = options.now ?? Date.now;
  // A Map keeps insertion order; a used entry is moved to the end, so the first entries are the least recently used.
  const entries = new Map<string, Entry>();

  function touch(key: string, entry: Entry) {
    entry.usedAt = now();
    entries.delete(key);
    entries.set(key, entry);
  }

  function evict(key: string, entry: Entry) {
    entries.delete(key);
    entry.clock.dispose();
    options.onEvict?.(key, entry.clock);
  }

  function entryOf(key: string): Entry {
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= options.max) {
        let victim: [string, Entry] | undefined;
        let oldest: [string, Entry] | undefined;
        for (const candidate of entries) {
          oldest ??= candidate;
          if (candidate[1].holds === 0) {
            victim = candidate;
            break;
          }
        }
        const drop = victim ?? oldest;
        if (drop) evict(...drop);
      }
      entry = { clock: options.create(key), usedAt: now(), holds: 0 };
    }
    touch(key, entry);
    return entry;
  }

  return {
    get: (key) => entryOf(key).clock,
    peek(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      touch(key, entry);
      return entry.clock;
    },
    hold(key) {
      const entry = entryOf(key);
      entry.holds++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        entry.holds--;
        // Idle time counts from the release; an entry evicted meanwhile is not brought back.
        if (entries.get(key) === entry) touch(key, entry);
      };
    },
    entries: () => [...entries].map(([key, entry]) => [key, entry.clock]),
    sweep() {
      const t = now();
      const dropped: string[] = [];
      for (const [key, entry] of [...entries]) {
        if (entry.holds === 0 && t - entry.usedAt >= options.idleMs) {
          evict(key, entry);
          dropped.push(key);
        }
      }
      return dropped;
    },
    get size() {
      return entries.size;
    },
    clear() {
      for (const [key, entry] of [...entries]) evict(key, entry);
    },
  };
}
