import type { AeiClient } from "@aei/contract";
import { antibioticName, type Locale, t } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import { type Compared, compareRows, type Frame, fetchCompare, overlaps, presetFrames, validFrame } from "./compare.ts";
import { certaintyOf, coverageQuery, type DoctorFilters, dmy, num, type Period, pct } from "./filters.ts";
import "./RecordStrip.css";
import "./CompareBar.css";

// The timeframe: one control, "4 weeks | 90 days | year", with "vs rest of year" on by default and a Custom pair of
// dates. Under it the antibiotics whose covered share changed; the rest wait behind "show all".

interface Props {
  client: Pick<AeiClient, "coverage">;
  locale: Locale;
  filters: DoctorFilters;
  asOf: string | null;
  onPeriod: (period: Period) => void;
}

const PERIODS: readonly Period[] = [28, 90, 365];
const range = (f: Frame) => `${dmy(f.from)}–${dmy(f.to)}`;

export function CompareBar({ client, locale, filters, asOf, onPeriod }: Props) {
  const [vs, setVs] = useState(true);
  const [custom, setCustom] = useState<{ a: Frame; b: Frame } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [result, setResult] = useState<{ key: string; data: Compared | null; failed: boolean } | null>(null);

  const frames = useMemo(() => {
    if (custom) return validFrame(custom.a) && validFrame(custom.b) ? custom : null;
    if (!asOf || !vs || filters.period >= 365) return null;
    const p = presetFrames(asOf, filters.period);
    return p.b ? { a: p.a, b: p.b } : null;
  }, [custom, asOf, vs, filters.period]);

  // Every filter but the window, which each frame sets for itself.
  const base = useMemo(() => {
    const { windowDays: _days, ...rest } = coverageQuery(filters);
    return rest;
  }, [filters]);
  const key = frames ? JSON.stringify([base, frames]) : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the base query and the frames.
  useEffect(() => {
    if (!frames) return;
    let stale = false;
    fetchCompare(client, base, frames.a, frames.b)
      .then((data) => {
        if (!stale) setResult({ key, data, failed: false });
      })
      .catch(() => {
        if (!stale) setResult({ key, data: null, failed: true });
      });
    return () => {
      stale = true;
    };
  }, [client, key]);

  const startCustom = () => {
    if (custom) return;
    const p = presetFrames(asOf ?? new Date().toISOString().slice(0, 10), 28);
    if (p.b) setCustom({ a: p.a, b: p.b });
  };
  const setFrame = (which: "a" | "b", part: "from" | "to", value: string) =>
    setCustom((c) => (c ? { ...c, [which]: { ...c[which], [part]: value } } : c));

  const current = frames && result && result.key === key ? result : null;
  const independent = frames ? !overlaps(frames.a, frames.b) : true;
  const rows = useMemo(() => (current?.data ? compareRows(current.data.a, current.data.b, independent) : []), [current, independent]);
  // Collapse only where marking means something: a descriptive pair shows every row.
  const marked = rows.filter((r) => r.marked);
  const shown = !independent || showAll ? rows : marked;

  return (
    <section className="cmp" aria-label={t(locale, "drPeriod")}>
      <div className="cmp-bar">
        <div className="rs-choices" role="group" aria-label={t(locale, "drPeriod")}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className="rs-choice"
              data-period={p}
              aria-pressed={!custom && filters.period === p}
              onClick={() => {
                setCustom(null);
                onPeriod(p);
              }}
            >
              {t(locale, p === 28 ? "drPeriodMonthShort" : p === 90 ? "drPeriodDays" : "drCmpYear", { days: 90 })}
            </button>
          ))}
          <button type="button" className="rs-choice" data-period="custom" aria-pressed={!!custom} onClick={startCustom}>
            {t(locale, "drCmpCustom")}
          </button>
        </div>
        {!custom && filters.period < 365 ? (
          <label className="cmp-vs">
            <input type="checkbox" checked={vs} onChange={(e) => setVs(e.target.checked)} />
            {t(locale, "drCmpVsRest")}
          </label>
        ) : null}
        {custom && !independent && frames ? <span className="cmp-tag">{t(locale, "drCmpDescriptive")}</span> : null}
      </div>

      {custom ? (
        <div className="cmp-dates">
          {(["a", "b"] as const).map((w) => (
            <fieldset key={w} className="cmp-frame">
              <legend>{t(locale, w === "a" ? "drCmpA" : "drCmpB")}</legend>
              <input
                type="date"
                aria-label={t(locale, "drCmpFrom")}
                value={custom[w].from}
                max={asOf ?? undefined}
                onChange={(e) => setFrame(w, "from", e.target.value)}
              />
              <input
                type="date"
                aria-label={t(locale, "drCmpTo")}
                value={custom[w].to}
                max={asOf ?? undefined}
                onChange={(e) => setFrame(w, "to", e.target.value)}
              />
            </fieldset>
          ))}
        </div>
      ) : null}

      {frames ? (
        <div className="cmp-body" aria-busy={!current}>
          {current?.failed ? (
            <p role="alert">{t(locale, "drError")}</p>
          ) : !current?.data ? (
            <p className="cmp-note">{t(locale, "drCmpLoading")}</p>
          ) : (
            <>
              <p className="cmp-head">
                <span>
                  <b>{t(locale, "drCmpA")}</b> {range(frames.a)}
                </span>
                <span>
                  <b>{t(locale, "drCmpB")}</b> {range(frames.b)}
                </span>
                <span className="cmp-level" title={t(locale, certaintyOf(current.data.level).label)}>
                  {t(locale, certaintyOf(current.data.level).short)}
                </span>
              </p>
              {shown.length === 0 ? <p className="cmp-note">{t(locale, "drCmpNoChange")}</p> : null}
              <ul className="cmp-rows">
                {shown.map((r) => {
                  const points = r.diff === null ? "" : `${r.diff > 0 ? "+" : r.diff < 0 ? "−" : ""}${Math.abs(Math.round(r.diff * 100))}`;
                  return (
                    <li
                      key={r.antibiotic}
                      className="cmp-row"
                      data-marked={r.marked || undefined}
                      data-dir={r.diff === null ? undefined : Math.sign(r.diff)}
                    >
                      <b>{antibioticName(locale, r.antibiotic as never)}</b>
                      <span className="num">
                        {r.a.known ? `${pct(r.a.covered / r.a.known)} %` : "–"}
                        <small> n {num(locale, r.a.known)}</small>
                      </span>
                      <span className="num">
                        {r.b.known ? `${pct(r.b.covered / r.b.known)} %` : "–"}
                        <small> n {num(locale, r.b.known)}</small>
                      </span>
                      <span className="cmp-diff num">{r.diff === null ? "–" : t(locale, "drCmpPts", { n: points })}</span>
                    </li>
                  );
                })}
              </ul>
              {independent && rows.length > marked.length ? (
                <button type="button" className="cmp-all" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                  {t(locale, showAll ? "drCmpHide" : "drCmpShowAll", { n: rows.length })}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
