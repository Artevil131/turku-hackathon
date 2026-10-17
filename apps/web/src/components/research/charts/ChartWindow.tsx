import type { AeiClient } from "@aei/contract";
import { figureSvgFile, toCsv } from "@aei/export";
import { type Locale, t } from "@aei/i18n";
import { useRef, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import { BetaCurve } from "../tools/Charts.tsx";
import { copyPng, saveBlob, standaloneSvg, svgToPng } from "./exportSvg.ts";
import { Bars, type Period, ShareChart, SmallMultiples } from "./Figures.tsx";
import { type ChartData, chartAria, chartTable, chartTitle, hasData, pct } from "./model.ts";
import type { ChartSpec, Frame } from "./spec.ts";
import { useChartData } from "./useChartData.ts";
import "./charts.css";

// One chart window (VISION.md "The workbench"): a title in words, the figure, a readout line, and the export
// footer. The window shows what `useChartData` returns for its spec; picking a period or a unit sends it out.

export interface ChartViewProps {
  spec: ChartSpec;
  data: ChartData;
  locale: Locale;
  asOf: string | null;
  /** A period of the share line or the bars was clicked: it becomes the Tools slice. */
  onPeriod?: (frame: Frame) => void;
  /** A unit panel was clicked: it is selected in the board. */
  onUnit?: (unit: string) => void;
}

const sentence = (locale: Locale, d: ChartData): string | null => {
  if (d.type !== "beta") return null;
  const b = d.result.posterior;
  return t(locale, "chartBetaWords", {
    k: d.result.k,
    n: d.result.n,
    mean: pct(b.mean, locale),
    range: `${pct(b.interval.lo, locale)}–${pct(b.interval.hi, locale)}`,
  });
};

export function ChartView({ spec, data, locale, asOf, onPeriod, onUnit }: ChartViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const title = chartTitle(locale, spec, asOf);
  const aria = chartAria(locale, title, data);
  const pick = (p: Period) => onPeriod?.({ from: p.from, to: p.to });
  const exportSvg = () => {
    const svg = root.current?.querySelector<SVGSVGElement>("svg[role='img']");
    if (svg) downloadFile(figureSvgFile({ name: `chart-${spec.type}-${spec.event}`, title, svg: standaloneSvg(svg) }));
  };
  const exportCsv = () => downloadFile(toCsv(chartTable(data)));
  // The figure as a PNG: on the clipboard (pasted into a slide or a message) or as a file.
  const [imageState, setImageState] = useState<"idle" | "copied" | "saved">("idle");
  const png = () => {
    const svg = root.current?.querySelector<SVGSVGElement>("svg[role='img']");
    return svg ? svgToPng(standaloneSvg(svg)) : Promise.reject(new Error("no figure"));
  };
  const pngName = `chart-${spec.type}-${spec.event}${asOf ? `-${asOf}` : ""}.png`;
  const copyImage = () =>
    png()
      .then((blob) => copyPng(blob, pngName))
      .then((how) => {
        setImageState(how);
        setTimeout(() => setImageState("idle"), 1800);
      })
      .catch(() => undefined);
  const downloadPng = () =>
    png()
      .then((blob) => saveBlob(blob, pngName))
      .catch(() => undefined);
  return (
    <article className="ch" aria-label={title} data-type={spec.type}>
      <header className="ch-head">
        <h2>{title}</h2>
        {spec.firstOnly ? <p className="ch-sub">{t(locale, "toolsFirstYes")}</p> : null}
      </header>
      <div className="ch-body" ref={root}>
        {!hasData(data) ? (
          <p className="ch-empty">{t(locale, "chartNoData")}</p>
        ) : data.type === "share" ? (
          <ShareChart points={data.result.points} locale={locale} aria={aria} onPick={pick} />
        ) : data.type === "bars" ? (
          <Bars points={data.result.points} locale={locale} aria={aria} onPick={pick} />
        ) : data.type === "beta" ? (
          <>
            <BetaCurve flat={data.result.posterior} discounted={null} locale={locale} aria={aria} />
            <p className="ch-read">{sentence(locale, data)}</p>
          </>
        ) : data.type === "multiples" ? (
          <SmallMultiples
            units={data.units.map((u) => ({ unit: u.unit, points: u.result.points }))}
            locale={locale}
            aria={aria}
            onPick={onUnit}
          />
        ) : null}
      </div>
      <footer className="ch-foot">
        <button type="button" className="btn" disabled={!hasData(data)} onClick={copyImage} aria-live="polite">
          {imageState === "copied"
            ? t(locale, "chartCopied")
            : imageState === "saved"
              ? t(locale, "chartSaved")
              : t(locale, "chartCopyImage")}
        </button>
        <button type="button" className="btn" disabled={!hasData(data)} onClick={downloadPng}>
          {t(locale, "chartDownloadPng")}
        </button>
        <button type="button" className="btn" disabled={!hasData(data)} onClick={exportSvg}>
          {t(locale, "chartExportSvg")}
        </button>
        <button type="button" className="btn" disabled={!hasData(data)} onClick={exportCsv}>
          {t(locale, "chartExportCsv")}
        </button>
      </footer>
    </article>
  );
}

export function ChartWindow({
  client,
  locale,
  asOf,
  spec,
  onPeriod,
  onUnit,
}: {
  client: AeiClient;
  locale: Locale;
  asOf: string | null;
  spec: ChartSpec;
  onPeriod?: (frame: Frame) => void;
  onUnit?: (unit: string) => void;
}) {
  const load = useChartData(client, spec, asOf);
  if (load.status === "ready")
    return <ChartView spec={spec} data={load.data} locale={locale} asOf={asOf} onPeriod={onPeriod} onUnit={onUnit} />;
  return (
    <article className="ch" aria-label={chartTitle(locale, spec, asOf)} aria-busy={load.status === "loading"}>
      <header className="ch-head">
        <h2>{chartTitle(locale, spec, asOf)}</h2>
      </header>
      <p className={load.status === "error" ? "ch-empty ch-error" : "ch-empty"} role={load.status === "error" ? "alert" : "status"}>
        {load.status === "error"
          ? t(locale, "toolsError", { error: load.message })
          : t(locale, load.status === "waiting" ? "toolsNoClock" : "chartLoading")}
      </p>
    </article>
  );
}
