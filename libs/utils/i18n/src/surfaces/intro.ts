// Copy for the pitch intro (#intro). Keys are global: prefix them `intro`.

export const introEn = {
  introTitle: "Pressure across Finland",
  introSubtitle: "How hard resistant bacteria press on each county, one month at a time.",
  introPicture: "A picture of pressure between {n} county figures, not a working view.",
  introSource:
    "Source: THL notified cases (communicable disease register), Statistics Finland county polygons, CC BY 4.0. Replay as of {asOf}; THL revises the newest months.",
  introEnter: "Enter the tool",
  introEnterKey: "or press Enter",
  introCanvas:
    "Terraced 3D picture of Finland: the notified-case rate of each county smoothed over the map and drawn as flat steps. Drag to rotate and tilt; the arrow keys do the same.",
  introHint: "Drag to rotate and tilt",
  introSeriesLabel: "Series",
  introSeriesName: "MRSA carriage",
  introMonthLabel: "Month",
  introMonthShown: "Month shown: {month}",
  introMonthLatest: "latest complete month",
  introSlider: "Month shown in the picture (does not move the replay clock)",
  introLegend: "Smoothed rate: {lo} to {hi} cases per 100,000 residents in {month}, from {n} county figures",
  introLegendLow: "lower",
  introLegendHigh: "higher",
  introTerraces: "Six flat terraces, each a band of the smoothed rate.",
  introNational: "Finland: {cases} notified cases in {month}",
  introHospitals:
    "Large dots: the five university hospitals (Tyks marked). Small dots: one central hospital per county, joined along referral links. Pulses and rings are decoration.",
  introTyks: "Tyks, Turku",
  introLoading: "Loading the picture…",
  introNoRegional: "County figures are not available, so only the outline of the counties is shown.",
  introNoGeo: "The county map is not available, so there is no picture to show. You can still enter the tool.",
  introNoMonths: "No complete month is available before the replay date, so only the outline is shown.",
} as const;

export const introFi: Record<keyof typeof introEn, string> = {
  introTitle: "Paine halki Suomen",
  introSubtitle: "Kuinka paljon resistentit bakteerit painavat kutakin maakuntaa, kuukausi kerrallaan.",
  introPicture: "Kuva paineesta {n} maakuntaluvun välillä, ei työnäkymä.",
  introSource:
    "Lähde: THL:n ilmoitetut tapaukset (tartuntatautirekisteri), Tilastokeskuksen hyvinvointialuerajat, CC BY 4.0. Toisto tilanteessa {asOf}; THL tarkistaa uusimpia kuukausia.",
  introEnter: "Siirry työkaluun",
  introEnterKey: "tai paina Enteriä",
  introCanvas:
    "Porrastettu 3D-kuva Suomesta: kunkin maakunnan ilmoitettujen tapausten ilmaantuvuus tasoitettuna kartan yli ja piirrettynä tasaisina portaina. Vedä kääntääksesi ja kallistaaksesi; nuolinäppäimet tekevät saman.",
  introHint: "Vedä kääntääksesi ja kallistaaksesi",
  introSeriesLabel: "Sarja",
  introSeriesName: "MRSA-kantajuus",
  introMonthLabel: "Kuukausi",
  introMonthShown: "Näytetty kuukausi: {month}",
  introMonthLatest: "viimeisin täysi kuukausi",
  introSlider: "Kuvassa näytetty kuukausi (ei siirrä toiston kelloa)",
  introLegend: "Tasoitettu ilmaantuvuus: {lo}–{hi} tapausta / 100 000 asukasta, {month}, {n} maakuntaluvusta",
  introLegendLow: "matalampi",
  introLegendHigh: "korkeampi",
  introTerraces: "Kuusi tasaista porrasta, kukin tasoitetun ilmaantuvuuden vyöhyke.",
  introNational: "Suomi: {cases} ilmoitettua tapausta, {month}",
  introHospitals:
    "Isot pisteet: viisi yliopistosairaalaa (Tyks korostettu). Pienet pisteet: yksi keskussairaala maakuntaa kohti, yhdistetty lähetekytkennöin. Sykkeet ja renkaat ovat koristetta.",
  introTyks: "Tyks, Turku",
  introLoading: "Ladataan kuvaa…",
  introNoRegional: "Maakuntalukuja ei ole saatavilla, joten näytetään vain maakuntien ääriviivat.",
  introNoGeo: "Maakuntakarttaa ei ole saatavilla, joten kuvaa ei voi näyttää. Voit silti siirtyä työkaluun.",
  introNoMonths: "Toistopäivää edeltävää täyttä kuukautta ei ole, joten näytetään vain ääriviivat.",
};
