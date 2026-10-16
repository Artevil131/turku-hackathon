import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { S } from "../data";
import { C, clamp, out, sans } from "../theme";

const HOME = "Varsinais-Suomen hyvinvointialue";
const MAP_H = 860;

// Real THL notifications: Finland's wellbeing services counties draw in, the two signals that survive the
// correction light up, and Tyks's own county shows its September 2025 CPE E. coli spike.
const RegionInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { map, region } = S;
  const k = MAP_H / map.height;
  const strong = new Map(region.signals.filter((s) => s.strong).map((s) => [s.region, s]));
  const home = region.signals.find((s) => s.region === HOME && s.strong);
  const draw = interpolate(frame, [0, 1.6 * fps], [0, 1], { ...clamp, easing: out });
  const light = interpolate(frame, [1.8 * fps, 2.6 * fps], [0, 1], { ...clamp, easing: out });
  const card = interpolate(frame, [2.8 * fps, 3.6 * fps], [0, 1], { ...clamp, easing: out });
  const line = interpolate(frame, [3.4 * fps, 5.4 * fps], [0, 1], { ...clamp, easing: out });
  const series = region.home.cases;
  const max = Math.max(...series);
  const sx = (i: number) => (i / (series.length - 1)) * 720;
  const sy = (v: number) => 200 - (v / max) * 180;
  const path = series.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
      <svg
        width={map.width * k}
        height={MAP_H}
        viewBox={`0 0 ${map.width} ${map.height}`}
        style={{ position: "absolute", left: 160, top: 110 }}
        role="img"
        aria-label="Finland's wellbeing services counties"
      >
        {map.counties.map((c) => {
          const s = strong.get(c.name);
          return (
            <path
              key={c.name}
              d={c.d}
              fill={s ? (c.name === HOME ? C.high : C.medium) : "#dfe7ef"}
              fillOpacity={s ? 0.15 + 0.85 * light : draw}
              stroke="#ffffff"
              strokeWidth={2.5}
              opacity={draw}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 820, top: 110, width: 940 }}>
        <p style={{ margin: 0, fontSize: 56, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>The region, on real THL data</p>
        <p style={{ margin: "10px 0 0", fontSize: 32, color: C.ink3 }}>
          MRSA, ESBL, VRE and CPE notifications per county, months up to September 2025
        </p>
        {home ? (
          <div
            style={{
              marginTop: 48,
              padding: "36px 44px",
              background: C.surface,
              borderRadius: 24,
              boxShadow: "0 2px 6px rgba(16,40,70,.06), 0 24px 60px -16px rgba(16,40,70,.28)",
              opacity: card,
              translate: interpolate(card, [0, 1], ["0px 30px", "0px 0px"]),
            }}
          >
            <p style={{ margin: 0, fontSize: 30, fontWeight: 600, color: C.highInk }}>Strong signal · Tyks's own county</p>
            <p style={{ margin: "10px 0 0", fontSize: 44, fontWeight: 700, color: C.ink }}>CPE carriage, E. coli · Varsinais-Suomi</p>
            <p style={{ margin: "8px 0 24px", fontSize: 36, color: C.ink2 }}>
              September 2025: <b style={{ color: C.high }}>{home.cases} cases</b>, about {home.expected.toFixed(1)} expected
            </p>
            <svg width={760} height={220} role="img" aria-label="Monthly cases, last 24 months">
              <path
                d={path}
                fill="none"
                stroke={C.high}
                strokeWidth={5}
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - line}
              />
              <circle cx={sx(series.length - 1)} cy={sy(series.at(-1) ?? 0)} r={9} fill={C.high} opacity={line > 0.98 ? 1 : 0} />
            </svg>
          </div>
        ) : null}
        <p style={{ margin: "32px 0 0", fontSize: 30, lineHeight: 1.4, color: C.ink3, opacity: card }}>
          {region.signals.filter((s) => s.strong).length} of {region.signals.length} county signals survive a correction for testing{" "}
          {region.tested.toLocaleString("en-GB")} county-months; the other one is{" "}
          <span style={{ color: C.medium, fontWeight: 600 }}>Keski-Suomi</span>, MRSA carriage, July 2025. Sources: THL; county outlines
          Statistics Finland; both CC BY 4.0.
        </p>
      </div>
    </div>
  );
};

export const Region = Interactive.create({
  Component: RegionInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
