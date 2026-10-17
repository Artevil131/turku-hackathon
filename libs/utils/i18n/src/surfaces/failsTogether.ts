// Copy for the "fails together" lines (apps/web/src/components/doctor/FailsTogether.tsx, D-054). Keys are global: prefix `ft`.

export const failsTogetherEn = {
  ftTitle: "Fails together",
  ftLine: "When {a} failed {where}, {b} also failed in {share} % ({both} of {n})",
  ftWhereUnit: "here",
  ftWhereWardType: "in similar units",
  ftWhereHospital: "in this hospital",
  ftLevelUnit: "own unit",
  ftLevelWardType: "similar units",
  ftLevelHospital: "whole hospital",
  ftSameClass: "same class",
  ftInterval: "95 % interval {lo}–{hi} %",
  ftFilterDropped: "patient filters left out to reach {floor}",
  ftNone: "Too few isolates resisted {a} to say which drugs fail with it (under {floor} tested for both).",
  ftLoading: "Counting drugs that fail together…",
  ftInfo:
    "First isolates of the period tested for both drugs. Of those that resisted the first drug, the share that also resisted the second. Only results the laboratory reported. Shown when at least {floor} resisted the first drug; otherwise similar units or the whole hospital.",
} as const;

export const failsTogetherFi: Record<keyof typeof failsTogetherEn, string> = {
  ftTitle: "Pettävät yhdessä",
  ftLine: "Kun {a} ei tehonnut {where}, myöskään {b} ei tehonnut {share} %:ssa ({both}/{n})",
  ftWhereUnit: "täällä",
  ftWhereWardType: "vastaavissa yksiköissä",
  ftWhereHospital: "tässä sairaalassa",
  ftLevelUnit: "oma yksikkö",
  ftLevelWardType: "vastaavat yksiköt",
  ftLevelHospital: "koko sairaala",
  ftSameClass: "sama ryhmä",
  ftInterval: "95 %:n väli {lo}–{hi} %",
  ftFilterDropped: "potilasrajaukset jätetty pois, jotta {floor} täyttyy",
  ftNone:
    "Liian harva isolaatti oli resistentti lääkkeelle {a} sanoaksemme, mitkä pettävät sen kanssa (alle {floor} molemmille testattua).",
  ftLoading: "Lasketaan yhdessä pettäviä lääkkeitä…",
  ftInfo:
    "Jakson ensimmäiset isolaatit, jotka on testattu molemmille lääkkeille. Ensimmäiselle lääkkeelle resistenteistä se osuus, joka oli resistentti myös toiselle. Vain laboratorion ilmoittamat tulokset. Näytetään, kun vähintään {floor} oli resistenttejä ensimmäiselle; muuten vastaavat yksiköt tai koko sairaala.",
};
