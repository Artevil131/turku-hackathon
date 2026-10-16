import type { IsoDate } from "../feed/types.ts";
import type { Signal } from "./types.ts";

// Rules shared by every screen and the engine, defined once.

/**
 * The organiser's floor: no percentage from fewer first isolates (CONTEXT.md,
 * "Counting rules"; THL Finres, WHO GLASS and CLSI M39 use the same 30).
 */
export const MIN_ISOLATES = 30;

/**
 * Signals known on `asOf`: none that start after it, and none drawn past it.
 * The screens pass every signal list through this, so a list computed for a
 * later day (e.g. while a rewind is being recomputed) never shows the future.
 */
export function visibleSignals(signals: readonly Signal[], asOf: IsoDate): Signal[] {
  const out: Signal[] = [];
  for (const sig of signals) {
    if (sig.firstDate > asOf) continue;
    out.push(sig.lastDate > asOf ? { ...sig, lastDate: asOf } : sig);
  }
  return out;
}
