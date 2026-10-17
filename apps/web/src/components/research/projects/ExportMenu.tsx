import { exportFormats } from "@aei/export";
import { type Locale, t } from "@aei/i18n";
import { type ReactNode, useEffect, useRef } from "react";

export type ExportFormat = (typeof exportFormats)[number]["id"] | "svg" | "png";

export function ExportFormatButtons({
  locale,
  busy,
  onSelect,
}: {
  locale: Locale;
  busy: boolean;
  onSelect: (format: ExportFormat) => void;
}) {
  return (
    <div className="project-export-options" aria-busy={busy}>
      {exportFormats.map((format) => (
        <button type="button" role="menuitem" key={format.id} disabled={busy} onClick={() => onSelect(format.id)}>
          {t(locale, `exportFormat${format.id}`)}
        </button>
      ))}
      <button type="button" role="menuitem" disabled={busy} onClick={() => onSelect("svg")}>
        {t(locale, "exportSvg")}
      </button>
      <button type="button" role="menuitem" disabled={busy} onClick={() => onSelect("png")}>
        {t(locale, "exportPng")}
      </button>
    </div>
  );
}

/** Native light-dismiss and Escape, with the arrow-key behaviour of a format menu. */
export function ExportMenu({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor: HTMLButtonElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = menu.current;
    const trigger = anchor ?? document.activeElement;
    if (!element) return;
    const bounds = trigger instanceof HTMLElement ? trigger.getBoundingClientRect() : null;
    if (bounds) {
      element.style.maxHeight = `${Math.max(80, innerHeight - bounds.bottom - 20)}px`;
      element.style.top = `${bounds.bottom + 8}px`;
      element.style.right = `${Math.max(12, innerWidth - bounds.right)}px`;
    }
    element.showPopover();
    element.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      element.hidePopover();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [anchor]);
  return (
    <div
      ref={menu}
      popover="auto"
      className="project-export-menu"
      role="menu"
      aria-label={title}
      onToggle={(event) => {
        if (event.newState === "closed" && !event.currentTarget.matches(":popover-open")) onClose();
      }}
      onKeyDown={(event) => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "ArrowDown"
            ? (index + 1) % buttons.length
            : event.key === "ArrowUp"
              ? (index - 1 + buttons.length) % buttons.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? buttons.length - 1
                  : null;
        if (next !== null) {
          event.preventDefault();
          buttons[next]?.focus();
        }
        if (event.key === "Tab") onClose();
      }}
    >
      {children}
    </div>
  );
}
