import { type Locale, t } from "@aei/i18n";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { OnBody, useAnchored } from "./anchored.ts";
import { Info as InfoIcon } from "./Icons.tsx";

interface Props {
  locale: Locale;
  /** The explanation shown in the popover. */
  children: ReactNode;
  /** Accessible name of the button; defaults to "Info". */
  label?: string;
  /** Where the popover opens relative to the button. */
  align?: "start" | "end";
}

/**
 * The ⓘ button: every explanation lives behind one. A real button with
 * aria-expanded; Enter, Space or a tap opens it, Esc or an outside click
 * closes it, and focus returns to the button. Never hover-only.
 */
export function InfoButton({ locale, children, label, align = "start" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // On <body>, placed next to the button, so a window's edge or the window below never cuts it off.
  const place = useAnchored(open, button, pop, align);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const at = e.target as Node;
      if (!root.current?.contains(at) && !pop.current?.contains(at)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span className="info" ref={root}>
      <button
        type="button"
        ref={button}
        className="info-btn"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label ?? t(locale, "uiInfo")}
        title={label ?? t(locale, "uiInfo")}
        onClick={() => setOpen((v) => !v)}
      >
        <InfoIcon />
      </button>
      {open ? (
        <OnBody>
          <div id={id} ref={pop} className="info-pop" role="note" style={place}>
            {children}
          </div>
        </OnBody>
      ) : null}
    </span>
  );
}
