// Copy for the demo files: ready-made projects that show what the tool does for each kind of user. Keys are global: prefix them `demo`.

export const demoEn = {
  demoFilling: "Filling in the demo…",
  demoShowcase: "Product showcase",
  demoShowcaseStart: "Play the showcase",
  demoShowcaseHint:
    "2 min. A cursor shows the whole product on the real screens, for a screen recording with your own voice-over: the demo files are reset, open tabs closed, the clock paused at 12 May 2025. Esc stops it.",
  demoShowcaseCountdown: "Starts in {n}",
  answerNone: "Nothing unusual right now",
  answerNoneNote: "No open signals {where} as of this date.",
  answerEverywhere: "anywhere in the hospital",
  answerOpenOne: "1 open signal",
  answerOpenCount: "{n} open signals",
  answerSeen: "Seen",
  answerUsual: "Usual",
  answerEvidence: "Show the evidence",
  answerFlow: "Where patients came from",
  demoSection: "Demo files",
  demoHint: "Ready-made projects, filled in as if they had been used. Open one to see what the tool does for that role.",
  demoOpenError: "The demo file could not be opened. Try again.",
  demoSuggest: "Nothing here yet. Start with a demo",
  demoSuggestNote: "{title}: a ready-made project with a two-minute guided tour. Your own projects will appear here.",
  demoSuggestOpen: "Open the {role} demo",
  demoRoleClinician: "Doctor",
  demoRoleControl: "Infection control · continuous review",
  demoRoleResearcher: "Researcher",
  demoClinicianTitle: "Empiric therapy at the bedside",
  demoClinicianBlurb:
    "A urinary tract infection on Internal medicine A: which antibiotics cover the likely organisms, with the ward's own signals beside it.",
  demoControlTitle: "Weekly risk watch, Urology",
  demoControlBlurb:
    "Left open all week: the timeline, the signal list, where the patients came from, and a notebook of what was checked and what to look at next.",
  demoResearcherTitle: "ESBL cluster on Internal medicine A",
  demoResearcherBlurb:
    "A frozen, reproducible analysis: the slice, notes, the rate, the weeks before, a Beta estimate, the detector, the Python and a chart.",
  demoNoteClinician: "",
  demoNoteControlHead:
    "## Monday check\n\nThe ESBL cluster on Urology is the open signal: 4 patients in 4 weeks, about 0.2 expected. Patient flow shows where the unit's patients came from.",
  demoNoteControlNext:
    "## To do this week\n\n- Ask the ward whether contact precautions were in place from the first isolate.\n- Re-read the weekly rate on Thursday: a second week above usual makes it an outbreak.\n- Look at Geriatrics, where the sampling gap is still open.",
  demoNoteResearcherQuestion:
    "## Question\n\nDid ESBL-producing isolates on Internal medicine A rise above their usual rate in spring 2025, and is the rise larger than week-to-week noise?\n\nThe slice below is frozen: every number on this page comes from the same cut of the data and can be reproduced in Python or R.",
  demoNoteResearcherRead:
    "## Reading\n\nThe share alone does not separate the two periods: 7 of 108 tested isolates were ESBL (6.5 %) against 6 of 111 (5.4 %) in the 61 days before, a difference of 1.1 points whose interval includes zero. The count says more: the detector flags Internal medicine A on 30 April, seven ESBL isolates in 28 days against about 1.4 expected. Next: check whether sampling changed (the rate per 100 cultures) and repeat for Internal medicine B as a control unit.",
};

