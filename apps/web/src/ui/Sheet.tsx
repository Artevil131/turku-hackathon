import { type ReactNode, useEffect, useId, useRef } from "react";
import { type Locale, t } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";

/*
  Sheet: a modal panel. A bottom sheet on phones, a centred dialog from 1024 px.
  Built on <dialog>: focus is trapped, Esc closes, the page behind is inert.
    open        boolean
    onClose     () => void            (Esc, backdrop tap, close button)
    title       ReactNode             heading, also the dialog's accessible name
    locale      Locale                for the close button's label
    children    ReactNode             the body (scrolls when tall)
    footer?     ReactNode             sticky action row at the bottom
    subtitle?   ReactNode             one quiet line under the title
    size?       "sm" | "md" | "lg"    desktop width (360 / 520 / 720 px), default "md"
    tone?       "default" | "sim"     "sim" marks the simulation controls
    initialFocus?  CSS selector inside the sheet to focus on open. Default: the first field with a keyboard
                   and mouse; on a touch screen the sheet's heading, so the on-screen keyboard does not
                   cover the list (a sheet whose point is typing, like Ask, passes its field here).
*/

export function Sheet({
  open,
  onClose,
  title,
  locale,
  children,
  footer,
  subtitle,
  size = "md",
  tone = "default",
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  locale: Locale;
  children: ReactNode;
  footer?: ReactNode;
  subtitle?: ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "sim";
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const before = document.activeElement as HTMLElement | null;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      const target =
        (initialFocus ? dialog.querySelector<HTMLElement>(initialFocus) : null) ??
        (touch
          ? dialog.querySelector<HTMLElement>(".k-sheet-title")
          : (dialog.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ??
            dialog.querySelector<HTMLElement>(".k-sheet-close")));
      target?.focus({ preventScroll: true });
      return () => {
        if (dialog.open) dialog.close();
        before?.focus?.();
      };
    }
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open, initialFocus]);

  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={`k-sheet is-${size} is-${tone}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onMouseDown={(e) => {
        // A press on the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div className="k-sheet-panel">
        <div className="k-sheet-grip" aria-hidden="true" />
        <header className="k-sheet-head">
          <div className="k-sheet-titles">
            <h2 id={titleId} className="k-sheet-title" tabIndex={-1}>
              {title}
            </h2>
            {subtitle ? <p className="k-sheet-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="k-iconbtn k-sheet-close"
            onClick={() => closeRef.current()}
            aria-label={t(locale, "common.close")}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="k-sheet-body">{children}</div>
        {footer ? <footer className="k-sheet-foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
