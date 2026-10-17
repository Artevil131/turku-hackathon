import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DAYS, S } from "../data";
import { C, clamp, out, sans } from "../theme";
import { LANE, Lanes } from "./Lanes";

// The lanes stay; everything but Urology fades, the cluster's isolates turn red, and the alert lands.
const OutbreakInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = S.outbreak.alert;
  const focus = interpolate(frame, [0.2 * fps, 1.2 * fps], [0, 1], { ...clamp, easing: out });
  const red = interpolate(frame, [1.2 * fps, 2 * fps], [0, 1], { ...clamp, easing: out });
  const card = interpolate(frame, [2.4 * fps, 3.2 * fps], [0, 1], { ...clamp, easing: out });
  const count = interpolate(frame, [2.6 * fps, 3.8 * fps], [0, a.observed], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
      <p style={{ position: "absolute", left: 160, top: 56, margin: 0, fontSize: 44, fontWeight: 600, color: C.ink }}>
        4 June: the day those results arrive, Urology raises an alert
      </p>
      <Lanes upTo={DAYS} focus={focus} clusterRed={red} />
      <div
        style={{
          position: "absolute",
          left: LANE.x,
          top: LANE.y + 5.4 * LANE.h,
          width: LANE.w,
          padding: "36px 44px",
          background: C.surface,
          borderRadius: 24,
          boxShadow: "0 2px 6px rgba(16,40,70,.06), 0 24px 60px -16px rgba(16,40,70,.28)",
          opacity: card,
          translate: interpolate(card, [0, 1], ["0px 30px", "0px 0px"]),
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <span style={{ fontSize: 120, fontWeight: 700, color: C.high, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {Math.max(1, Math.ceil(count))}
          </span>
          <span style={{ fontSize: 46, fontWeight: 600, color: C.ink }}>
            patients, one resistant <i>E. coli</i>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 46, color: C.ink2 }}>about {a.expected.toFixed(1)} expected</span>
        </div>
        <p style={{ margin: "20px 0 0", fontSize: 30, lineHeight: 1.4, color: C.ink3 }}>{a.en}</p>
      </div>
    </div>
  );
};

export const Outbreak = Interactive.create({
  Component: OutbreakInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
