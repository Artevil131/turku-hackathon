import snapshot from "./data/snapshot.json";

// The server's numbers (scripts/snapshot.mjs) plus the experiment results the close quotes.
export const S = snapshot;

export const UNITS = [
  { code: "ED", en: "Emergency" },
  { code: "MED-A", en: "Internal medicine A" },
  { code: "MED-B", en: "Internal medicine B" },
  { code: "SURG", en: "Surgery" },
  { code: "URO", en: "Urology" },
  { code: "ICU", en: "Intensive care" },
  { code: "GER", en: "Geriatrics" },
  { code: "PHC-N", en: "Health centre North" },
  { code: "PHC-S", en: "Health centre South" },
] as const;

export const ANTIBIOTIC: Record<string, string> = {
  MEC: "Mecillinam",
  NIT: "Nitrofurantoin",
  CIP: "Ciprofloxacin",
  TMP: "Trimethoprim",
  CXM: "Cefuroxime",
  TZP: "Piperacillin-tazobactam",
  MEM: "Meropenem",
  AMP: "Ampicillin",
};

const DAY0 = Date.parse("2025-05-12T00:00:00Z");
export const DAYS = 28;
export const dayIndex = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - DAY0) / 86_400_000);
export const dayLabel = (i: number) =>
  new Date(DAY0 + i * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Each isolate as a dot: its day, its lane, and its place in that lane's day cell (3 across, stacked). */
export const DOTS = (() => {
  const seen = new Map<string, number>();
  return S.outbreak.dots.map((d) => {
    const key = `${d.ward}|${d.day}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    return { ...d, day: dayIndex(d.day), lane: UNITS.findIndex((u) => u.code === d.ward), slot: k };
  });
})();

export const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

// From the experiment records (each experiment's out/results.md), quoted on the closing card.
export const EVIDENCE = [
  { claim: "Clusters of 4 patients with a rare resistant strain caught", value: "38 / 40", ref: "0007" },
  { claim: "A unit going silent for 3 days caught", value: "37 / 40", ref: "0009" },
  { claim: "Mild picks that clear: covered the next month", value: "96.6%", ref: "0010" },
  { claim: "Clusters of the commonest strain: not caught", value: "1 / 180", ref: "0011" },
];
