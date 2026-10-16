import type { AeiClient, Alert, IsolateQuery } from "@aei/contract";
import { type Organism, PHENOTYPES, type Phenotype, type Specimen, shortOrganism, WARDS, type WardCode } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { useMemo } from "react";
import { useQuestion } from "../ai.ts";
import { EXAMPLE_DEVIATION, historyFor, organismsFor, stripsFor } from "../examples.ts";
import type { Finding } from "../live.ts";
import { nextUnits, useFlows } from "../relations.ts";
import { AlertList } from "./AlertExplanation.tsx";
import { AntibiogramGrid } from "./Analyzer.tsx";
import { Ask, AskedResults } from "./Ask.tsx";
import { Check, Flask, Open, Rise } from "./Icons.tsx";
import { Network } from "./Network.tsx";
import { Seg } from "./Treat.tsx";
import { TrendChart } from "./TrendChart.tsx";

// Research: for epidemiologists, AMR researchers and infection control.
// The data in four views: signals (resistant finds as they arrive), the
// antibiogram grid, trend plots, and how units are related.

export type ResearchTab = "signals" | "antibiogram" | "trends" | "relations";

export interface ResearchState {
  tab: ResearchTab;
  ward: WardCode | "all";
  phenotypes: Phenotype[];
  days: 7 | 14 | 28;
  unseenOnly: boolean;
  selected: string | null;
  specimen: Specimen;
  window: "recent" | "year";
  organism: Organism | null;
}

interface Props {
  client: AeiClient;
  ai: boolean;
  alerts: Alert[];
  locale: Locale;
  state: ResearchState;
  onChange: (patch: Partial<ResearchState>) => void;
  findings: Finding[];
  asOf: string | null;
  acknowledge: (ids: string[]) => void;
  onTreat: (f: Finding) => void;
  reducedMotion: boolean;
  minIsolates: number;
}

const SPECIMENS: Specimen[] = ["urine", "blood", "wound"];