export const demoFi: Record<keyof typeof demoEn, string> = {
  demoFilling: "Täytetään esimerkkiä…",
  demoShowcase: "Tuote-esittely",
  demoShowcaseStart: "Toista esittely",
  demoShowcaseHint:
    "2 min. Kursori näyttää koko tuotteen oikeilla näytöillä, ruutunauhoitusta ja omaa selostusta varten: esimerkkitiedostot nollataan, avoimet välilehdet suljetaan, kello pysäytetään 12.5.2025:een. Esc keskeyttää.",
  demoShowcaseCountdown: "Alkaa {n} s kuluttua",
  answerNone: "Ei mitään epätavallista juuri nyt",
  answerNoneNote: "Ei avoimia signaaleja {where} tähän päivään mennessä.",
  answerEverywhere: "missään sairaalassa",
  answerOpenOne: "1 avoin signaali",
  answerOpenCount: "{n} avointa signaalia",
  answerSeen: "Havaittu",
  answerUsual: "Tavallisesti",
  answerEvidence: "Näytä perustelut",
  answerFlow: "Mistä potilaat tulivat",
  demoSection: "Esimerkkitiedostot",
  demoHint: "Valmiita projekteja, täytetty kuin niitä olisi käytetty. Avaa yksi nähdäksesi, mitä työkalu tekee kyseiselle roolille.",
  demoOpenError: "Esimerkkitiedostoa ei voitu avata. Yritä uudelleen.",
  demoSuggest: "Täällä ei ole vielä mitään. Aloita esimerkistä",
  demoSuggestNote: "{title}: valmis projekti ja kahden minuutin esittely. Omat projektisi näkyvät tässä.",
  demoSuggestOpen: "Avaa esimerkki: {role}",
  demoRoleClinician: "Lääkäri",
  demoRoleControl: "Infektioiden torjunta · jatkuva seuranta",
  demoRoleResearcher: "Tutkija",
  demoClinicianTitle: "Empiirinen hoito potilaan luona",
  demoClinicianBlurb:
    "Virtsatieinfektio sisätaudit A -yksikössä: mitkä antibiootit kattavat todennäköiset bakteerit, yksikön omat signaalit vieressä.",
  demoControlTitle: "Viikoittainen riskiseuranta, Urologia",
  demoControlBlurb:
    "Auki koko viikon: aikajana, signaalilista, mistä potilaat tulivat ja muistio siitä, mitä tarkistettiin ja mitä katsotaan seuraavaksi.",
  demoResearcherTitle: "ESBL-klusteri, Sisätaudit A",
  demoResearcherBlurb:
    "Jäädytetty, toistettava analyysi: otanta, muistiinpanot, ilmaantuvuus, edelliset viikot, Beta-arvio, tunnistin, Python ja kuvaaja.",
  demoNoteClinician: "",
  demoNoteControlHead:
    "## Maanantain tarkistus\n\nUrologian ESBL-klusteri on avoin signaali: 4 potilasta 4 viikossa, odotettu noin 0,2. Potilasvirta näyttää, mistä yksikön potilaat tulivat.",
  demoNoteControlNext:
    "## Tämän viikon tehtävät\n\n- Kysy osastolta, oliko kontaktieristys käytössä ensimmäisestä löydöksestä alkaen.\n- Lue viikkoilmaantuvuus uudelleen torstaina: toinen tavallista korkeampi viikko tekee siitä epidemian.\n- Katso Geriatriaa, jossa näytteenottoaukko on yhä auki.",
  demoNoteResearcherQuestion:
    "## Kysymys\n\nNousivatko ESBL-tuottajat Sisätaudit A:lla tavallista korkeammalle keväällä 2025, ja onko nousu suurempi kuin viikoittainen vaihtelu?\n\nAlla oleva otanta on jäädytetty: jokainen luku tällä sivulla tulee samasta aineistoleikkauksesta ja on toistettavissa Pythonilla tai R:llä.",
  demoNoteResearcherRead:
    "## Tulkinta\n\nPelkkä osuus ei erota jaksoja: 7 testatusta 108 löydöksestä oli ESBL (6,5 %), edeltävien 61 päivän 111:stä 6 (5,4 %), eli 1,1 prosenttiyksikön ero, jonka luottamusväli sisältää nollan. Lukumäärä kertoo enemmän: tunnistin nostaa Sisätaudit A:n esiin 30. huhtikuuta, seitsemän ESBL-löydöstä 28 päivässä, odotettu noin 1,4. Seuraavaksi: tarkista, muuttuiko näytteenotto (ilmaantuvuus sataa viljelyä kohti) ja toista Sisätaudit B:lle verrokkiyksikkönä.",
};
