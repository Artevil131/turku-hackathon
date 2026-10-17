import { methods, parameterDefaults } from "@aei/methods";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { ExportBundle } from "./bundle.ts";
import { methodNumber, methodsNumbers, toMethodsParagraph } from "./methods.ts";
import { packageFiles } from "./package.ts";
import { toJson, toLatex, toMarkdown } from "./text.ts";
import { toDocx } from "./word.ts";

const bundle: ExportBundle = {
  title: "Study",
  generatedAt: "2026-10-17T12:00:00Z",
  asOf: "2025-05-12",
  scope: { units: ["URO"] },
  sourceNote: "Synthetic microbiology dataset",
  tables: [],
  figures: [],
  numbers: [methodNumber({ label: "Coverage", value: 0.9, parameters: { windowDays: 180 } }, "coverage")],
  methodIds: ["liveSignals"],
};

describe("generated Methods paragraph", () => {
  it("states the source, data cut, first-isolate rule, used methods, actual parameters and provenance", () => {
    const paragraph = toMethodsParagraph(bundle, "en");
    expect(paragraph).toContain("Synthetic microbiology dataset");
    expect(paragraph).toContain("2025-05-12");
    expect(paragraph).toContain("first isolate per patient, species and specimen type");
    expect(paragraph).toContain("over 180 days");
    expect(paragraph).toContain("windowDays=180 days (D-023)");
    expect(paragraph).toContain(`alpha=${parameterDefaults.profileExcess.alpha}`);
    for (const id of ["profileExcess", "phenotypeExcess", "samplingDrop", "emptyRun", "risingTrend"] as const)
      expect(paragraph).toContain(methods[id].name.en);
    expect(paragraph).toContain("D-044");
    expect(paragraph).toContain("0004");
    expect(paragraph).not.toContain(methods.newInUnitAlerts.name.en);
    expect(paragraph).not.toMatch(/\{\w+\}/);
  });

  it("localizes from the registry and expands coverage dependencies", () => {
    const paragraph = toMethodsParagraph({ ...bundle, numbers: [], methodIds: ["suggestCombinations"], locale: "fi" });
    expect(paragraph).toContain("Katkaisupäivä: 2025-05-12");
    expect(paragraph).toContain(methods.coverage.name.fi);
    expect(paragraph).toContain(methods.suggest.name.fi);
    expect(paragraph).toContain("Parametrit:");
    expect(paragraph).not.toContain(methods.profileExcess.name.fi);
  });

  it("does not collapse distinct parameter settings for the same method", () => {
    const paragraph = toMethodsParagraph({
      ...bundle,
      methodIds: [],
      numbers: [...bundle.numbers, methodNumber({ label: "Other coverage", value: 0.8, parameters: { windowDays: 90 } }, "coverage")],
    });
    expect(paragraph).toContain("windowDays=180");
    expect(paragraph).toContain("windowDays=90");
  });

  it("includes the paragraph in Markdown, LaTeX, Word and package README", async () => {
    const paragraph = toMethodsParagraph(bundle);
    expect(toMarkdown(bundle).data).toContain("## Methods");
    expect(toMarkdown(bundle).data).toContain("Data cut: 2025-05-12");
    const tex = String(toLatex({ ...bundle, methodIds: [...(bundle.methodIds ?? []), "suggestCombinations"] }).data);
    expect(tex).toContain("\\section*{Methods}");
    for (const symbol of ["\\ensuremath{\\geq}", "\\ensuremath{-}", "\\ensuremath{\\times}"]) expect(tex).toContain(symbol);
    expect(tex).not.toMatch(/[≥−×]/);
    const files = Object.fromEntries(packageFiles(bundle).map((file) => [file.path, file.data]));
    expect(files["README.md"]).toContain(paragraph);
    const docx = await toDocx(bundle);
    const zip = await JSZip.loadAsync(docx.data);
    const document = await zip.file("word/document.xml")?.async("string");
    expect(document).toContain("Methods");
    expect(document).toContain("Data cut: 2025-05-12");
    expect(document).toContain("windowDays=180");
  });

  it("writes the registry definition and authoritative decisions into methods.json and JSON", () => {
    const files = Object.fromEntries(packageFiles(bundle).map((file) => [file.path, file.data]));
    const numbers = JSON.parse(String(files["methods.json"]));
    expect(numbers[0].methodId).toBe("coverage");
    expect(numbers[0].decisions).toEqual(methods.coverage.decisions);
    expect(numbers[0].definition).toEqual(methods.coverage);
    expect(numbers[0].parameters.windowDays).toBe(180);
    expect(JSON.parse(String(toJson(bundle).data)).numbers).toEqual(numbers);
    expect(
      methodsNumbers({ ...bundle, numbers: [{ label: "X", value: 1, methodId: "coverage", decisions: ["wrong"] }] })[0]?.decisions,
    ).toEqual(methods.coverage.decisions);
  });

  it("does not invent a source or a registered method for legacy numbers", () => {
    const paragraph = toMethodsParagraph({
      ...bundle,
      sourceNote: undefined,
      asOf: undefined,
      numbers: [{ label: "X", value: 1, method: "external" }],
      methodIds: [],
    });
    expect(paragraph).toContain("Data source not specified");
    expect(paragraph).toContain("Data cut: not specified");
    expect(paragraph).not.toContain(bundle.generatedAt);
    expect(paragraph).toContain("external (no registered method id)");
    expect(paragraph).not.toContain("Poisson");
  });
});
