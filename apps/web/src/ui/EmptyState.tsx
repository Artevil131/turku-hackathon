import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.tsx";

/*
  EmptyState: a calm, informative "nothing here (yet)" block. Says what is
  missing and why, and offers the one useful next step when there is one.
    title     ReactNode
    body?     ReactNode
    icon?     IconName      default "inbox"
    action?   ReactNode     a button or link
    tone?     "default" | "offline" | "loading"   loading draws a soft pulse (reduced-motion safe) and is a live status
    compact?  boolean       for use inside a card
*/

export function EmptyState({
  title,
  body,
  icon = "inbox",
  action,
  tone = "default",
  compact = false,
}: {
  title: ReactNode;
  body?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  tone?: "default" | "offline" | "loading";
  compact?: boolean;
}) {
  return (
    <div className={`k-empty is-${tone}${compact ? " is-compact" : ""}`} role={tone === "loading" ? "status" : undefined}>
      <div className="k-empty-icon" aria-hidden="true">
        <Icon name={icon} size={compact ? 22 : 28} />
      </div>
      <p className="k-empty-title">{title}</p>
      {body ? <p className="k-empty-body">{body}</p> : null}
      {action ? <div className="k-empty-action">{action}</div> : null}
    </div>
  );
}
