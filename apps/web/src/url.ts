// URL state: the page and its view state live in the hash, e.g.
// `#research?panel=grid&unit=URO`, so any view is a link. Pages read their
// params on load and write them back with `replaceState`, so filtering does
// not flood the back button; switching pages pushes a history entry.

export function hashPage(): string {
  return location.hash.slice(1).split("?")[0] ?? "";
}

export function hashParams(): URLSearchParams {
  const query = location.hash.split("?")[1];
  return new URLSearchParams(query ?? "");
}

/** Replaces the current page's params in the URL without a history entry. */
/** Params that belong to the whole app (the timeline's layers), kept when a page writes its own. */
const SHARED_PARAMS = ["tl", "hospital"] as const;

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
  const next = `#${hashPage()}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next && !(next === "#" && location.hash === "")) history.replaceState(history.state, "", next);
}

export function writeHashParams(params: Record<string, string | null | undefined>): void {
  const page = hashPage();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const current = hashParams();
  for (const key of SHARED_PARAMS) if (!(key in params) && current.get(key)) search.set(key, current.get(key) as string);
  const qs = search.toString();
  const next = `#${page}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next) history.replaceState(history.state, "", next);
}
