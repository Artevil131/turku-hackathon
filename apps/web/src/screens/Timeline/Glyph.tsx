import type { Severity, SignalKind } from "../../engine/types.ts";

// The mark inside a signal segment: one small glyph per kind, drawn on a
// 10 x 10 box centred on (0, 0). Kind is never shown by the glyph alone:
// the legend, the popover and the list name it in words.

const PATH: Record<SignalKind, string> = {
  sentinel: "M0 -3.4V0.9 M0 3.1v0.2",
  surge: "M0 3.5V-3.1 M-2.8 -0.5L0 -3.4L2.8 -0.5",
  cluster: "",
  "data-gap": "M-3.8 0H-1.3 M1.3 0H3.8 M-1.3 -2.2V2.2 M1.3 -2.2V2.2",
  shift: "M0 -3.5V3.1 M-2.8 0.5L0 3.4L2.8 0.5",
  trend: "M-3.7 2.7L-1 0L0.8 1.6L3.7 -2.5 M1.3 -2.6H3.8V-0.2",
};

/** Draws inside an SVG; `color` is a CSS colour value (a token). */
export function GlyphMark({ kind, x, y, color, scale = 1 }: { kind: SignalKind; x: number; y: number; color: string; scale?: number }) {
  const tr = `translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ""}`;
  if (kind === "cluster")
    return (
      <g transform={tr} fill={color} aria-hidden="true">
        <circle cx={-2.3} cy={1.6} r={1.35} />
        <circle cx={2.3} cy={1.6} r={1.35} />
        <circle cx={0} cy={-2.2} r={1.35} />
      </g>
    );
  return (
    <path
      transform={tr}
      d={PATH[kind]}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  );
}

export const SEVERITY_FILL: Record<Severity, string> = {
  high: "var(--high-dot)",
  medium: "var(--medium-dot)",
  low: "var(--low-ink)",
};

/** A standalone glyph for HTML (legend, list): a small severity-coloured pill with the kind mark. */
export function KindGlyph({ kind, severity, size = 18 }: { kind: SignalKind; severity?: Severity; size?: number }) {
  const fill = severity ? SEVERITY_FILL[severity] : "var(--ink-2)";
  return (
    <svg className="timeline-glyph" width={size} height={size} viewBox="-6 -6 12 12" aria-hidden="true" focusable="false">
      <circle r={6} fill={fill} />
      <GlyphMark kind={kind} x={0} y={0} color="var(--surface)" scale={1.05} />
    </svg>
  );
}
