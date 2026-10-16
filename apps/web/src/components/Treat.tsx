import {
  ANTIBIOTICS,
  type AntibioticCode,
  type IsolateRecord,
  type Organism,
  type Specimen,
  shortOrganism,
  WARDS,
  type WardCode,
} from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { type ReactNode, useMemo } from "react";
import { type Cell, type Figure, historyFor, organismsFor, stripsFor } from "../examples.ts";
import type { Finding } from "../live.ts";
import { previousUnits, useFlows } from "../relations.ts";
import { AlertTri, Flask, Tri } from "./Icons.tsx";
import { Spread } from "./Spread.tsx";
import { TrendChart } from "./TrendChart.tsx";

// Doctor: recommendations for one patient. A short form of patient context on the left,
// the antibiotics ranked by how often they still work on the right, and a
// drawer with the history behind the chosen one.

export type Window = "recent" | "year";

export interface TreatState {
  ward: WardCode;
  specimen: Specimen;
  organism: Organism | null;
  window: Window;
  antibiotic: AntibioticCode | null;
}

interface Props {
  locale: Locale;
  state: TreatState;
  onChange: (patch: Partial<TreatState>) => void;
  findings: Finding[];
  records: IsolateRecord[];
  asOf: string | null;
  minIsolates: number;
  onOpenSignals: (ward: WardCode) => void;
}

const SPECIMENS: Specimen[] = ["urine", "blood", "wound"];
const susceptible = (f: Figure) => Math.round(100 - f.r);

