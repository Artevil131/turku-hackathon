// Copy for the demo files: ready-made projects that show what the tool does for each kind of user. Keys are global: prefix them `demo`.

export const demoEn = {
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
  demoRoleControl: "Infection control, continuous watch",
  demoRoleResearcher: "Researcher",
  demoClinicianTitle: "Empiric therapy at the bedside",
  demoClinicianBlurb:
    "A urinary tract infection on Internal medicine A: which antibiotics cover the likely organisms, with the ward's own signals beside it.",
  demoControlTitle: "Weekly risk watch, Internal medicine A",
  demoControlBlurb:
    "Left open all week: the timeline, the signal list, where the patients came from, and a notebook of what was checked and what to look at next.",
  demoResearcherTitle: "ESBL cluster on Internal medicine A",
  demoResearcherBlurb:
    "A frozen, reproducible analysis: the slice, notes, the rate, the weeks before, a Beta estimate, the detector, the Python and a chart.",
  demoNoteClinician: "",
  demoNoteControlHead:
    "## Monday check\n\nThe ESBL cluster on Internal medicine A is the open signal. Seven patients since 2 April against about 1.4 usual. Patient flow shows the emergency department as the largest source of the unit's patients (28 %).",
  demoNoteControlNext:
    "## To do this week\n\n- Ask the ward whether contact precautions were in place from the first isolate.\n- Re-read the weekly rate on Thursday: a second week above usual makes it an outbreak.\n- Look at Geriatrics, where the sampling gap is still open.",
  demoNoteResearcherQuestion:
    "## Question\n\nDid ESBL-producing isolates on Internal medicine A rise above their usual rate in spring 2025, and is the rise larger than week-to-week noise?\n\nThe slice below is frozen: every number on this page comes from the same cut of the data and can be reproduced in Python or R.",
  demoNoteResearcherRead:
    "## Reading\n\nThe rate is well above what the weeks before would give, and the comparison with the previous 61 days agrees. The detector flagged the cluster on the same dates. Next step for the paper: describe the isolates (specimen, age group) and repeat for Internal medicine B as a control unit.",
};

export const demoFi: Record<keyof typeof demoEn, string> = {
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
  demoRoleControl: "Infektioiden torjunta, jatkuva seuranta",
  demoRoleResearcher: "Tutkija",
  demoClinicianTitle: "Empiirinen hoito potilaan luona",
  demoClinicianBlurb:
    "Virtsatieinfektio sisätaudit A -yksikössä: mitkä antibiootit kattavat todennäköiset bakteerit, yksikön omat signaalit vieressä.",
  demoControlTitle: "Viikoittainen riskiseuranta, Sisätaudit A",
  demoControlBlurb:
    "Auki koko viikon: aikajana, signaalilista, mistä potilaat tulivat ja muistio siitä, mitä tarkistettiin ja mitä katsotaan seuraavaksi.",
  demoResearcherTitle: "ESBL-klusteri, Sisätaudit A",
  demoResearcherBlurb:
    "Jäädytetty, toistettava analyysi: otanta, muistiinpanot, ilmaantuvuus, edelliset viikot, Beta-arvio, tunnistin, Python ja kuvaaja.",
  demoNoteClinician: "",
  demoNoteControlHead:
    "## Maanantain tarkistus\n\nSisätaudit A:n ESBL-klusteri on avoin signaali. Seitsemän potilasta 2. huhtikuusta, tavallisesti noin 1,4. Potilasvirta näyttää päivystyksen yksikön suurimpana lähteenä (28 %).",
  demoNoteControlNext:
    "## Tämän viikon tehtävät\n\n- Kysy osastolta, oliko kontaktieristys käytössä ensimmäisestä löydöksestä alkaen.\n- Lue viikkoilmaantuvuus uudelleen torstaina: toinen tavallista korkeampi viikko tekee siitä epidemian.\n- Katso Geriatriaa, jossa näytteenottoaukko on yhä auki.",
  demoNoteResearcherQuestion:
    "## Kysymys\n\nNousivatko ESBL-tuottajat Sisätaudit A:lla tavallista korkeammalle keväällä 2025, ja onko nousu suurempi kuin viikoittainen vaihtelu?\n\nAlla oleva otanta on jäädytetty: jokainen luku tällä sivulla tulee samasta aineistoleikkauksesta ja on toistettavissa Pythonilla tai R:llä.",
  demoNoteResearcherRead:
    "## Tulkinta\n\nIlmaantuvuus on selvästi korkeampi kuin edellisten viikkojen perusteella odottaisi, ja vertailu edelliseen 61 päivään on samaa mieltä. Tunnistin nosti klusterin esiin samoina päivinä. Artikkelia varten seuraavaksi: kuvaile löydökset (näytetyyppi, ikäryhmä) ja toista Sisätaudit B:lle verrokkiyksikkönä.",
};
