import { type AeiClient, ApiError, type QualityResponse } from "@aei/contract";
import { useEffect, useRef, useState } from "react";

export type QualityState =
  | { kind: "loading" }
  | { kind: "ready"; data: QualityResponse; asOf: string }
  | { kind: "missing" }
  | { kind: "error" };

/** Monday of the week holding the day, as a day number. */
const mondayOf = (iso: string) => {
  const n = Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  return n - ((((n + 3) % 7) + 7) % 7);
};

/**
 * The data checks: one read on mount, again when the replay date goes backwards (a seek or reset)
 * or crosses into a new week. No polling.
 */
export function useQuality(client: AeiClient | undefined, asOf: string | undefined): QualityState {
  const [state, setState] = useState<QualityState>({ kind: "loading" });
  const fetched = useRef<string | null>(null);

  useEffect(() => {
    if (!client || !asOf) return;
    const last = fetched.current;
    if (last && asOf >= last && mondayOf(asOf) === mondayOf(last)) return;
    fetched.current = asOf;
    let live = true;
    let settled = false;
    client
      .quality()
      .then((data) => {
        settled = true;
        if (live) setState({ kind: "ready", data, asOf });
      })
      .catch((e) => {
        settled = true;
        if (!live) return;
        setState(e instanceof ApiError && e.status === 404 ? { kind: "missing" } : { kind: "error" });
      });
    return () => {
      live = false;
      // A read cancelled before it answered must not count as done, or the rerun skips it and the status stays on loading.
      if (!settled) fetched.current = last;
    };
  }, [client, asOf]);

  return state;
}
