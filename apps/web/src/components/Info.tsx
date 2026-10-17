import { type Locale, t } from "@aei/i18n";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
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
        <span id={id} className="info-pop" role="note" data-align={align}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
