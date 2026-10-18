import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { OnBody, useAnchored } from "../anchored.ts";

/**
 * A project card's "…" menu. The cards sit in a row that scrolls sideways, which would cut a menu inside it off, so
 * the menu opens on <body> next to its button. Esc or a press elsewhere closes it, and so does choosing an item.
 */
export function CardMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const place = useAnchored(open, button, menu, "end");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const at = e.target as Node;
      if (!button.current?.contains(at) && !menu.current?.contains(at)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="start-card-menu">
      <button
        type="button"
        ref={button}
        className="start-card-menu-btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="4" cy="9" r="1" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="14" cy="9" r="1" />
        </svg>
      </button>
      {open ? (
        <OnBody>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the items are buttons; a click on one closes the menu after it acts */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: same: the click comes from the buttons inside */}
          <div id={id} ref={menu} className="start-card-pop" style={place} onClick={() => setOpen(false)}>
            {children}
          </div>
        </OnBody>
      ) : null}
    </div>
  );
}
