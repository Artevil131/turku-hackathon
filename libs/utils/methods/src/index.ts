import { NEW_IN_UNIT_DAYS, NEW_IN_UNIT_PHENOTYPES, SAMPLING_DROP_SUPPRESSION_DAYS } from "@aei/alerts";
import { COMBINATION_LIMIT, COVERAGE_DEFAULTS, MAX_UNTESTED, MIN_PARTNER_GAIN, RECENT_DAYS, THRESHOLDS, WILSON_Z } from "@aei/coverage";
import { EPISODE_DAYS, LIVE_PHENOTYPES, LIVE_SETTINGS, MIN_BASELINE_ISOLATES, PROFILE_SMOOTHING, SURVEILLANCE_PAIRS } from "@aei/detect";
import type { AntibioticCode, Phenotype, Specimen } from "@aei/domain";
import { antibioticName, phenotypeName, specimenName } from "@aei/i18n";

export type Locale = "en" | "fi";
export type Localized = Record<Locale, string>;
export type ParameterValue = string | number | boolean | null | readonly unknown[];
export interface MethodParameter {
  name: string;
  default: ParameterValue;
  unit?: string;
  description: Localized;
  decision: string;
}
export interface MethodEntry {
  id: MethodId;
  kind: "detector" | "figure" | "count" | "ranking";
  name: Localized;
  sentence: Localized;
  parameters: readonly MethodParameter[];
  inputs: readonly string[];
  output: string;
  decisions: readonly string[];
  experiments: readonly string[];
  gear: { module: string; export: string };
}

/** References to the executing gears, not a second set of thresholds (D-066). */
export const parameterDefaults = {
  profileExcess: { ...LIVE_SETTINGS.profileExcess, minBaseline: MIN_BASELINE_ISOLATES, smoothing: PROFILE_SMOOTHING },
  phenotypeExcess: {
    ...LIVE_SETTINGS.phenotypeExcess,
    phenotypes: LIVE_PHENOTYPES,
    minBaseline: MIN_BASELINE_ISOLATES,
    smoothing: PROFILE_SMOOTHING,
  },
  samplingDrop: LIVE_SETTINGS.samplingDrop,
  volumeJump: LIVE_SETTINGS.volumeJump,
  emptyRun: LIVE_SETTINGS.emptyRun,
  risingTrend: { ...LIVE_SETTINGS.risingTrend, pairs: SURVEILLANCE_PAIRS },
  resistanceShift: { ...LIVE_SETTINGS.resistanceShift, smoothing: PROFILE_SMOOTHING },
  liveSignals: {},
  cpeAlerts: {},
  newInUnitAlerts: { phenotypes: NEW_IN_UNIT_PHENOTYPES, lookbackDays: NEW_IN_UNIT_DAYS },
  coverage: { ...COVERAGE_DEFAULTS, recentDays: RECENT_DAYS, wilsonZ: WILSON_Z },
  suggest: { mild: THRESHOLDS.mild, severe: THRESHOLDS.severe, maxUntested: MAX_UNTESTED },
  suggestCombinations: { limit: COMBINATION_LIMIT, minPartnerGain: MIN_PARTNER_GAIN, maxUntested: MAX_UNTESTED },
  isolates: {},
  patients: {},
  alerts: { episodeDays: EPISODE_DAYS, samplingDropSuppressionDays: SAMPLING_DROP_SUPPRESSION_DAYS },
} as const;
export type MethodId = keyof typeof parameterDefaults;

