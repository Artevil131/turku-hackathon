import { ApiError } from "@aei/contract";
import { useEffect, useState } from "react";

export type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "404" } | { state: "error" };

/** Fetches on mount and when `deps` or `attempt` change; the previous data stays while a refetch runs. */
export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[], attempt: number): Load<T> & { fetching: boolean } {
  const [res, setRes] = useState<Load<T>>({ state: "loading" });
  const [fetching, setFetching] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher is rebuilt each render; deps say when to refetch
  useEffect(() => {
    let live = true;
    setFetching(true);
    fetcher()
      .then(
        (data) => live && setRes({ state: "ok", data }),
        (e) => live && setRes(e instanceof ApiError && e.status === 404 ? { state: "404" } : { state: "error" }),
      )
      .finally(() => live && setFetching(false));
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return { ...res, fetching };
}