export function Treat({ locale, state, onChange, findings, records, asOf, minIsolates, onOpenSignals }: Props) {
  const organisms = useMemo(() => organismsFor(state.ward, state.specimen), [state.ward, state.specimen]);
  const organism =
    state.organism && organisms.some((o) => o.organism === state.organism) ? state.organism : (organisms[0]?.organism ?? null);
  const strip = useMemo(
    () => (organism ? stripsFor(state.ward, state.specimen).find((s) => s.organism === organism) : undefined),
    [state.ward, state.specimen, organism],
  );

  // Resistant-phenotype findings here or in the units that send most patients here, last 14 days.
  const feeders = previousUnits(useFlows(), state.ward, 3).map((p) => p.ward);
  const nearby = findings.filter(
    (f) => (f.record.ward === state.ward || feeders.includes(f.record.ward)) && (!asOf || f.arrivedAt >= shiftDays(asOf, -14)),
  );

  return (
    <div className="section section-doctor">
      <form className="context glass ply-1" onSubmit={(e) => e.preventDefault()} aria-label={t(locale, "patientContext")}>
        <h2 className="context-title">{t(locale, "patientContext")}</h2>

        <label className="field" htmlFor="treat-unit">
          <span className="field-label">{t(locale, "unit")}</span>
          <select
            id="treat-unit"
            className="select"
            value={state.ward}
            onChange={(e) => onChange({ ward: e.target.value as WardCode, organism: null, antibiotic: null })}
          >
            <optgroup label={t(locale, "hospital")}>
              {WARDS.filter((w) => w.institution === "hospital").map((w) => (
                <option key={w.code} value={w.code}>
                  {wardName(locale, w.code)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t(locale, "primaryCare")}>
              {WARDS.filter((w) => w.institution === "primary_care").map((w) => (
                <option key={w.code} value={w.code}>
                  {wardName(locale, w.code)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <fieldset className="field">
          <legend className="field-label">{t(locale, "infectionSite")}</legend>
          <div className="choice-row">
            {SPECIMENS.map((s) => (
              <button
                key={s}
                type="button"
                className="choice"
                aria-pressed={state.specimen === s}
                onClick={() => onChange({ specimen: s, organism: null, antibiotic: null })}
              >
                {specimenName(locale, s)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">{t(locale, "organism")}</legend>
          <p className="field-hint">{t(locale, "organismHint")}</p>
          <div className="org-list">
            {organisms.map((o) => (
              <button
                key={o.organism}
                type="button"
                className="org-choice"
                aria-pressed={organism === o.organism}
                onClick={() => onChange({ organism: o.organism, antibiotic: null })}
              >
                <span className="org-choice-name">{o.organism}</span>
                <span className="org-choice-share num">{Math.round(o.share * 100)} %</span>
                <span className="org-choice-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(o.share * 100)}%` }} />
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <p className="field-hint">{t(locale, "moreFiltersLater")}</p>

        {nearby.length > 0 ? (
          <div className="nearby">
            <h3 className="field-label">{t(locale, "nearbySignals")}</h3>
            <ul>
              {nearby.slice(0, 4).map((f) => (
                <li key={f.id}>
                  <AlertTri />
                  <span>
                    <b>{phenotypeName(f.phenotype)}</b> <em>{shortOrganism(f.record.organism)}</em> · {wardName(locale, f.record.ward)} ·{" "}
                    <span className="num">{formatDate(locale, f.arrivedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="link" onClick={() => onOpenSignals(state.ward)}>
              {t(locale, "openSignals")}
            </button>
          </div>
        ) : null}
      </form>

      <section className="result glass ply-2" aria-labelledby="result-title">
        <header className="result-head">
          <div>
            <h1 className="result-title" id="result-title">
              {t(locale, "whatWorks")}
            </h1>
            <p className="result-sub">
              {organism ? (
                <>
                  <em>{organism}</em> · {specimenName(locale, state.specimen)} ·{" "}
                </>
              ) : null}
              {wardName(locale, state.ward)} · {state.window === "recent" ? t(locale, "windowRecent") : t(locale, "windowYear")}
              <span className="chip chip-example" title={t(locale, "exampleDataNote")}>
                <Flask />
                {t(locale, "exampleData")}
              </span>
            </p>
          </div>
          <div className="result-tools">
            <Seg
              label={t(locale, "windowLabel")}
              value={state.window}
              onChange={(window) => onChange({ window })}
              options={[
                ["recent", t(locale, "windowRecent")],
                ["year", t(locale, "windowYear")],
              ]}
            />
          </div>
        </header>

        {strip && organism ? (
          <Ranked
            locale={locale}
            cells={strip.cells}
            window={state.window}
            minIsolates={minIsolates}
            active={state.antibiotic}
            onPick={(antibiotic) => onChange({ antibiotic: state.antibiotic === antibiotic ? null : antibiotic })}
            renderDetail={(cell) =>
              asOf ? (
                <Detail
                  locale={locale}
                  ward={state.ward}
                  organism={organism}
                  specimen={state.specimen}
                  cell={cell}
                  asOf={asOf}
                  minIsolates={minIsolates}
                />
              ) : null
            }
          />
        ) : (
          <p className="empty">{t(locale, "noStrips")}</p>
        )}
      </section>

      <Spread
        locale={locale}
        ward={state.ward}
        specimen={state.specimen}
        organism={organism}
        records={records}
        findings={findings}
        onPickOrganism={(o) => onChange({ organism: o, antibiotic: null })}
        onOpenResearch={() => onOpenSignals(state.ward)}
      />
    </div>
  );
}

function Ranked(props: {
  locale: Locale;
  cells: Cell[];
  window: Window;
  minIsolates: number;
  active: AntibioticCode | null;
  onPick: (a: AntibioticCode) => void;
  renderDetail: (cell: Cell) => ReactNode;
}) {
  const { locale, cells, window, minIsolates, active } = props;
  // A four-week figure from too few isolates falls back to the 12-month figure, marked as such.
  const shown = (c: Cell): { f: Figure; from: Window } | null => {
    if (c[window].n >= minIsolates) return { f: c[window], from: window };
    if (window === "recent" && c.year.n >= minIsolates) return { f: c.year, from: "year" };
    return null;
  };
  const reportable = cells.filter((c) => shown(c)).sort((a, b) => (shown(a)?.f.r ?? 0) - (shown(b)?.f.r ?? 0));
  const thin = cells.filter((c) => !shown(c));
  const usesFallback = reportable.some((c) => shown(c)?.from !== window);

  const row = (c: Cell, i: number | null) => {
    const s = shown(c);
    const open = active === c.antibiotic;
    const baseline: "year" | "hospital" = window === "recent" && s?.from === "recent" ? "year" : "hospital";
    const delta = s && c[baseline].n >= minIsolates ? Math.round(c[baseline].r - s.f.r) : null;
    const meta = ANTIBIOTICS.find((x) => x.code === c.antibiotic);
    return (
      <li key={c.antibiotic} className="rank" data-open={open}>
        <button type="button" className="rank-row" aria-expanded={open} onClick={() => props.onPick(c.antibiotic)}>
          <span className="rank-pos num">{i === null ? "–" : i + 1}</span>
          <span className="rank-name">
            <b>{antibioticName(locale, c.antibiotic)}</b>
            <span className="rank-class">
              {meta?.class}
              {meta?.reportedFor === "urine" ? ` · ${t(locale, "urineOnly")}` : ""}
            </span>
          </span>
          <span className="rank-main">
            {s ? (
              <>
                <span className="rank-pct num">{susceptible(s.f)} %</span>
                {s.from !== window ? <span className="from-tag">{t(locale, "colYear")}</span> : null}
                <span className="rank-bar" aria-hidden="true">
                  <i style={{ width: `${susceptible(s.f)}%` }} />
                </span>
              </>
            ) : (
              <span className="rank-thin">{t(locale, "thinData", { n: c[window].n, min: minIsolates })}</span>
            )}
          </span>
          <span className="rank-n num">
            n {s ? s.f.n : c[window].n}
            {s && s.from !== window ? (
              <small className="muted">
                {" "}
                ({t(locale, "colRecent")} {c[window].n})
              </small>
            ) : null}
          </span>
          <span className="rank-delta num">
            {delta !== null && Math.abs(delta) >= 3 ? (
              <span className="delta-inline" data-dir={delta < 0 ? "down" : "up"}>
                <Tri dir={delta < 0 ? "down" : "up"} /> {Math.abs(delta)}
              </span>
            ) : (
              <span className="muted">±0</span>
            )}
          </span>
          <span className="rank-compare num">
            {baseline === "year" ? t(locale, "colYear") : t(locale, "hospital")}{" "}
            {c[baseline].n >= minIsolates ? `${susceptible(c[baseline])} %` : "–"}
          </span>
        </button>
        {open ? <div className="rank-detail">{props.renderDetail(c)}</div> : null}
      </li>
    );
  };

  return (
    <div className="ranked">
      {usesFallback ? <p className="works-note">{t(locale, "fallbackNote", { min: minIsolates })}</p> : null}
      <div className="rank-head" aria-hidden="true">
        <span />
        <span>{t(locale, "antibiotic")}</span>
        <span>{t(locale, "susceptibleHead")}</span>
        <span>n</span>
        <span>{t(locale, "changeHead")}</span>
        <span>{t(locale, "compareLabel")}</span>
      </div>
      <ol className="rank-list">{reportable.map((c, i) => row(c, i))}</ol>
      {thin.length > 0 ? (
        <>
          <h2 className="rank-group">{t(locale, "thinGroup", { min: minIsolates })}</h2>
          <ol className="rank-list">{thin.map((c) => row(c, null))}</ol>
        </>
      ) : null}
      <p className="result-foot">{t(locale, "worksFoot", { min: minIsolates })}</p>
    </div>
  );
}

function Detail(props: {
  locale: Locale;
  ward: WardCode;
  organism: Organism;
  specimen: Specimen;
  cell: Cell;
  asOf: string;
  minIsolates: number;
}) {
  const { locale, ward, organism, specimen, cell, asOf, minIsolates } = props;
  const points = useMemo(
    () => historyFor(ward, organism, specimen, cell.antibiotic, asOf),
    [ward, organism, specimen, cell.antibiotic, asOf],
  );
  const figures: [string, Figure][] = [
    [t(locale, "windowRecent"), cell.recent],
    [t(locale, "windowYear"), cell.year],
    [`${t(locale, "hospital")}, ${t(locale, "windowYear").toLowerCase()}`, cell.hospital],
  ];
  return (
    <div className="detail">
      <TrendChart locale={locale} points={points} minIsolates={minIsolates} unitLabel={wardName(locale, ward)} />
      <dl className="detail-figs">
        {figures.map(([label, f]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="num">
              {f.n >= minIsolates ? `${susceptible(f)} %` : "–"} <span className="muted">n {f.n}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function Seg<T extends string>(props: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map(([value, text]) => (
        <button key={value} type="button" aria-pressed={props.value === value} onClick={() => props.onChange(value)}>
          {text}
        </button>
      ))}
    </div>
  );
}
