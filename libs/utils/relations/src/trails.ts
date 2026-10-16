import { type IsoDate, type Organism, PHENOTYPES, type Phenotype, type WardCode } from "@aei/domain";
import { addDays, daysBetween } from "@aei/replay";
import { type DateWindow, inWindow, type Sample, samplesByPatient } from "./flows.ts";

/** An isolate as the trail needs it. An `IsolateRecord` from @aei/domain fits. */
export interface Find {
  cultureId: string;
  organism: Organism;
  phenotypes: readonly Phenotype[];
}

export interface TrailOptions {
  /** Keep trails with a step in this window; earlier finds within `maxDays` still count as origins. */
  window?: DateWindow;
  /** How long after a find the patient still counts as a carrier (D-012). Default 90. */
  maxDays?: number;
  /** Only this phenotype; all four when left out. */
  phenotype?: Phenotype;
}

export const DEFAULT_CARRIER_DAYS = 90;

export interface TrailStep {
  cultureId: string;
  date: IsoDate;
  ward: WardCode;
  /** Organisms in this sample with the phenotype. Empty: the carrier was sampled here without it showing. */
  organisms: Organism[];
  /** For a sample in another unit than the latest find: the unit of that find. */
  carriedFrom: WardCode | null;
  /** The date of that find, when `carriedFrom` is set. */
  foundOn: IsoDate | null;
}

/** A known carrier sampled in another unit than where the phenotype was last found. */
export interface CarrierArrival {
  patientId: string;
  phenotype: Phenotype;
  cultureId: string;
  date: IsoDate;
  ward: WardCode;
  from: WardCode;
  foundOn: IsoDate;
  /** The sample in the new unit showed the phenotype again. */
  confirmed: boolean;
}

export interface PatientTrail {
  patientId: string;
  phenotype: Phenotype;
  /** In time order: every find, and every later sample in another unit while the patient counts as a carrier. */
  steps: TrailStep[];
}

export interface TrailLink {
  from: WardCode;
  to: WardCode;
  phenotype: Phenotype;
  /** Distinct carriers found in `from` and later sampled in `to`. */
  patients: number;
  /** Of those, how many showed the phenotype again in `to`. */
  confirmed: number;
}

/**
 * Phenotype trail (D-012): a patient with ESBL, MRSA, VRE or CPE found in
 * unit A who is later sampled in unit B (any result) within `maxDays` of
 * the latest find is a carrier moving A → B. Pass every culture as
 * `samples` (negative ones too) and the isolates as `finds`.
 */
export function phenotypeTrails(samples: readonly Sample[], finds: readonly Find[], options: TrailOptions = {}): PatientTrail[] {
  const maxDays = options.maxDays ?? DEFAULT_CARRIER_DAYS;
  const phenotypes = options.phenotype ? [options.phenotype] : PHENOTYPES;
  const window = options.window;
  const context = window ? { from: addDays(window.from, -maxDays), to: window.to } : undefined;

  const found = new Map<string, Map<Phenotype, Organism[]>>();
  for (const f of finds) {
    for (const p of f.phenotypes) {
      const byPhenotype = found.get(f.cultureId) ?? new Map<Phenotype, Organism[]>();
      const organisms = byPhenotype.get(p) ?? [];
      if (!organisms.includes(f.organism)) organisms.push(f.organism);
      byPhenotype.set(p, organisms);
      found.set(f.cultureId, byPhenotype);
    }
  }

  const trails: PatientTrail[] = [];
  for (const [patientId, list] of samplesByPatient(samples)) {
    for (const phenotype of phenotypes) {
      const steps: TrailStep[] = [];
      let latest: { ward: WardCode; date: IsoDate } | null = null;
      for (const s of list) {
        if (!inWindow(s.sampleDate, context)) continue;
        const organisms = found.get(s.cultureId)?.get(phenotype) ?? [];
        const carried = latest && latest.ward !== s.ward && daysBetween(latest.date, s.sampleDate) <= maxDays ? latest : null;
        if (organisms.length || carried) {
          steps.push({
            cultureId: s.cultureId,
            date: s.sampleDate,
            ward: s.ward,
            organisms,
            carriedFrom: carried?.ward ?? null,
            foundOn: carried?.date ?? null,
          });
        }
        if (organisms.length) latest = { ward: s.ward, date: s.sampleDate };
      }
      if (steps.some((step) => inWindow(step.date, window))) trails.push({ patientId, phenotype, steps });
    }
  }
  return trails;
}

/**
 * Every carrier move dated in `window`, newest first. A step depends only
 * on earlier samples, so trails computed once over all data can be cut to
 * any window later.
 */
export function carrierArrivals(trails: readonly PatientTrail[], window?: DateWindow): CarrierArrival[] {
  const out: CarrierArrival[] = [];
  for (const trail of trails) {
    for (const step of trail.steps) {
      if (!step.carriedFrom || !step.foundOn || !inWindow(step.date, window)) continue;
      out.push({
        patientId: trail.patientId,
        phenotype: trail.phenotype,
        cultureId: step.cultureId,
        date: step.date,
        ward: step.ward,
        from: step.carriedFrom,
        foundOn: step.foundOn,
        confirmed: step.organisms.length > 0,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.cultureId.localeCompare(b.cultureId)));
}

/** Carrier moves between units, counted per patient, strongest first. Only moves dated in `window`. */
export function trailLinks(trails: readonly PatientTrail[], window?: DateWindow): TrailLink[] {
  const links = new Map<string, { from: WardCode; to: WardCode; phenotype: Phenotype; ids: Set<string>; confirmed: Set<string> }>();
  for (const trail of trails) {
    for (const step of trail.steps) {
      if (!step.carriedFrom || !inWindow(step.date, window)) continue;
      const key = `${step.carriedFrom}|${step.ward}|${trail.phenotype}`;
      const link = links.get(key) ?? {
        from: step.carriedFrom,
        to: step.ward,
        phenotype: trail.phenotype,
        ids: new Set<string>(),
        confirmed: new Set<string>(),
      };
      link.ids.add(trail.patientId);
      if (step.organisms.length) link.confirmed.add(trail.patientId);
      links.set(key, link);
    }
  }
  return [...links.values()]
    .map(({ from, to, phenotype, ids, confirmed }) => ({ from, to, phenotype, patients: ids.size, confirmed: confirmed.size }))
    .sort((a, b) => b.patients - a.patients || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
