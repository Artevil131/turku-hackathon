// Copy for the resistance-shift and volume-jump detectors (D-080, D-081). Keys are global: prefix `det`, plus the two alert labels.

export const detectorsEn = {
  alertResistanceShift: "Resistance above usual",
  alertVolumeJump: "Sampling jump",
  detShiftSentence:
    "{observed} resistant {drug} results in the last {windowDays} days; {expected} expected from the {baselineDays} days before.",
  detEvidenceShift: "{observed} resistant results · expected {expected} · 28 days to {date}",
  detMeasureShift: "{observed} resistant · usual {expected}",
  detLatestShift:
    "Resistance above usual: {observed} {organism} results resistant to {antibiotic} in {unit} within 28 days, about {expected} expected, first seen {date}.",
  detJumpSentence: "{observed} cultures in the last {windowDays} days; {expected} expected from the {baselineDays} days before.",
} as const;

export const detectorsFi: Record<keyof typeof detectorsEn, string> = {
  alertResistanceShift: "Resistenssi tavallista korkeampi",
  alertVolumeJump: "Näytteenoton nousu",
  detShiftSentence:
    "{observed} resistenttiä {drug}-tulosta viimeisen {windowDays} päivän aikana; edeltävien {baselineDays} päivän perusteella odotus on {expected}.",
  detEvidenceShift: "{observed} resistenttiä tulosta · odotettu {expected} · 28 päivää {date} asti",
  detMeasureShift: "{observed} resistenttiä · tavallisesti {expected}",
  detLatestShift:
    "Resistenssi tavallista korkeampi: {observed} {organism}-tulosta resistenttejä antibiootille {antibiotic} osastolla {unit} 28 päivän sisällä, odotettu noin {expected}, ensimmäinen havainto {date}.",
  detJumpSentence:
    "{observed} viljelyä viimeisen {windowDays} päivän aikana; edeltävien {baselineDays} päivän perusteella odotus on {expected}.",
};
