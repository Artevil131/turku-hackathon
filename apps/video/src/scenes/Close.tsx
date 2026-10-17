import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EVIDENCE, S } from "../data";
import { C, clamp, out, sans } from "../theme";

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

// What every number rests on: the data checks over every row, the tests the detectors and the list
// passed (and the one they fail), then the end card.
const CloseInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = S.quality.checked;
  const n = interpolate(frame, [0.2 * fps, 1.8 * fps], [0, 1], { ...clamp, easing: out });
  const end = interpolate(frame, [7 * fps, 7.8 * fps], [0, 1], { ...clamp, easing: out });
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
      <div style={{ position: "absolute", inset: 0, padding: "100px 160px", opacity: 1 - end }}>
        <p style={{ margin: 0, fontSize: 40, fontWeight: 600, color: C.access }}>
          {S.quality.findings === 0 ? "Every data check passed" : `${S.quality.findings} data-check findings`}
        </p>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 54,
            fontWeight: 700,
            color: C.ink,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          {fmt(q.patients * n)} patients · {fmt(q.cultures * n)} cultures · {fmt(q.results * n)} results
        </p>
        <div style={{ marginTop: 70 }}>
          {EVIDENCE.map((e, i) => {
            const show = interpolate(frame, [(2.2 + i * 0.7) * fps, (2.9 + i * 0.7) * fps], [0, 1], { ...clamp, easing: out });
            return (
              <div
                key={e.ref}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 40,
                  padding: "22px 0",
                  borderTop: `1px solid ${C.line}`,
                  opacity: show,
                  translate: interpolate(show, [0, 1], ["0px 20px", "0px 0px"]),
                }}
              >
                <span
                  style={{
                    width: 260,
                    fontSize: 52,
                    fontWeight: 700,
                    color: e.ref === "0011" ? C.high : C.blue,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {e.value}
                </span>
                <span style={{ flex: 1, fontSize: 38, color: C.ink }}>{e.claim}</span>
                <span style={{ fontSize: 28, color: C.ink3 }}>experiment {e.ref}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 160px",
          opacity: end,
        }}
      >
        <p style={{ margin: 0, fontSize: 128, fontWeight: 700, color: C.ink, letterSpacing: "-0.03em" }}>AEI</p>
        <p style={{ margin: "24px 0 0", fontSize: 56, fontWeight: 500, color: C.ink2, maxWidth: 1500, lineHeight: 1.25 }}>
          Fed by the lab system. Opened from the patient record. <span style={{ color: C.blue }}>What works here, today.</span>
        </p>
      </div>
    </div>
  );
};

export const Close = Interactive.create({
  Component: CloseInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
