import type { Phenotype } from "@aei/domain";
import type { WeeklySeries } from "./weekly.ts";

/** Match the THL series' phenotype only, not its organism or specimen definition. */
export function phenotypeOfSeries(group: string): Phenotype | null {
  const prefix = group.split(/\s/)[0]?.toLowerCase();
  return prefix === "mrsa" || prefix === "esbl" || prefix === "vre" || prefix === "cpe" ? prefix : null;
}

/**
 * Two adjacent four-week totals from the latest eight API week buckets (the latest may be partial).
 * Counts are patient–unit–weeks, not distinct hospital patients: the API deduplicates only within
 * a phenotype, unit and week. Fewer than eight buckets cannot supply both windows.
 */
export function phenotypeWindows(data: WeeklySeries, phenotype: Phenotype) {
  const n = data.weeks.length;
  if (n < 8) return null;
  const total = (from: number, to: number) =>
    Object.values(data.units).reduce((sum, unit) => sum + unit.phenotypes[phenotype].slice(from, to).reduce((a, b) => a + b, 0), 0);
  return {
    previous: { from: data.weeks[n - 8] as string, to: data.weeks[n - 5] as string, count: total(n - 8, n - 4) },
    recent: { from: data.weeks[n - 4] as string, to: data.weeks[n - 1] as string, count: total(n - 4, n) },
  };
}
