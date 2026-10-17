import type { AeiClient, Flow, RelationsResponse, TrailLink } from "@aei/contract";
import type { Phenotype, WardCode } from "@aei/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { daysBetween, type Incident, windowOf } from "./model.ts";

// The units an incident spans (Artem's correction 1): where it was raised,
// where its patients went next (relations flows), the phenotype trail
// (relations links) and other incidents of the same phenotype within 28
// days. Only API data; shares are counts divided by the unit's outflow.

export interface NextUnit {
  unit: WardCode;
  patients: number;
  /** Share of the patients who left the origin unit in the window, 0 to 1. */
  share: number;
}
export interface TrailUnit {
  unit: WardCode;
  patients: number;
  confirmed: number;
  /** "out": carriers found in the origin unit later sampled here; "in": the other way. */
  direction: "out" | "in";
}
export interface Spans {
  origin: WardCode | null;
  next: NextUnit[];
  trail: TrailUnit[];
  /** Units of other incidents of the same phenotype within 28 days. */
  also: { unit: WardCode; incident: string; date: string }[];
  /** The window the relations cover; it ends at the as-of date. */
  from: string | null;
  to: string | null;
  /** Every distinct unit, origin first. */
  units: WardCode[];
}

const NEXT_MAX = 3;
const TRAIL_MAX = 2;
const ALSO_DAYS = 28;

export function computeSpans(inc: Incident, all: readonly Incident[], rel: RelationsResponse | null): Spans {
  const origin = inc.ward;
  const next: NextUnit[] = [];
  const trail: TrailUnit[] = [];
  if (rel && origin) {
    const out = rel.flows.filter((f: Flow) => f.from === origin && f.to !== origin);
    const total = out.reduce((sum, f) => sum + f.patients, 0);
    for (const f of [...out].sort((a, b) => b.patients - a.patients || a.to.localeCompare(b.to)).slice(0, NEXT_MAX))
      next.push({ unit: f.to, patients: f.patients, share: total > 0 ? f.patients / total : 0 });
    const shown = new Set<Phenotype>(inc.phenotypes);
    const links = rel.links.filter((l: TrailLink) => shown.has(l.phenotype) && (l.from === origin || l.to === origin) && l.from !== l.to);
    for (const l of [...links].sort((a, b) => b.patients - a.patients).slice(0, TRAIL_MAX))
      trail.push({
        unit: l.from === origin ? l.to : l.from,
        patients: l.patients,
        confirmed: l.confirmed,
        direction: l.from === origin ? "out" : "in",
      });
  }
  const also = all
    .filter(
      (o) =>
        o.key !== inc.key &&
        o.ward &&
        o.ward !== origin &&
        o.kind === "cluster" &&
        o.phenotypes.some((p) => inc.phenotypes.includes(p)) &&
        Math.abs(daysBetween(inc.date, o.date)) <= ALSO_DAYS,
    )
    .map((o) => ({ unit: o.ward as WardCode, incident: o.key, date: o.date }));
  const units = [
    ...new Set<WardCode>([
      ...(origin ? [origin] : []),
      ...next.map((n) => n.unit),
      ...trail.map((x) => x.unit),
      ...also.map((a) => a.unit),
    ]),
  ];
  return { origin, next, trail, also, from: rel?.from ?? null, to: rel?.to ?? null, units };
}

/** How many days of relations an incident needs: from 28 days before its first alert to the as-of date. */
export function daysFor(inc: Incident, asOf: string): number {
  return Math.max(28, daysBetween(windowOf(inc).from, asOf) + 1);
}

/**
 * One relations request per distinct window, cached until the clock moves.
 * Requests run in small batches so the feed stays responsive.
 */
export function useRelations(client: AeiClient, asOf: string | null, incidents: readonly Incident[]) {
  const [cache, setCache] = useState<Map<number, RelationsResponse>>(new Map());
  const cacheAt = useRef<string | null>(null);
  const days = useMemo(() => (asOf ? [...new Set(incidents.filter((i) => i.ward).map((i) => daysFor(i, asOf)))] : []), [incidents, asOf]);
  const key = days.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `days`.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    if (cacheAt.current !== asOf) {
      cacheAt.current = asOf;
      setCache(new Map());
    }
    (async () => {
      for (let i = 0; i < days.length && !stale; i += 4) {
        const batch = days.slice(i, i + 4);
        const got = await Promise.all(
          batch.map((d) =>
            client.relations({ days: d }).then(
              (r) => [d, r] as const,
              () => null,
            ),
          ),
        );
        if (stale) return;
        setCache((c) => {
          const next = new Map(c);
          for (const g of got) if (g) next.set(g[0], g[1]);
          return next;
        });
      }
    })();
    return () => {
      stale = true;
    };
  }, [client, asOf, key]);
  return (inc: Incident): RelationsResponse | null => (asOf ? (cache.get(daysFor(inc, asOf)) ?? null) : null);
}
