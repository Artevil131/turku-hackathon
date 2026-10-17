import type { AeiClient } from "@aei/contract";
import type { Locale } from "@aei/i18n";
import { ChartWindow } from "../../charts/ChartWindow.tsx";
import type { ChartSpec } from "../../charts/spec.ts";

// A chart cell: the chart window's figure for a result's spec (specFromResult), with its Export SVG and CSV.

export function ChartCellBody({ client, locale, asOf, spec }: { client: AeiClient; locale: Locale; asOf: string | null; spec: ChartSpec }) {
  return (
    <div className="nb-chart">
      <ChartWindow client={client} locale={locale} asOf={asOf} spec={spec} />
    </div>
  );
}
