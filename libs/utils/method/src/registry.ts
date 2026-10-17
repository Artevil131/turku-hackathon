import { NEW_IN_UNIT_DAYS } from "@aei/alerts";
import { LIVE_SETTINGS, SURVEILLANCE_PAIRS } from "@aei/detect";

// One source of truth for what each detector computes (D-075). The signal card's ⓘ reads
// it now; the Method page, the research package and the notebook are meant to read the same
// entries, so the screen, the package and the notebook cannot describe different tests.
// Formulas follow ENGINE.md A3; constants are read from the live settings, never retyped
// (except where the code keeps a number out of the settings, marked below).

export type MethodId = "profile-excess" | "phenotype-excess" | "sampling-drop" | "empty-run" | "rising-trend" | "cpe" | "new-in-unit";

export interface Method {
  id: MethodId;
  /** The test's name, as a statistician would say it. */
  name: { en: string; fi: string };
  /** The formula as LaTeX source, for copying into a paper or a notebook. */
  latex: string;
  /** The same formula as MathML, rendered by the browser on the card and the Method page (no library). */
  mathml: string;
  /** One line in plain words, in each language. */
  plain: { en: string; fi: string };
  /** Constants with their values from the live settings and the decision that set them. */
  constants: { name: string; value: number | string; decision: string }[];
  /** Where it runs: repo-relative TypeScript path and function; the Python function in `aei.detect` ("" if none). */
  code: { ts: string; fn: string; py: string };
  decisions: string[];
  /**
   * A Python snippet for the notebook. The placeholders {ward}, {organism}, {from} and {to} are
   * filled by `fillSnippet`. It reads the live set (`live_signals`) and keeps this detector's signals.
   */
  snippet: string;
}

const { profileExcess, phenotypeExcess, samplingDrop, emptyRun, risingTrend } = LIVE_SETTINGS;

/** The baseline floor of the excess detectors: the code keeps it beside the test, not in LIVE_SETTINGS (detectors.ts). */
const MIN_BASELINE_ISOLATES = 50;

/** The Python line that keeps this detector's signals of the live set, filtered to the card's unit, organism and dates. */
const liveSnippet = (detector: string, filter: string) =>
  [
    "from aei.detect import live_signals",
    "signals = [",
    `    s for s in live_signals(records, cultures)`,
    `    if s.detector == "${detector}"${filter}`,
    "]",
  ].join("\n");

const DATES = ` and "{from}" <= s.date <= "{to}"`;

