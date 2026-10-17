import { readFileSync } from "node:fs";
import { NEW_IN_UNIT_DAYS, NEW_IN_UNIT_PHENOTYPES, SAMPLING_DROP_SUPPRESSION_DAYS } from "@aei/alerts";
import { COMBINATION_LIMIT, COVERAGE_DEFAULTS, MAX_UNTESTED, MIN_PARTNER_GAIN, RECENT_DAYS, THRESHOLDS, WILSON_Z } from "@aei/coverage";
import { EPISODE_DAYS, LIVE_PHENOTYPES, LIVE_SETTINGS, MIN_BASELINE_ISOLATES, PROFILE_SMOOTHING, SURVEILLANCE_PAIRS } from "@aei/detect";
import { describe, expect, it } from "vitest";
import { defaultsFor, fillSentence, methods, registry, registryJson } from "./index.ts";

it("has each public live method once, plus the three export counts", () => {
  expect(registry.map((entry) => entry.id)).toEqual([
    "profileExcess",
    "phenotypeExcess",
    "samplingDrop",
    "emptyRun",
    "risingTrend",
    "liveSignals",
    "cpeAlerts",
    "newInUnitAlerts",
    "coverage",
    "suggest",
    "suggestCombinations",
    "isolates",
    "patients",
    "alerts",
  ]);
  expect(new Set(registry.map((entry) => entry.id)).size).toBe(registry.length);
});

it("takes every registered default from its executing gear", () => {
  const expected = {
    profileExcess: { ...LIVE_SETTINGS.profileExcess, minBaseline: MIN_BASELINE_ISOLATES, smoothing: PROFILE_SMOOTHING },
    phenotypeExcess: {
      ...LIVE_SETTINGS.phenotypeExcess,
      phenotypes: LIVE_PHENOTYPES,
      minBaseline: MIN_BASELINE_ISOLATES,
      smoothing: PROFILE_SMOOTHING,
    },
    samplingDrop: LIVE_SETTINGS.samplingDrop,
    emptyRun: LIVE_SETTINGS.emptyRun,
    risingTrend: { ...LIVE_SETTINGS.risingTrend, pairs: SURVEILLANCE_PAIRS },
    liveSignals: {},
    cpeAlerts: {},
    newInUnitAlerts: { phenotypes: NEW_IN_UNIT_PHENOTYPES, lookbackDays: NEW_IN_UNIT_DAYS },
    coverage: { ...COVERAGE_DEFAULTS, recentDays: RECENT_DAYS, wilsonZ: WILSON_Z },
    suggest: { mild: THRESHOLDS.mild, severe: THRESHOLDS.severe, maxUntested: MAX_UNTESTED },
    suggestCombinations: { limit: COMBINATION_LIMIT, minPartnerGain: MIN_PARTNER_GAIN, maxUntested: MAX_UNTESTED },
    isolates: {},
    patients: {},
    alerts: { episodeDays: EPISODE_DAYS, samplingDropSuppressionDays: SAMPLING_DROP_SUPPRESSION_DAYS },
  };
  for (const method of registry) expect(defaultsFor(method.id), method.id).toEqual(expected[method.id]);
});

it("fills named values, defaults and both locales without interpreting replacement syntax", () => {
  expect(fillSentence(methods.samplingDrop, { windowDays: 9 }, "en")).toContain("over 9 days");
  expect(fillSentence(methods.samplingDrop, {}, "fi")).toContain(`${LIVE_SETTINGS.samplingDrop.windowDays} päivältä`);
  const entry = { ...methods.isolates, sentence: { en: "{observed}/{expected}", fi: "{observed}/{expected}" } };
  expect(fillSentence(entry, { observed: 0, expected: "$&" })).toBe("0/$&");
});

it("writes every filled sentence in words, never as JSON, in both locales", () => {
  for (const method of registry)
    for (const locale of ["en", "fi"] as const) {
      const sentence = fillSentence(method, {}, locale);
      expect(sentence, `${method.id} ${locale}`).not.toMatch(/[[\]"{}]/);
    }
  expect(fillSentence(methods.phenotypeExcess, {}, "en")).toContain("ESBL, MRSA, VRE and CPE");
  expect(fillSentence(methods.phenotypeExcess, {}, "fi")).toContain("ESBL, MRSA, VRE ja CPE");
});

it("has complete localized text, parameter provenance and no unresolved default placeholders", () => {
  for (const method of registry) {
    expect(method.gear.module).toMatch(/^@aei\//);
    expect(method.decisions.length).toBeGreaterThan(0);
    for (const locale of ["en", "fi"] as const) {
      expect(method.name[locale]).not.toBe("");
      expect(fillSentence(method, {}, locale)).not.toMatch(/\{\w+\}/);
      for (const parameter of method.parameters) {
        expect(parameter.description[locale]).not.toBe("");
        expect(parameter.decision).toMatch(/^D-\d{3}$/);
      }
    }
  }
});

describe("language-neutral package data", () => {
  for (const path of ["../registry.json", "../../py/aei/registry.json", "../../r/inst/registry.json"]) {
    it(`${path} is up to date (regenerate with scripts/sync-methods-registry.ts)`, () => {
      const contents = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(JSON.parse(contents)).toEqual(JSON.parse(registryJson()));
      expect(contents).toBe(readFileSync(new URL("../registry.json", import.meta.url), "utf8"));
    });
  }
});
