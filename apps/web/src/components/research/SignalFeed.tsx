import { PHENOTYPES, type Phenotype } from "@aei/domain";
import { formatDate, phenotypeName, t, wardName } from "@aei/i18n";
import { useEffect, useRef } from "react";
import { useAiStatus, useQuestion } from "../../ai.ts";
import { networkUnits } from "../../sites.ts";
import { Ask, AskedResults } from "../Ask.tsx";
import { AsOf } from "../AsOf.tsx";
import { type FeedProps, KINDS, type SignalKind } from "./board.ts";
import { KindGlyph } from "./feed/glyphs.tsx";
import { IncidentRow } from "./feed/IncidentRow.tsx";
import { applyFilters, type Incident, openIncidents } from "./feed/model.ts";
import { kindLabel } from "./feed/names.ts";
import type { Spans } from "./feed/spans.ts";
import type { IncidentLoad } from "./feed/useIncidents.ts";
import "./SignalFeed.css";

// The researcher's incident list (spec-v2 5): every incident of the last 365
// days, by date, newest first, each row naming the units it spans. It opens
// unfiltered; a unit filter shows a bar that clears it.

interface Props extends FeedProps {
  load: IncidentLoad;
  incidents: Incident[];
  retry: () => void;
  spansOf: (i: Incident) => Spans | null;
  /** The incident the math panel shows. */
  selected: string | null;
}

