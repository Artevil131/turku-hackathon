import type { ReactElement } from "react";
import type { DemoId } from "../../demo/demos.ts";
import type { Template } from "../research/workspace/templates.ts";

// Small drawings on the start page cards: what each template or demo opens, in the shapes the app itself uses
// (lanes with signal pills, coverage bars against a bar, a resistance grid, a regional trend, an empty board).
// Pictures of the kind of view, not data: they never show numbers.

const W = 160;
const H = 64;

function Lanes() {
  const lanes = [14, 26, 38, 50];
  return (
    <>
      {lanes.map((y, i) => (
        <path
          key={y}
          className="ta-ribbon"
          d={`M6 ${y} C40 ${y - 2 - i} 60 ${y + 3} 90 ${y} S140 ${y - 3} 154 ${y}`}
          strokeWidth={i === 1 ? 4 : 2}
        />
      ))}
      <rect className="ta-pill" x="58" y="21" width="26" height="9" rx="2.5" />
      <rect className="ta-pill-alert" x="104" y="9" width="20" height="9" rx="2.5" />
      <rect className="ta-pill-quiet" x="24" y="45" width="22" height="9" rx="2.5" />
      <line className="ta-today" x1="150" x2="150" y1="4" y2="60" />
    </>
  );
}

function Coverage() {
  const rows = [
    [0.92, 0.04],
    [0.84, 0.06],
    [0.71, 0.08],
  ] as const;
  const x = (v: number) => 14 + ((v - 0.5) / 0.5) * 136; // 50 % at the left edge, 100 % at the right
  return (
    <>
      {rows.map(([v, ci], i) => {
        const y = 14 + i * 18;
        return (
          <g key={y}>
            <line className="ta-axis" x1="14" x2="150" y1={y} y2={y} />
            <rect className={i === 2 ? "ta-band-low" : "ta-band"} x={x(v - ci)} y={y - 3} width={x(v + ci) - x(v - ci)} height="6" rx="3" />
            <circle className={i === 2 ? "ta-dot-low" : "ta-dot"} cx={x(v)} cy={y} r="3.2" />
          </g>
        );
      })}
      <line className="ta-bar" x1={x(0.8)} x2={x(0.8)} y1="4" y2="60" />
    </>
  );
}

function Grid() {
  const shades = [
    ["a", [0.9, 0.7, 0.2, 0.5, 0.95]],
    ["b", [0.6, 0.85, 0.4, 0.1, 0.7]],
    ["c", [0.3, 0.5, 0.9, 0.75, 0.2]],
  ] as const;
  return (
    <>
      {shades.flatMap(([row, values], r) =>
        values.map((v, c) => (
          <rect
            key={`${row}${"vwxyz"[c]}`}
            className="ta-cell"
            x={20 + c * 25}
            y={6 + r * 18}
            width="22"
            height="15"
            rx="2"
            style={{ fillOpacity: 0.12 + v * 0.75 }}
          />
        )),
      )}
    </>
  );
}

function Trend() {
  return (
    <>
      <path
        className="ta-area"
        d="M6 50 L30 46 L54 48 L78 40 L102 42 L126 30 L154 22 L154 40 L126 44 L102 52 L78 50 L54 56 L30 54 L6 58 Z"
      />
      <path className="ta-line" d="M6 54 L30 50 L54 52 L78 45 L102 47 L126 37 L154 31" />
      <path className="ta-line-quiet" d="M6 46 L30 47 L54 45 L78 46 L102 44 L126 45 L154 44" />
      <circle className="ta-dot-alert" cx="154" cy="31" r="3.2" />
    </>
  );
}

function Board() {
  return (
    <>
      <rect className="ta-win" x="8" y="6" width="88" height="52" rx="4" />
      <rect className="ta-win" x="102" y="6" width="50" height="24" rx="4" />
      <rect className="ta-win-empty" x="102" y="34" width="50" height="24" rx="4" />
      <path className="ta-plus" d="M127 41v10M122 46h10" />
      <line className="ta-text" x1="16" x2="60" y1="16" y2="16" />
      <line className="ta-text" x1="16" x2="80" y1="24" y2="24" />
      <line className="ta-text" x1="110" x2="136" y1="15" y2="15" />
    </>
  );
}

function Notebook() {
  return (
    <>
      <rect className="ta-win" x="8" y="4" width="144" height="16" rx="3" />
      <line className="ta-text" x1="14" x2="70" y1="12" y2="12" />
      <rect className="ta-code" x="8" y="24" width="144" height="16" rx="3" />
      <line className="ta-code-text" x1="14" x2="54" y1="32" y2="32" />
      <line className="ta-code-text" x1="58" x2="96" y1="32" y2="32" />
      <path className="ta-line" d="M12 58 L36 55 L60 57 L84 50 L108 52 L132 46 L150 47" />
    </>
  );
}

const TEMPLATE_ART: Record<Template, () => ReactElement> = {
  research: Notebook,
  monitor: Lanes,
  outbreak: Lanes,
  antibiogram: Grid,
  patient: Coverage,
  regional: Trend,
  blank: Board,
};
const DEMO_ART: Record<DemoId, () => ReactElement> = { clinician: Coverage, control: Lanes, researcher: Notebook };

export function TemplateArt({ template, demo }: { template?: Template; demo?: DemoId }) {
  const Art = template ? TEMPLATE_ART[template] : demo ? DEMO_ART[demo] : Board;
  return (
    <svg className="template-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <Art />
    </svg>
  );
}
