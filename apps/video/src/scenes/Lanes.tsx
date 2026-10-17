import { interpolate } from "remotion";
import { DAYS, DOTS, dayLabel, UNITS } from "../data";
import { C, clamp, out, sans } from "../theme";

// The hospital's units as lanes, one column per day from 12 May to 8 June 2025, one dot per isolate that
// arrived. Shared by the feed and the outbreak scenes so the cut between them is seamless.
export const LANE = { x: 520, y: 150, w: 1300, h: 84, label: 360 };
const cellW = LANE.w / DAYS;

export const dotXY = (d: { day: number; lane: number; slot: number }) => ({
  x: LANE.x + d.day * cellW + 8 + (d.slot % 3) * 14,
  y: LANE.y + d.lane * LANE.h + 18 + Math.floor(d.slot / 3) * 14,
});

/** `upTo`: days revealed so far (fractional for the sweep); `focus`: 0..1 dims every lane but Urology. */
export const Lanes = ({ upTo, focus, clusterRed }: { upTo: number; focus: number; clusterRed: number }) => (
  <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
    {UNITS.map((u, i) => (
      <div
        key={u.code}
        style={{
          position: "absolute",
          left: LANE.x - LANE.label - 30,
          top: LANE.y + i * LANE.h,
          width: LANE.label + LANE.w + 30,
          height: LANE.h - 8,
          borderTop: `1px solid ${C.line}`,
          opacity: u.code === "URO" ? 1 : interpolate(focus, [0, 1], [1, 0.25]),
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 26,
            width: LANE.label,
            fontSize: 30,
            fontWeight: u.code === "URO" ? 700 : 500,
            color: C.ink2,
          }}
        >
          {u.en}
        </span>
      </div>
    ))}
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }} role="img" aria-label="Isolates by unit and day">
      {DOTS.filter((d) => d.lane >= 0).map((d) => {
        const { x, y } = dotXY(d);
        const shown = interpolate(upTo, [d.day, d.day + 1], [0, 1], { ...clamp, easing: out });
        const dim = d.lane === 4 ? 1 : interpolate(focus, [0, 1], [1, 0.25]);
        const red = d.cluster ? clusterRed : 0;
        return (
          <circle
            key={`${d.lane}-${d.day}-${d.slot}`}
            cx={x}
            cy={y}
            r={5.5 + red * 2.5}
            fill={red > 0.5 ? C.high : d.lane === 4 ? C.blue : C.dot}
            opacity={shown * dim}
          />
        );
      })}
    </svg>
    {[0, 7, 14, 21, 27].map((day) => (
      <span
        key={day}
        style={{ position: "absolute", left: LANE.x + day * cellW, top: LANE.y + UNITS.length * LANE.h + 6, fontSize: 26, color: C.ink3 }}
      >
        {dayLabel(day)}
      </span>
    ))}
  </div>
);
