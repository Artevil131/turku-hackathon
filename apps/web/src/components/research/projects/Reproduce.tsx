import { type Locale, t } from "@aei/i18n";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./reproduce.css";

export type NotebookLanguage = "python" | "r";
export function notebookUrl(id: string, language: NotebookLanguage) {
  return `/notebook/lab/index.html?path=${encodeURIComponent(`projects/${id}/${language === "r" ? "reproduce-r" : "reproduce"}.ipynb`)}`;
}

export function Reproduce({
  locale,
  project,
  language,
  onLanguage,
}: {
  locale: Locale;
  project?: { id: string; name: string };
  language: NotebookLanguage;
  onLanguage: (language: NotebookLanguage) => void;
}) {
  if (!project)
    return (
      <div className="reproduce-empty">
        <p>{t(locale, "reproduceEmpty")}</p>
        <button
          type="button"
          className="reproduce-save"
          onClick={() => dispatchEvent(new CustomEvent("aei:project-action", { detail: "save" }))}
        >
          {t(locale, "pmSaveAs")}
        </button>
      </div>
    );
  return (
    <div className="reproduce">
      <div className="reproduce-head">
        <strong title={project.name}>{project.name}</strong>
        <div className="reproduce-languages" role="group" aria-label={t(locale, "reproduceLanguage")}>
          {(["python", "r"] as const).map((value) => (
            <button type="button" key={value} aria-pressed={language === value} onClick={() => onLanguage(value)}>
              {value === "r" ? "R" : "Python"}
            </button>
          ))}
        </div>
        <a href={notebookUrl(project.id, language)} target="_blank" rel="noopener noreferrer">
          {t(locale, "reproduceNewTab")}
        </a>
      </div>
      <div className="reproduce-slot" data-reproduce-slot />
    </div>
  );
}

/** The dock re-parents its children. Keep the kernel here, and follow only the slot's geometry. */
export function ReproduceHost({ locale, projectId, language }: { locale: Locale; projectId: string | null; language: NotebookLanguage }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [started, setStarted] = useState(false);
  useLayoutEffect(() => setRoot(anchor.current?.closest<HTMLElement>(".ws") ?? null), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: position the newly mounted iframe after first opening
  useLayoutEffect(() => {
    if (!root) return;
    let pending = 0;
    let dragging = false;
    let slot: HTMLElement | null = null;
    const resize = new ResizeObserver(() => schedule());
    resize.observe(root);
    const position = () => {
      pending = 0;
      const next = root.querySelector<HTMLElement>("[data-reproduce-slot]");
      if (next !== slot) {
        if (slot) resize.unobserve(slot);
        slot = next;
        if (slot) resize.observe(slot);
      }
      const rect = slot?.getBoundingClientRect();
      const visible = !!rect && rect.width > 0 && rect.height > 0 && !slot?.closest("[hidden]");
      if (visible) setStarted(true);
      const iframe = frame.current;
      if (!iframe) return;
      iframe.style.visibility = visible && projectId ? "visible" : "hidden";
      iframe.tabIndex = visible && projectId ? 0 : -1;
      iframe.style.pointerEvents = dragging || root.querySelector('[data-dragging="true"]') ? "none" : "auto";
      if (!rect || !slot) return;
      // Stack with the window that holds the slot: windows are raised by z-index, and a fixed lower one left the
      // frame behind its own window's background, so the window showed empty. Later in the DOM, an equal z wins.
      const host = slot.closest<HTMLElement>(".ws-win");
      const z = host ? getComputedStyle(host).zIndex : "auto";
      iframe.style.zIndex = z === "auto" ? "" : z;
      const origin = root.getBoundingClientRect();
      iframe.style.left = `${rect.left - origin.left + root.scrollLeft}px`;
      iframe.style.top = `${rect.top - origin.top + root.scrollTop}px`;
      iframe.style.width = `${rect.width}px`;
      iframe.style.height = `${rect.height}px`;
      // Clip against scroll containers so the overlay cannot cover another window or its controls.
      let top = rect.top,
        left = rect.left,
        right = rect.right,
        bottom = rect.bottom;
      for (let parent = slot.parentElement; parent && parent !== root; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (style.overflowX !== "visible") {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (style.overflowY !== "visible") {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
      }
      iframe.style.clipPath = `inset(${Math.max(0, top - rect.top)}px ${Math.max(0, rect.right - right)}px ${Math.max(0, rect.bottom - bottom)}px ${Math.max(0, left - rect.left)}px)`;
    };
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(position);
    };
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".ws-title, .ws-splitter")) return;
      dragging = true;
      // Do this synchronously, before a pointer can cross into the frame.
      if (frame.current) frame.current.style.pointerEvents = "none";
    };
    const up = () => {
      dragging = false;
      schedule();
    };
    const mutation = new MutationObserver(schedule);
    const area = root.querySelector(".ws-area");
    if (area) mutation.observe(area, { subtree: true, childList: true, attributes: true });
    mutation.observe(root, { attributes: true });
    root.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("blur", up);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(pending);
      resize.disconnect();
      mutation.disconnect();
      root.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("blur", up);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
    };
  }, [root, projectId, started]);
  return (
    <>
      <span ref={anchor} hidden />
      {root && started && projectId
        ? createPortal(
            <iframe ref={frame} className="reproduce-frame" title={t(locale, "boardReproduce")} src={notebookUrl(projectId, language)} />,
            root,
          )
        : null}
    </>
  );
}
