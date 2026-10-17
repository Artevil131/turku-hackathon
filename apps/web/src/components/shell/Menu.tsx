import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMedia } from "../doctor/useMedia.ts";

// A sidebar menu: a row button that opens a flyout to its right (a native popover, so it sits above the
// dock and closes on an outside press), or, in the phone drawer, a list that unfolds in place.
// Keys: Enter, Space or → open it on the first item; ↑ ↓ Home End move; Esc or ← close it and return
// focus to the row; Tab closes it and moves on.

export const PHONE = "(max-width: 760px)";
const ITEM = '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled), [role="menuitemradio"]:not(:disabled)';

const CloseContext = createContext<() => void>(() => {});
/** Closes the menu the caller is in, returning focus to its row. */
export const useCloseMenu = () => useContext(CloseContext);

export function Menu({
  id,
  label,
  icon,
  badge,
  disabled,
  title,
  children,
  wide,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  /** A short note after the label, such as "3 closed". */
  badge?: ReactNode;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  /** A wider flyout, for menus with long rows. */
  wide?: boolean;
}) {
  const inline = useMedia(PHONE);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const focusFirst = useRef(false);
  // A press on the row light-dismisses the open flyout before the click arrives; remember it was open.
  const wasOpen = useRef(false);
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);
  const show = (first: boolean) => {
    focusFirst.current = first;
    setOpen(true);
  };
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    if (!inline) {
      const r = trigger.current?.getBoundingClientRect();
      el.showPopover?.();
      if (r) {
        const height = el.offsetHeight;
        const top = Math.max(8, Math.min(r.top - 6, innerHeight - height - 8));
        const left = Math.min(r.right + 6, innerWidth - el.offsetWidth - 8);
        el.style.top = `${top}px`;
        el.style.left = `${Math.max(8, left)}px`;
      }
    }
    if (focusFirst.current) el.querySelector<HTMLElement>(ITEM)?.focus();
    else el.focus({ preventScroll: true });
    return () => {
      if (!inline && el.matches?.(":popover-open")) el.hidePopover();
    };
  }, [open, inline]);
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);
  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(ITEM)];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === "ArrowDown"
        ? (at + 1) % items.length
        : e.key === "ArrowUp"
          ? (at - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : null;
    if (to !== null && items.length && !(e.target instanceof HTMLInputElement && e.target.type !== "checkbox")) {
      e.preventDefault();
      items[to]?.focus();
      return;
    }
    if (e.key === "Escape" || (e.key === "ArrowLeft" && !inline && !(e.target instanceof HTMLInputElement))) {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab" && !inline) close(false);
  };
  return (
    <div className="sb-menu" data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        id={id}
        className="sb-item sb-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        disabled={disabled}
        title={title ?? label}
        onPointerDown={() => {
          wasOpen.current = open;
        }}
        onClick={() => {
          const was = open || wasOpen.current;
          wasOpen.current = false;
          if (was) close(false);
          else show(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || (e.key === "ArrowDown" && inline && open)) {
            e.preventDefault();
            show(true);
          } else if ((e.key === "Enter" || e.key === " ") && !open) {
            e.preventDefault();
            show(true);
          }
        }}
      >
        <span className="sb-icon">{icon}</span>
        <span className="sb-label">
          {label}
          {badge ? <span className="sb-badge">{badge}</span> : null}
        </span>
        <svg className="sb-chev" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <CloseContext.Provider value={close}>
          <div
            ref={pop}
            id={popId}
            role="menu"
            aria-labelledby={id}
            tabIndex={-1}
            className={`sb-pop${wide ? " sb-pop-wide" : ""}`}
            data-inline={inline || undefined}
            popover={inline ? undefined : "auto"}
            onKeyDown={onPopKey}
            onToggle={(e) => {
              if ((e as unknown as { newState?: string }).newState === "closed") setOpen(false);
            }}
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  disabled,
  hint,
  keep,
  ...data
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  hint?: ReactNode;
  /** Keep the menu open after choosing (for toggles). */
  keep?: boolean;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const close = useCloseMenu();
  return (
    <button
      type="button"
      role="menuitem"
      className="sb-pop-item"
      disabled={disabled}
      onClick={() => {
        if (!keep) close();
        onSelect();
      }}
      {...data}
    >
      <span>{children}</span>
      {hint ? <small>{hint}</small> : null}
    </button>
  );
}

export function MenuCheck({
  children,
  checked,
  onToggle,
  ...data
}: { children: ReactNode; checked: boolean; onToggle: () => void } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} className="sb-pop-item sb-pop-check" onClick={onToggle} {...data}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
        {checked ? <path d="M5 8.2 7 10.2 11 5.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : null}
      </svg>
      <span>{children}</span>
    </button>
  );
}

export const MenuSeparator = () => <hr className="sb-pop-sep" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <p className="sb-pop-label" role="presentation">
    {children}
  </p>
);
