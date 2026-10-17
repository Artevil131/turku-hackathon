import { PHENOTYPES, type Phenotype, WARDS, type WardCode } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { useMemo, useState } from "react";
import type { Finding } from "../live.ts";
import { nextUnits, previousUnits, undirectedFlows, useFlows } from "../relations.ts";
import { Open } from "./Icons.tsx";

// The home screen: the analyzer's routing schematic. Units are cassette
// slots, tubes carry patients between them, and a resistant phenotype that
// arrives lights its unit and pulses down the tubes to where those patients
// usually go next.

export const W = 1000;
export const H = 560;

// Community on the left, the emergency department as the hub, wards in an arc.
export const POS: Record<WardCode, [number, number]> = {
  "PHC-N": [110, 150],
  "PHC-S": [110, 410],
  ED: [345, 280],
  ICU: [585, 280],
  "MED-A": [600, 78],
  URO: [835, 150],
  SURG: [870, 290],
  GER: [835, 430],
  "MED-B": [600, 488],
};

export function curve(a: WardCode, b: WardCode): string {
  const [x1, y1] = POS[a] ?? [0, 0];
  const [x2, y2] = POS[b] ?? [0, 0];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const bend = 0.12;
  return `M${x1},${y1} Q${mx - dy * bend},${my + dx * bend} ${x2},${y2}`;
}

// Flow ramp relative to the busiest pair in the window (both directions),
// so four weeks and a year read alike.
export function tubeWidth(patients: number, max: number): number {
  const share = max > 0 ? patients / max : 0;
  if (share >= 0.75) return 7;
  if (share >= 0.5) return 5;
  if (share >= 0.3) return 3.4;
  if (share >= 0.2) return 2.2;
  return 1.2;
}

interface Props {
  locale: Locale;
  findings: Finding[];
  onOpenWard: (ward: WardCode) => void;
  reducedMotion: boolean;
}

