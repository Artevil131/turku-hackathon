import { type ReactNode, useEffect, useRef } from "react";

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
