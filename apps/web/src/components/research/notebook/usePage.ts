import { useCallback, useEffect, useState } from "react";
import { loadPage, type Page, savePage } from "./model.ts";

// The notebook page of one slot (hospital, and project when one is open), held by the board so it outlives the
// window: a closed Notebook still receives the rail's "To notebook". Saved on every change.

export function useNotebookPage(slot: string): { page: Page; update: (fn: (p: Page) => Page) => void } {
  const [state, setState] = useState(() => ({ slot, page: loadPage(slot) }));
  // Another hospital or project: that slot's page, read before anything is saved over it.
  const current = state.slot === slot ? state : { slot, page: loadPage(slot) };
  if (current !== state) setState(current);
  useEffect(() => {
    if (state.slot === slot) savePage(state.slot, state.page);
  }, [state, slot]);
  const update = useCallback((fn: (p: Page) => Page) => setState((s) => ({ slot: s.slot, page: fn(s.page) })), []);
  return { page: current.page, update };
}