const descriptions: Record<string, Localized> = {
  episodeDays: { en: "Maximum gap between same-key source signals", fi: "Saman avaimen lähdesignaalien enimmäisväli" },
  samplingDropSuppressionDays: {
    en: "Suppress a source sampling-drop episode starting this soon after an empty run",
    fi: "Poista lähteen näytemäärän laskujakso, joka alkaa näin pian näytteettömän jakson jälkeen",
  },
  minBaseline: {
    en: "Minimum baseline isolates (resistance shift: known results)",
    fi: "Vertailuisolaattien vähimmäismäärä (resistenssin muutos: tunnetut tulokset)",
  },
  smoothing: {
    en: "Added successes in the baseline share (one total pseudo-isolate)",
    fi: "Vertailuosuuteen lisätyt onnistumiset (yhteensä yksi pseudoisolaatti)",
  },
  windowDays: { en: "Observation window", fi: "Havaintoikkuna" },
  baselineDays: { en: "Baseline preceding the window", fi: "Ikkunaa edeltävä vertailujakso" },
  alpha: { en: "Signal when the one-sided p value is below this", fi: "Signaali, kun yksisuuntainen p-arvo alittaa tämän" },
  minObserved: { en: "Minimum distinct patients", fi: "Potilaiden vähimmäismäärä" },
  minWindow: { en: "Minimum known results in the window", fi: "Tunnettujen tulosten vähimmäismäärä ikkunassa" },
  sameSpecimen: { en: "Match specimen type", fi: "Sama näytetyyppi" },
  phenotypes: { en: "Phenotypes watched", fi: "Seurattavat fenotyypit" },
  binDays: { en: "Complete time-bin length", fi: "Täyden aikajakson pituus" },
  minBins: { en: "Minimum complete bins", fi: "Täysien jaksojen vähimmäismäärä" },
  pairs: { en: "Surveillance organism–antibiotic pairs", fi: "Seurattavat bakteeri–antibioottiparit" },
  lookbackDays: { en: "Quiet interval and initial observation period", fi: "Hiljainen jakso ja havainnoinnin alkujakso" },
  minTested: { en: "Minimum pool and known-result count", fi: "Aineiston ja tunnettujen tulosten vähimmäismäärä" },
  onset: { en: "Acquisition filter", fi: "Infektion alkuperän rajaus" },
  recentDays: { en: "Unit context only, not the estimate", fi: "Vain yksikön taustatieto, ei estimaatti" },
  wilsonZ: { en: "Normal quantile for the 95 % Wilson interval", fi: "95 % Wilson-välin normaalikvantiili" },
  mild: { en: "Mild infection coverage bar (proportion)", fi: "Lievän infektion kattavuusraja (osuus)" },
  severe: { en: "Severe or hospital-onset coverage bar (proportion)", fi: "Vakavan tai sairaalasyntyisen infektion kattavuusraja (osuus)" },
  maxUntested: { en: "Maximum untested proportion", fi: "Tutkimatta jääneiden enimmäisosuus" },
  minPartnerGain: {
    en: "Minimum gain over the better single drug (proportion)",
    fi: "Vähimmäislisä parempaan yksittäiseen lääkkeeseen (osuus)",
  },
  limit: { en: "Maximum suggestions", fi: "Ehdotusten enimmäismäärä" },
};
const parameterDecision: Record<string, string> = {
  recentDays: "D-023",
  wilsonZ: "D-023",
  minTested: "D-033",
  onset: "D-049",
  mild: "D-026",
  severe: "D-049",
  maxUntested: "D-046",
  minPartnerGain: "D-033",
  limit: "D-028",
  episodeDays: "D-020",
  samplingDropSuppressionDays: "D-031",
};
function entry(
  id: MethodId,
  kind: MethodEntry["kind"],
  name: Localized,
  sentence: Localized,
  module: string,
  inputs: string[],
  output: string,
  decisions: [string, ...string[]],
  experiments: string[],
): MethodEntry & { id: MethodId } {
  return {
    id,
    kind,
    name,
    sentence,
    parameters: Object.entries(parameterDefaults[id]).map(([key, value]) => ({
      name: key,
      default: value,
      description: descriptions[key] ?? { en: key, fi: key },
      ...(key.endsWith("Days") ? { unit: "days" } : {}),
      decision: parameterDecision[key] ?? decisions[0],
    })),
    inputs,
    output,
    decisions,
    experiments,
    gear: { module, export: kind === "count" ? "projectBundle" : id },
  };
}

