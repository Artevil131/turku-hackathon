// The glossary: every abbreviation a card or timeline shows, with its long form
// and a one-line meaning (research-unified.md §6). Keys are global: prefix them `gloss`.
// Unit codes take the unit's full name from the dataset's WARDS list (libs/utils/domain).

import type { Locale } from "../index.ts";

export const GLOSS_TERMS = [
  "ESBL",
  "MRSA",
  "VRE",
  "CPE",
  "n",
  "%S",
  "%R",
  "usual",
  "surprise",
  "first isolate",
  "day 3",
  "TMP",
  "TZP",
  "ED",
  "MED-A",
  "MED-B",
  "SURG",
  "URO",
  "ICU",
  "GER",
  "PHC-N",
  "PHC-S",
] as const;

export type GlossTerm = (typeof GLOSS_TERMS)[number];

export type GlossEntry = { long: string; meaning: string };

const HOSPITAL_UNIT = { en: "a hospital unit", fi: "sairaalan yksikkö" } as const;
const PRIMARY_UNIT = { en: "a primary-care unit", fi: "perusterveydenhuollon yksikkö" } as const;

export const GLOSSARY: Record<Locale, Record<GlossTerm, GlossEntry>> = {
  en: {
    ESBL: {
      long: "extended-spectrum beta-lactamase",
      meaning: "E. coli and Klebsiella that break down penicillins and most cephalosporins",
    },
    MRSA: { long: "methicillin-resistant S. aureus", meaning: "S. aureus resistant to most beta-lactams" },
    VRE: { long: "vancomycin-resistant enterococcus", meaning: "enterococci resistant to vancomycin" },
    CPE: { long: "carbapenemase-producing Enterobacterales", meaning: "every case is an alert" },
    n: { long: "number of first isolates the figure rests on", meaning: "the count behind a figure" },
    "%S": { long: "share susceptible", meaning: "percent of isolates susceptible, out of n" },
    "%R": { long: "share resistant", meaning: "percent of isolates resistant, out of n" },
    usual: {
      long: "what this unit's own last year predicts for the same window",
      meaning: "the expected count",
    },
    surprise: {
      long: "how unlikely the observed count is by chance; 2 is 1 in 100, 4.7 is 1 in 50 000",
      meaning: "−log10 p: higher means less likely to be chance",
    },
    "first isolate": {
      long: "one per patient, species and specimen type in a period",
      meaning: "counted once per patient and species",
    },
    "day 3": {
      long: "sample taken on the third day of the stay or later: counted as hospital-acquired",
      meaning: "a hospital-acquired sample",
    },
    TMP: { long: "trimethoprim", meaning: "antibiotic, reported for urine" },
    TZP: { long: "piperacillin-tazobactam", meaning: "penicillin with a beta-lactamase inhibitor" },
    ED: { long: "Emergency department", meaning: HOSPITAL_UNIT.en },
    "MED-A": { long: "Internal medicine A", meaning: HOSPITAL_UNIT.en },
    "MED-B": { long: "Internal medicine B", meaning: HOSPITAL_UNIT.en },
    SURG: { long: "Surgery", meaning: HOSPITAL_UNIT.en },
    URO: { long: "Urology", meaning: HOSPITAL_UNIT.en },
    ICU: { long: "Intensive care unit", meaning: HOSPITAL_UNIT.en },
    GER: { long: "Geriatrics", meaning: HOSPITAL_UNIT.en },
    "PHC-N": { long: "Health centre North", meaning: PRIMARY_UNIT.en },
    "PHC-S": { long: "Health centre South", meaning: PRIMARY_UNIT.en },
  },
  fi: {
    ESBL: {
      long: "laajakirjoinen beetalaktamaasi",
      meaning: "E. coli ja Klebsiella, jotka hajottavat penisilliinit ja useimmat kefalosporiinit",
    },
    MRSA: { long: "metisilliinille resistentti S. aureus", meaning: "S. aureus, resistentti useimmille beetalaktaameille" },
    VRE: { long: "vankomysiinille resistentti enterokokki", meaning: "vankomysiinille resistentit enterokokit" },
    CPE: { long: "karbapenemaasia tuottava enterobakteeri", meaning: "jokainen löydös on hälytys" },
    n: { long: "ensimmäisten isolaattien määrä, johon luku perustuu", meaning: "luvun takana oleva määrä" },
    "%S": { long: "herkkien osuus", meaning: "herkkien isolaattien prosenttiosuus n:stä" },
    "%R": { long: "resistenttien osuus", meaning: "resistenttien isolaattien prosenttiosuus n:stä" },
    usual: {
      long: "mitä yksikön oma edellinen vuosi ennustaa samalle ikkunalle",
      meaning: "odotettu määrä",
    },
    surprise: {
      long: "kuinka epätodennäköinen havaittu määrä on sattumalta; 2 on 1 : 100, 4,7 on 1 : 50 000",
      meaning: "−log10 p: suurempi tarkoittaa vähemmän todennäköistä sattumaa",
    },
    "first isolate": {
      long: "yksi potilasta, lajia ja näytetyyppiä kohti jaksossa",
      meaning: "lasketaan kerran potilasta ja lajia kohti",
    },
    "day 3": {
      long: "näyte otettu kolmantena hoitopäivänä tai myöhemmin: lasketaan sairaalaperäiseksi",
      meaning: "sairaalaperäinen näyte",
    },
    TMP: { long: "trimetopriimi", meaning: "antibiootti, raportoidaan virtsasta" },
    TZP: { long: "piperasilliini-tatsobaktaami", meaning: "penisilliini ja beetalaktamaasin estäjä" },
    ED: { long: "Päivystys", meaning: HOSPITAL_UNIT.fi },
    "MED-A": { long: "Sisätaudit A", meaning: HOSPITAL_UNIT.fi },
    "MED-B": { long: "Sisätaudit B", meaning: HOSPITAL_UNIT.fi },
    SURG: { long: "Kirurgia", meaning: HOSPITAL_UNIT.fi },
    URO: { long: "Urologia", meaning: HOSPITAL_UNIT.fi },
    ICU: { long: "Teho-osasto", meaning: HOSPITAL_UNIT.fi },
    GER: { long: "Geriatria", meaning: HOSPITAL_UNIT.fi },
    "PHC-N": { long: "Terveysasema Pohjoinen", meaning: PRIMARY_UNIT.fi },
    "PHC-S": { long: "Terveysasema Etelä", meaning: PRIMARY_UNIT.fi },
  },
};

export const glossaryEn = {
  glossTitle: "Glossary",
  glossFirstUse: "{short} ({long})",
};

export const glossaryFi: Record<keyof typeof glossaryEn, string> = {
  glossTitle: "Sanasto",
  glossFirstUse: "{short} ({long})",
};
