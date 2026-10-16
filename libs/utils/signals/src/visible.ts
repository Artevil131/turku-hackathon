import type { IsoDate } from "@aei/feed";
import type { Signal } from "./types.ts";

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