export const registry = [
  entry(
    "profileExcess",
    "detector",
    { en: "Profile excess", fi: "Resistenssiprofiilin ryväs" },
    {
      en: "We count distinct patients with the same acquired-resistant profile and organism (same specimen required: {sameSpecimen}) in the last {windowDays} days on a unit and compare with the unit's distinct patient count for that organism times the hospital's smoothed profile share in the preceding {baselineDays} days (at least {minBaseline} baseline isolates). A signal requires at least {minObserved} patients and Poisson upper-tail p < {alpha}.",
      fi: "Laskemme saman hankitun resistenssiprofiilin ja bakteerin potilaat (sama näytetyyppi vaaditaan: {sameSpecimen}) yksikössä {windowDays} päivältä ja vertaamme yksikön kyseisen bakteerin potilasmäärään kerrottuna sairaalan tasoitetulla profiiliosuudella edeltäviltä {baselineDays} päivältä (vähintään {minBaseline} vertailuisolaattia). Signaali edellyttää vähintään {minObserved} potilasta ja Poisson-ylähännän p < {alpha}.",
    },
    "@aei/detect",
    ["IsolateRecord[]", "ExcessOptions"],
    "Signal[]",
    ["D-020", "D-044"],
    ["0002", "0007", "0011", "0016"],
  ),
  entry(
    "phenotypeExcess",
    "detector",
    { en: "Phenotype excess", fi: "Fenotyypin ryväs" },
    {
      en: "We count distinct patients with a watched phenotype ({phenotypes}) in {windowDays} days on a unit and compare with the unit's current patient count times its smoothed phenotype share in the preceding {baselineDays} days (at least {minBaseline} baseline isolates). A signal requires at least {minObserved} patients and Poisson upper-tail p < {alpha}.",
      fi: "Laskemme seurattavan fenotyypin ({phenotypes}) potilaat yksikössä {windowDays} päivältä ja vertaamme yksikön nykyiseen potilasmäärään kerrottuna fenotyypin tasoitetulla osuudella edeltäviltä {baselineDays} päivältä (vähintään {minBaseline} vertailuisolaattia). Signaali edellyttää vähintään {minObserved} potilasta ja Poisson-ylähännän p < {alpha}.",
    },
    "@aei/detect",
    ["IsolateRecord[]", "Phenotype[]", "ExcessOptions"],
    "Signal[]",
    ["D-020", "D-044"],
    ["0002", "0015"],
  ),
  entry(
    "samplingDrop",
    "detector",
    { en: "Sampling drop", fi: "Näytemäärän lasku" },
    {
      en: "We compare a unit's culture count over {windowDays} days with its preceding {baselineDays}-day daily rate; Poisson lower-tail p < {alpha} signals a drop.",
      fi: "Vertaamme yksikön viljelymäärää {windowDays} päivältä edeltävän {baselineDays} päivän päivätahtiin; Poisson-alahännän p < {alpha} merkitsee laskua.",
    },
    "@aei/detect",
    ["Culture[]", "DropOptions"],
    "Signal[]",
    ["D-020", "D-044"],
    ["0002"],
  ),
  entry(
    "volumeJump",
    "detector",
    { en: "Sampling jump", fi: "Näytemäärän nousu" },
    {
      en: "We compare a unit's culture count over {windowDays} days with its preceding {baselineDays}-day daily rate; Poisson upper-tail p < {alpha} signals a jump. A unit with no cultures in its baseline is not tested.",
      fi: "Vertaamme yksikön viljelymäärää {windowDays} päivältä edeltävän {baselineDays} päivän päivätahtiin; Poisson-ylähännän p < {alpha} merkitsee nousua. Yksikköä, jolla ei ole viljelyjä vertailujaksolla, ei testata.",
    },
    "@aei/detect",
    ["Culture[]", "DropOptions"],
    "Signal[]",
    ["D-081"],
    ["0025"],
  ),
  entry(
    "emptyRun",
    "detector",
    { en: "Empty run", fi: "Näytteetön jakso" },
    {
      en: "We test consecutive days without cultures on a unit against its daily rate in the {baselineDays} days before the run began: exp(−rate × run) < {alpha}. We scan only through the last supplied culture date.",
      fi: "Vertaamme yksikön peräkkäisiä viljelyttömiä päiviä jakson alkua edeltävien {baselineDays} päivän päivätahtiin: exp(−tahti × jakso) < {alpha}. Seuranta päättyy viimeiseen annettuun viljelypäivään.",
    },
    "@aei/detect",
    ["Culture[]", "EmptyRunOptions"],
    "Signal[]",
    ["D-031", "D-044"],
    ["0009"],
  ),
  entry(
    "risingTrend",
    "detector",
    { en: "Rising resistance trend", fi: "Nouseva resistenssitrendi" },
    {
      en: "We test rising hospital resistance shares in complete {binDays}-day bins, with at least {minBins} bins, using the one-sided Cochran–Armitage test at p < {alpha} on the surveillance pairs.",
      fi: "Testaamme sairaalan resistenssiosuuden nousua täysissä {binDays} päivän jaksoissa, vähintään {minBins} jaksolla, yksisuuntaisella Cochran–Armitage-testillä: p < {alpha} seurattaville pareille.",
    },
    "@aei/detect",
    ["IsolateRecord[]", "Pair[]", "TrendOptions"],
    "Signal[]",
    ["D-020", "D-022", "D-044"],
    ["0002", "0006"],
  ),
  entry(
    "resistanceShift",
    "detector",
    { en: "Resistance shift", fi: "Resistenssin muutos" },
    {
      en: "Per unit, specimen, organism and antibiotic we count resistant results in the last {windowDays} days (at least {minWindow} known results) and compare with the unit's own smoothed resistant share over the {baselineDays} days before the window (at least {minBaseline} known results). A signal requires exact binomial upper-tail p < {alpha}. Isolates of an already detected cluster are left out.",
      fi: "Laskemme yksikön, näytetyypin, bakteerin ja antibiootin resistentit tulokset viimeiseltä {windowDays} päivältä (vähintään {minWindow} tunnettua tulosta) ja vertaamme yksikön omaan tasoitettuun resistenttien osuuteen ikkunaa edeltäviltä {baselineDays} päivältä (vähintään {minBaseline} tunnettua tulosta). Signaali edellyttää tarkkaa binomin ylähännän p < {alpha}. Jo havaitun ryppään isolaatit jätetään pois.",
    },
    "@aei/detect",
    ["IsolateRecord[]", "ShiftOptions"],
    "Signal[]",
    ["D-080"],
    ["0024"],
  ),
  entry(
    "liveSignals",
    "detector",
    { en: "Live detector set", fi: "Käytössä olevat tunnistimet" },
    {
      en: "We run profile excess, phenotype excess, sampling drop, sampling jump, empty run, rising trend and resistance shift at their registered settings, separately by hospital; detected clusters are excluded causally from trends. Signals are not episode alerts.",
      fi: "Ajamme profiili- ja fenotyyppiryppäät, näytemäärän laskun ja nousun, näytteettömän jakson, nousevan trendin ja resistenssin muutoksen rekisteröidyillä asetuksilla sairaaloittain; jo havaitut ryppäät poistetaan trenditestistä ajallisesti. Signaalit eivät ole jaksohälytyksiä.",
    },
    "@aei/detect",
    ["IsolateRecord[]", "Culture[]"],
    "Signal[]",
    ["D-020", "D-031", "D-044", "D-051", "D-080", "D-081"],
    ["0002", "0007", "0009", "0024", "0025"],
  ),
  entry(
    "cpeAlerts",
    "detector",
    { en: "CPE alerts", fi: "CPE-hälytykset" },
    {
      en: "Every CPE isolate in the requested inclusive date range raises an alert, without a statistical test.",
      fi: "Jokainen CPE-isolaatti pyydetyllä päivämäärävälillä tuottaa hälytyksen ilman tilastollista testiä.",
    },
    "@aei/alerts",
    ["IsolateRecord[]", "DateWindow?"],
    "CpeAlert[]",
    ["D-014"],
    [],
  ),
  entry(
    "newInUnitAlerts",
    "detector",
    { en: "New in unit", fi: "Uusi yksikössä" },
    {
      en: "A finding with a watched phenotype ({phenotypes}) on an inpatient unit raises an alert after more than {lookbackDays} days without that phenotype; no alerts are raised in the hospital's first {lookbackDays} days of data.",
      fi: "Seurattavan fenotyypin ({phenotypes}) löydös vuodeosastolla hälyttää, kun edellisestä samasta fenotyypistä on yli {lookbackDays} päivää; sairaalan aineiston ensimmäiset {lookbackDays} päivää eivät hälytä.",
    },
    "@aei/alerts",
    ["IsolateRecord[]", "Phenotype[]?", "lookbackDays?", "Ward[]?"],
    "NewInUnitAlert[]",
    ["D-021", "D-034", "D-051"],
    [],
  ),
  entry(
    "coverage",
    "figure",
    { en: "Antibiotic coverage", fi: "Antibiootin kattavuus" },
    {
      en: "We estimate the covered share of first isolates over {windowDays} days, with a 95 % Wilson interval. One pool is used: the unit if it has {minTested} isolates, otherwise its ward type, otherwise its hospital. Each drug estimate needs {minTested} known results. Filters drop age, onset, sex before widening when the unit has enough unfiltered isolates. Intrinsic resistance and no breakpoint count as not covered; untested results are excluded. The unit's last {recentDays} days are context only.",
      fi: "Arvioimme ensiisolaattien katetun osuuden {windowDays} päivältä ja 95 % Wilson-välin. Yksi aineisto: yksikkö, jos siinä on {minTested} isolaattia, muuten osastotyyppi, muuten sairaala. Lääkkeen arvio vaatii {minTested} tunnettua tulosta. Rajaukset poistetaan järjestyksessä ikä, alkuperä, sukupuoli ennen laajentamista, jos rajaamaton yksikkö riittää. Luontainen resistenssi ja puuttuva raja-arvo ovat kattamattomia; tutkimattomat jätetään pois. Yksikön viimeiset {recentDays} päivää ovat vain taustatietoa.",
    },
    "@aei/coverage",
    ["IsolateRecord[]", "CoverageQuery", "Ward[]?"],
    "CoverageResult",
    ["D-023", "D-033", "D-044", "D-049", "D-053"],
    ["0004", "0005", "0012", "0014"],
  ),
  entry(
    "suggest",
    "ranking",
    { en: "Single-drug ranking", fi: "Yksittäisten lääkkeiden järjestys" },
    {
      en: "We rank by standing then coverage, without AWaRe tiers. Clears means the interval's lower bound reaches the bar; borderline means only the point estimate does. Mild infections use in-spectrum coverage and exclude IV-only drugs; severe infections use all organisms. Bars are {mild} (mild) and {severe} (severe or hospital onset). An untested proportion above {maxUntested} is not assessable; all-organism coverage is always shown. This informs, not prescribes.",
      fi: "Järjestämme rajan ylityksen ja kattavuuden mukaan ilman AWaRe-luokkia. Raja ylittyy, kun luottamusvälin alaraja yltää siihen; rajatapauksessa vain piste-estimaatti yltää. Lievissä infektioissa käytetään vaikutuskirjon kattavuutta ilman vain suonensisäisiä lääkkeitä; vakavissa kaikkia bakteereita. Rajat ovat {mild} (lievä) ja {severe} (vakava tai sairaalasyntyinen). Tutkimaton osuus yli {maxUntested} estää arvion; kaikkien bakteerien kattavuus näytetään aina. Tieto tukee, ei määrää hoitoa.",
    },
    "@aei/coverage",
    ["CoverageResult", "Severity"],
    "Suggestion[]",
    ["D-026", "D-027", "D-033", "D-046", "D-049", "D-056"],
    ["0010"],
  ),
  entry(
    "suggestCombinations",
    "ranking",
    { en: "Combination ranking", fi: "Yhdistelmien järjestys" },
    {
      en: "Only for severe infections when no single drug clears the bar, we rank tested-both pairs by standing then coverage, requiring gain ≥ {minPartnerGain} over the better single drug. Two beta-lactams or urine-only agents are excluded. Untested proportion above {maxUntested} is not assessable; return at most {limit} pairs.",
      fi: "Vain vakavissa infektioissa, kun yksittäinen lääke ei ylitä rajaa, järjestämme molemmille tutkitut parit rajan ylityksen ja kattavuuden mukaan; lisän on oltava ≥ {minPartnerGain} parempaan yksittäiseen lääkkeeseen. Kaksi beetalaktaamia tai virtsalääke suljetaan pois. Tutkimaton osuus yli {maxUntested} estää arvion; palautetaan enintään {limit} paria.",
    },
    "@aei/coverage",
    ["CoverageResult", "Severity", "limit?"],
    "CombinationSuggestion[]",
    ["D-028", "D-033", "D-046", "D-049", "D-056"],
    ["0010"],
  ),
  entry(
    "isolates",
    "count",
    { en: "Isolate count", fi: "Isolaattien määrä" },
    {
      en: "We count exported isolate rows in the saved scope; this is a row count, not a first-isolate count.",
      fi: "Laskemme tallennetun rajauksen viedyt isolaattirivit; tämä ei ole ensiisolaattien määrä.",
    },
    "@aei/export",
    ["isolates table"],
    "integer",
    ["D-060", "D-064"],
    [],
  ),
  entry(
    "patients",
    "count",
    { en: "Distinct patients", fi: "Eri potilaat" },
    {
      en: "We count distinct patientId values in the exported isolate rows, within the saved scope.",
      fi: "Laskemme eri patientId-arvot viedyistä isolaattiriveistä tallennetussa rajauksessa.",
    },
    "@aei/export",
    ["isolates table", "patientId"],
    "integer",
    ["D-060", "D-064"],
    [],
  ),
  entry(
    "alerts",
    "count",
    { en: "Alert count", fi: "Hälytysten määrä" },
    {
      en: "We count exported alert rows in the saved scope, not distinct incidents. Source statistical alerts merge same-detector, same-key signals up to {episodeDays} days apart; a sampling-drop episode starting within {samplingDropSuppressionDays} days after an empty-run alert on the same unit is suppressed. CPE and new-in-unit alerts follow their sentinel rules.",
      fi: "Laskemme tallennetun rajauksen viedyt hälytysrivit, emme erillisiä tapahtumia. Lähteen tilastolliset hälytykset yhdistävät saman tunnistimen ja avaimen signaalit enintään {episodeDays} päivän välein; saman yksikön näytteettömän jakson hälytystä {samplingDropSuppressionDays} päivän sisällä seuraava näytemäärän laskujakso poistetaan. CPE ja uusi yksikössä noudattavat omia sääntöjään.",
    },
    "@aei/export",
    ["alerts table"],
    "integer",
    ["D-020", "D-031", "D-034", "D-060", "D-064"],
    [],
  ),
] as const;

