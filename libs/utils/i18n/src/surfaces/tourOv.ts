// Copy for the full presentation: the start page, the data page, a project with its windows, tools and notebook,
// and the doctor's view. A cursor walks the real screens. Short, plain, a little dry. Keys are global: prefix `tourOv`.
// The arc: what it is → where the data comes from and how it is trusted → how you work with it → what each role gets.

export const tourOvEn = {
  tourOvOfferTitle: "Want the full tour?",
  tourOvOfferBody:
    "Three minutes. A cursor walks the real screens: where the data comes from, how it is checked, and what the doctor, infection control and the researcher each get.",
  tourOvOfferPlay: "Play the tour",
  tourOvOfferSkip: "Not now",
  tourOvBoxTitle: "Take the tour",
  tourOvBoxNote: "Three minutes, the whole product",
  tourOvWelcome:
    "YL turns the culture results a lab already sends into a live picture of antibiotic resistance. Today that picture is one report a year, hospital-wide.",
  tourOvAsk: "Start from a question. The box takes a ward, an organism or an antibiotic; the three below are one click.",
  tourOvDemos: "Three demo files, one per role, filled in as if they had been used for a while. We open two of them in a minute.",
  tourOvTemplates:
    "Or start your own from a template: an outbreak investigation, a unit's antibiogram, one patient, the region, or a blank desk.",
  tourOvDataGo: "First, where the numbers come from. Every window in the tool reads from this page.",
  tourOvImport:
    "Results arrive as HL7 v2, FHIR or CSV, what lab systems already send. Drop or paste a message here and it is read on the spot.",
  tourOvSources:
    "Connected now. The lab feed is the organisers' synthetic dataset, replayed one day at a time; the THL figures beside it are real.",
  tourOvChecks:
    "Fifteen plausibility checks run over every row: duplicates, impossible dates, a result that contradicts the organism. Findings are listed, never dropped.",
  tourOvOpen:
    "Now a project: infection control's weekly watch on one unit. The Summary comes first: one sentence, seen against expected, and a button to the evidence.",
  tourOvWindows:
    "Below it, the evidence: a project is a set of windows. Here the signal list, the notebook and the patient flow between units.",
  tourOvGuide: "Every window has an i. It says in a sentence or two what the window shows and how to read it, so nobody needs a manual.",
  tourOvAdd: "Add a window: the picker lists every kind a project can show. The same kind can be added more than once.",
  tourOvPick: "The unit grid: every unit side by side over recent weeks, on one scale, so the one that differs from the rest stands out.",
  tourOvTools:
    "Statistics: rate, compare, share over time, a detector. Each result shows the formula, the numbers that went in and the code.",
  tourOvNotebook:
    "The notebook keeps the exact slice of data, the analyses and the notes together, so the week's work can be read and rerun later.",
  tourOvDoctor:
    "Last, the doctor's view: ward, sample and severity preset. One line says what to start with and on how many results; the doctor decides.",
  tourOvOutro: "That is YL. The demo files are in the sidebar, each with a deeper tour of its own; open one and change anything.",
};

export const tourOvFi: Record<keyof typeof tourOvEn, string> = {
  tourOvOfferTitle: "Haluatko koko esittelyn?",
  tourOvOfferBody:
    "Kolme minuuttia. Kursori kulkee oikeiden näyttöjen läpi: mistä aineisto tulee, miten se tarkistetaan ja mitä lääkäri, infektioiden torjunta ja tutkija kukin saavat.",
  tourOvOfferPlay: "Näytä esittely",
  tourOvOfferSkip: "Ei nyt",
  tourOvBoxTitle: "Katso esittely",
  tourOvBoxNote: "Kolme minuuttia, koko tuote",
  tourOvWelcome:
    "YL muuttaa laboratorion jo lähettämät viljelyvastaukset eläväksi kuvaksi antibioottiresistenssistä. Nykyisin se kuva on yksi raportti vuodessa, koko sairaalasta.",
  tourOvAsk:
    "Aloita kysymyksestä. Kenttään käy yksikkö, bakteeri tai antibiootti; kolme alla olevaa kysymystä aukeavat yhdellä napsautuksella.",
  tourOvDemos:
    "Kolme esimerkkitiedostoa, yksi kullekin roolille, täytettynä kuin niitä olisi käytetty jonkin aikaa. Kaksi niistä avataan kohta.",
  tourOvTemplates: "Tai aloita omasi pohjasta: epidemiaselvitys, yksikön antibiogrammi, yksi potilas, alue tai tyhjä pöytä.",
  tourOvDataGo: "Ensin se, mistä luvut tulevat. Jokainen ikkuna lukee tältä sivulta.",
  tourOvImport:
    "Tulokset tulevat HL7 v2-, FHIR- tai CSV-muodossa, eli siinä, mitä laboratoriojärjestelmät jo lähettävät. Pudota tai liitä viesti tähän, niin se luetaan heti.",
  tourOvSources:
    "Yhdistetty nyt. Laboratoriovirta on järjestäjän synteettinen aineisto, joka toistetaan päivä kerrallaan; viereiset THL:n luvut ovat todellisia.",
  tourOvChecks:
    "Viisitoista uskottavuustarkistusta käy läpi jokaisen rivin: kaksoiskappaleet, mahdottomat päivämäärät, bakteerin kanssa ristiriitainen tulos. Huomiot listataan, rivejä ei pudoteta.",
  tourOvOpen:
    "Nyt projekti: infektioiden torjunnan viikkoseuranta yhdessä yksikössä. Yhteenveto tulee ensin: yksi lause, havaittu ja odotettu, ja painike perusteluihin.",
  tourOvWindows: "Sen alla perustelut: projekti on joukko ikkunoita. Tässä signaalilista, muistio ja potilasvirta yksiköiden välillä.",
  tourOvGuide:
    "Jokaisessa ikkunassa on i. Se kertoo parilla lauseella, mitä ikkuna näyttää ja miten sitä luetaan, joten ohjekirjaa ei tarvita.",
  tourOvAdd: "Lisää ikkuna: valikko listaa kaikki tyypit, joita projekti voi näyttää. Samaa tyyppiä voi lisätä useamman.",
  tourOvPick: "Yksikköruudukko: kaikki yksiköt rinnakkain viime viikoilta, samalla asteikolla, jotta muista poikkeava erottuu.",
  tourOvTools: "Tilastot: määrä, vertailu, osuus ajan yli, tunnistin. Jokainen tulos näyttää kaavan, siihen menneet luvut ja koodin.",
  tourOvNotebook:
    "Muistio pitää tarkan aineistorajauksen, analyysit ja muistiinpanot yhdessä, joten viikon työn voi lukea ja ajaa uudelleen myöhemmin.",
  tourOvDoctor:
    "Lopuksi lääkärin näkymä: yksikkö, näyte ja vaikeusaste valmiina. Yksi rivi kertoo, millä aloittaa ja kuinka monen tuloksen varassa se on; lääkäri päättää.",
  tourOvOutro: "Tämä on YL. Esimerkkitiedostot ovat sivupalkissa, kullakin oma tarkempi esittelynsä; avaa yksi ja muuta mitä vain.",
};
