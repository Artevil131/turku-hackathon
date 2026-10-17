import type { AeiClient } from "@aei/contract";
import { useEffect, useMemo, useState } from "react";
import { type ChartData, computeChart, recordQuery } from "./model.ts";
import { type ChartSpec, resolveFrame } from "./spec.ts";

export type ChartLoad =
  | { status: "waiting" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ChartData };

/**
 * The data of one chart at this clock: the same isolates request the Tools window makes, then computeChart.
 * A trailing window has a new end each time the clock moves, so it is fetched and computed again then.
 */
export function useChartData(client: AeiClient, spec: ChartSpec, asOf: string | null): ChartLoad {
  const frame = useMemo(() => resolveFrame(spec, asOf), [spec, asOf]);
  const [load, setLoad] = useState<ChartLoad>({ status: "waiting" });
  // The request is the dependency; a spec edit that changes nothing it asks for does not refetch.
  const key = frame ? JSON.stringify(recordQuery(spec, frame)) : "";
  const specKey = JSON.stringify(spec);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` and `specKey` stand for `frame` and `spec`.
  useEffect(() => {
    if (!frame) return setLoad({ status: "waiting" });
    let live = true;
    setLoad((l) => (l.status === "ready" ? l : { status: "loading" }));
    client
      .isolates(recordQuery(spec, frame) as never)
      .then((r) => live && setLoad({ status: "ready", data: computeChart(r.records, spec, frame) }))
      .catch((e) => live && setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [client, key, specKey]);
  return load;
}
