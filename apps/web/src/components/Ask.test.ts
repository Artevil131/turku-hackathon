import { type AskResponse, createAeiClient } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Question } from "../ai.ts";
import { AlertExplanation } from "./AlertExplanation.tsx";
import { Ask, AskedResults } from "./Ask.tsx";

const answer: AskResponse = {
  asOf: "2025-05-01",
  filters: {
    ward: "ICU",
    specimen: "urine",
    organism: "Escherichia coli",
    sex: "M",
    ageMin: 0,
    ageMax: 17,
    from: "2025-02-02",
    to: "2025-05-01",
  },
  ageGroup: "child",
  unmatched: ["mystery"],
};
const question: Question = {
  available: true,
  answer,
  parsed: answer,
  active: true,
  records: [],
  loading: false,
  loadError: false,
  pending: false,
  error: false,
  ask: async () => {},
  remove: () => {},
  clear: () => {},
};

describe("assistant presentation", () => {
  it("shows translated, removable chips including age zero and unmatched words", () => {
    const en = renderToStaticMarkup(createElement(Ask, { locale: "en", question }));
    const fi = renderToStaticMarkup(createElement(Ask, { locale: "fi", question }));
    expect(en).toContain("Remove filter: Intensive care unit");
    expect(en).toContain("children · 0–17 y");
    expect(en).toContain("Not understood: mystery");
    expect(fi).toContain("Poista rajaus: Teho-osasto");
    expect(fi).toContain("lapset · 0–17 v");
    expect(fi).toContain("Ei ymmärretty: mystery");
  });
  it("hides an unavailable field and exposes loading and recovery states", () => {
    expect(
      renderToStaticMarkup(
        createElement(Ask, { locale: "en", question: { ...question, available: false, active: false, answer: null, parsed: null } }),
      ),
    ).toBe("");
    const pending = renderToStaticMarkup(createElement(Ask, { locale: "en", question: { ...question, pending: true } }));
    expect(pending).toContain("Understanding…");
    expect(pending).toContain("disabled");
    expect(renderToStaticMarkup(createElement(Ask, { locale: "fi", question: { ...question, error: true } }))).toContain("Käytä rajauksia");
  });
  it("shows measured counts and records, never resistance percentages", () => {
    const records: IsolateRecord[] = Array.from({ length: 60 }, (_, i) => ({
      isolateId: `i${i}`,
      cultureId: `c${i}`,
      patientId: `p${i % 40}`,
      sampleDate: "2025-05-01",
      admissionDate: null,
      ward: "ICU",
      specimen: "urine",
      organism: "Escherichia coli",
      sex: "M",
      ageYears: 75,
      homeArea: "North",
      phenotypes: [],
      results: { AMP: i < 25 ? "S" : "R" },
    }));
    const render = (records: IsolateRecord[]) =>
      renderToStaticMarkup(createElement(AskedResults, { locale: "en", records, loading: false, error: false }));
    const html = render(records);
    expect(html).toContain("60 isolates from 40 patients match");
    expect(html).not.toContain("%");
    expect(html.match(/<tr>/g)?.length).toBe(51); // header + the newest 50
    expect(html).toContain("Newest 50 shown");
    expect(render([])).toContain("No isolates match these filters");
  });
  it("offers Explain even when no AI is configured", () => {
    // Initial markup must not call the network; fetching is explicitly user-triggered.
    const client = createAeiClient({
      baseUrl: "",
      fetch: async () => {
        throw new Error("unexpected request");
      },
    });
    expect(renderToStaticMarkup(createElement(AlertExplanation, { client, id: "cpe:i", locale: "en" }))).toContain("Explain");
    expect(renderToStaticMarkup(createElement(AlertExplanation, { client, id: "cpe:i", locale: "fi" }))).toContain("Selitä");
  });
});