export const METHODS: Record<MethodId, Method> = {
  "profile-excess": {
    id: "profile-excess",
    name: { en: "Poisson upper tail, hospital-wide baseline", fi: "Poisson-jakauman yläpää, koko sairaalan perustaso" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>μ</mi><mo>=</mo><msub><mi>n</mi><mtext>unit</mtext></msub><mo>·</mo><mfrac><mrow><msub><mi>B</mi><mtext>profile</mtext></msub><mo>+</mo><mfrac><mn>1</mn><mn>2</mn></mfrac></mrow><mrow><msub><mi>B</mi><mtext>all</mtext></msub><mo>+</mo><mn>1</mn></mrow></mfrac><mo>,</mo><mspace width="1em"/><mi>P</mi><mo>(</mo><mi>Y</mi><mo>≥</mo><mi>y</mi><mo>∣</mo><mi>Y</mi><mo>∼</mo><mi mathvariant="normal">Poisson</mi><mo>(</mo><mi>μ</mi><mo>)</mo><mo>)</mo><mo>&lt;</mo><mi>α</mi></mrow></math>',
    latex:
      "y = \\#\\{\\text{patients in this unit with the profile}\\},\\quad \\mu = n_{\\text{unit}}\\cdot\\frac{B_{\\text{profile}}+\\tfrac12}{B_{\\text{all}}+1},\\quad \\text{signal if } P(Y \\ge y \\mid Y\\sim\\mathrm{Poisson}(\\mu)) < \\alpha",
    plain: {
      en: "Patients in this unit with the same resistance profile in the last 28 days, against how often that profile appeared across the hospital in the year before, scaled to this unit's patients.",
      fi: "Tämän osaston potilaat, joilla on sama resistenssiprofiili viimeisen 28 päivän aikana, verrattuna siihen, kuinka usein profiili esiintyi koko sairaalassa edellisenä vuonna, skaalattuna osaston potilasmäärään.",
    },
    constants: [
      { name: "window days", value: profileExcess.windowDays, decision: "D-020" },
      { name: "baseline days", value: profileExcess.baselineDays, decision: "D-020" },
      { name: "alpha", value: profileExcess.alpha, decision: "D-020" },
      { name: "min patients", value: profileExcess.minObserved, decision: "D-020" },
      { name: "min baseline isolates", value: MIN_BASELINE_ISOLATES, decision: "D-020" },
      { name: "stratum", value: "organism and specimen", decision: "D-020" },
    ],
    code: { ts: "libs/utils/detect/src/detectors.ts", fn: "profileExcess", py: "aei.detect.profile_excess" },
    decisions: ["D-020", "D-042"],
    snippet: liveSnippet("profile-excess", ` and s.ward == "{ward}" and s.organism == "{organism}"${DATES}`),
  },
  "phenotype-excess": {
    id: "phenotype-excess",
    name: { en: "Poisson upper tail, the unit's own baseline", fi: "Poisson-jakauman yläpää, osaston oma perustaso" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>μ</mi><mo>=</mo><msub><mi>n</mi><mtext>unit</mtext></msub><mo>·</mo><mfrac><mrow><msub><mi>B</mi><mtext>unit</mtext></msub><mo>+</mo><mfrac><mn>1</mn><mn>2</mn></mfrac></mrow><mrow><mi>B</mi><mo>+</mo><mn>1</mn></mrow></mfrac><mo>,</mo><mspace width="1em"/><mi>P</mi><mo>(</mo><mi>Y</mi><mo>≥</mo><mi>y</mi><mo>∣</mo><mi>Y</mi><mo>∼</mo><mi mathvariant="normal">Poisson</mi><mo>(</mo><mi>μ</mi><mo>)</mo><mo>)</mo><mo>&lt;</mo><mi>α</mi></mrow></math>',
    latex:
      "y = \\#\\{\\text{patients in this unit with the phenotype}\\},\\quad \\mu = n_{\\text{unit}}\\cdot\\frac{B_{\\text{unit}}+\\tfrac12}{B+1},\\quad \\text{signal if } P(Y \\ge y \\mid Y\\sim\\mathrm{Poisson}(\\mu)) < \\alpha",
    plain: {
      en: "Patients in this unit with an ESBL, MRSA, VRE or CPE finding in the last 28 days, against this unit's own share of that finding over the year before.",
      fi: "Tämän osaston potilaat, joilla on ESBL-, MRSA-, VRE- tai CPE-löydös viimeisen 28 päivän aikana, verrattuna osaston oman osuuteen tästä löydöksestä edellisenä vuonna.",
    },
    constants: [
      { name: "window days", value: phenotypeExcess.windowDays, decision: "D-020" },
      { name: "baseline days", value: phenotypeExcess.baselineDays, decision: "D-020" },
      { name: "alpha", value: phenotypeExcess.alpha, decision: "D-020" },
      { name: "min patients", value: phenotypeExcess.minObserved, decision: "D-020" },
      { name: "min baseline isolates", value: MIN_BASELINE_ISOLATES, decision: "D-020" },
    ],
    code: { ts: "libs/utils/detect/src/detectors.ts", fn: "phenotypeExcess", py: "aei.detect.phenotype_excess" },
    decisions: ["D-020", "D-042"],
    snippet: liveSnippet("phenotype-excess", ` and s.ward == "{ward}"${DATES}`),
  },
  "sampling-drop": {
    id: "sampling-drop",
    name: { en: "Poisson lower tail", fi: "Poisson-jakauman alapää" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>y</mi><mo>=</mo><msub><mi>c</mi><mn>7</mn></msub><mo>,</mo><mspace width="1em"/><mi>μ</mi><mo>=</mo><mn>7</mn><mo>·</mo><mfrac><msub><mi>c</mi><mn>56</mn></msub><mn>56</mn></mfrac><mo>,</mo><mspace width="1em"/><mi>P</mi><mo>(</mo><mi>Y</mi><mo>≤</mo><mi>y</mi><mo>∣</mo><mi>Y</mi><mo>∼</mo><mi mathvariant="normal">Poisson</mi><mo>(</mo><mi>μ</mi><mo>)</mo><mo>)</mo><mo>&lt;</mo><mi>α</mi></mrow></math>',
    latex:
      "y = c_{7},\\quad \\mu = 7\\cdot\\frac{c_{56}}{56},\\quad \\text{signal if } P(Y \\le y \\mid Y\\sim\\mathrm{Poisson}(\\mu)) < \\alpha",
    plain: {
      en: "Cultures this unit sent in the last 7 days, against its usual week, the mean daily count over the 56 days before, times 7.",
      fi: "Tämän osaston viimeisen 7 päivän viljelyt verrattuna tavalliseen viikkoon, eli 56 edellisen päivän keskiarvoon kerrottuna seitsemällä.",
    },
    constants: [
      { name: "window days", value: samplingDrop.windowDays, decision: "D-020" },
      { name: "baseline days", value: samplingDrop.baselineDays, decision: "D-020" },
      { name: "alpha", value: samplingDrop.alpha, decision: "D-020" },
    ],
    code: { ts: "libs/utils/detect/src/detectors.ts", fn: "samplingDrop", py: "aei.detect.sampling_drop" },
    decisions: ["D-020", "D-042"],
    snippet: liveSnippet("sampling-drop", ` and s.ward == "{ward}"${DATES}`),
  },
  "empty-run": {
    id: "empty-run",
    name: { en: "Poisson gap probability", fi: "Poisson-tyhjän jakson todennäköisyys" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>λ</mi><mo>=</mo><mfrac><msub><mi>c</mi><mn>56</mn></msub><mn>56</mn></mfrac><mo>,</mo><mspace width="1em"/><msup><mi>e</mi><mrow><mo>−</mo><mi>λ</mi><mi>L</mi></mrow></msup><mo>&lt;</mo><mi>α</mi></mrow></math>',
    latex: "\\lambda = \\frac{c_{56}}{56},\\quad \\text{signal if } e^{-\\lambda L} < \\alpha",
    plain: {
      en: "L days in a row with no cultures from this unit, against its mean daily count over the 56 days before the run.",
      fi: "Tämän osaston L päivää peräkkäin ilman viljelyä, verrattuna sen päivittäiseen keskiarvoon 56 päivää ennen jaksoa.",
    },
    constants: [
      { name: "baseline days", value: emptyRun.baselineDays, decision: "D-031" },
      { name: "alpha", value: emptyRun.alpha, decision: "D-031" },
    ],
    code: { ts: "libs/utils/detect/src/detectors.ts", fn: "emptyRun", py: "aei.detect.empty_run" },
    decisions: ["D-031", "D-042"],
    snippet: liveSnippet("empty-run", ` and s.ward == "{ward}"${DATES}`),
  },
  "rising-trend": {
    id: "rising-trend",
    name: { en: "Cochran–Armitage trend test, one-sided", fi: "Cochran–Armitage-trenditesti, yksisuuntainen" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>p</mi><mo>=</mo><mtext>Cochran–Armitage, one-sided, </mtext><mi>k</mi><mo>≥</mo><mn>13</mn><mtext> bins of 28 d</mtext><mo>,</mo><mspace width="1em"/><mi>p</mi><mo>&lt;</mo><mi>α</mi></mrow></math>',
    latex:
      "p = \\text{one-sided Cochran–Armitage test of the resistant share over } k \\ge 13 \\text{ bins of } 28 \\text{ days},\\quad \\text{signal if } p < \\alpha",
    plain: {
      en: "The resistant share of isolates across the whole hospital, in 28-day periods since the data began, tested for a rise along the periods.",
      fi: "Resistenttien näytteiden osuus koko sairaalassa 28 päivän jaksoissa datan alusta lähtien, testattuna nousulle jaksojen yli.",
    },
    constants: [
      { name: "bin days", value: risingTrend.binDays, decision: "D-020" },
      { name: "min bins", value: risingTrend.minBins, decision: "D-020" },
      { name: "alpha", value: risingTrend.alpha, decision: "D-020" },
      { name: "pairs watched", value: SURVEILLANCE_PAIRS.length, decision: "D-020" },
    ],
    code: { ts: "libs/utils/detect/src/detectors.ts", fn: "risingTrend", py: "aei.detect.rising_trend" },
    decisions: ["D-020", "D-022", "D-042", "D-044"],
    snippet: liveSnippet("rising-trend", ` and s.organism == "{organism}"${DATES}`),
  },
  cpe: {
    id: "cpe",
    name: { en: "Rule, no test", fi: "Sääntö, ei testiä" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mtext>every CPE isolate → alert on its sample date (rule)</mtext></mrow></math>',
    latex: "\\text{every CPE isolate is an alert on its sample date (no test)}",
    plain: {
      en: "A rule, not a test: every carbapenemase-producing Enterobacterales isolate is an alert on its sample date.",
      fi: "Sääntö, ei testi: jokainen karbapenemaasia-tuottava enterobakteeri-isolaatti on hälytys näytepäivänään.",
    },
    constants: [{ name: "rule", value: "every isolate", decision: "D-014" }],
    code: { ts: "libs/utils/alerts/src/index.ts", fn: "cpeAlerts", py: "" },
    decisions: ["D-014"],
    snippet: [
      "# CPE: every isolate is an alert on its sample date (D-014); no Python function yet, filter the records",
      "cpe = [",
      "    r for r in records",
      '    if "cpe" in r.phenotypes and r.ward == "{ward}" and "{from}" <= r.sample_date <= "{to}"',
      "]",
    ].join("\n"),
  },
  "new-in-unit": {
    id: "new-in-unit",
    name: { en: "Rule, no test", fi: "Sääntö, ei testiä" },
    mathml:
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mtext>MRSA or VRE on an inpatient unit, none there in </mtext><mi>L</mi><mtext> days (rule), </mtext><mi>L</mi><mo>=</mo><mn>180</mn></mrow></math>',
    latex:
      "\\text{MRSA or VRE isolate on an inpatient unit with none there in the previous } L \\text{ days (no test)},\\quad L = " +
      String(NEW_IN_UNIT_DAYS),
    plain: {
      en: `A rule, not a test: the first MRSA or VRE isolate on this inpatient unit in ${NEW_IN_UNIT_DAYS} days.`,
      fi: `Sääntö, ei testi: ensimmäinen MRSA tai VRE tällä vuodeosastolla ${NEW_IN_UNIT_DAYS} päivään.`,
    },
    constants: [
      { name: "look-back days", value: NEW_IN_UNIT_DAYS, decision: "D-021" },
      { name: "scope", value: "inpatient units", decision: "D-034" },
    ],
    code: { ts: "libs/utils/alerts/src/index.ts", fn: "newInUnitAlerts", py: "" },
    decisions: ["D-021", "D-034"],
    snippet: [
      "# New in unit: first MRSA or VRE in 180 days (D-021); no Python function yet, filter the records",
      "new = [",
      "    r for r in records",
      '    if ("mrsa" in r.phenotypes or "vre" in r.phenotypes) and r.ward == "{ward}" and "{from}" <= r.sample_date <= "{to}"',
      "]",
    ].join("\n"),
  },
};

/** The registry entry for an alert, or null for kinds with no method (carrier arrivals, divergence). */
export function methodOf(alert: { kind: string; detector?: string }): Method | null {
  if (alert.kind === "cpe") return METHODS.cpe;
  if (alert.kind === "new-in-unit") return METHODS["new-in-unit"];
  if (alert.kind !== "detector" || !alert.detector) return null;
  return METHODS[alert.detector as MethodId] ?? null;
}

/** The notebook snippet with its placeholders filled; unknown placeholders stay as written. */
export function fillSnippet(method: Method, values: Record<"ward" | "organism" | "from" | "to", string>): string {
  return method.snippet.replace(/\{(ward|organism|from|to)\}/g, (_, key: keyof typeof values) => values[key]);
}
