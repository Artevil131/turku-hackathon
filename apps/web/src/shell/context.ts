import type { Project } from "@aei/contract";
import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

/** What a page can ask of the app shell: open, close and describe the open projects. */
export interface Shell {
  /** Opens a saved project in its own tab (or switches to it), with the project's saved view. */
  openProject: (project: Project) => void;
  /** Opens the project-less view, optionally from a quick start ("patient"). */
  openView: (quick?: string | null, params?: Record<string, string>) => void;
  /** Closes a project's tab after it was deleted or is no longer wanted. */
  closeProject: (id: string) => void;
  /** The project was deleted elsewhere (the server answered 404): close its tab and say so. */
  projectGone: (id: string, name: string | null) => void;
  /** Closes the active tab. */
  closeActive: () => void;
  goHome: () => void;
  /** The open tab reports what it shows, so the sidebar can name it and mark it frozen. */
  describe: (info: { project: Project | null; drift: boolean }) => void;
}

const noop = () => {};
export const ShellContext = createContext<Shell>({
  openProject: noop,
  openView: noop,
  closeProject: noop,
  projectGone: noop,
  closeActive: noop,
  goHome: noop,
  describe: noop,
});
export const useShell = () => useContext(ShellContext);

/** Places in the sidebar that the open project fills with its own controls. */
export interface Slots {
  actions: HTMLElement | null;
  windows: HTMLElement | null;
}
export const SlotsContext = createContext<Slots>({ actions: null, windows: null });

/** Renders `children` into a sidebar slot; nothing while the sidebar has not mounted it. */
export function InSlot({ name, children }: { name: keyof Slots; children: ReactNode }) {
  const el = useContext(SlotsContext)[name];
  return el ? createPortal(children, el) : null;
}
