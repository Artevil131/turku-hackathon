import { type ReactNode, useEffect, useRef } from "react";
import { type Locale, t } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";

/*
  Toasts: short notices that float above the content (above the tab bar on
  phones). The region is a polite live region (role=status); nothing steals focus.
  Motion is a short fade/rise and disappears under prefers-reduced-motion.

  ToastItem
    id        string          same id replaces the earlier toast (e.g. the arrivals counter)
    text      ReactNode
    tone      "alert" (a new high signal, red edge + ▲) | "info" | "quiet" (arrivals; small, no action)
    action?   { label: string; onClick: () => void }   e.g. "Open"
    timeout?  ms before it hides itself; default 7000 alert, 5000 info, 2600 quiet; 0 = until dismissed

  Toaster
    items      ToastItem[]
    onDismiss  (id: string) => void
    locale     Locale
*/

export interface ToastItem {
  id: string;
  text: ReactNode;
  tone: "alert" | "info" | "quiet";
  action?: { label: string; onClick: () => void };
  timeout?: number;
  /** Bumped when a toast with the same id is replaced, to restart its timer. */
  stamp?: number;
}

const DEFAULT_TIMEOUT: Record<ToastItem["tone"], number> = { alert: 9000, info: 5000, quiet: 2600 };

export function Toaster({ items, onDismiss, locale }: { items: readonly ToastItem[]; onDismiss: (id: string) => void; locale: Locale }) {
  return (
    <div className="k-toasts" role="status" aria-live="polite" aria-label={t(locale, "common.toast.region")}>
      {items.map((item) => (
        <ToastView key={item.id} item={item} onDismiss={onDismiss} locale={locale} />
      ))}
    </div>
  );
}

function ToastView({ item, onDismiss, locale }: { item: ToastItem; onDismiss: (id: string) => void; locale: Locale }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const hovering = useRef(false);
  const timeout = item.timeout ?? DEFAULT_TIMEOUT[item.tone];

  // biome-ignore lint/correctness/useExhaustiveDependencies: the timer restarts only for a new or replaced toast (id, stamp)
  useEffect(() => {
    if (!timeout) return;
    let timer = window.setTimeout(function tick() {
      // Hold while the pointer or focus rests on it; check again shortly.
      if (hovering.current) {
        timer = window.setTimeout(tick, 1500);
        return;
      }
      dismiss.current(item.id);
    }, timeout);
    return () => window.clearTimeout(timer);
  }, [item.id, item.stamp, timeout]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer and focus only pause the auto-hide timer
    <div
      className={`k-toast is-${item.tone}`}
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
      onFocus={() => (hovering.current = true)}
      onBlur={() => (hovering.current = false)}
    >
      {item.tone === "alert" ? (
        <span className="k-toast-glyph" aria-hidden="true">
          ▲
        </span>
      ) : null}
      {item.tone === "quiet" ? <span className="k-toast-dot" aria-hidden="true" /> : null}
      <span className="k-toast-text">{item.text}</span>
      {item.action ? (
        <button
          type="button"
          className="k-toast-action"
          onClick={() => {
            item.action?.onClick();
            dismiss.current(item.id);
          }}
        >
          {item.action.label}
          <Icon name="arrow-right" size={16} />
        </button>
      ) : null}
      {item.tone !== "quiet" ? (
        <button
          type="button"
          className="k-iconbtn is-sm k-toast-x"
          onClick={() => dismiss.current(item.id)}
          aria-label={t(locale, "common.toast.dismiss")}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