export function Network({ locale, findings, onOpenWard, reducedMotion }: Props) {
  const [focus, setFocus] = useState<WardCode>("ED");
  const directed = useFlows();
  const flows = useMemo(() => undirectedFlows(directed), [directed]);
  const max = flows[0]?.patients ?? 0;
  const unseen = findings.filter((f) => !f.seen);

  const sightings = useMemo(() => {
    const map = new Map<WardCode, Map<Phenotype, number>>();
    for (const f of unseen) {
      const byType = map.get(f.record.ward) ?? new Map<Phenotype, number>();
      byType.set(f.phenotype, (byType.get(f.phenotype) ?? 0) + 1);
      map.set(f.record.ward, byType);
    }
    return map;
  }, [unseen]);

  // One pulse per recent unseen finding towards its two strongest next units.
  const pulses = unseen
    .slice(0, 6)
    .flatMap((f) =>
      nextUnits(directed, f.record.ward, 2).map((next) => ({ id: `${f.id}>${next.ward}`, from: f.record.ward, to: next.ward })),
    );

  const next = nextUnits(directed, focus, 4);
  const prev = previousUnits(directed, focus, 3);
  const focusSightings = sightings.get(focus);

  return (
    <div className="network">
      <div className="layer-row" role="group" aria-label={t(locale, "layers")}>
        <span className="chip chip-on">
          <i className="dot" aria-hidden="true" />
          {t(locale, "layerFlow")}
        </span>
        <span className="chip" title={t(locale, "layerPending")}>
          {t(locale, "layerTrail")} · {t(locale, "layerPending")}
        </span>
      </div>

      <div className="network-body">
        <div className="map" role="group" aria-label={t(locale, "networkTitle")}>
          <svg viewBox={`0 0 ${W} ${H}`} className="map-tubes" aria-hidden="true">
            {flows.map(({ a, b, patients }) => {
              const active = a === focus || b === focus;
              if (patients < 0.2 * max && !active) return null;
              return (
                <path
                  key={`${a}|${b}`}
                  id={`tube-${a}-${b}`}
                  d={curve(a, b)}
                  className="tube"
                  data-active={active}
                  strokeWidth={tubeWidth(patients, max)}
                />
              );
            })}
            {!reducedMotion &&
              pulses.map((p) => {
                const [a, b] = p.from < p.to ? [p.from, p.to] : [p.to, p.from];
                const forward = p.from === a;
                return (
                  <circle key={p.id} r="5" className="pulse-dot">
                    <animateMotion dur="2.6s" repeatCount="indefinite" keyPoints={forward ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear">
                      <mpath href={`#tube-${a}-${b}`} />
                    </animateMotion>
                  </circle>
                );
              })}
          </svg>

          {WARDS.map((w) => {
            const [x, y] = POS[w.code] ?? [0, 0];
            const lit = sightings.get(w.code);
            return (
              <button
                key={w.code}
                type="button"
                className="node"
                data-lit={Boolean(lit)}
                data-focus={focus === w.code}
                style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
                onMouseEnter={() => setFocus(w.code)}
                onFocus={() => setFocus(w.code)}
                onClick={() => onOpenWard(w.code)}
                aria-label={`${wardName(locale, w.code)}. ${t(locale, "openWard")}`}
              >
                <span className="node-code data">{w.code}</span>
                <span className="node-name">{wardName(locale, w.code)}</span>
                {lit ? (
                  <span className="node-sightings">
                    {PHENOTYPES.filter((p) => lit.has(p)).map((p) => (
                      <span key={p} className="pheno">
                        {phenotypeName(p)} <b className="num">{lit.get(p)}</b>
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <aside className="focus-card glass ply-3" aria-live="polite">
          <div className="focus-head">
            <span className="slot-code data">{focus}</span>
            <div>
              <div className="inspector-title">{wardName(locale, focus)}</div>
              {focusSightings ? (
                <div className="inspector-sub">
                  {PHENOTYPES.filter((p) => focusSightings.has(p))
                    .map((p) => `${phenotypeName(p)} ${focusSightings.get(p)}`)
                    .join(" · ")}{" "}
                  · {t(locale, "unseenLabel")}
                </div>
              ) : null}
            </div>
          </div>

          <h2 className="focus-label">{t(locale, "goesNext")}</h2>
          <ul className="flow-list">
            {next.map((n) => (
              <li key={n.ward}>
                <button type="button" className="flow-row" onClick={() => onOpenWard(n.ward)}>
                  <span className="data">{n.ward}</span>
                  <span className="bar-track">
                    <i style={{ width: `${Math.round(n.share * 100)}%`, background: "var(--live)" }} />
                  </span>
                  <span className="num">{Math.round(n.share * 100)} %</span>
                </button>
              </li>
            ))}
          </ul>

          <h2 className="focus-label">{t(locale, "comesFrom")}</h2>
          <p className="focus-from">
            {prev.map((p, i) => (
              <span key={p.ward}>
                {i > 0 ? ", " : ""}
                <span className="data">{p.ward}</span> <span className="num">{p.patients}</span>
              </span>
            ))}{" "}
            <span className="muted">{t(locale, "patientsUnit")}</span>
          </p>

          <button type="button" className="btn btn-primary" onClick={() => onOpenWard(focus)}>
            <Open />
            {t(locale, "openWard")}
          </button>
        </aside>
      </div>

      <footer className="legend">
        <span className="legend-item">
          <svg viewBox="0 0 40 20" aria-hidden="true" style={{ width: 40 }}>
            <path d="M2 14 Q20 2 38 14" fill="none" stroke="var(--ink-2)" strokeWidth="5" strokeLinecap="round" />
          </svg>
          {t(locale, "flowLegend")}
        </span>
        <span className="legend-item">
          <span className="pheno">ESBL 1</span>
          {t(locale, "litLegend")}
        </span>
        {!reducedMotion ? (
          <span className="legend-item">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="5" fill="var(--live)" />
            </svg>
            {t(locale, "pulseLegend")}
          </span>
        ) : null}
      </footer>
    </div>
  );
}
