import { type Culture, type IsoDate, type IsolateRecord, PHENOTYPES, type Phenotype, WARDS, type WardCode } from "@aei/domain";
import { addDays } from "@aei/replay";

/** Monday of the ISO week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export interface UnitWeeks {
  /** Cultures sampled in the unit per week (sampling volume; a gap shows as zeros). */
  cultures: number[];
  /** Distinct patients per week with an isolate carrying each phenotype. */
  phenotypes: Record<Phenotype, number[]>;
}

export interface WeeklySeries {
  /** Monday of each week, oldest first; the last week may be partial (it ends at `to`). */
  weeks: IsoDate[];
  units: Record<WardCode, UnitWeeks>;
}

/**
 * Weekly raw counts per unit from `from` to `to` inclusive (D-042: detection
 * reads raw weekly counts, never smoothed estimates). Records and cultures
 * after `to` are ignored, so a series cut at the replay date never shows
 * later days.
 */
export function weeklySeries(records: readonly IsolateRecord[], cultures: readonly Culture[], from: IsoDate, to: IsoDate): WeeklySeries {
  const weeks: IsoDate[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push(w);
  const index = new Map(weeks.map((w, i) => [w, i]));
  const empty = () => weeks.map(() => 0);
  const units = Object.fromEntries(
    WARDS.map((w) => [
      w.code,
      { cultures: empty(), phenotypes: Object.fromEntries(PHENOTYPES.map((p) => [p, empty()])) as Record<Phenotype, number[]> },
    ]),
  ) as Record<WardCode, UnitWeeks>;

  for (const c of cultures) {
    if (c.sampleDate < from || c.sampleDate > to) continue;
    const i = index.get(weekStart(c.sampleDate));
    if (i !== undefined) units[c.ward].cultures[i] = (units[c.ward].cultures[i] ?? 0) + 1;
  }
  const seen = new Set<string>();
  for (const r of records) {
    if (r.sampleDate < from || r.sampleDate > to) continue;
    const i = index.get(weekStart(r.sampleDate));
    if (i === undefined) continue;
    for (const p of r.phenotypes) {
      const key = `${r.ward}|${p}|${i}|${r.patientId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const series = units[r.ward].phenotypes[p];
      series[i] = (series[i] ?? 0) + 1;
    }
  }
  return { weeks, units };
}

// ---------- weekly patients in a window that starts anywhere ----------

const DAY = 86_400_000;
const toMs = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);

/** `date` plus `n` days (n may be negative). */
export const addDaysIso = (d: IsoDate, n: number): IsoDate => addDays(d, n);

/**
 * Distinct patients per week with `phenotype` in `ward`, for the weeks that start at `from`, `from + 7`, … and end
 * at or before `to` (a last partial week is dropped). Unlike `weeklySeries`, weeks are anchored at `from`, not on a
 * Monday, so a window can end on the as-of date: pass `from = addDaysIso(asOf, −7·n + 1)` and `to = asOf`.
 * Weeks without a patient are returned with count 0. Counts are raw (D-042).
 */
export function weeklyPatients(
  records: readonly Pick<IsolateRecord, "patientId" | "sampleDate" | "ward" | "phenotypes">[],
  ward: WardCode,
  phenotype: Phenotype,
  from: IsoDate,
  to: IsoDate,
): { start: IsoDate; count: number }[] {
  const weeks: { start: IsoDate; count: number }[] = [];
  const sets: Set<string>[] = [];
  for (let s = from; addDays(s, 6) <= to; s = addDays(s, 7)) {
    weeks.push({ start: s, count: 0 });
    sets.push(new Set());
  }
  const t0 = toMs(from);
  for (const r of records) {
    if (r.ward !== ward || !r.phenotypes.includes(phenotype)) continue;
    const i = Math.floor((toMs(r.sampleDate) - t0) / (7 * DAY));
    if (i >= 0 && i < weeks.length && toMs(r.sampleDate) <= toMs(to)) sets[i]?.add(r.patientId);
  }
  return weeks.map((w, i) => ({ start: w.start, count: sets[i]?.size ?? 0 }));
}
