import type { Locale } from "@aei/i18n";

// What the performing hand types into the real notebook: short notes a person would write while working, in both
// languages, short enough to watch being typed. (The long demo notes in the i18n library are the plain fill-in's.)

const en = {
  skip: "Skip · Esc",
  handoff: "Your turn · click, drag or edit anything",
  replay: "Watch it fill in again (resets this demo's notebook)",
  controlMonday: "## Monday check\n\nThe ESBL cluster on Urology is open: 4 patients against about 0.2 usual.",
  controlTodo: "## To do\n\n- Ask the ward about contact precautions.\n- Re-read the weekly rate on Thursday.",
  researcherQuestion: "## Question\n\nDid ESBL on Internal medicine A rise above its usual rate this spring, beyond week-to-week noise?",
  researcherReading: "## Reading\n\nThe share barely moves; the count does: seven ESBL isolates in 28 days against about 1.4 expected.",
  showcaseSearch: "urology e. coli",
};
const fi: typeof en = {
  skip: "Ohita · Esc",
  handoff: "Sinun vuorosi · klikkaa, vedä tai muokkaa mitä vain",
  replay: "Katso täyttyminen uudelleen (nollaa tämän demon muistion)",
  controlMonday: "## Maanantain tarkistus\n\nUrologian ESBL-klusteri on avoin: 4 potilasta, tavallisesti noin 0,2.",
  controlTodo: "## Tehtävät\n\n- Kysy osastolta kontaktieristyksestä.\n- Lue viikkoilmaantuvuus torstaina.",
  researcherQuestion: "## Kysymys\n\nNousiko ESBL Sisätaudit A:lla tavallista korkeammalle tänä keväänä, yli viikoittaisen vaihtelun?",
  researcherReading: "## Tulkinta\n\nOsuus tuskin muuttuu; lukumäärä muuttuu: seitsemän ESBL-löydöstä 28 päivässä, odotettu noin 1,4.",
  showcaseSearch: "urologia e. coli",
};

export type CopyKey = keyof typeof en;
export const copy = (locale: Locale, key: CopyKey): string => (locale === "fi" ? fi : en)[key];
