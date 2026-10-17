import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./Popover.css";

interface Props {
  /** Visible content of the trigger button. */
  children: ReactNode;
  /** The popover's content. */
  content: ReactNode;
  /** Accessible name of the trigger (and of the popover). */
  label: string;
  className?: string;
  title?: string;
}

const WIDTH = 288;

/**
 * A button that opens a small popover: Enter, Space or a tap opens it, Esc or a click elsewhere closes it and
 * focus returns to the button. Never hover-only. Positioned `fixed` from the button, so scrolling lists do not clip it.
 */
export function Popover({ children, content, label, className, title }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const w = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const h = pop.current?.offsetHeight ?? 0;
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 && r.top - 4 - h > 8 ? r.top - 4 - h : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!pop.current?.contains(el) && !button.current?.contains(el)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    const onMove = () => close(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        ref={button}
        className={className}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={title ?? label}
        onClick={() => {
          setPos(null);
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={pop}
          id={id}
          className="pop"
          role="group"
          aria-label={label}
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
            width: Math.min(WIDTH, window.innerWidth - 16),
          }}
        >
          {content}
        </div>
      ) : null}
    </>
  );
}

/** The ⓘ glyph as an icon, 16 px, currentColor. */
export function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.2v4M8 4.6v.1" strokeLinecap="round" />
    </svg>
  );
}
