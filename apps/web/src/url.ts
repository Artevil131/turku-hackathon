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
export function writeHashParams(params: Record<string, string | null | undefined>): void {
  const page = hashPage();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const qs = search.toString();
  const next = `#${page}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next) history.replaceState(history.state, "", next);
}
