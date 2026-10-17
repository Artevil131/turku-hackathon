import type { MessageKey } from "@aei/i18n";
import type { Template } from "../research/workspace/templates.ts";

// The professions the start page can be tailored to. A role only changes the order and the example questions:
// every project, template and demo stays reachable for everyone.

export const ROLES = ["clinician", "control", "stewardship", "lab", "researcher", "surveillance", "management"] as const;
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
};

/** What a question chip does when clicked. */
export type ChipAction =
  | { kind: "demo"; id: "clinician" | "control" | "researcher" }
  | { kind: "view"; template: Template | null; params?: Record<string, string> }
  | { kind: "hash"; href: string };

export interface Chip {
  label: MessageKey;
  action: ChipAction;
}

const ESBL: ChipAction = { kind: "view", template: null, params: { unit: "MED-A", ph: "esbl" } };
const URINE: ChipAction = { kind: "view", template: "patient", params: { "cov.site": "urine" } };
const RISING: ChipAction = { kind: "demo", id: "control" };

export const CHIPS: Record<Role, Chip[]> = {
  clinician: [
    { label: "startAskQ2", action: URINE },
    { label: "chipMyWard", action: { kind: "view", template: "antibiogram" } },
    { label: "startAskQ1", action: RISING },
  ],
  control: [
    { label: "startAskQ1", action: RISING },
    { label: "startAskQ3", action: ESBL },
    { label: "chipSharedPatients", action: { kind: "hash", href: "#research?panel=network" } },
  ],
  stewardship: [
    { label: "chipFirstLine", action: { kind: "view", template: "antibiogram" } },
    { label: "chipCompareWards", action: { kind: "hash", href: "#research?panel=grid" } },
    { label: "startAskQ2", action: URINE },
  ],
  lab: [
    { label: "chipFeedHealthy", action: { kind: "hash", href: "#data" } },
    { label: "chipCulturesWeek", action: { kind: "hash", href: "#research?panel=grid" } },
    { label: "startAskQ1", action: RISING },
  ],
  researcher: [
    { label: "chipBlankNotebook", action: { kind: "view", template: "blank" } },
    { label: "startAskQ3", action: ESBL },
    { label: "chipRegionalMap", action: { kind: "hash", href: "#research?panel=map" } },
  ],
  surveillance: [
    { label: "chipCountyPicture", action: { kind: "hash", href: "#research?panel=map" } },
    { label: "chipRegionalTrends", action: { kind: "view", template: "regional" } },
    { label: "startAskQ1", action: RISING },
  ],
  management: [
    { label: "chipHowWeDo", action: RISING },
    { label: "startAskQ1", action: RISING },
    { label: "chipRegionalTrends", action: { kind: "view", template: "regional" } },
  ],
};

export const TEMPLATE_ORDER: Record<Role, Template[]> = {
  clinician: ["patient", "antibiogram", "outbreak", "regional", "blank"],
  control: ["outbreak", "antibiogram", "patient", "regional", "blank"],
  stewardship: ["antibiogram", "regional", "patient", "outbreak", "blank"],
  lab: ["antibiogram", "outbreak", "regional", "patient", "blank"],
  researcher: ["blank", "regional", "outbreak", "antibiogram", "patient"],
  surveillance: ["regional", "antibiogram", "outbreak", "patient", "blank"],
  management: ["outbreak", "regional", "antibiogram", "patient", "blank"],
};

/** The demo file each role starts from. */
export const ROLE_DEMO: Record<Role, "clinician" | "control" | "researcher"> = {
  clinician: "clinician",
  control: "control",
  stewardship: "clinician",
  lab: "control",
  researcher: "researcher",
  surveillance: "researcher",
  management: "control",
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
