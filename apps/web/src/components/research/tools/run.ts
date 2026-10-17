import type { AeiClient } from "@aei/contract";
import { type IsolateRecord, PHENOTYPES, type Phenotype } from "@aei/domain";
import {
  baselineStart,
  type CellResult,
  computeBeta,
  computeCompare,
  computeDetector,
  computeRate,
  computeShares,
  type DetectorChoice,
  type Discount,
  type EventSpec,
  type Frame,
  prepare,
  type Slice,
  type ToolId,
} from "./model.ts";

// One analysis run: the rows it fetches and the gear call it makes. The rail's inspector and the notebook's
// analysis cells both call this, so the same slice and parameters give the same numbers in both places.

export interface RunInputs {
  event: EventSpec;
  /** Compare's second frame, already resolved (previous, another unit or dates of its own). */
  frameB: Frame;
  periodDays: number;
  /** D-041's discount for the Beta; null is the flat prior only. */
  discount: Discount | null;
  detector: DetectorChoice;
}

async function fetchFrame(client: AeiClient, s: Slice, f: Frame, wide = false): Promise<IsolateRecord[]> {
  return (
    await client.isolates({
      from: f.from,
      to: f.to,
      ...(f.unit && !wide ? { ward: f.unit } : {}),
      ...(s.organism && !wide ? { organism: s.organism as never } : {}),
      ...(s.specimen && !wide ? { specimen: s.specimen as never } : {}),
    })
  ).records;
}

export async function runTool(client: AeiClient, tool: ToolId, s: Slice, inp: RunInputs): Promise<CellResult> {
  const get = (f: Frame, wide = false) => fetchFrame(client, s, f, wide);
  if (tool === "rate") return computeRate(prepare(await get(s), s, s.firstOnly), s);
  if (tool === "compare") {
    const b = inp.frameB;
    const [ra, rb] = await Promise.all([get(s), get(b)]);
    return computeCompare(prepare(ra, s, s.firstOnly), prepare(rb, b, s.firstOnly), s, b, inp.event);
  }
  if (tool === "shares") return computeShares(prepare(await get(s), s, s.firstOnly), s, inp.event, inp.periodDays);
  if (tool === "beta") {
    const own = prepare(await get(s), s, s.firstOnly);
    const parent = inp.discount ? prepare(await get({ ...s, unit: "" }, true), s, s.firstOnly) : null;
    return computeBeta(own, parent, s, inp.event, inp.discount);
  }
  // The baseline is the live detector's: every unit and organism, 365 days before the frame.
  const all = await get({ from: baselineStart(s.from), to: s.to, unit: "" }, true);
  const phs: Phenotype[] = s.phenotype ? [s.phenotype] : [...PHENOTYPES];
  return computeDetector(all, s, inp.detector, phs);
}
