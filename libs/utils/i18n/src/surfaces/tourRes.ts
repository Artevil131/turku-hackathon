// Copy for the Researcher tour (a cursor walks the frozen analysis).
// Short, plain, a little dry. Keys are global: prefix `tour`. English and Finnish carry the same keys.

export const tourResEn = {
  tourResIntro: "Frozen at 30 April 2025: the data stop there, so every number on this page comes out the same next year.",
  tourResQuestion:
    "The slice: ESBL on Internal medicine A, 1 March to 30 April, first isolate per patient. Every result below reads this same cut.",
  tourResRate:
    "Rate: isolates per week with an exact Poisson interval, and per 100 cultures. If the ward only sampled more, the first number rises and the second does not.",
  tourResCompare:
    "Compare: these 61 days against the 61 before. A sentence first, then the difference in share, the ratio of weekly rates with its interval, and a trend test across the weeks.",
  tourResBeta:
    "Belief: a Beta distribution for the true ESBL share, from k resistant of n tested with a flat prior. Given this cut, the share sits inside the 95 % interval with 95 % probability.",
  tourResDetector:
    "The detector: the live phenotype-excess rule replayed on this frame, 28 days against the year before. It flags Internal medicine A on 30 April: seven ESBL isolates, about 1.4 expected.",
  tourResCode:
    "Every result comes with code. This is the detector's, in Python or R, ready to paste into a longer script or open in Reproduce.",
  tourResReproduce:
    "Open in Reproduce puts the frozen cut and this exact code in a tab of its own. A reviewer runs what you ran, nothing else.",
  tourResInfer:
    "What these data support: that the rise beats chance, when it began, and where. Not whether one strain spread, or why. That takes typing in the lab.",
  tourResOutro: "The researcher's view: a question, a fixed cut of your lab's data, the numbers and the code behind them. Over to you.",
};

export const tourResFi: Record<keyof typeof tourResEn, string> = {
  tourResIntro: "Jäädytetty 30.4.2025: aineisto päättyy siihen päivään, joten jokainen sivun luku on sama vielä ensi vuonna.",
  tourResQuestion:
    "Aineistoleikkaus: ESBL Sisätaudit A:lla 1.3.–30.4., ensimmäinen eristys potilasta kohti. Kaikki alla olevat tulokset lukevat tätä samaa leikkausta.",
  tourResRate:
    "Määrä: eristyksiä viikossa tarkalla Poisson-luottamusvälillä sekä sataa viljelyä kohti. Jos osasto vain otti enemmän näytteitä, ensimmäinen luku nousee ja toinen ei.",
  tourResCompare:
    "Vertaa: nämä 61 päivää edeltäviin 61 päivään. Ensin lause, sitten osuuksien ero, viikkotiheyksien suhde luottamusväleineen ja trenditesti viikkojen yli.",
  tourResBeta:
    "Uskomus: Beta-posteriorijakauma todelliselle ESBL-osuudelle, kun n:stä testatusta k oli resistenttejä, tasaisella priorilla. Tämän leikkauksen valossa osuus on 95 %:n välillä 95 %:n todennäköisyydellä.",
  tourResDetector:
    "Tunnistin: käytössä oleva fenotyypin ylimäärä -sääntö ajettuna tälle jaksolle, 28 päivää edeltävää vuotta vasten. Se nostaa Sisätaudit A:n esiin 30. huhtikuuta: seitsemän ESBL-löydöstä, odotettu noin 1,4.",
  tourResCode:
    "Jokaisella tuloksella on koodinsa. Tämä on tunnistimen, Pythonina tai R:nä, liitettäväksi pidempään skriptiin tai avattavaksi Toista-ikkunassa.",
  tourResReproduce:
    "Avaa Toista-ikkunassa vie jäädytetyn leikkauksen ja täsmälleen tämän koodin omaan välilehteensä. Arvioija ajaa saman kuin sinä, ei muuta.",
  tourResInfer:
    "Mitä aineisto kantaa: että nousu ylittää sattuman, milloin se alkoi ja missä. Ei sitä, levisikö yksi kanta tai miksi. Siihen tarvitaan laboratorion tyypitys.",
  tourResOutro: "Tutkijan näkymä: kysymys, kiinteä leikkaus laboratorion aineistosta, luvut ja niiden takana oleva koodi. Sinun vuorosi.",
};
