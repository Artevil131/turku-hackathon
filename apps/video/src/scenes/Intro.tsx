import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, out, sans } from "../theme";

const IntroInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "0 160px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: sans,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 124,
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 700,
          color: C.ink,
          maxWidth: 1500,
          opacity: interpolate(frame, [0, 0.8 * fps], [0, 1], { ...clamp, easing: out }),
          translate: interpolate(frame, [0, 1.2 * fps], ["0px 40px", "0px 0px"], { ...clamp, easing: out }),
        }}
      >
        Which antibiotic still works <span style={{ color: C.blue }}>here, today?</span>
      </h1>
      <p
        style={{
          margin: "48px 0 0",
          fontSize: 52,
          fontWeight: 500,
          color: C.ink2,
          opacity: interpolate(frame, [1 * fps, 1.8 * fps], [0, 1], { ...clamp, easing: out }),
        }}
      >
        AEI, the Antibiotic Efficacy Indicator for Tyks Laboratories
      </p>
    </div>
  );
};

export const Intro = Interactive.create({
  Component: IntroInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
