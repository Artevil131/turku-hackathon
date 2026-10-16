import type { ElementType, ReactNode } from "react";

/*
  Card: the frosted-glass surface every block of content sits on.
    children   ReactNode
    title?     ReactNode         card heading (h2 by default; see `level`)
    eyebrow?   ReactNode         a quiet subtitle under the title
    actions?   ReactNode         right side of the heading row (a link, a Segmented)
    footer?    ReactNode         quiet row at the bottom (evidence, "based on ...")
    level?     2 | 3             heading level, default 2
    as?        ElementType       "section" by default; "article", "div", "li"
    tone?      "glass" (default) | "solid" | "inset" | "high" | "medium" | "low"
               high/medium/low are the frosted signal surface; the severity is said by a Badge word
    pad?       "md" (default) | "sm" | "none"
    className? string
    id?        string
    labelledBy? string           aria-labelledby when the title is elsewhere
*/

export function Card({
  children,
  title,
  eyebrow,
  actions,
  footer,
  level = 2,
  as,
  tone = "glass",
  pad = "md",
  className,
  id,
  labelledBy,
}: {
  children?: ReactNode;
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  level?: 2 | 3;
  as?: ElementType;
  tone?: "glass" | "solid" | "inset" | "high" | "medium" | "low";
  pad?: "md" | "sm" | "none";
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  const Tag = (as ?? "section") as ElementType;
  const H = (level === 3 ? "h3" : "h2") as ElementType;
  const head = title !== undefined || eyebrow !== undefined || actions !== undefined;
  return (
    <Tag id={id} aria-labelledby={labelledBy} className={`k-card is-${tone} pad-${pad}${className ? ` ${className}` : ""}`}>
      {head ? (
        <div className="k-card-head">
          <div className="k-card-titles">
            {title !== undefined ? <H className="k-card-title">{title}</H> : null}
            {eyebrow !== undefined ? <p className="k-card-sub">{eyebrow}</p> : null}
          </div>
          {actions !== undefined ? <div className="k-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer !== undefined ? <div className="k-card-foot">{footer}</div> : null}
    </Tag>
  );
}