export function SignalFeed(props: Props) {
  const { client, locale, asOf, state, onChange, load, incidents, retry, spansOf, selected } = props;
  const rootRef = useRef<HTMLElement>(null);

  // The Ask field appears when the API reports the assistant answering (Meta.aiStatus "ready"); while
  // a configured model is offline one line says so, and the field returns by itself (D-049).
  const { status: ai, recheck } = useAiStatus(client);
  // The model only returns filters; the unit filter also drives the board, the counts come from records.
  const question = useQuestion(client, ai, asOf, state.unit ? { ward: state.unit } : {}, (f) => {
    if ("ward" in f) onChange({ unit: f.ward ?? null });
  });
  // A failed question made the server probe the model again; read its answer.
  useEffect(() => {
    if (question.error) recheck();
  }, [question.error, recheck]);

  const filters = { unit: state.unit, kinds: state.kinds, phenotype: state.phenotype };
  const shown = applyFilters(incidents, filters);
  const readyAsOf = load.status === "ready" ? load.asOf : null;
  const open = readyAsOf ? openIncidents(shown, readyAsOf) : [];
  const openKeys = new Set(open.map((i) => i.key));
  const history = shown.filter((i) => !openKeys.has(i.key));

  // Facet counts: each choice counts the incidents the other filters leave.
  const unitCounts = countBy(applyFilters(incidents, filters, "unit"), (i) => (i.ward ? [i.ward] : []));
  const kindCounts = countBy(applyFilters(incidents, filters, "kind"), (i) => [i.kind]);
  const phenoCounts = countBy(applyFilters(incidents, filters, "phenotype"), (i) => i.phenotypes);
  const units = networkUnits([]).filter((c) => unitCounts.has(c) || state.unit === c);
  const phenotypes = [...new Set<Phenotype>([...phenoCounts.keys(), ...(state.phenotype ? [state.phenotype] : [])])].sort();
  const filtered = state.unit !== null || state.kinds.length > 0 || state.phenotype !== null;
  const clearAll = () => onChange({ unit: null, kinds: [], phenotype: null });

  // The selected row stays in view when a filter or a link moves it.
  const filterKey = `${state.unit}|${state.kinds.join(",")}|${state.phenotype}|${load.status}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when the filters or the selection change, not on every render.
  useEffect(() => {
    if (!selected || !state.incident) return;
    const id = requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>('.feed-row[aria-current="true"]')?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(id);
  }, [filterKey, selected]);

  const toggleKind = (k: SignalKind) =>
    onChange({ kinds: state.kinds.includes(k) ? state.kinds.filter((x) => x !== k) : [...state.kinds, k] });

  return (
    <section ref={rootRef} className="feed" aria-labelledby="feed-title" aria-busy={load.status === "loading"}>
      <header className="feed-header">
        <div className="feed-headline">
          <h1 id="feed-title">{t(locale, "feedTitle")}</h1>
          {readyAsOf ? (
            <>
              <span className="feed-count">
                {t(locale, incidents.length === 1 ? "feedWindowOne" : "feedWindow", { n: incidents.length })}
              </span>
              <AsOf locale={locale} date={readyAsOf} pending={asOf !== null && asOf !== readyAsOf} clockDate={asOf ?? undefined} />
            </>
          ) : null}
        </div>
        {question.available || question.offline || question.active || question.error ? (
          <div className="feed-ask">
            <Ask locale={locale} question={question} />
            {question.active ? (
              <AskedResults
                locale={locale}
                records={question.records}
                loading={question.loading}
                error={question.loadError}
                asOf={question.answer?.asOf}
              />
            ) : null}
          </div>
        ) : null}
        {readyAsOf ? (
          <div className="feed-filters" role="group" aria-label={t(locale, "feedFilters")}>
            <select
              className="feed-select"
              aria-label={t(locale, "feedFilterUnit")}
              value={state.unit ?? ""}
              onChange={(e) => onChange({ unit: (e.target.value || null) as typeof state.unit })}
            >
              <option value="">{t(locale, "feedAllUnits")}</option>
              {units.map((c) => (
                <option key={c} value={c}>
                  {c} · {wardName(locale, c)} · {unitCounts.get(c) ?? 0}
                </option>
              ))}
            </select>
            <select
              className="feed-select"
              aria-label={t(locale, "feedFilterPhenotype")}
              value={state.phenotype ?? ""}
              onChange={(e) => onChange({ phenotype: (e.target.value || null) as Phenotype | null })}
            >
              <option value="">{t(locale, "feedAllPhenotypes")}</option>
              {phenotypes
                .filter((p) => PHENOTYPES.includes(p))
                .map((p) => (
                  <option key={p} value={p}>
                    {phenotypeName(p)} · {phenoCounts.get(p) ?? 0}
                  </option>
                ))}
            </select>
            <div className="feed-kinds" role="group" aria-label={t(locale, "feedFilterKind")}>
              {KINDS.filter((k) => k !== "divergence").map((k) => (
                <button
                  key={k}
                  type="button"
                  className="feed-chip"
                  aria-pressed={state.kinds.includes(k)}
                  title={kindLabel(locale, k)}
                  onClick={() => toggleKind(k)}
                >
                  <KindGlyph kind={k} />
                  <span className="feed-chip-name">{k === "data" ? t(locale, "feedKindDataChip") : kindLabel(locale, k)}</span>
                  <span className="feed-chip-count">{kindCounts.get(k) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {state.unit !== null ? (
          <p className="feed-unitbar" role="status">
            <span>{t(locale, "feedUnitOnly", { unit: wardName(locale, state.unit) })}</span>
            <button type="button" className="link" onClick={() => onChange({ unit: null })}>
              {t(locale, "feedShowAll")}
            </button>
          </p>
        ) : filtered ? (
          <p className="feed-unitbar" role="status">
            <button type="button" className="link" onClick={clearAll}>
              {t(locale, "feedClearFilters")}
            </button>
          </p>
        ) : null}
      </header>

      <div className="feed-scroll">
        {load.status === "loading" ? (
          <ul className="feed-list">
            {[0, 1, 2, 3].map((n) => (
              <li key={n} className="feed-skeleton" aria-hidden="true">
                <span />
                <span />
              </li>
            ))}
          </ul>
        ) : load.status === "error" ? (
          <div className="feed-state" role="alert">
            <p>{t(locale, "feedError")}</p>
            <button type="button" className="feed-btn" onClick={retry}>
              {t(locale, "retry")}
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="feed-state" role="status">
            {t(locale, "feedEmpty", { date: formatDate(locale, load.asOf, "long") })}
          </p>
        ) : (
          <>
            <h2 className="feed-section-title">{t(locale, "feedOpen", { n: open.length })}</h2>
            <p className="feed-section-note">{t(locale, "feedOpenNote")}</p>
            {[open, history].map((list, index) => (
              <section
                key={index === 0 ? "open" : "history"}
                aria-label={t(locale, index === 0 ? "feedOpen" : "feedHistory", { n: open.length })}
              >
                {index === 1 && list.length > 0 ? <h2 className="feed-section-title">{t(locale, "feedHistory")}</h2> : null}
                <ul className="feed-list">
                  {list.map((i) => (
                    <li key={i.key}>
                      <IncidentRow
                        locale={locale}
                        incident={i}
                        selected={selected === i.key}
                        spans={spansOf(i)}
                        onSelect={(key) => onChange({ incident: key })}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function countBy<T extends string>(list: readonly Incident[], keys: (i: Incident) => T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of list) for (const k of new Set(keys(i))) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}
