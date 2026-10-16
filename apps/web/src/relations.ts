import type { WardCode } from "@aei/domain";

// Relation layers between units (DECISIONS.md D-009). How relations are
// modelled is not decided; until a gear in libs/utils provides them, the map
// uses one measured layer: consecutive cultures of the same patient taken
// in two different units, counted over the whole dataset (2023-10-02 to
// 2026-09-27, computed from cultures.csv). It shows where patients go next,
// not where bacteria spread.

export type Flow = readonly [from: WardCode, to: WardCode, patients: number];

export const PATIENT_FLOWS: readonly Flow[] = [
  ["PHC-N", "ED", 1038],
  ["ED", "PHC-S", 987],
  ["PHC-S", "ED", 974],
  ["ED", "PHC-N", 964],
  ["ED", "MED-A", 807],
  ["MED-A", "ED", 760],
  ["ED", "URO", 728],
  ["URO", "ED", 696],
  ["SURG", "ED", 665],
  ["ED", "SURG", 652],
  ["GER", "ED", 631],
  ["ED", "GER", 627],
  ["ED", "MED-B", 568],
  ["MED-B", "ED", 545],
  ["MED-A", "PHC-S", 475],
  ["MED-A", "PHC-N", 444],
  ["PHC-S", "MED-A", 436],
  ["PHC-N", "MED-A", 427],
  ["URO", "PHC-N", 388],
  ["URO", "PHC-S", 387],
  ["PHC-S", "URO", 385],
  ["PHC-N", "URO", 376],
  ["SURG", "PHC-S", 365],
  ["ED", "ICU", 361],
  ["ICU", "ED", 356],
  ["SURG", "PHC-N", 353],
  ["PHC-S", "SURG", 353],
  ["PHC-N", "SURG", 350],
  ["GER", "PHC-N", 349],
  ["PHC-S", "GER", 342],
  ["PHC-N", "GER", 333],
  ["GER", "PHC-S", 332],
  ["MED-A", "GER", 311],
  ["URO", "MED-A", 310],
  ["PHC-N", "MED-B", 310],
  ["MED-B", "PHC-N", 306],
  ["SURG", "MED-A", 294],
  ["MED-B", "PHC-S", 293],
  ["PHC-S", "MED-B", 286],
  ["GER", "MED-A", 283],
  ["MED-A", "SURG", 277],
  ["MED-A", "URO", 276],
  ["URO", "SURG", 261],
  ["MED-A", "MED-B", 246],
  ["MED-B", "MED-A", 246],
  ["URO", "GER", 240],
  ["SURG", "URO", 233],
  ["GER", "URO", 230],
  ["SURG", "GER", 225],
  ["GER", "SURG", 223],
  ["MED-B", "SURG", 223],
  ["ICU", "PHC-N", 218],
  ["PHC-N", "ICU", 212],
  ["PHC-S", "ICU", 210],
  ["MED-B", "URO", 201],
  ["MED-B", "GER", 200],
  ["SURG", "MED-B", 196],
  ["URO", "MED-B", 195],
  ["GER", "MED-B", 191],
  ["ICU", "PHC-S", 186],
  ["MED-A", "ICU", 157],
  ["ICU", "MED-A", 153],
  ["ICU", "URO", 147],
  ["ICU", "GER", 144],
  ["ICU", "SURG", 138],
  ["URO", "ICU", 135],
  ["GER", "ICU", 135],
  ["SURG", "ICU", 125],
  ["ICU", "MED-B", 99],
  ["MED-B", "ICU", 94],
];

/** Units patients from `ward` most often go to next, strongest first. */
export function nextUnits(ward: WardCode, limit = 3): { ward: WardCode; patients: number; share: number }[] {
  const out = PATIENT_FLOWS.filter(([from]) => from === ward);
  const total = out.reduce((sum, [, , n]) => sum + n, 0);
  return out
    .slice()
    .sort((a, b) => b[2] - a[2])
    .slice(0, limit)
    .map(([, to, n]) => ({ ward: to, patients: n, share: total ? n / total : 0 }));
}

/** Units that send the most patients to `ward`, strongest first. */
export function previousUnits(ward: WardCode, limit = 3): { ward: WardCode; patients: number }[] {
  return PATIENT_FLOWS.filter(([, to]) => to === ward)
    .slice()
    .sort((a, b) => b[2] - a[2])
    .slice(0, limit)
    .map(([from, , n]) => ({ ward: from, patients: n }));
}

/** Both directions of every pair added together. */
export function undirectedFlows(): { a: WardCode; b: WardCode; patients: number }[] {
  const pairs = new Map<string, { a: WardCode; b: WardCode; patients: number }>();
  for (const [from, to, n] of PATIENT_FLOWS) {
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    const pair = pairs.get(key) ?? { a, b, patients: 0 };
    pair.patients += n;
    pairs.set(key, pair);
  }
  return [...pairs.values()].sort((x, y) => y.patients - x.patients);
}
