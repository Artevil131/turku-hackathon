import type { RegionalResponse } from "@aei/contract";
import { useEffect, useRef, useState } from "react";

type Fetched = { status: "loading" } | { status: "missing" } | { status: "failed" } | { status: "ok"; data: RegionalResponse };

/** The regional data as of `month` (YYYY-MM); fetched again only when the month changes. */
export function useRegional(month: string, base = ""): Fetched {
  const [state, setState] = useState<Fetched>({ status: "loading" });
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `month` is not in the URL, but the server cuts the data at its clock, so a new month refetches.
  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    fetch(`${base}/api/regional`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 404) return { status: "missing" } as const;
        if (!res.ok) return { status: "failed" } as const;
        return { status: "ok", data: (await res.json()) as RegionalResponse } as const;
      })
      .then((state) => {
        if (id === latest.current && !ctrl.signal.aborted) setState(state);
      })
      .catch((error: unknown) => {
        if (id === latest.current && !ctrl.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "failed" });
        }
      });
    return () => ctrl.abort();
  }, [month, base]);
  return state;
}
