import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ANTIBIOTIC, pct, S } from "../data";
import { C, clamp, out, sans } from "../theme";

const W = 1100; // full bar = 100 %

const Bar = ({ share, color, grow, label, strong }: { share: number; color: string; grow: number; label: string; strong?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 28, height: 56 }}>
    <div style={{ position: "relative", width: W, height: 26, borderRadius: 13, background: "#e3eaf3" }}>
      <div style={{ position: "absolute", inset: 0, width: W * share * grow, borderRadius: 13, background: color }} />
    </div>
    <span style={{ fontSize: 36, fontWeight: strong ? 700 : 500, color: strong ? C.ink : C.ink2, opacity: grow, whiteSpace: "nowrap" }}>
      <b style={{ fontVariantNumeric: "tabular-nums" }}>{pct(share)}</b> {label}
    </span>
  </div>
);

const Aware = ({ group }: { group: string }) => (
  <span
    style={{
      fontSize: 26,
      fontWeight: 600,
      padding: "6px 16px",
      borderRadius: 999,
      color: group === "Access" ? C.access : C.watch,
      background: group === "Access" ? C.accessBg : C.watchBg,
    }}
  >
    {group === "Access" ? "First choice" : "Use with care"}
  </span>
);

// Mild first: the share of the bacteria each drug is meant for, then the share of everything that grows,
// which the backtest (experiment 0010) showed is what the patient actually gets. Then severe.
const TreatInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mild = S.treat.mild.suggestions.slice(0, 3);
  const severe = S.treat.severe.suggestions[0];
  const g = (from: number, len = 0.9) => interpolate(frame, [from * fps, (from + len) * fps], [0, 1], { ...clamp, easing: out });
  const toSevere = interpolate(frame, [8 * fps, 8.8 * fps], [0, 1], { ...clamp, easing: out });
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans, padding: "90px 160px" }}>
      <p style={{ margin: 0, fontSize: 60, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>
        What works on Urology for a urine infection
      </p>
      <p style={{ margin: "10px 0 0", fontSize: 34, color: C.ink3 }}>
        The unit's own {S.treat.mild.isolates} first isolates, last 12 months, up to 8 June 2025
      </p>

      <div style={{ position: "absolute", left: 160, top: 300, opacity: 1 - toSevere }}>
        <p style={{ margin: "0 0 26px", fontSize: 40, fontWeight: 600, color: C.blue }}>Mild or moderate</p>
        {mild.map((s, i) => (
          <div key={s.antibiotic} style={{ marginBottom: 34, opacity: g(0.4 + i * 0.5, 0.6) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 6 }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: C.ink }}>{ANTIBIOTIC[s.antibiotic]}</span>
              <Aware group={s.aware} />
            </div>
            <Bar share={s.share ?? 0} color={C.blue} grow={g(0.6 + i * 0.5)} label="of the bacteria it is meant for" />
            {i === 0 ? (
              <Bar share={s.allOrganisms ?? 0} color={C.ink} grow={g(3.4, 1.2)} label="of everything that grows here" strong />
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 160, top: 300, opacity: toSevere }}>
        <p style={{ margin: "0 0 26px", fontSize: 40, fontWeight: 600, color: C.high }}>Severe: judged on everything that grows</p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 6 }}>
          <span style={{ fontSize: 56, fontWeight: 700, color: C.ink }}>{ANTIBIOTIC[severe.antibiotic]}</span>
          <Aware group={severe.aware} />
        </div>
        <Bar share={severe.share ?? 0} color={C.blue} grow={g(9, 1.2)} label="of everything that grows" strong />
        <p style={{ margin: "18px 0 0", fontSize: 34, color: C.ink3, opacity: g(10.2) }}>
          95% range {pct(severe.interval?.[0] ?? null)} to {pct(severe.interval?.[1] ?? null)}. The doctor decides; the tool shows the count
          behind every number.
        </p>
      </div>
    </div>
  );
};

export const Treat = Interactive.create({
  Component: TreatInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
