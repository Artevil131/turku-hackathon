import { WARDS, type WardCode } from "@aei/domain";
import { type Locale, t, wardName } from "@aei/i18n";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SignalKind } from "../board.ts";
import { KindGlyph } from "../feed/glyphs.tsx";
import { flowMatrix, shadeStep } from "./flowLayout.ts";

// All units at once: a 9 x 9 flow matrix, rows = from, columns = to, units in
// WARDS order. One shade ramp (seven steps) by patients; the number is printed
// when the cell is wide enough. The diagonal is blank. The focus unit's row and
// column are outlined; a unit with a signal carries its kind glyph in the row
// and column header. A cell re-centres the Sankey on its row's unit.

const CODES = WARDS.map((w) => w.code);
const FIT = 22; // narrowest cell (px) that still shows its number

interface Props {
  locale: Locale;
  flows: readonly { from: WardCode; to: WardCode; patients: number }[];
  focus: WardCode | null;
  /** Glyph kind of a unit that has a signal in the window, else null. */
  kindOf: (unit: WardCode) => SignalKind | null;
  /** The unit's signal sentence (for titles), else null. */
  signalText: (unit: WardCode) => string | null;
  onPick: (unit: WardCode) => void;
}

export function FlowMatrix({ locale, flows, focus, kindOf, signalText, onPick }: Props) {
  const m = useMemo(() => flowMatrix(flows, CODES), [flows]);
  const wrap = useRef<HTMLDivElement>(null);
  const [cellW, setCellW] = useState(40);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => setCellW((el.clientWidth - 64) / CODES.length);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fi = focus ? CODES.indexOf(focus) : -1;
  // Roving tabindex: one cell is in the tab order; it starts on the focus unit's row.
  const [cur, setCur] = useState<[number, number]>(() => {
    const r = Math.max(0, fi);
    return [r, r === 0 ? 1 : 0];
  });

  const go = (r: number, c: number, dr: number, dc: number) => {
    const last = CODES.length - 1;
    let nr = r;
    let nc = c;
    for (let guard = 0; guard < 2; guard++) {
      nr = Math.min(last, Math.max(0, nr + dr));
      nc = Math.min(last, Math.max(0, nc + dc));
      if (nr !== nc) break;
    }
    if (nr === nc) return; // against an edge with only the diagonal beyond
    setCur([nr, nc]);
    wrap.current?.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${nc}"]`)?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, r: number) => {
    const c = Number(e.currentTarget.dataset.c);
    const step: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const s = step[e.key];
    if (s) {
      e.preventDefault();
      go(r, c, s[0], s[1]);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(r, -1, 0, 1);
    } else if (e.key === "End") {
      e.preventDefault();
      go(r, CODES.length, 0, -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(CODES[r] as WardCode);
    }
  };

  const mark = (unit: WardCode) => {
    const k = kindOf(unit);
    return k ? (
      <span className="fm-glyph" data-kind={k} aria-hidden="true">
        <KindGlyph kind={k} />
      </span>
    ) : null;
  };
  const headTitle = (unit: WardCode) => [`${unit} · ${wardName(locale, unit)}`, signalText(unit)].filter(Boolean).join(" · ");
  const showN = cellW >= FIT;

  return (
    <div className="fm" ref={wrap}>
      {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: an arrow-key grid with roving tabindex */}
      <table className="fm-table" role="grid" aria-label={t(locale, "netMatrixCaption")}>
        <thead>
          <tr>
            <th className="fm-corner" scope="col">
              {t(locale, "netMatrixCorner")}
            </th>
            {CODES.map((c, j) => (
              <th key={c} scope="col" className="fm-ch" data-focus={j === fi} title={headTitle(c)}>
                {mark(c)}
                <span className="fm-code">{c}</span>
                <span className="fm-sr">
                  {t(locale, "netMatrixColHead", { unit: c, name: wardName(locale, c) })}
                  {signalText(c) ? `. ${signalText(c)}` : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CODES.map((from, i) => (
            <tr key={from}>
              <th scope="row" className="fm-rh" data-focus={i === fi} title={headTitle(from)}>
                <span className="fm-code">{from}</span>
                {mark(from)}
                <span className="fm-sr">
                  {t(locale, "netMatrixRowHead", { unit: from, name: wardName(locale, from) })}
                  {signalText(from) ? `. ${signalText(from)}` : ""}
                </span>
              </th>
              {CODES.map((to, j) => {
                if (i === j) return <td key={to} className="fm-cell fm-diag" aria-hidden="true" />;
                const n = (m.n[i] as number[])[j] as number;
                const step = shadeStep(n, m.max);
                const on = cur[0] === i && cur[1] === j;
                const label = n > 0 ? t(locale, "netMatrixCell", { from, to, n }) : t(locale, "netMatrixCellNone", { from, to });
                return (
                  <td
                    key={to}
                    className="fm-cell"
                    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: grid cell with roving tabindex
                    role="gridcell"
                    tabIndex={on ? 0 : -1}
                    data-r={i}
                    data-c={j}
                    data-step={step}
                    data-row={i === fi}
                    data-col={j === fi}
                    aria-label={`${label}. ${t(locale, "netMatrixRecentre", { unit: from })}`}
                    title={label}
                    onClick={() => {
                      setCur([i, j]);
                      onPick(from);
                    }}
                    onFocus={() => setCur([i, j])}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    {n > 0 && showN ? n : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="geo-faint fm-note">{t(locale, "netMatrixCaption")}</p>
    </div>
  );
}
