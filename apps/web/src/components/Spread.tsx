import { HOME_AREAS, type IsolateRecord, type Organism, PHENOTYPES, type Specimen, shortOrganism, WARDS, type WardCode } from "@aei/domain";
import { homeAreaName, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { useMemo } from "react";
import type { Finding } from "../live.ts";
import { previousUnits, undirectedFlows } from "../relations.ts";
import { curve, H, POS, tubeWidth, W } from "./Network.tsx";

// What is going around, for the doctor: where resistant finds turned up in
// the last four weeks and which units feed this one (mini map), how widely
// each common organism has spread across units and home regions, and which
// organisms each region sees. Counts of all arrived isolates, no modelling.

interface Props {
  locale: Locale;
  ward: WardCode;
  specimen: Specimen;
  organism: Organism | null;
  records: IsolateRecord[];
  findings: Finding[];
  onPickOrganism: (o: Organism) => void;
  onOpenResearch: () => void;
}

const TOP = 6;

export function Spread({ locale, ward, specimen, organism, records, findings, onPickOrganism, onOpenResearch }: Props) {
  const ofSpecimen = useMemo(() => records.filter((r) => r.specimen === specimen), [records, specimen]);

  const rows = useMemo(() => {
    const by = new Map<Organism, IsolateRecord[]>();
    for (const r of ofSpecimen) by.set(r.organism, [...(by.get(r.organism) ?? []), r]);
    return [...by.entries()]
      .map(([o, list]) => ({
        organism: o,
        n: list.length,
        units: new Set(list.map((r) => r.ward)),
        areas: new Map(HOME_AREAS.map((a) => [a.code, list.filter((r) => r.homeArea === a.code).length])),
        resistant: list.filter((r) => r.phenotypes.length > 0).length,
      }))
      .sort((a, b) => b.units.size - a.units.size || b.n - a.n)
      .slice(0, TOP);
  }, [ofSpecimen]);

  const finds = new Map<WardCode, number>();
  for (const f of findings) finds.set(f.record.ward, (finds.get(f.record.ward) ?? 0) + 1);
  const feeders = new Set(previousUnits(ward, 3).map((p) => p.ward));
  const maxArea = Math.max(1, ...rows.flatMap((r) => [...r.areas.values()]));

  return (
    <aside className="spread glass ply-2" aria-labelledby="spread-title">
      <header className="spread-head">
        <h2 className="spread-title" id="spread-title">
          {t(locale, "spreadTitle")}
        </h2>
        <p className="field-hint">{t(locale, "spreadSub", { specimen: specimenName(locale, specimen) })}</p>
      </header>

      <figure className="minimap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(locale, "minimapLabel", { unit: wardName(locale, ward) })}>
          {undirectedFlows().map(({ a, b, patients }) => {
            const intoUnit = (a === ward && feeders.has(b)) || (b === ward && feeders.has(a));
            if (!intoUnit && patients < 1000) return null;
            return (
              <path
                key={`${a}|${b}`}
                d={curve(a, b)}
                className="mini-tube"
                data-active={intoUnit}
                strokeWidth={tubeWidth(patients) * 1.6}
              />
            );
          })}
          {WARDS.map((w) => {
            const [x, y] = POS[w.code];
            const count = finds.get(w.code) ?? 0;
            const self = w.code === ward;
            return (
              <g key={w.code} className="mini-node" data-self={self} data-finds={count > 0}>
                <circle cx={x} cy={y} r={self ? 50 : 44} />
                <text x={x} y={y + 7} textAnchor="middle">
                  {w.code}
                </text>
                {count > 0 ? (
                  <g className="mini-badge">
                    <circle cx={x + 34} cy={y - 32} r="22" />
                    <text x={x + 34} y={y - 24} textAnchor="middle">
                      {count}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
        <figcaption className="mini-legend">
          <span>
            <i className="key key-unit" aria-hidden="true" /> {t(locale, "minimapFeeds")}
          </span>
          <span>
            <i className="mini-dot" aria-hidden="true" /> {t(locale, "minimapFinds")}
          </span>
        </figcaption>
      </figure>

      <h3 className="field-label">{t(locale, "spreadOrganisms")}</h3>
      <table className="spread-table">
        <thead>
          <tr>
            <th scope="col">{t(locale, "organism")}</th>
            <th scope="col">{t(locale, "unitsHead")}</th>
            <th scope="col">{t(locale, "regionsHead")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.organism} data-active={r.organism === organism}>
              <th scope="row">
                <button type="button" className="link org-link" onClick={() => onPickOrganism(r.organism)}>
                  <em>{shortOrganism(r.organism)}</em>
                </button>
                <span className="muted num">
                  {" "}
                  n {r.n}
                  {r.resistant > 0 ? ` · ${t(locale, "resistantN", { n: r.resistant })}` : ""}
                </span>
              </th>
              <td>
                <span className="unit-dots" title={[...r.units].map((u) => wardName(locale, u)).join(", ")}>
                  {WARDS.map((w) => (
                    <i key={w.code} data-on={r.units.has(w.code)} data-self={w.code === ward} />
                  ))}
                  <span className="num">{r.units.size}/9</span>
                </span>
              </td>
              <td>
                <span className="area-cells">
                  {HOME_AREAS.map((a) => {
                    const n = r.areas.get(a.code) ?? 0;
                    return (
                      <i
                        key={a.code}
                        title={`${homeAreaName(locale, a.code)}: ${n}`}
                        style={{ background: `color-mix(in oklch, var(--live) ${Math.round((n / maxArea) * 85)}%, var(--well-empty))` }}
                      />
                    );
                  })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-hint">
        {t(locale, "regionsKey")}: {HOME_AREAS.map((a) => homeAreaName(locale, a.code)).join(" · ")}
      </p>

      <div className="spread-finds">
        <h3 className="field-label">{t(locale, "phenotypesLabel")}</h3>
        <div className="choice-row">
          {PHENOTYPES.map((p) => (
            <span key={p} className="pheno">
              {phenotypeName(p)} <b className="num">{findings.filter((f) => f.phenotype === p).length}</b>
            </span>
          ))}
        </div>
        <button type="button" className="link" onClick={onOpenResearch}>
          {t(locale, "openSignals")}
        </button>
      </div>
    </aside>
  );
}
