// Copy for the Infection control tour (a cursor walks the weekly watch and its notebook).
// Short, plain, a little dry. Keys are global: prefix `tour`. English and Finnish carry the same keys.

export const tourCtrlEn = {
  tourCtrlIntro:
    "Infection control's project, open all week; a smoke detector with a notebook attached. The summary on top says why: 7 ESBL isolates on Internal medicine A, about 1.4 expected.",
  tourCtrlSlice:
    "The slice fixes which results count: Internal medicine A, ESBL, 17 February to 11 May. Every cell below uses the same cut, so two readers get the same numbers.",
  tourCtrlSignals:
    "Every flag so far, newest first. One is the open cluster; a signal says something changed on a unit, not what caused it.",
  tourCtrlNote:
    "The Monday note, in words: seven patients since 2 April, about 1.4 usual, and where they came from. Thursday's colleague reads the page, not your memory.",
  tourCtrlShares:
    "Share over time: ESBL isolates over all isolates per 7-day period, with a 95 % interval. A wide interval is a thin week, where one case moves the share a lot.",
  tourCtrlDetector:
    "The live detector, run on this slice: more ESBL than this unit usually has? It fires only on gaps too large for ordinary wobble, and this run is not an alert.",
  tourCtrlGraph:
    "Patient flow from the same records: 28 % of this unit's patients came through the emergency department. Thick lines are busy corridors, the routes spread would take.",
  tourCtrlMap: "A map window puts the hospital in its region with THL's public county figures: a local fire, or weather everywhere?",
  tourCtrlAdd: "The plus between cells adds one: a note, a slice, Python, or a statistics tool. Here, Compare.",
  tourCtrlCompare:
    "Compare two frames: these 12 weeks against the 12 before. Run it; the answer comes as a sentence first, then the numbers and the method.",
  tourCtrlCompareRead:
    "Difference A − B is in percentage points: 5 % to 12 % is 7 points. If the interval includes zero, the data do not separate the frames, whatever the chart looks like.",
  tourCtrlWindow:
    "One more window, the unit grid: every unit over recent weeks on one scale, to see whether Internal medicine A is the only one that differs.",
  tourCtrlInfer:
    "Fair to conclude from this page: something changed, when, and where. Who passed it to whom is not in culture results; that takes typing and a ward visit, hence the to-do note.",
  tourCtrlOutro: "That is the weekly watch; on Monday it shows the new week. The page is yours now: leave it open or take it apart.",
};

export const tourCtrlFi: Record<keyof typeof tourCtrlEn, string> = {
  tourCtrlIntro:
    "Infektioiden torjunnan projekti, auki koko viikon: palovaroitin, jossa on muistio mukana. Yhteenveto kertoo miksi: 7 ESBL-löydöstä Sisätaudit A:lla, odotettu noin 1,4.",
  tourCtrlSlice:
    "Rajaus määrää, mitkä tulokset lasketaan: Sisätaudit A, ESBL, 17.2.–11.5. Jokainen solu alla käyttää samaa leikkausta, joten kaksi lukijaa saa samat luvut.",
  tourCtrlSignals:
    "Kaikki tähänastiset hälytykset, uusin ensin. Yksi niistä on avoin klusteri; signaali kertoo, että yksikössä jokin muuttui, ei mistä se johtuu.",
  tourCtrlNote:
    "Maanantain muistiinpano sanoin: seitsemän potilasta 2. huhtikuusta, tavallisesti noin 1,4, ja mistä he tulivat. Torstain kollega lukee sivun, ei sinun muistiasi.",
  tourCtrlShares:
    "Osuus ajan yli: ESBL-löydökset kaikista löydöksistä 7 päivän jaksoissa, 95 %:n välin kanssa. Leveä väli on ohut viikko, jolla yksi tapaus liikuttaa osuutta paljon.",
  tourCtrlDetector:
    "Live-tunnistin ajettuna tälle rajaukselle: enemmän ESBL:ää kuin yksikössä tavallisesti? Se reagoi vain eroihin, jotka ovat tavallista heiluntaa suurempia, eikä tämä ajo ole hälytys.",
  tourCtrlGraph:
    "Potilasvirta samoista tiedoista: 28 % yksikön potilaista tuli päivystyksen kautta. Paksut viivat ovat vilkkaita käytäviä, reittejä joita leviäminen kulkisi.",
  tourCtrlMap: "Karttaikkuna asettaa sairaalan alueelleen THL:n julkisilla maakuntaluvuilla: paikallinen tulipalo vai sää kaikkialla?",
  tourCtrlAdd: "Solujen välinen plus lisää solun: muistiinpanon, rajauksen, Pythonia tai tilastotyökalun. Tässä: Vertaa.",
  tourCtrlCompare:
    "Vertaa kahta jaksoa: nämä 12 viikkoa edeltäviin 12:een. Aja se; vastaus tulee ensin lauseena, sitten luvut ja menetelmä.",
  tourCtrlCompareRead:
    "Erotus A − B on prosenttiyksikköinä: 5 %:sta 12 %:iin on 7 yksikköä. Jos väli sisältää nollan, aineisto ei erota jaksoja, näyttipä kuvaaja miltä tahansa.",
  tourCtrlWindow:
    "Vielä yksi ikkuna, yksikköruudukko: kaikki yksiköt viime viikoilta samalla asteikolla. Siitä näkee, poikkeaako Sisätaudit A yksin.",
  tourCtrlInfer:
    "Tästä sivusta voi päätellä: jokin muuttui, milloin ja missä. Kuka tartutti kenet ei ole viljelyvastauksissa; siihen tarvitaan tyypitys ja käynti osastolla, siksi tehtävälista.",
  tourCtrlOutro: "Tämä on viikkoseuranta; maanantaina se näyttää uuden viikon. Sivu on nyt sinun: jätä se auki tai pura osiin.",
};
