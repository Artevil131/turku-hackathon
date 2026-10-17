export const AUDIENCES = ["clinician", "control", "researcher"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_KEYS = { clinician: "startClinician", control: "startControl", researcher: "startResearcher" } as const;
export function storedAudience(): Audience {
  try {
    const value = localStorage.getItem("aei.audience");
    if (AUDIENCES.includes(value as Audience)) return value as Audience;
  } catch {
    /* The preset still works for this session. */
  }
  return "control";
}
