/** Distinct patients shared by two alert case lists, not shared isolate ids. */
export function patientOverlap(above: readonly { patientId: string }[], related: readonly { patientId: string }[]) {
  const a = new Set(above.map((r) => r.patientId));
  const b = new Set(related.map((r) => r.patientId));
  let both = 0;
  for (const id of a) if (b.has(id)) both++;
  return { both, onlyAbove: a.size - both, onlyRelated: b.size - both };
}
