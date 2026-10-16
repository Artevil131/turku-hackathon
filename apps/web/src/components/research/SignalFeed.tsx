import type { Alert } from "@aei/contract";
import { type Phenotype, WARDS } from "@aei/domain";
import { formatDate, phenotypeName, t, wardName } from "@aei/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AsOf } from "../AsOf.tsx";
import { useMedia } from "../doctor/useMedia.ts";
import { type FeedProps, KINDS, type SignalKind } from "./board.ts";
import { Check, Chevron, KindGlyph } from "./feed/glyphs.tsx";
import { IncidentCard, kindLabel } from "./feed/IncidentCard.tsx";
import { applyFilters, groupIncidents, type Incident, shift } from "./feed/model.ts";
import "./SignalFeed.css";

// The researcher's signal feed (spec-research.md, "SignalFeed"): alerts of the
// last 365 days grouped into incidents, newest first, sentinels pinned.

const WINDOW_DAYS = 365;
const PINNED_DAYS = 180;

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; asOf: string; alerts: Alert[] };

export function SignalFeed(props: FeedProps) {
  const { client, locale, asOf, state, onChange, findings, acknowledge } = props;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const phone = useMedia("(max-width: 760px)");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    setLoad((l) => (l.status === "ready" ? l : { status: "loading" }));
    client
      .alerts({ from: shift(asOf, -WINDOW_DAYS) })
      .then((r) => !stale && setLoad({ status: "ready", asOf: r.asOf, alerts: r.alerts }))
      .catch(() => !stale && setLoad({ status: "error" }));
    return () => {
      stale = true;
    };
  }, [client, asOf, attempt]);

  const incidents = useMemo(() => (load.status === "ready" ? groupIncidents(load.alerts) : []), [load]);
  const filters = { unit: state.unit, kinds: state.kinds, phenotype: state.phenotype };
  const shown = applyFilters(incidents, filters);
  const readyAsOf = load.status === "ready" ? load.asOf : null;
  const pinnedFrom = readyAsOf ? shift(readyAsOf, -PINNED_DAYS) : "";
  const pinned = shown.filter((i) => i.kind === "sentinel" && i.date >= pinnedFrom);
  const rest = shown.filter((i) => !pinned.includes(i));

  // Facet counts: each chip counts the incidents the other filters leave.
  const unitCounts = countBy(applyFilters(incidents, filters, "unit"), (i) => (i.ward ? [i.ward] : []));
  const kindCounts = countBy(applyFilters(incidents, filters, "kind"), (i) => [i.kind]);
  const phenoCounts = countBy(applyFilters(incidents, filters, "phenotype"), (i) => i.phenotypes);

  const units = WARDS.map((w) => w.code).filter((c) => unitCounts.has(c) || state.unit === c);
  const phenotypes = [...new Set<Phenotype>([...phenoCounts.keys(), ...(state.phenotype ? [state.phenotype] : [])])].sort();
  const filtered = state.unit !== null || state.kinds.length > 0 || state.phenotype !== null;

  const activeCount = (state.unit !== null ? 1 : 0) + (state.kinds.length > 0 ? 1 : 0) + (state.phenotype !== null ? 1 : 0);
  const summary = [
    state.unit !== null ? wardName(locale, state.unit) : t(locale, "feedAllUnits"),
    state.kinds.length > 0 ? state.kinds.map((k) => kindLabel(locale, k)).join(", ") : t(locale, "feedAllKinds"),
    state.phenotype !== null ? phenotypeName(state.phenotype) : t(locale, "feedAllPhenotypes"),
  ].join(" · ");
  const clearAll = () => onChange({ unit: null, kinds: [], phenotype: null });
  const showRows = !phone || filtersOpen;

  // After a filter change keep the open incident in view (its list position moves).
  const rootRef = useRef<HTMLElement>(null);
  const filterKey = `${state.unit}|${state.kinds.join(",")}|${state.phenotype}`;
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    const id = requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>('.feed-card[data-open="true"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
    return () => cancelAnimationFrame(id);
  }, [filterKey]);

  // The open incident's unit is lit in the panels; it follows the card (also when opened from the URL).
  const openFocus = useMemo(
    () => (state.incident ? (incidents.find((i) => i.key === state.incident)?.ward ?? null) : null),
    [incidents, state.incident],
  );
  useEffect(() => {
    if (load.status !== "ready" && state.incident) return;
    if (state.focus !== openFocus) onChange({ focus: openFocus });
  }, [load.status, state.incident, state.focus, openFocus, onChange]);

  const toggleKind = (k: SignalKind) =>
    onChange({ kinds: state.kinds.includes(k) ? state.kinds.filter((x) => x !== k) : [...state.kinds, k] });
  const card = (i: Incident) => (
    <li key={i.key}>
      <IncidentCard
        client={client}
        locale={locale}
        incident={i}
        open={state.incident === i.key}
        findings={findings}
        onToggle={(key) => onChange({ incident: key })}
        onChange={onChange}
        acknowledge={acknowledge}
      />
    </li>
  );

  return (
    <section ref={rootRef} className="feed" aria-labelledby="feed-title" aria-busy={load.status === "loading"}>
      <header className="feed-header">
        <div className="feed-headline">
          <h2 id="feed-title">{t(locale, "feedTitle")}</h2>
          {readyAsOf ? (
            <AsOf locale={locale} date={readyAsOf} pending={asOf !== null && asOf !== readyAsOf} clockDate={asOf ?? undefined} />
          ) : null}
        </div>
        {readyAsOf ? (
          <p className="feed-count">{t(locale, incidents.length === 1 ? "feedWindowOne" : "feedWindow", { n: incidents.length })}</p>
        ) : null}
        {readyAsOf && phone ? (
          <div className="feed-sumrow">
            <button
              type="button"
              className="feed-sum"
              aria-expanded={filtersOpen}
              aria-controls="feed-filter-rows"
              title={t(locale, filtersOpen ? "feedFiltersCollapseHint" : "feedFiltersExpandHint")}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <span className="feed-sum-text">
                <span className="feed-sum-label">{t(locale, "feedFiltersLabel")}</span> {summary}
              </span>
              {activeCount > 0 ? <span className="feed-sum-count">{t(locale, "feedFiltersActive", { n: activeCount })}</span> : null}
              <Chevron />
            </button>
            {filtered ? (
              <button type="button" className="link feed-sum-clear" onClick={clearAll}>
                {t(locale, "feedFiltersClear")}
              </button>
            ) : null}
          </div>
        ) : null}
        <div id="feed-filter-rows" className="feed-filters" role="group" aria-label={t(locale, "feedFilters")}>
          {readyAsOf && showRows ? (
            <>
              <ChipRow label={t(locale, "feedFilterUnit")}>
                {units.map((c) => (
                  <Chip
                    key={c}
                    title={wardName(locale, c)}
                    on={state.unit === c}
                    count={unitCounts.get(c) ?? 0}
                    onClick={() => onChange({ unit: state.unit === c ? null : c })}
                  >
                    {c}
                  </Chip>
                ))}
              </ChipRow>
              <ChipRow label={t(locale, "feedFilterKind")}>
                {KINDS.map((k) =>
                  k === "divergence" ? (
                    <span key={k} className="feed-chip" aria-disabled="true">
                      <KindGlyph kind={k} />
                      {kindLabel(locale, k)} <span className="feed-chip-note">({t(locale, "feedNoDetectorYet")})</span>
                    </span>
                  ) : (
                    <Chip key={k} on={state.kinds.includes(k)} count={kindCounts.get(k) ?? 0} onClick={() => toggleKind(k)}>
                      <KindGlyph kind={k} />
                      {kindLabel(locale, k)}
                    </Chip>
                  ),
                )}
              </ChipRow>
              <ChipRow label={t(locale, "feedFilterPhenotype")}>
                {phenotypes.map((p) => (
                  <Chip
                    key={p}
                    on={state.phenotype === p}
                    count={phenoCounts.get(p) ?? 0}
                    onClick={() => onChange({ phenotype: state.phenotype === p ? null : p })}
                  >
                    {phenotypeName(p)}
                  </Chip>
                ))}
              </ChipRow>
              {filtered ? (
                <button type="button" className="link feed-clear" onClick={clearAll}>
                  {t(locale, "feedClearFilters")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {load.status === "loading" ? (
        <ul className="feed-list">
          {[0, 1, 2].map((n) => (
            <li key={n} className="feed-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </li>
          ))}
        </ul>
      ) : load.status === "error" ? (
        <div className="feed-state" role="alert">
          <p>{t(locale, "feedError")}</p>
          <button type="button" className="feed-btn" onClick={() => setAttempt(attempt + 1)}>
            {t(locale, "retry")}
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="feed-state" role="status">
          {t(locale, "feedEmpty", { date: formatDate(locale, load.asOf, "long") })}
        </p>
      ) : (
        <>
          {pinned.length > 0 ? (
            <section className="feed-pinned" aria-labelledby="feed-pinned-title">
              <h3 id="feed-pinned-title">
                <button type="button" className="feed-pin-toggle" aria-expanded={pinnedOpen} onClick={() => setPinnedOpen(!pinnedOpen)}>
                  <KindGlyph kind="sentinel" />
                  {t(locale, "feedPinned")} · {pinned.length}
                  <Chevron />
                </button>
              </h3>
              {pinnedOpen ? <ul className="feed-list">{pinned.map(card)}</ul> : null}
            </section>
          ) : null}
          {rest.length > 0 ? (
            <>
              {pinned.length > 0 ? <h3 className="feed-others">{t(locale, "feedOthers")}</h3> : null}
              <ul className="feed-list">{rest.map(card)}</ul>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function countBy<T extends string>(list: readonly Incident[], keys: (i: Incident) => T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of list) for (const k of new Set(keys(i))) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="feed-chiprow" role="group" aria-label={label}>
      <span className="feed-chiplabel">{label}</span>
      <span className="feed-chips">{children}</span>
    </div>
  );
}

function Chip({
  on,
  count,
  title,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="feed-chip" aria-pressed={on} title={title} onClick={onClick}>
      {on ? <Check /> : null}
      {children}
      <span className="feed-chip-count">{count}</span>
    </button>
  );
}
