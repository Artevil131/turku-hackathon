// Which records have "arrived" by a given date. The caller says which date
// of a record counts as its arrival; this module only indexes and slices.

export interface ReleaseIndex<T> {
  /** Records dated on or before `date`. */
  upTo(date: string): T[];
  /** Records dated after `from` and on or before `to`. */
  between(from: string, to: string): T[];
  readonly size: number;
}

export function createReleaseIndex<T>(records: readonly T[], dateOf: (record: T) => string): ReleaseIndex<T> {
  const sorted = [...records].sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0));
  const dates = sorted.map(dateOf);

  // First position whose date is greater than `date`.
  function upperBound(date: string): number {
    let lo = 0;
    let hi = dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((dates[mid] as string) <= date) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  return {
    upTo: (date) => sorted.slice(0, upperBound(date)),
    between: (from, to) => (from >= to ? [] : sorted.slice(upperBound(from), upperBound(to))),
    size: sorted.length,
  };
}
