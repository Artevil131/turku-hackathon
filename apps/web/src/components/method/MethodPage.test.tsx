import type { AeiClient } from "@aei/contract";
import { fillSentence, methods, registry } from "@aei/methods";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveRulesMath } from "./MethodMath.tsx";
import { MethodPage } from "./MethodPage.tsx";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
}

describe("registry-driven Method page", () => {
  for (const locale of ["en", "fi"] as const) {
    it(`renders all definitions and retains the experiment figures in ${locale}`, () => {
      // No effects/API calls run in SSR; only the explanatory registry is needed.
      const html = renderToStaticMarkup(<MethodPage client={{} as AeiClient} locale={locale} asOf={null} />);
      for (const method of registry) {
        expect(html).toContain(`id="method-${method.id}"`);
        expect(html).toContain(escapeHtml(method.name[locale]));
        expect(html).toContain(escapeHtml(fillSentence(method, {}, locale)));
        for (const decision of method.decisions) expect(html).toContain(decision);
      }
      for (const id of ["0012", "0013", "0014", "0015", "0016", "0018", "0019", "0020"]) expect(html).toContain(`/method/${id}.`);
    });

    it(`uses registry explanations in the existing live formulas in ${locale}`, () => {
      const html = renderToStaticMarkup(
        <LiveRulesMath locale={locale} rules={["wilson", "poisson", "drop", "empty", "trend", "sentinel"]} />,
      );
      for (const id of [
        "coverage",
        "profileExcess",
        "phenotypeExcess",
        "samplingDrop",
        "emptyRun",
        "risingTrend",
        "newInUnitAlerts",
      ] as const)
        expect(html).toContain(escapeHtml(fillSentence(methods[id], {}, locale)));
    });
  }
});
