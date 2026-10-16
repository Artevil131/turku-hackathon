import type { QualityResponse } from "@aei/contract";
import { useEffect, useRef, useState } from "react";

/*
  useQuality(key) -> { data, failed, key }
  The server's data checks over every row it holds (GET /api/quality,
  libs/utils/quality, D-038). Fetched again whenever `key` changes (the app
  passes the feed generation and the latest arrival, so new results are
  checked); `key` in the answer says which request it belongs to, so the
  arrival notice can wait for the checks of its own arrival.
*/

export interface QualityState {
  data: QualityResponse | null;
  /** The server answered with an error or not at all (an older server without the route). */
  failed: boolean;
  /** The key the answer was fetched for (null before the first answer). */
  key: string | null;
}

export function useQuality(key: string, base = ""): QualityState {
  const [state, setState] = useState<QualityState>({ data: null, failed: false, key: null });
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    const ctrl = new AbortController();
    fetch(`${base}/api/quality`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<QualityResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (id === latest.current) setState({ data, failed: false, key });
      })
      .catch((error: unknown) => {
        if (id !== latest.current || (error instanceof DOMException && error.name === "AbortError")) return;
        setState((s) => ({ ...s, failed: true, key }));
      });
    return () => ctrl.abort();
  }, [key, base]);

  return state;
}

/** Findings over all checks. */
export function findingCount(data: QualityResponse): number {
  return data.summary.reduce((n, c) => n + c.count, 0);
}
