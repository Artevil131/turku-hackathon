# @aei/replay

Shows a fixed dataset as if results kept arriving (D-005).

- `createReplayClock({ start, end, asOf?, tickMs, daysPerTick, scheduler? })`
  walks an as-of date through the range: `play`, `pause`, `step`, `seek`,
  `configure`, `subscribe(listener)`. The scheduler is injectable for tests.
- `createReleaseIndex(records, dateOf)` answers which records have arrived:
  `upTo(date)` and `between(from, to)` (half-open, `from` excluded). The
  caller decides which date of a record counts as its arrival.
- `addDays`, `daysBetween`, `clampDate` on ISO dates, in UTC.

Knows nothing about microbiology. Relies on: D-004, D-005.
Tests: `src/replay.test.ts`.
