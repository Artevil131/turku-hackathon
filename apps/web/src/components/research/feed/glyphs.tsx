import type { SignalKind } from "../board.ts";

// One glyph per kind; the kind's word always sits next to it (never colour alone).
const PATHS: Record<SignalKind, string> = {
  sentinel: "M8 1.5 15 14H1z M8 6v4 M8 11.8v.4",
  cluster: "M4 5a1.6 1.6 0 1 0 .01 0 M11 4a1.6 1.6 0 1 0 .01 0 M8 11a1.6 1.6 0 1 0 .01 0 M12 11.5a1.2 1.2 0 1 0 .01 0",
  trend: "M1.5 12 6 7.5l3 3L14.5 4 M10.5 4h4v4",
  divergence: "M2 3v10 M14 3v10 M5 8h6",
  data: "M8 1.5a6.5 6.5 0 1 0 .01 0 M3.4 12.6 12.6 3.4",
};

export function KindGlyph({ kind }: { kind: SignalKind }) {
  return (
    <svg className="feed-glyph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={PATHS[kind]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="m3 8.5 3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg className="feed-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
