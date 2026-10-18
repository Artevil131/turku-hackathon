// Open projects, like documents in Photoshop: each is a tab in the sidebar with its own URL (its project id and
// view state in the hash). At most two tabs have no project: the patient view started without saving (Treat a
// patient) and one board view (a link to a signal). No DOM access here except the remembered list in localStorage.

export const PROJECT_PAGE = "project";
export const VIEW_KEY = "view";
const STORAGE = "aei.tabs.v1";
const MAX_TABS = 12;

export interface DocTab {
  /** `p:<project id>`, or `view` for the one project-less view. */
  key: string;
  project: string | null;
  /** The quick start a project-less view began from, which names it. */
  quick: string | null;
  /** The project's name, as last read from the server. */
  name: string | null;
  frozen: boolean;
  asOf: string | null;
  drift: boolean;
  /** The tab's own location, e.g. `#project?project=abc&inc=…`, restored on switching back. */
  hash: string;
}

const paramsOf = (hash: string) => new URLSearchParams(hash.split("?")[1] ?? "");

/** The one project-less patient view (Treat a patient) is a tab of its own, apart from the project-less board. */
export const PATIENT_KEY = "view:patient";

export function tabKey(hash: string): string {
  const params = paramsOf(hash);
  const id = params.get("project");
  if (id) return `p:${id}`;
  return params.get("quick") === "patient" ? PATIENT_KEY : VIEW_KEY;
}

export function tabFromHash(hash: string, previous?: DocTab): DocTab {
  const params = paramsOf(hash);
  const project = params.get("project");
  const key = tabKey(hash);
  const same = previous?.key === key ? previous : undefined;
  return {
    key,
    project,
    quick: project ? null : params.get("quick"),
    name: same?.name ?? null,
    frozen: same?.frozen ?? false,
    asOf: same?.asOf ?? null,
    drift: same?.drift ?? false,
    hash,
  };
}

/** Adds the tab for `hash`, or updates the open one with the same key in place. Oldest tabs drop past the limit. */
export function upsertTab(tabs: readonly DocTab[], hash: string): DocTab[] {
  const key = tabKey(hash);
  const at = tabs.findIndex((tab) => tab.key === key);
  if (at >= 0) {
    const next = [...tabs];
    next[at] = tabFromHash(hash, tabs[at]);
    return next;
  }
  return [...tabs, tabFromHash(hash)].slice(-MAX_TABS);
}

export function patchTab(tabs: readonly DocTab[], key: string, patch: Partial<Omit<DocTab, "key">>): DocTab[] {
  return tabs.map((tab) => (tab.key === key ? { ...tab, ...patch } : tab));
}

/** Removes a tab; `next` is the neighbour to show when it was the active one (the right one, else the left), or null. */
export function closeTab(tabs: readonly DocTab[], key: string): { tabs: DocTab[]; next: DocTab | null } {
  const at = tabs.findIndex((tab) => tab.key === key);
  if (at < 0) return { tabs: [...tabs], next: null };
  const rest = tabs.filter((tab) => tab.key !== key);
  return { tabs: rest, next: rest[at] ?? rest[at - 1] ?? null };
}

export function loadTabs(): DocTab[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (tab): tab is DocTab => typeof tab?.key === "string" && typeof tab?.hash === "string" && tab.hash.startsWith(`#${PROJECT_PAGE}`),
      )
      .map((tab) => ({
        ...tabFromHash(tab.hash),
        name: typeof tab.name === "string" ? tab.name : null,
        frozen: !!tab.frozen,
        asOf: tab.asOf ?? null,
      }))
      .slice(-MAX_TABS);
  } catch {
    return [];
  }
}

export function saveTabs(tabs: readonly DocTab[]): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(tabs.map(({ drift: _drift, ...tab }) => tab)));
  } catch {
    /* Blocked storage: the tabs last for this session. */
  }
}
