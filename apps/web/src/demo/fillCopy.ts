import type { Locale } from "@aei/i18n";

// What the performing hand types into the real notebook: short notes a person would write while working, in both
// languages, short enough to watch being typed. (The long demo notes in the i18n library are the plain fill-in's.)

const en = {
  skip: "Skip",
  controlMonday: "## Monday check\n\nThe ESBL cluster on Internal medicine A is open: seven patients against about 1.4 usual.",
  controlTodo: "## To do\n\n- Ask the ward about contact precautions.\n- Re-read the weekly rate on Thursday.",
  researcherQuestion: "## Question\n\nDid ESBL on Internal medicine A rise above its usual rate this spring, beyond week-to-week noise?",
  researcherReading: "## Reading\n\nThe share barely moves; the count does: seven ESBL isolates in 28 days against about 1.4 expected.",
};
const fi: typeof en = {
  skip: "Ohita",
  controlMonday: "## Maanantain tarkistus\n\nSisätaudit A:n ESBL-klusteri on avoin: seitsemän potilasta, tavallisesti noin 1,4.",
  controlTodo: "## Tehtävät\n\n- Kysy osastolta kontaktieristyksestä.\n- Lue viikkoilmaantuvuus torstaina.",
  researcherQuestion: "## Kysymys\n\nNousiko ESBL Sisätaudit A:lla tavallista korkeammalle tänä keväänä, yli viikoittaisen vaihtelun?",
  researcherReading: "## Tulkinta\n\nOsuus tuskin muuttuu; lukumäärä muuttuu: seitsemän ESBL-löydöstä 28 päivässä, odotettu noin 1,4.",
};

export type CopyKey = keyof typeof en;
export const copy = (locale: Locale, key: CopyKey): string => (locale === "fi" ? fi : en)[key];
