import type { IsoDate } from "../feed/types.ts";

// Calendar arithmetic on ISO dates (YYYY-MM-DD), always in UTC so a date never
// shifts with the viewer's time zone. ISO dates compare correctly as strings,
// so `a < b` is the comparison to use; these helpers do the arithmetic.

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// Results repeat a few hundred distinct dates thousands of times, so parsed
// day numbers are memoised.
const dayCache = new Map<string, number>();

/** True for a well-formed calendar date such as "2026-02-28" (not "2026-02-30"). */
export function isIsoDate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  return fromDayNumber(toDayNumber(value)) === value;
}

/** Days since 1970-01-01. */
export function toDayNumber(iso: IsoDate): number {
  const cached = dayCache.get(iso);
  if (cached !== undefined) return cached;
  const m = ISO.exec(iso);
  if (!m) throw new RangeError(`Not an ISO date: ${iso}`);
  const day = Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
  if (dayCache.size > 20_000) dayCache.clear();
  dayCache.set(iso, day);
  return day;
}

/** The ISO date of a day number (inverse of toDayNumber). */
export function fromDayNumber(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** `iso` moved by `days` (negative = earlier). */
export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** First day of the month `iso` falls in. */
export function monthStart(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

/** Last day of the month `iso` falls in. */
export function monthEnd(iso: IsoDate): IsoDate {
  return addDays(addMonths(monthStart(iso), 1), -1);
}

/** `iso` moved by whole calendar months; the day is clamped to the target month's length (Jan 31 + 1 = Feb 28/29). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + months;
  const d = Number(iso.slice(8, 10));
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d, length))).toISOString().slice(0, 10);
}

/** Whole calendar months from `from`'s month to `to`'s month (2026-01-31 -> 2026-02-01 is 1). */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const months = (iso: IsoDate) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  return months(to) - months(from);
}

/** Monday of the ISO week `iso` falls in. */
export function weekStart(iso: IsoDate): IsoDate {
  const day = toDayNumber(iso);
  // 1970-01-01 was a Thursday: (day + 3) mod 7 is 0 on Mondays.
  return fromDayNumber(day - (((day + 3) % 7) + 7) % 7);
}

/** The earlier of two dates. */
export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

/** The later of two dates. */
export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}
