import type { IsoDate, WardCode } from "@aei/domain";

/** A sample as the relation layers need it. A `Culture` from @aei/domain fits. */
export interface Sample {
  cultureId: string;
  patientId: string;
  sampleDate: IsoDate;
  ward: WardCode;
}

/** Inclusive date range, ISO dates. */
export interface DateWindow {
  from: IsoDate;
  to: IsoDate;
}

export interface Flow {
  from: WardCode;
  to: WardCode;
  /** Distinct patients who made this move in the window. */
  patients: number;
}

/** Each patient's samples in time order (date, then culture id, which the dataset assigns in time order). */
export function samplesByPatient<S extends Sample>(samples: readonly S[]): Map<string, S[]> {
  const byPatient = new Map<string, S[]>();
  for (const s of samples) {
    const list = byPatient.get(s.patientId);
    if (list) list.push(s);
    else byPatient.set(s.patientId, [s]);
  }
  for (const list of byPatient.values()) list.sort(bySampleOrder);
  return byPatient;
}

export function bySampleOrder(a: Sample, b: Sample): number {
  if (a.sampleDate !== b.sampleDate) return a.sampleDate < b.sampleDate ? -1 : 1;
  return a.cultureId < b.cultureId ? -1 : a.cultureId > b.cultureId ? 1 : 0;
}

export function inWindow(date: IsoDate, window: DateWindow | undefined): boolean {
  return !window || (date >= window.from && date <= window.to);
}

/** One patient moving between units, dated by the sample in the new unit. */
export interface Move {
  patientId: string;
  from: WardCode;
  to: WardCode;
  date: IsoDate;
}

/**
 * Every move between units (D-011): a patient's sample in unit B whose
 * previous sample was in unit A is a move A → B, dated by B's sample. A
 * move depends only on earlier samples, so moves computed once over all
 * data can be cut to any window later. Pass every culture (negative ones
 * too), not only isolates.
 */
export function patientMoves(samples: readonly Sample[]): Move[] {
  const moves: Move[] = [];
  for (const [patientId, list] of samplesByPatient(samples)) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const next = list[i];
      if (prev && next && prev.ward !== next.ward) moves.push({ patientId, from: prev.ward, to: next.ward, date: next.sampleDate });
    }
  }
  return moves;
}

/** Patient flow between units: moves dated in `window`, counted once per patient. Strongest first. */
export function patientFlows(samples: readonly Sample[], window?: DateWindow): Flow[] {
  return countFlows(patientMoves(samples), window);
}

/** Like `patientFlows`, from moves computed beforehand. */
export function countFlows(moves: readonly Move[], window?: DateWindow): Flow[] {
  const pairs = new Map<string, { from: WardCode; to: WardCode; ids: Set<string> }>();
  for (const m of moves) {
    if (!inWindow(m.date, window)) continue;
    const key = `${m.from}|${m.to}`;
    const pair = pairs.get(key) ?? { from: m.from, to: m.to, ids: new Set<string>() };
    pair.ids.add(m.patientId);
    pairs.set(key, pair);
  }
  return [...pairs.values()]
    .map(({ from, to, ids }) => ({ from, to, patients: ids.size }))
    .sort((a, b) => b.patients - a.patients || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

/** Units patients from `ward` most often go to next, strongest first. */
export function nextUnits(flows: readonly Flow[], ward: WardCode, limit = 3): { ward: WardCode; patients: number; share: number }[] {
  const out = flows.filter((f) => f.from === ward);
  const total = out.reduce((sum, f) => sum + f.patients, 0);
  return out
    .slice()
    .sort((a, b) => b.patients - a.patients)
    .slice(0, limit)
    .map((f) => ({ ward: f.to, patients: f.patients, share: total ? f.patients / total : 0 }));
}

/** Units that send the most patients to `ward`, strongest first. */
export function previousUnits(flows: readonly Flow[], ward: WardCode, limit = 3): { ward: WardCode; patients: number }[] {
  return flows
    .filter((f) => f.to === ward)
    .slice()
    .sort((a, b) => b.patients - a.patients)
    .slice(0, limit)
    .map((f) => ({ ward: f.from, patients: f.patients }));
}

/** Both directions of every pair added together, strongest first. */
export function undirectedFlows(flows: readonly Flow[]): { a: WardCode; b: WardCode; patients: number }[] {
  const pairs = new Map<string, { a: WardCode; b: WardCode; patients: number }>();
  for (const { from, to, patients } of flows) {
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    const pair = pairs.get(key) ?? { a, b, patients: 0 };
    pair.patients += patients;
    pairs.set(key, pair);
  }
  return [...pairs.values()].sort((x, y) => y.patients - x.patients);
}