export const methods = Object.fromEntries(registry.map((method) => [method.id, method])) as Record<MethodId, MethodEntry>;
export function defaultsFor(id: MethodId): Record<string, ParameterValue> {
  return Object.fromEntries(methods[id].parameters.map((p) => [p.name, p.default]));
}
const PHENOTYPES = new Set(["esbl", "mrsa", "vre", "cpe"]);
/** "A, B and C" / "A, B ja C" (British English: no serial comma). */
function list(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(locale === "fi" ? "fi" : "en-GB", { type: "conjunction" }).format(items);
}
/** A parameter value as words in the sentence's language: lists joined, phenotypes and antibiotics by name. */
export function formatValue(value: unknown, locale: Locale = "en"): string {
  if (Array.isArray(value))
    return list(
      locale,
      value.map((item) => formatValue(item, locale)),
    );
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.organism === "string" && typeof v.antibiotic === "string") {
      const drug = antibioticName(locale, v.antibiotic as AntibioticCode);
      const specimen = typeof v.specimen === "string" ? ` (${specimenName(locale, v.specimen as Specimen)})` : "";
      return `${v.organism} – ${drug}${specimen}`;
    }
    return list(
      locale,
      Object.entries(v).map(([key, item]) => `${key} ${formatValue(item, locale)}`),
    );
  }
  if (typeof value === "string" && PHENOTYPES.has(value)) return phenotypeName(value as Phenotype);
  if (typeof value === "boolean") return locale === "fi" ? (value ? "kyllä" : "ei") : value ? "yes" : "no";
  return String(value);
}
export function fillSentence(entry: MethodEntry, values: Record<string, unknown> = {}, locale: Locale = "en"): string {
  const parameters = { ...Object.fromEntries(entry.parameters.map((p) => [p.name, p.default])), ...values };
  return entry.sentence[locale].replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = parameters[key];
    return value === undefined ? placeholder : formatValue(value, locale);
  });
}
export function registryJson(): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

export const detectorMethodIds = {
  "profile-excess": "profileExcess",
  "phenotype-excess": "phenotypeExcess",
  "sampling-drop": "samplingDrop",
  "volume-jump": "volumeJump",
  "empty-run": "emptyRun",
  "rising-trend": "risingTrend",
  "resistance-shift": "resistanceShift",
} as const;
