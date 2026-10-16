import type { ReactNode } from "react";
import type { AwareGroup, Severity } from "../engine/types.ts";
import { t, type Locale } from "../i18n/index.ts";

/*
  Badge: a small label. Colour is never the only cue: status tones draw a
  glyph and the children are always a word.
    tone       "neutral" | "info" | "access" | "watch" | "reserve" | "high" | "medium" | "low" | "live" | "sim"
    children   ReactNode   the word(s)
    glyph?     boolean     default true (high ▲, medium ◆, low ●, access ●, watch ◐, reserve ■, live ●)
    title?     string      longer explanation (shown on hover, also read by screen readers)
    size?      "sm" | "md" (default)

  AwareBadge: the WHO AWaRe group of an antibiotic under WHO's own name
  ("Access", "Watch", "Reserve"), with what it means as its title. It is a
  stewardship class, not a verdict on this patient: "Access" never reads as
  "first choice here". Renders nothing for null (unknown antibiotic).
    locale, group: AwareGroup | null, size?

  SeverityBadge: a signal's severity with its word.
    locale, severity: Severity, size?
*/

export type BadgeTone = "neutral" | "info" | "access" | "watch" | "reserve" | "high" | "medium" | "low" | "live" | "sim";

const GLYPH: Partial<Record<BadgeTone, string>> = {
  high: "▲",
  medium: "◆",
  low: "●",
  access: "●",
  watch: "◐",
  reserve: "■",
  live: "●",
};

export function Badge({
  tone = "neutral",
  children,
  glyph = true,
  title,
  size = "md",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  glyph?: boolean;
  title?: string;
  size?: "sm" | "md";
}) {
  const g = glyph ? GLYPH[tone] : undefined;
  return (
    <span className={`k-badge is-${tone} is-${size}`} title={title}>
      {g ? (
        <span className="k-badge-glyph" aria-hidden="true">
          {g}
        </span>
      ) : null}
      <span className="k-badge-text">{children}</span>
      {title ? <span className="u-sr"> ({title})</span> : null}
    </span>
  );
}

export function AwareBadge({ locale, group, size = "sm" }: { locale: Locale; group: AwareGroup | null; size?: "sm" | "md" }) {
  if (!group) return null;
  return (
    <Badge tone={group} size={size} title={`${t(locale, "common.aware.about")}: ${t(locale, `common.aware.${group}Why`)}`}>
      {t(locale, `common.aware.${group}`)}
    </Badge>
  );
}

export function SeverityBadge({ locale, severity, size = "md" }: { locale: Locale; severity: Severity; size?: "sm" | "md" }) {
  return (
    <Badge tone={severity} size={size}>
      {t(locale, `common.severity.${severity}`)}
    </Badge>
  );
}
