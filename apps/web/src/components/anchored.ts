import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const EDGE = 8;
const GAP = 4;

/**
 * Places an open popover next to its anchor in viewport coordinates, so it can live in a portal on <body> and no
 * window's overflow, transform or stacking order can clip or cover it. Below the anchor when it fits, above when there
 * is more room there; aligned to the anchor's start or end edge, then kept inside the viewport. The room it has is
 * --anchored-room, for the popover's own max-height.
 */
export function useAnchored(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  pop: RefObject<HTMLElement | null>,
  align: "start" | "end",
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ position: "fixed", visibility: "hidden" });
      return;
    }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = pop.current;
      if (!a || !el) return;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const below = vh - a.bottom - GAP - EDGE;
      const above = a.top - GAP - EDGE;
      const h = el.scrollHeight;
      const up = h > below && above > below;
      const room = Math.max(120, up ? above : below);
      const w = el.offsetWidth;
      let left = align === "end" ? a.right - w : a.left;
      left = Math.min(left, vw - EDGE - w);
      left = Math.max(left, EDGE);
      // Above, it hangs from its bottom edge, so a CSS max-height that cuts it shorter leaves no gap.
      const next: CSSProperties & Record<"--anchored-room", string> = {
        position: "fixed",
        left: Math.round(left),
        ...(up ? { bottom: Math.round(vh - a.top + GAP) } : { top: Math.round(a.bottom + GAP) }),
        "--anchored-room": `${Math.round(room)}px`,
      };
      setStyle(next);
    };
    place();
    addEventListener("resize", place);
    // Capture: a scroll inside any window moves the anchor too.
    addEventListener("scroll", place, true);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [open, align, anchor, pop]);

  return style;
}

/** Renders a popover on <body> (nothing on the server, where it never opens). */
export function OnBody({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}
