import type { CoverageResponse } from "@aei/contract";
import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "../../feed/types.ts";
import { coverageUrl, type TreatChoice } from "./model.ts";

/*
  useCoverage(choice, asOf) -> { data, failed, pending }
  The server's coverage list for the doctor's choices (GET /api/coverage:
  libs/utils/coverage, D-023, D-026, D-027, D-028, D-033), fetched again when
  the choices change or the clock moves. The previous answer stays on screen
  while the next one loads.
*/

export interface CoverageState {
  data: CoverageResponse | null;
  failed: boolean;
  pending: boolean;
}

export function useCoverage(choice: TreatChoice, asOf: IsoDate, base = ""): CoverageState {
  const [state, setState] = useState<CoverageState>({ data: null, failed: false, pending: true });
  const latest = useRef(0);
  const url = coverageUrl(base, choice);

  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, pending: true }));
    fetch(url, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<CoverageResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (id === latest.current) setState({ data, failed: false, pending: false });
      })
      .catch((error: unknown) => {
        if (id !== latest.current || (error instanceof DOMException && error.name === "AbortError")) return;
        setState((s) => ({ ...s, failed: true, pending: false }));
      });
    return () => ctrl.abort();
  }, [url, asOf]);

  return state;
}
