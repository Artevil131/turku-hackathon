import type { MessageKey } from "@aei/i18n";
import type { Template } from "../research/workspace/templates.ts";

// The professions the start page can be tailored to. A role only changes the order and the example questions:
// every project, template and demo stays reachable for everyone.

// "other": none of the seven; the page keeps its general order and a broad set of questions.
export const ROLES = ["clinician", "control", "stewardship", "lab", "researcher", "surveillance", "management", "other"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_KEY = "aei.role";

export const ROLE_LABEL: Record<Role, MessageKey> = {
  clinician: "roleWardDoctor",
  control: "startControl",
  stewardship: "roleStewardship",
  lab: "roleLab",
  researcher: "startResearcher",
  surveillance: "roleSurveillance",
  management: "roleManagement",
  other: "roleOther",
};

/** What a question chip does when clicked. */
export type ChipAction =
  | { kind: "demo"; id: "clinician" | "control" | "researcher" }
  /** A new, empty project from a template: a question never opens a filled demo. */
  | { kind: "template"; template: Template }
  | { kind: "view"; template: Template | null; params?: Record<string, string> }
  | { kind: "hash"; href: string };

export interface Chip {
  label: MessageKey;
  action: ChipAction;
}

const ESBL: ChipAction = { kind: "view", template: null, params: { unit: "MED-A", ph: "esbl" } };
const URINE: ChipAction = { kind: "view", template: "patient", params: { "cov.site": "urine" } };
const RISING: ChipAction = { kind: "template", template: "outbreak" };

export const CHIPS: Record<Role, Chip[]> = {
  clinician: [
    { label: "startAskQ2", action: URINE },
    { label: "chipMyWard", action: { kind: "template", template: "antibiogram" } },
    { label: "startAskQ1", action: RISING },
  ],
  control: [
    { label: "startAskQ1", action: RISING },
    { label: "startAskQ3", action: ESBL },
    { label: "chipSharedPatients", action: { kind: "hash", href: "#research?panel=network" } },
  ],
  stewardship: [
    { label: "chipFirstLine", action: { kind: "template", template: "antibiogram" } },
    { label: "chipCompareWards", action: { kind: "hash", href: "#research?panel=grid" } },
    { label: "startAskQ2", action: URINE },
  ],
  lab: [
    { label: "chipFeedHealthy", action: { kind: "hash", href: "#data" } },
    { label: "chipCulturesWeek", action: { kind: "hash", href: "#research?panel=grid" } },
    { label: "startAskQ1", action: RISING },
  ],
  researcher: [
    { label: "chipBlankNotebook", action: { kind: "template", template: "blank" } },
    { label: "startAskQ3", action: ESBL },
    { label: "chipRegionalMap", action: { kind: "hash", href: "#research?panel=map" } },
  ],
  surveillance: [
    { label: "chipCountyPicture", action: { kind: "hash", href: "#research?panel=map" } },
    { label: "chipRegionalTrends", action: { kind: "template", template: "regional" } },
    { label: "startAskQ1", action: RISING },
  ],
  management: [
    { label: "chipHowWeDo", action: RISING },
    { label: "startAskQ1", action: RISING },
    { label: "chipRegionalTrends", action: { kind: "template", template: "regional" } },
  ],
  other: [
    { label: "startAskQ1", action: RISING },
    { label: "startAskQ2", action: URINE },
    { label: "startAskQ3", action: ESBL },
  ],
};

const MRSA: ChipAction = { kind: "view", template: null, params: { ph: "mrsa" } };
const VRE: ChipAction = { kind: "view", template: null, params: { ph: "vre" } };
const CPE: ChipAction = { kind: "view", template: null, params: { ph: "cpe" } };
const BLOOD: ChipAction = { kind: "view", template: "patient", params: { "cov.site": "blood" } };
const WOUND: ChipAction = { kind: "view", template: "patient", params: { "cov.site": "wound" } };
const OUTBREAK: ChipAction = { kind: "template", template: "outbreak" };
const FIRST_LINE: ChipAction = { kind: "template", template: "antibiogram" };
const REGIONAL: ChipAction = { kind: "template", template: "regional" };
const MAP: ChipAction = { kind: "hash", href: "#research?panel=map" };
const GRID: ChipAction = { kind: "hash", href: "#research?panel=grid" };

/** Every question the "More questions" window can offer, by id. */
const QUESTION: Record<string, Chip> = {
  rising: { label: "startAskQ1", action: RISING },
  urine: { label: "startAskQ2", action: URINE },
  esbl: { label: "startAskQ3", action: ESBL },
  blood: { label: "qBlood", action: BLOOD },
  wound: { label: "qWound", action: WOUND },
  mrsa: { label: "qMrsa", action: MRSA },
  vre: { label: "qVre", action: VRE },
  cpe: { label: "qCpe", action: CPE },
  outbreak: { label: "qOutbreak", action: OUTBREAK },
  firstLine: { label: "chipFirstLine", action: FIRST_LINE },
  myWard: { label: "chipMyWard", action: FIRST_LINE },
  compareWards: { label: "chipCompareWards", action: GRID },
  shared: { label: "chipSharedPatients", action: { kind: "hash", href: "#research?panel=network" } },
  feed: { label: "chipFeedHealthy", action: { kind: "hash", href: "#data" } },
  cultures: { label: "chipCulturesWeek", action: GRID },
  county: { label: "chipCountyPicture", action: MAP },
  trends: { label: "chipRegionalTrends", action: REGIONAL },
  howWeDo: { label: "chipHowWeDo", action: RISING },
  blank: { label: "chipBlankNotebook", action: { kind: "template", template: "blank" } },
  map: { label: "chipRegionalMap", action: MAP },
};

/** The questions each role sees in the "More questions" window, most relevant first. */
export const MORE_QUESTIONS: Record<Role, Chip[]> = Object.fromEntries(
  (
    [
      ["clinician", ["urine", "blood", "wound", "myWard", "firstLine", "rising", "esbl", "mrsa"]],
      ["control", ["rising", "esbl", "mrsa", "vre", "cpe", "outbreak", "shared", "compareWards"]],
      ["stewardship", ["firstLine", "urine", "blood", "wound", "compareWards", "trends", "rising", "esbl"]],
      ["lab", ["feed", "cultures", "rising", "esbl", "mrsa", "vre", "cpe", "compareWards"]],
      ["researcher", ["blank", "esbl", "mrsa", "cpe", "trends", "map", "outbreak", "firstLine"]],
      ["surveillance", ["county", "trends", "map", "rising", "cpe", "mrsa", "vre", "firstLine"]],
      ["management", ["howWeDo", "rising", "trends", "outbreak", "compareWards", "county", "firstLine", "feed"]],
      ["other", ["rising", "urine", "esbl", "firstLine", "outbreak", "map", "compareWards", "blank"]],
    ] as const
  ).map(([role, ids]) => [role, ids.flatMap((id) => QUESTION[id] ?? [])]),
) as Record<Role, Chip[]>;

/** The three empty desks of the demo files (Research, Treat a patient, Unit monitoring) come first for everyone; Regional trends is no longer offered here; the rest follow in the role's order. */
const firstTwo = (rest: Template[]): Template[] => [
  "research",
  "patient",
  "monitor",
  ...rest.filter((t) => !["research", "patient", "monitor", "regional"].includes(t)),
];
export const TEMPLATE_ORDER: Record<Role, Template[]> = Object.fromEntries(
  Object.entries({
    clinician: ["patient", "antibiogram", "outbreak", "regional", "blank"],
    control: ["outbreak", "antibiogram", "patient", "regional", "blank"],
    stewardship: ["antibiogram", "regional", "patient", "outbreak", "blank"],
    lab: ["antibiogram", "outbreak", "regional", "patient", "blank"],
    researcher: ["blank", "regional", "outbreak", "antibiogram", "patient"],
    surveillance: ["regional", "antibiogram", "outbreak", "patient", "blank"],
    management: ["outbreak", "regional", "antibiogram", "patient", "blank"],
    other: ["patient", "outbreak", "antibiogram", "regional", "blank"],
  }).map(([role, rest]) => [role, firstTwo(rest as Template[])]),
) as Record<Role, Template[]>;

/** The demo file each role starts from. */
export const ROLE_DEMO: Record<Role, "clinician" | "control" | "researcher"> = {
  clinician: "clinician",
  control: "control",
  stewardship: "clinician",
  lab: "control",
  researcher: "researcher",
  surveillance: "researcher",
  management: "control",
  other: "control",
};

export function storedRole(): Role | null {
  try {
    const v = localStorage.getItem(ROLE_KEY);
    return ROLES.includes(v as Role) ? (v as Role) : null;
  } catch {
    return null;
  }
}

export function storeRole(role: Role): void {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* the choice still holds for this visit */
  }
}
