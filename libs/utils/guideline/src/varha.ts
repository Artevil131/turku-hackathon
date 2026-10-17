// Varha's Mikrobilääkesuositus, 13.4.2026 (research/guidelines.md section 1).
// Finnish text quotes the guide; English is a plain translation. Doses stay in
// the text and are never computed with. Pages are the guide's printed page
// numbers (equal to the PDF page).

import type { AntibioticCode } from "@aei/domain";
import type { Choice, Guide, Route } from "./types.ts";

const c = (drug: AntibioticCode | null, fi: string, en: string, route: Route): Choice => ({ drug, text: { fi, en }, route });

// Drugs that recur.
const ertapenem = c(null, "ertapeneemi 1 g x 1 iv", "ertapenem 1 g × 1 iv", "iv");
const vancomycinAdd = c("VAN", "vankomysiini iv", "vancomycin iv", "iv");

export const VARHA: Guide = {
  site: "varha",
  title: "Mikrobilääkesuositus (Varsinais-Suomen hyvinvointialue)",
  date: "2026-04-13",
  url: "https://hoito-ohjeet.fi/fi/Ohjepankki/YHTEINEN/Mikrobil%C3%A4%C3%A4kesuositus.pdf",
  syndromes: [
    {
      id: "cystitis-woman",
      name: { fi: "Akuutti kystiitti naisella", en: "Acute cystitis in a woman" },
      specimen: "urine",
      severity: "mild",
      onset: "community",
      sex: "F",
      firstChoices: [
        c("TMP", "trimetopriimi 160 mg x 2 po", "trimethoprim 160 mg × 2 po", "po"),
        c("NIT", "nitrofurantoiini 75 mg x 2 po", "nitrofurantoin 75 mg × 2 po", "po"),
        c("MEC", "pivmesillinaami 200 mg x 3 tai 400 mg x 2 po", "pivmecillinam 200 mg × 3 or 400 mg × 2 po", "po"),
      ],
      carrierRules: {
        esbl: {
          action: "replace",
          choices: [
            c("NIT", "nitrofurantoiini 75 mg x 2 po", "nitrofurantoin 75 mg × 2 po", "po"),
            c(null, "fosfomysiini 3 g po kerta-annos", "fosfomycin 3 g po, single dose", "po"),
            c("MEC", "pivmesillinaami isolla annoksella 400 mg x 3 po", "pivmecillinam at high dose, 400 mg × 3 po", "po"),
          ],
          text: {
            fi: "ESBL-kystiitissä herkkyysmäärityksen mukaan esim. nitrofurantoiini; vaihtoehtona fosfomysiini tai pivmesillinaami isolla annoksella.",
            en: "ESBL cystitis: by susceptibility, e.g. nitrofurantoin; alternatively fosfomycin or high-dose pivmecillinam.",
          },
        },
      },
      duration: { fi: "Hoitoaika 3 vrk.", en: "3 days." },
      source: { section: "7.4.1 A", page: 37 },
    },
    {
      id: "cystitis-man",
      name: { fi: "Miehen kuumeeton rakkotason infektio", en: "Afebrile bladder infection in a man" },
      specimen: "urine",
      severity: "mild",
      onset: "community",
      sex: "M",
      firstChoices: [
        c("TMP", "trimetopriimi 160 mg x 2 po", "trimethoprim 160 mg × 2 po", "po"),
        c(null, "sulfa-trimetopriimi 160/500 mg x 2 po", "sulfamethoxazole-trimethoprim 160/500 mg × 2 po", "po"),
        c(
          "NIT",
          "nitrofurantoiini 75 mg x 2 po, jos ei kuumetta eikä eturauhanen tuseerattaessa arista",
          "nitrofurantoin 75 mg × 2 po, if no fever and the prostate is not tender on palpation",
          "po",
        ),
        c(
          null,
          "fosfomysiini 3 g kerta-annos, jos ei kuumetta eikä eturauhanen tuseerattaessa arista",
          "fosfomycin 3 g single dose, if no fever and the prostate is not tender on palpation",
          "po",
        ),
      ],
      carrierRules: {},
      duration: {
        fi: "Hoitoaika on yleensä 7 vrk; lopullinen valinta herkkyysmäärityksen mukaan.",
        en: "Usually 7 days; the final choice by susceptibility.",
      },
      source: { section: "7.4.1 E", page: 38 },
    },
    {
      id: "pyelonephritis",
      name: { fi: "Pyelonefriitti", en: "Pyelonephritis" },
      specimen: "urine",
      severity: "severe",
      onset: "community",
      firstChoices: [
        c("CXM", "kefuroksiimi 1,5 g x 3 iv", "cefuroxime 1.5 g × 3 iv", "iv"),
        c("CIP", "siprofloksasiini 500 mg x 2 po", "ciprofloxacin 500 mg × 2 po", "po"),
      ],
      carrierRules: {
        esbl: {
          action: "replace",
          choices: [ertapenem],
          text: {
            fi: "ESBL-kantajan pyelonefriitti (empiirinen hoito): ertapeneemi 1 g x 1 iv. Jos kanta on herkkä fluorokinolonille tai sulfa-trimetopriimille, niitä voidaan käyttää.",
            en: "Pyelonephritis in an ESBL carrier (empirical): ertapenem 1 g × 1 iv. If the strain is susceptible to a fluoroquinolone or sulfamethoxazole-trimethoprim, those can be used.",
          },
        },
      },
      duration: {
        fi: "Beetalaktaamilla 7–10 vrk, fluorokinoloneilla 5–7 vrk, sulfa-trimetopriimilla 7–10 vrk.",
        en: "7–10 days with a beta-lactam, 5–7 days with a fluoroquinolone, 7–10 days with sulfamethoxazole-trimethoprim.",
      },
      source: { section: "7.4.1 D", page: 38 },
    },
    {
      id: "pyelonephritis-man",
      name: { fi: "Miehen kuumeinen virtsatieinfektio", en: "Febrile urinary tract infection in a man" },
      specimen: "urine",
      severity: "severe",
      onset: "community",
      sex: "M",
      firstChoices: [c("CIP", "fluorokinoloni", "a fluoroquinolone", "po/iv"), c("CXM", "iv-kefuroksiimi", "cefuroxime iv", "iv")],
      carrierRules: {},
      duration: { fi: "Hoitoaika on 10–14 vrk.", en: "10–14 days." },
      source: { section: "7.4.1 F", page: 38 },
    },
    {
      id: "urinary-sepsis",
      name: { fi: "Virtsatielähtöinen sepsis", en: "Sepsis from a urinary source" },
      specimen: "blood",
      severity: "severe",
      onset: "community",
      firstChoices: [
        c(
          "CXM",
          "kefuroksiimi 1,5 g x 3 iv (1,5 g x 4 iv, jos vaikea sepsis ja elintoimintahäiriö)",
          "cefuroxime 1.5 g × 3 iv (1.5 g × 4 iv in severe sepsis with organ dysfunction)",
          "iv",
        ),
      ],
      carrierRules: {
        esbl: {
          action: "replace",
          choices: [ertapenem, c("MEM", "meropeneemi 1 g x 3 iv", "meropenem 1 g × 3 iv", "iv")],
          text: {
            fi: "Jos ESBL-kantaja tai jos hoitoon liittyvä sepsis, ks. edellä (6.2.1): ertapeneemi 1 g x 1 iv tai meropeneemi 1 g x 3 iv.",
            en: "If an ESBL carrier or healthcare-associated sepsis, see above (6.2.1): ertapenem 1 g × 1 iv or meropenem 1 g × 3 iv.",
          },
        },
      },
      source: { section: "6.3.1", page: 21 },
    },
    {
      id: "sepsis-unknown-focus",
      name: { fi: "Avohoitolähtöinen sepsis, fokus ei tiedossa", en: "Community-onset sepsis, focus unknown" },
      specimen: "blood",
      severity: "severe",
      onset: "community",
      firstChoices: [c("CXM", "kefuroksiimi 1,5 g x 4 iv. Aloita viiveettä!", "cefuroxime 1.5 g × 4 iv. Start without delay.", "iv")],
      carrierRules: {
        esbl: {
          action: "replace",
          choices: [ertapenem, c("MEM", "meropeneemi 1 g x 3 iv", "meropenem 1 g × 3 iv", "iv")],
          text: {
            fi: "Jos potilas ESBL-kantaja ja infektio sopii enterobakteerin aiheuttamaksi: ertapeneemi 1 g x 1 iv tai meropeneemi 1 g x 3 iv (hypoalbuminemiassa meropeneemi).",
            en: "ESBL carrier and an infection consistent with Enterobacterales: ertapenem 1 g × 1 iv or meropenem 1 g × 3 iv (meropenem if hypoalbuminaemic).",
          },
        },
        mrsa: {
          action: "add",
          choices: [c("VAN", "vankomysiini 1–1,5 g x 2 iv", "vancomycin 1–1.5 g × 2 iv", "iv")],
          text: {
            fi: "Jos MRSA-kantaja ja infektio sopii S. aureuksen aiheuttamaksi, liitä kefuroksiimin rinnalle vankomysiini 1–1,5 g x 2 iv, mikäli ei munuaisten vajaatoimintaa.",
            en: "MRSA carrier and an infection consistent with S. aureus: add vancomycin 1–1.5 g × 2 iv to cefuroxime, unless renal function is impaired.",
          },
        },
        cpe: {
          action: "consult",
          choices: [],
          text: {
            fi: "Moniresistentin bakteerin kantajat: konsultoi herkästi infektiolääkäriä.",
            en: "Carriers of a multidrug-resistant organism: consult an infectious-disease physician early.",
          },
        },
        vre: {
          action: "consult",
          choices: [],
          text: {
            fi: "Moniresistentin bakteerin kantajat: konsultoi herkästi infektiolääkäriä.",
            en: "Carriers of a multidrug-resistant organism: consult an infectious-disease physician early.",
          },
        },
      },
      source: { section: "6.2.1", page: 20 },
    },
    {
      id: "sepsis-healthcare",
      name: { fi: "Hoitoon liittyvä sepsis", en: "Healthcare-associated sepsis" },
      specimen: "blood",
      severity: "severe",
      onset: "hospital",
      firstChoices: [
        c("TZP", "piperasilliini-tatsobaktaami 4 g x 4 iv", "piperacillin-tazobactam 4 g × 4 iv", "iv"),
        c("MEM", "meropeneemi 1 (-2) g x 3-4 iv", "meropenem 1 (–2) g × 3–4 iv", "iv"),
      ],
      carrierRules: {},
      // The guide numbers this section 6.2.1 as well (its own numbering).
      source: { section: "6.2.1", page: 21 },
    },
    {
      id: "wound-mild",
      name: { fi: "Lievä pinnallinen haavainfektio", en: "Mild superficial wound infection" },
      specimen: "wound",
      severity: "mild",
      onset: "any",
      firstChoices: [
        c(null, "flukloksasilliini 750–1000 mg x 3 po", "flucloxacillin 750–1000 mg × 3 po", "po"),
        c(null, "kefaleksiini 500–750 mg x 3–4 po", "cefalexin 500–750 mg × 3–4 po", "po"),
      ],
      allergyAlternative: [
        c(
          "CLI",
          "klindamysiini 300 mg x 4 / 450 mg x 3 po (jos beetalaktaamiallergia)",
          "clindamycin 300 mg × 4 or 450 mg × 3 po (if beta-lactam allergy)",
          "po",
        ),
      ],
      carrierRules: {
        mrsa: {
          action: "replace",
          choices: [c(null, "sulfa-trimetopriimi", "sulfamethoxazole-trimethoprim", "po"), c("CLI", "klindamysiini", "clindamycin", "po")],
          text: {
            fi: "MRSA-kantajalla valinta herkkyysmäärityksen mukaan (ensisijaisesti sulfa-trimetopriimi tai klindamysiini).",
            en: "MRSA carrier: choose by susceptibility (first sulfamethoxazole-trimethoprim or clindamycin).",
          },
        },
      },
      source: { section: "7.1.4", page: 27 },
    },
    {
      id: "wound-moderate",
      name: { fi: "Keskivaikea haavainfektio", en: "Moderate wound infection" },
      specimen: "wound",
      severity: "severe",
      onset: "any",
      firstChoices: [
        c(null, "kloksasilliini 2 g x 4–6 iv", "cloxacillin 2 g × 4–6 iv", "iv"),
        c("CXM", "kefuroksiimi 1,5 g x 3–4 iv", "cefuroxime 1.5 g × 3–4 iv", "iv"),
      ],
      allergyAlternative: [
        c(
          "CLI",
          "klindamysiini 600 mg x 3 iv/po (jos beetalaktaamiallergia)",
          "clindamycin 600 mg × 3 iv/po (if beta-lactam allergy)",
          "po/iv",
        ),
      ],
      carrierRules: {
        mrsa: {
          action: "add",
          choices: [vancomycinAdd],
          text: {
            fi: "MRSA-kantajilla edellä mainittuihin lisätään yleensä vankomysiini iv.",
            en: "In MRSA carriers vancomycin iv is usually added to the above.",
          },
        },
      },
      source: { section: "7.1.4", page: 27 },
    },
    {
      id: "wound-severe",
      name: { fi: "Vaikea haavainfektio", en: "Severe wound infection" },
      specimen: "wound",
      severity: "severe",
      onset: "hospital",
      firstChoices: [
        c("TZP", "piperasilliini-tatsobaktaami 4 g x 4 iv", "piperacillin-tazobactam 4 g × 4 iv", "iv"),
        c("MEM", "meropeneemi 1 g x 3 iv", "meropenem 1 g × 3 iv", "iv"),
      ],
      allergyAlternative: [
        c("CLI", "karbapeneemiallergiassa klindamysiini 600 mg x 4 iv/po", "in carbapenem allergy, clindamycin 600 mg × 4 iv/po", "po/iv"),
        c("CIP", "+ siprofloksasiini 400 mg x 2–3 iv / 500–750 mg x 2 po", "+ ciprofloxacin 400 mg × 2–3 iv or 500–750 mg × 2 po", "po/iv"),
      ],
      carrierRules: {
        mrsa: {
          action: "add",
          choices: [vancomycinAdd],
          text: {
            fi: "MRSA-kantajilla edellä mainittuihin lisätään yleensä vankomysiini iv.",
            en: "In MRSA carriers vancomycin iv is usually added to the above.",
          },
        },
      },
      source: { section: "7.1.4", page: 27 },
    },
  ],
};
