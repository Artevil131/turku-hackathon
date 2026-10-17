import { type ReactNode, useId, useState } from "react";
import { Icon } from "./Icon.tsx";

/*
  Disclosure: show / hide secondary detail ("Why this order", "How it was counted").
    summary       ReactNode     the always-visible line (a button, >= 44 px tall)
    children      ReactNode     the hidden detail
    defaultOpen?  boolean
    open?, onToggle?(open)      controlled use
    meta?         ReactNode     quiet text right of the summary (a count)
    className?    string
*/

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: openProp,
  onToggle,
  meta,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  meta?: ReactNode;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const id = useId();
  return (
    <div className={`k-disc${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="k-disc-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOwn(!open);
          onToggle?.(!open);
        }}
      >
        <Icon name="chevron-right" size={18} className="k-disc-chev" />
        <span className="k-disc-summary">{summary}</span>
        {meta !== undefined ? <span className="k-disc-meta">{meta}</span> : null}
      </button>
      <div id={id} className="k-disc-body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