export function Research(props: Props) {
  const { locale, state, onChange, asOf, minIsolates } = props;
  const question = useQuestion(
    props.client,
    props.ai,
    asOf,
    {
      ward: state.ward === "all" ? undefined : state.ward,
      ...(state.tab === "antibiogram" || state.tab === "trends" ? { specimen: state.specimen, organism: state.organism ?? undefined } : {}),
    },
    (filters: IsolateQuery) => {
      onChange({
        ...("ward" in filters ? { ward: filters.ward ?? "all" } : {}),
        ...(filters.specimen ? { specimen: filters.specimen } : {}),
        ...("organism" in filters ? { organism: filters.organism ?? null } : {}),
      });
    },
  );
  const findings = question.active
    ? question.records.flatMap((record) =>
        record.phenotypes.map((phenotype) => ({
          id: `${record.isolateId}:${phenotype}`,
          phenotype,
          record,
          arrivedAt: record.sampleDate,
          seen: props.findings.find((f) => f.id === `${record.isolateId}:${phenotype}`)?.seen ?? true,
        })),
      )
    : props.findings;
  // The grid and trend views are per unit; "all units" falls back to the emergency department, the hub.
  const unit: WardCode = state.ward === "all" ? "ED" : state.ward;
  const perUnit = state.tab === "antibiogram" || state.tab === "trends";
  const organisms = useMemo(() => organismsFor(unit, state.specimen), [unit, state.specimen]);
  const organism =
    state.organism && organisms.some((o) => o.organism === state.organism) ? state.organism : (organisms[0]?.organism ?? null);

  const from = asOf ? shiftDays(asOf, -state.days) : null;
  const inPeriod = useMemo(() => findings.filter((f) => question.active || !from || f.arrivedAt > from), [findings, from, question.active]);
  const shown = inPeriod.filter(
    (f) =>
      (state.ward === "all" || f.record.ward === state.ward) &&
      (state.phenotypes.length === 0 || state.phenotypes.includes(f.phenotype)) &&
      (!state.unseenOnly || !f.seen),
  );
  const counts = new Map<Phenotype, number>(PHENOTYPES.map((p) => [p, inPeriod.filter((f) => f.phenotype === p).length]));
  const unseenShown = shown.filter((f) => !f.seen).map((f) => f.id);

  const titles: Record<ResearchTab, string> = {
    signals: t(locale, "signalsTitle"),
    antibiogram: t(locale, "allOrganisms"),
    trends: t(locale, "trendsTitle"),
    relations: t(locale, "networkTitle"),
  };

  return (
    <div className="section">
      <form className="context glass ply-1" onSubmit={(e) => e.preventDefault()} aria-label={t(locale, "filters")}>
        <h2 className="context-title">{t(locale, "filters")}</h2>
        <Ask locale={locale} question={question} />

        <label className="field" htmlFor="research-unit">
          <span className="field-label">{t(locale, "unit")}</span>
          <select
            id="research-unit"
            className="select"
            value={perUnit ? unit : state.ward}
            onChange={(e) => onChange({ ward: e.target.value as WardCode | "all", organism: null })}
          >
            {perUnit ? null : <option value="all">{t(locale, "allUnits")}</option>}
            {WARDS.map((w) => (
              <option key={w.code} value={w.code}>
                {wardName(locale, w.code)}
              </option>
            ))}
          </select>
        </label>

        {state.tab === "signals" ? (
          <>
            <fieldset className="field">
              <legend className="field-label">{t(locale, "phenotype")}</legend>
              <div className="choice-row">
                {PHENOTYPES.map((p) => {
                  const on = state.phenotypes.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className="choice"
                      aria-pressed={on}
                      onClick={() => onChange({ phenotypes: on ? state.phenotypes.filter((x) => x !== p) : [...state.phenotypes, p] })}
                    >
                      {phenotypeName(p)}{" "}
                      <span className="choice-count num">
                        {question.active && (question.loading || question.loadError) ? "–" : counts.get(p)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="field" disabled={question.active}>
              <legend className="field-label">{t(locale, "period")}</legend>
              <Seg
                label={t(locale, "period")}
                value={String(state.days) as "7" | "14" | "28"}
                onChange={(v) => onChange({ days: Number(v) as 7 | 14 | 28 })}
                options={[
                  ["7", t(locale, "daysN", { n: 7 })],
                  ["14", t(locale, "daysN", { n: 14 })],
                  ["28", t(locale, "daysN", { n: 28 })],
                ]}
              />
            </fieldset>
            <label className="check">
              <input
                type="checkbox"
                id="research-unseen"
                checked={state.unseenOnly}
                onChange={(e) => onChange({ unseenOnly: e.target.checked })}
              />
              {t(locale, "unseenOnly")}
            </label>
          </>
        ) : null}

        {perUnit ? (
          <fieldset className="field">
            <legend className="field-label">{t(locale, "specimen")}</legend>
            <div className="choice-row">
              {SPECIMENS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="choice"
                  aria-pressed={state.specimen === s}
                  onClick={() => onChange({ specimen: s, organism: null })}
                >
                  {specimenName(locale, s)}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {!question.active && state.tab === "antibiogram" ? (
          <fieldset className="field">
            <legend className="field-label">{t(locale, "windowLabel")}</legend>
            <Seg
              label={t(locale, "windowLabel")}
              value={state.window}
              onChange={(window) => onChange({ window })}
              options={[
                ["recent", t(locale, "windowRecent")],
                ["year", t(locale, "windowYear")],
              ]}
            />
          </fieldset>
        ) : null}

        {!question.active && state.tab === "trends" ? (
          <fieldset className="field">
            <legend className="field-label">{t(locale, "organism")}</legend>
            <div className="org-list">
              {organisms.map((o) => (
                <button
                  key={o.organism}
                  type="button"
                  className="org-choice"
                  aria-pressed={organism === o.organism}
                  onClick={() => onChange({ organism: o.organism })}
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
        ) : null}

        <p className="field-hint">{t(locale, "scopeNote")}</p>
      </form>

      <section className="result glass ply-2" aria-labelledby="research-title">
        <header className="result-head">
          <div>
            <h1 className="result-title" id="research-title">
              {question.active && state.tab !== "signals" ? t(locale, "askResults") : titles[state.tab]}
            </h1>
            <p className="result-sub">
              {state.tab === "signals"
                ? question.active
                  ? question.loading
                    ? t(locale, "dataLoading")
                    : question.loadError
                      ? t(locale, "dataLoadError")
                      : t(locale, "queryFindings", { n: shown.length })
                  : t(locale, "signalsSub", { n: shown.length, days: state.days })
                : null}
              {state.tab === "relations" ? t(locale, "networkSub") : null}
              {perUnit && !question.active ? (
                <>
                  {wardName(locale, unit)} · {specimenName(locale, state.specimen)}
                  {state.tab === "trends" && organism ? (
                    <>
                      {" "}
                      · <em>{organism}</em>
                    </>
                  ) : null}
                  {!question.active ? (
                    <span className="chip chip-example" title={t(locale, "exampleDataNote")}>
                      <Flask />
                      {t(locale, "exampleData")}
                    </span>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>
          <div className="result-tools">
            {state.tab === "signals" && unseenShown.length > 0 ? (
              <button type="button" className="btn" onClick={() => props.acknowledge(unseenShown)}>
                <Check />
                {t(locale, "markAllSeen", { n: unseenShown.length })}
              </button>
            ) : null}
          </div>
          <div className="tabs" role="group" aria-label={t(locale, "viewLabel")}>
            {(["signals", "antibiogram", "trends", "relations"] as ResearchTab[]).map((tab) => (
              <button key={tab} type="button" className="tab" aria-pressed={state.tab === tab} onClick={() => onChange({ tab })}>
                {t(locale, tabKey[tab])}
              </button>
            ))}
          </div>
        </header>

        {state.tab === "signals" ? (
          <div className="signals">
            {!question.active ? <ExampleChange locale={locale} /> : null}
            <AlertList
              client={props.client}
              alerts={props.alerts.filter((a) => state.ward === "all" || a.ward === state.ward || a.ward === null)}
              locale={locale}
            />
            {question.active && question.loading ? <p role="status">{t(locale, "dataLoading")}</p> : null}
            {question.active && question.loadError ? <p role="alert">{t(locale, "dataLoadError")}</p> : null}
            {question.active && (question.loading || question.loadError) ? null : shown.length === 0 ? (
              <p className="empty">{t(locale, "noSignals")}</p>
            ) : (
              <table className="signal-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">{t(locale, "status")}</span>
                    </th>
                    <th scope="col">{t(locale, "date")}</th>
                    <th scope="col">{t(locale, "phenotype")}</th>
                    <th scope="col">{t(locale, "organism")}</th>
                    <th scope="col">{t(locale, "unit")}</th>
                    <th scope="col">{t(locale, "stayDay")}</th>
                    <th scope="col">{t(locale, "goesNextShort")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((f) => (
                    <SignalRow
                      key={f.id}
                      locale={locale}
                      f={f}
                      open={state.selected === f.id}
                      onToggle={() => onChange({ selected: state.selected === f.id ? null : f.id })}
                      findings={findings}
                      acknowledge={props.acknowledge}
                      onTreat={props.onTreat}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {question.active && state.tab !== "signals" ? (
          <AskedResults locale={locale} records={question.records} loading={question.loading} error={question.loadError} />
        ) : null}
        {!question.active && state.tab === "antibiogram" ? (
          <AntibiogramGrid
            locale={locale}
            ward={unit}
            specimen={state.specimen}
            window={state.window}
            minIsolates={minIsolates}
            selection={null}
            onSelect={(s) => onChange({ tab: "trends", organism: s.organism })}
          />
        ) : null}

        {!question.active && state.tab === "trends" ? (
          <Trends locale={locale} unit={unit} specimen={state.specimen} organism={organism} asOf={asOf} minIsolates={minIsolates} />
        ) : null}

        {!question.active && state.tab === "relations" ? (
          <Network
            locale={locale}
            findings={findings}
            onOpenWard={(ward) => onChange({ ward, tab: "signals" })}
            reducedMotion={props.reducedMotion}
          />
        ) : null}
      </section>
    </div>
  );
}

const tabKey = { signals: "tabSignals", antibiogram: "viewGrid", trends: "tabTrends", relations: "tabRelations" } as const;

function Trends(props: {
  locale: Locale;
  unit: WardCode;
  specimen: Specimen;
  organism: Organism | null;
  asOf: string | null;
  minIsolates: number;
}) {
  const { locale, unit, specimen, organism, asOf, minIsolates } = props;
  const strip = organism ? stripsFor(unit, specimen).find((s) => s.organism === organism) : undefined;
  if (!strip || !organism || !asOf) return <p className="empty">{t(locale, "noStrips")}</p>;
  return (
    <div className="multiples">
      {strip.cells.map((cell) => (
        <section key={cell.antibiotic} className="multiple">
          <h2 className="multiple-title">{antibioticName(locale, cell.antibiotic)}</h2>
          <TrendChart
            locale={locale}
            points={historyFor(unit, organism, specimen, cell.antibiotic, asOf)}
            minIsolates={minIsolates}
            unitLabel={wardName(locale, unit)}
          />
        </section>
      ))}
    </div>
  );
}

function stayDay(f: Finding): number | null {
  if (!f.record.admissionDate) return null;
  return Math.round((Date.parse(f.record.sampleDate) - Date.parse(f.record.admissionDate)) / 86_400_000) + 1;
}

function SignalRow(props: {
  locale: Locale;
  f: Finding;
  open: boolean;
  onToggle: () => void;
  findings: Finding[];
  acknowledge: (ids: string[]) => void;
  onTreat: (f: Finding) => void;
}) {
  const { locale, f, open } = props;
  const day = stayDay(f);
  const next = nextUnits(useFlows(), f.record.ward, 3);
  // The phenotype trail as far as the loaded findings reach: the same patient's other resistant finds.
  const trail = props.findings.filter((x) => x.record.patientId === f.record.patientId && x.id !== f.id);
  return (
    <>
      <tr className="signal" data-seen={f.seen} data-open={open}>
        <td>
          <span className="seen-dot" data-seen={f.seen} title={f.seen ? t(locale, "seen") : t(locale, "unseenLabel")} />
        </td>
        <td className="num">
          <button type="button" className="row-link" aria-expanded={open} onClick={props.onToggle}>
            {formatDate(locale, f.arrivedAt)}
          </button>
        </td>
        <td>
          <span className="pheno">{phenotypeName(f.phenotype)}</span>
        </td>
        <td>
          <em>{shortOrganism(f.record.organism)}</em> <span className="muted">· {specimenName(locale, f.record.specimen)}</span>
        </td>
        <td>{wardName(locale, f.record.ward)}</td>
        <td className="num">{day === null ? <span className="muted">{t(locale, "outpatient")}</span> : day}</td>
        <td className="num">
          {next
            .slice(0, 2)
            .map((n) => `${n.ward} ${Math.round(n.share * 100)} %`)
            .join(", ")}
        </td>
      </tr>
      {open ? (
        <tr className="signal-detail">
          <td colSpan={7}>
            <div className="signal-drawer">
              <div>
                <h3 className="field-label">{t(locale, "isolateDetails")}</h3>
                <dl className="kv">
                  <dt>{t(locale, "organism")}</dt>
                  <dd>
                    <em>{f.record.organism}</em>
                  </dd>
                  <dt>{t(locale, "specimen")}</dt>
                  <dd>{specimenName(locale, f.record.specimen)}</dd>
                  <dt>{t(locale, "patient")}</dt>
                  <dd className="num">
                    {f.record.patientId} · {f.record.sex === "F" ? t(locale, "female") : t(locale, "male")} · {f.record.ageYears}{" "}
                    {t(locale, "yearsShort")}
                  </dd>
                  <dt>{t(locale, "stayDay")}</dt>
                  <dd className="num">{day === null ? t(locale, "outpatient") : day}</dd>
                  <dt>{t(locale, "phenotypesLabel")}</dt>
                  <dd>{f.record.phenotypes.map((p) => phenotypeName(p)).join(", ")}</dd>
                </dl>
              </div>
              <div>
                <h3 className="field-label">{t(locale, "goesNext")}</h3>
                <ul className="flow-list">
                  {next.map((n) => (
                    <li key={n.ward} className="flow-row">
                      <span>{wardName(locale, n.ward)}</span>
                      <span className="bar-track">
                        <i style={{ width: `${Math.round(n.share * 100)}%`, background: "var(--live)" }} />
                      </span>
                      <span className="num">{Math.round(n.share * 100)} %</span>
                    </li>
                  ))}
                </ul>
                <h3 className="field-label">{t(locale, "trailTitle")}</h3>
                {trail.length === 0 ? (
                  <p className="muted small">{t(locale, "trailNone")}</p>
                ) : (
                  <ul className="trail">
                    {trail.map((x) => (
                      <li key={x.id} className="num">
                        {formatDate(locale, x.arrivedAt)} · {phenotypeName(x.phenotype)} · {wardName(locale, x.record.ward)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="signal-actions">
                {f.seen ? (
                  <span className="chip">
                    <Check />
                    {t(locale, "seen")}
                  </span>
                ) : (
                  <button type="button" className="btn" onClick={() => props.acknowledge([f.id])}>
                    <Check />
                    {t(locale, "acknowledge")}
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => props.onTreat(f)}>
                  <Open />
                  {t(locale, "openInTreat")}
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ExampleChange({ locale }: { locale: Locale }) {
  const d = EXAMPLE_DEVIATION;
  return (
    <div className="change-card">
      <span className="status" data-level="alert">
        <Rise />
        {t(locale, "rising")}
      </span>
      <span>
        <b>{d.antibiotic}</b> · <em>{shortOrganism(d.organism)}</em>, {specimenName(locale, d.specimen)} · {wardName(locale, d.ward)}:{" "}
        {t(locale, "resistanceUp", { d: d.lift })}
      </span>
      <span className="chip chip-example">
        <Flask />
        {t(locale, "deviationExample")}
      </span>
    </div>
  );
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
