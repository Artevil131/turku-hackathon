import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DAYS, dayLabel, S } from "../data";
import { C, clamp, mono, out, sans } from "../theme";
import { Lanes } from "./Lanes";

// A real ORU^R01 from the dataset types itself in, then every result of four weeks lands on its unit.
const FeedInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typed = interpolate(frame, [0.3 * fps, 3.6 * fps], [0, S.hl7.join("\n").length], clamp);
  const msgOut = interpolate(frame, [4.6 * fps, 5.4 * fps], [1, 0], { ...clamp, easing: out });
  const sweep = interpolate(frame, [5.6 * fps, 11 * fps], [0, DAYS], clamp);
  let left = typed;
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
      <div style={{ position: "absolute", inset: 0, padding: "120px 160px", opacity: msgOut }}>
        <p style={{ margin: 0, fontSize: 52, fontWeight: 600, color: C.ink }}>A result arrives from the lab system</p>
        <p style={{ margin: "12px 0 40px", fontSize: 34, color: C.ink3 }}>
          HL7 v2.5.1 ORU^R01, organisms and antibiotics in THL's national codes
        </p>
        <pre
          style={{
            margin: 0,
            fontFamily: mono,
            fontSize: 24,
            lineHeight: 1.5,
            color: C.ink2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {S.hl7.map((line) => {
            const shown = line.slice(0, Math.max(0, left));
            left -= line.length + 1;
            const code = shown.replace(/(7640-22|\b\d{1,2}\^[A-Z][a-zä]+)/g, "\u0000$1\u0000").split("\u0000");
            return (
              <div key={line}>
                {code.map((part, i) =>
                  i % 2 ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: segments of one fixed line; their position is their identity
                    <span key={`${line}-${i}`} style={{ color: C.blue, fontWeight: 500 }}>
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
              </div>
            );
          })}
        </pre>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [5 * fps, 5.8 * fps], [0, 1], { ...clamp, easing: out }) }}>
        <p style={{ position: "absolute", left: 160, top: 56, margin: 0, fontSize: 44, fontWeight: 600, color: C.ink }}>
          Every result lands on its unit as it arrives
        </p>
        <p
          style={{
            position: "absolute",
            right: 100,
            top: 62,
            margin: 0,
            fontSize: 40,
            fontWeight: 600,
            color: C.blue,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {dayLabel(Math.min(DAYS - 1, Math.floor(sweep)))} 2025
        </p>
        <Lanes upTo={sweep} focus={0} clusterRed={0} />
      </div>
    </div>
  );
};

export const Feed = Interactive.create({
  Component: FeedInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
