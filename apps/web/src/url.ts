// URL state: the page and its view state live in the hash, e.g.
// `#research?panel=grid&unit=URO`, so any view is a link. Pages read their
// params on load and write them back with `replaceState`, so filtering does
// not flood the back button; switching pages pushes a history entry.
//
// `replaceState` fires no `hashchange`, so writers here notify subscribers
// themselves (`subscribeHash`); `useHashParam` lets two components that never
// meet (the timeline above the page, the board inside it) share one param.

import { useCallback, useSyncExternalStore } from "react";

export function hashPage(): string {
  return location.hash.slice(1).split("?")[0] ?? "";
}

export function hashParams(): URLSearchParams {
  const query = location.hash.split("?")[1];
  return new URLSearchParams(query ?? "");
}

/** Params that belong to the whole app (the timeline's layers, the hospital), kept when a page writes its own. */
const SHARED_PARAMS = ["tl", "hospital"] as const;

/**
 * Pure: `hash` (with or without the leading `#`) with `params` set, empty or null
 * values removed, and the shared params kept unless named. Returns the new hash with `#`.
 */
export function mergeHash(hash: string, params: Record<string, string | null | undefined>): string {
  const bare = hash.startsWith("#") ? hash.slice(1) : hash;
  const [page = "", query] = bare.split("?");
  const current = new URLSearchParams(query ?? "");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  for (const key of SHARED_PARAMS) if (!(key in params) && current.get(key)) search.set(key, current.get(key) as string);
  const qs = search.toString();
  return `#${page}${qs ? `?${qs}` : ""}`;
}

const listeners = new Set<() => void>();
function notify() {
  for (const fn of listeners) fn();
}

/** Called after every hash write made through this module, and on the browser's own hash and history events. */
export function subscribeHash(fn: () => void): () => void {
  listeners.add(fn);
  if (listeners.size === 1) {
    addEventListener("hashchange", notify);
    addEventListener("popstate", notify);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      removeEventListener("hashchange", notify);
      removeEventListener("popstate", notify);
    }
  };
}

function replaceHash(next: string) {
  if (location.hash === next || (next === "#" && location.hash === "")) return;
  history.replaceState(history.state, "", next);
  notify();
}

/** The selected hospital as a query string ("?hospital=sata"), or "" for the home site; carried to another page. */
export function sharedQuery(keys: readonly (typeof SHARED_PARAMS)[number][] = ["hospital"]): string {
  const current = hashParams();
  const search = new URLSearchParams();
  for (const key of keys) if (current.get(key)) search.set(key, current.get(key) as string);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Sets or removes one app-wide param, keeping every other param of the page. */
export function writeSharedParam(key: (typeof SHARED_PARAMS)[number], value: string | null): void {
  const search = hashParams();
  if (value) search.set(key, value);
  else search.delete(key);
  const qs = search.toString();
  replaceHash(`#${hashPage()}${qs ? `?${qs}` : ""}`);
}

/** Replaces the current page's params in the URL without a history entry. */
export function writeHashParams(params: Record<string, string | null | undefined>): void {
  replaceHash(mergeHash(location.hash, params));
}

/** Sets or removes one param of the current page, keeping the others. */
export function writeHashParam(key: string, value: string | null): void {
  const search = hashParams();
  if (value) search.set(key, value);
  else search.delete(key);
  const qs = search.toString();
  replaceHash(`#${hashPage()}${qs ? `?${qs}` : ""}`);
}

/**
 * One hash param as React state shared across the app: `[value, set]`. Reading
 * follows every write made through this module and the browser's own navigation.
 */
export function useHashParam(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribeHash,
    () => hashParams().get(key),
    () => null,
  );
  const set = useCallback((next: string | null) => writeHashParam(key, next), [key]);
  return [value, set];
}
