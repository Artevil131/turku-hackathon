import type { AeiClient, Alert, WeeklyResponse } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { useEffect, useState } from "react";
import { DEFAULT_LAYERS } from "../../../hero/layers.ts";
import type { BandRange } from "../../../hero/useBandRange.ts";
import { WeeklyBand } from "../../../hero/WeeklyBand.tsx";
import type { Slice } from "../../tools/model.ts";

// A timeline cell: the weekly band (resistant finds by phenotype, cultures, one lane per unit, the alerts as pills)
// for the slice above's hospital, over the cell's own window. Dragging weeks on the band writes them to that slice
// cell, never to the page's timeline (the hash); the slice is then the shaded range, and "Fit" zooms the band to it.
// While the window is the slice itself nothing is shaded, so a drag draws a new range (one inside a range moves it).

type Load = { status: "loading" } | { status: "ready"; weekly: WeeklyResponse; alerts: Alert[] } | { status: "error"; message: string };

export function TimelineCellBody({
  client,
  locale,
  asOf,
  slice,
  sliceN,
  window: win,
  onRange,
  onFit,
  onAddSlice,
}: {
  client: AeiClient;
  locale: Locale;
  asOf: string | null;
  slice: Slice | null;
  sliceN: number;
  window: { from: string; to: string };
  /** A range chosen on the band: the slice cell's new dates. */
  onRange: (r: BandRange) => void;
  /** Sets the window to the slice's own dates. */
  onFit: () => void;
  onAddSlice: () => void;
}) {
  const site = slice?.site;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: asOf is a trigger: the clock moving on adds weeks inside the window.
  useEffect(() => {
    let stale = false;
    setLoad({ status: "loading" });
    const q = { from: win.from, ...(site ? { site } : {}) };
    Promise.all([client.weekly(q), client.alerts(q)])
      .then(([weekly, a]) => {
        if (!stale) setLoad({ status: "ready", weekly, alerts: a.alerts.filter((x) => x.date <= win.to) });
      })
      .catch((e: unknown) => {
        if (!stale) setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      stale = true;
    };
  }, [client, win.from, win.to, site, asOf]);

  if (!slice)
    return (
      <div className="nb-timeline">
        <p className="tl-warn">{t(locale, "nbNoSlice")}</p>
        <button type="button" className="btn" onClick={onAddSlice}>
          {t(locale, "nbAddSliceAbove")}
        </button>
      </div>
    );
  const end = asOf && asOf < win.to ? asOf : win.to;
  const fitted = win.from === slice.from && win.to === slice.to;
  return (
    <div className="nb-timeline">
      <div className="nb-timeline-head">
        <p className="nb-muted">
          {formatDate(locale, win.from)} – {formatDate(locale, end, "long")} · {t(locale, "nbTimelineRange", { n: sliceN })}
        </p>
        <button type="button" className="btn nb-small" disabled={fitted} onClick={onFit}>
          {t(locale, "nbTimelineFit", { n: sliceN })}
        </button>
      </div>
      {load.status === "ready" ? (
        <div className="nb-band">
          <WeeklyBand
            locale={locale}
            start={win.from}
            asOf={end}
            weekly={load.weekly}
            alerts={load.alerts}
            layers={DEFAULT_LAYERS}
            label={t(locale, "tlStream")}
            range={fitted ? null : { from: slice.from, to: slice.to }}
            onRange={(r) => {
              if (r) onRange(r);
            }}
          />
        </div>
      ) : (
        <p className={load.status === "error" ? "tl-warn" : "tl-wait"} role={load.status === "error" ? "alert" : "status"}>
          {load.status === "error" ? t(locale, "toolsError", { error: load.message }) : t(locale, "chartLoading")}
        </p>
      )}
    </div>
  );
}
