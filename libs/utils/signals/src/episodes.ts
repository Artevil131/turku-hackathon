import type { IsoDate } from "@aei/feed";
import { daysBetween } from "@aei/isolates";
import type { Severity, Signal } from "./types.ts";

// One outbreak raises several signals: a cluster, then a surge, then an
// antibiotic working less often for the same organism on the same unit. For
// the reader they are one story. groupEpisodes() links signals that concern
// the same unit and the same organism or resistance flag and overlap in time,
// so a screen can show one card with a dated story instead of five cards.
// Presentation only: detection (signals.ts) is unchanged, every signal keeps
// its own id, evidence and "how it was found".

/** Signals on the same unit this many days apart or closer can belong to one episode. */
export const EPISODE_LINK_DAYS = 14;

export interface Episode {
  /** Stable while the episode grows: "ep|" + the id of its first signal. */
  id: string;
  /** The signal the card leads with: most severe, then the earliest. */
  lead: Signal;
  /** Every signal in the episode, oldest first. */
  members: Signal[];
  severity: Severity;
  firstDate: IsoDate;
  lastDate: IsoDate;
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function related(a: Signal, b: Signal, gap: number): boolean {
  if (!a.ward || a.ward !== b.ward) return false;
  // A data gap is the laboratory's business, never part of an outbreak story.
  if (a.kind === "data-gap" || b.kind === "data-gap") return false;
  const sameOrganism = !!a.organism && a.organism === b.organism;
  const sameFlag = !!a.phenotype && a.phenotype === b.phenotype;
  if (!sameOrganism && !sameFlag) return false;
  // Time spans [firstDate, lastDate] within `gap` days of each other.
  const aEnd = a.lastDate;
  const bEnd = b.lastDate;
  const apart = a.firstDate > bEnd ? daysBetween(bEnd, a.firstDate) : b.firstDate > aEnd ? daysBetween(aEnd, b.firstDate) : 0;
  return apart <= gap;
}

/**
 * Signals grouped into episodes, in the order of each episode's first signal
 * in `signals` (so a sorted list stays sorted by its most prominent member).
 */
export function groupEpisodes(signals: readonly Signal[], gap: number = EPISODE_LINK_DAYS): Episode[] {
  const n = signals.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  // Only signals on the same unit can link: compare within each unit.
  const byWard = new Map<string, number[]>();
  signals.forEach((s, i) => {
    if (!s.ward) return;
    const list = byWard.get(s.ward);
    if (list) list.push(i);
    else byWard.set(s.ward, [i]);
  });
  for (const list of byWard.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const i = list[x]!;
        const j = list[y]!;
        if (related(signals[i]!, signals[j]!, gap)) {
          const ri = find(i);
          const rj = find(j);
          if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
        }
      }
    }
  }
  const groups = new Map<number, Signal[]>();
  const order: number[] = [];
  signals.forEach((s, i) => {
    const r = find(i);
    let g = groups.get(r);
    if (!g) {
      g = [];
      groups.set(r, g);
      order.push(r);
    }
    g.push(s);
  });
  return order.map((r) => {
    const members = groups
      .get(r)!
      .slice()
      .sort((a, b) => (a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const lead = members.reduce((best, s) =>
      RANK[s.severity] < RANK[best.severity] || (RANK[s.severity] === RANK[best.severity] && s.firstDate < best.firstDate) ? s : best,
    );
    let lastDate = members[0]!.lastDate;
    for (const s of members) if (s.lastDate > lastDate) lastDate = s.lastDate;
    return { id: `ep|${members[0]!.id}`, lead, members, severity: lead.severity, firstDate: members[0]!.firstDate, lastDate };
  });
}

/** The episode holding the signal with this id, if any. */
export function episodeOf(episodes: readonly Episode[], signalId: string): Episode | undefined {
  return episodes.find((e) => e.members.some((s) => s.id === signalId));
}
