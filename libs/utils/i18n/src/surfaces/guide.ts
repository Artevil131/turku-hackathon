// Copy for the window guide: what each window kind is and what to try in it, read by the adaptive tour (a cursor
// walks whichever windows are open) and by the Docs page. Short: a sentence on what it shows, then actions.
// Keys are global: `tourGd` for what the tour says, `docs` for the Docs page. English and Finnish carry the same keys.

export const guideEn = {
  tourGdOfferTitle: "Take a short tour of this screen?",
  tourGdOfferBody: "A cursor points at each open window and says what it shows.",
  tourGdIntro: "A short look at the windows open on this screen.",
  tourGdEmpty: "Nothing is open yet. Press Add a window to choose one.",
  tourGdOutro: "Add a window or open a tool at any time. Guide in the sidebar plays this again.",
  tourGdButton: "Guide",
  tourGdButtonTip: "A short tour of the windows on this screen",

  tourGdTitle_chart: "Chart",

  tourGdWhat_timeline: "The lab feed week by week, one lane per unit. Each pill is a signal.",
  tourGdTry_timeline_1: "Click a pill to open its signal.",
  tourGdTry_timeline_2: "Click a unit's code to focus on it.",

  tourGdWhat_signals: "Every signal found so far, newest first.",
  tourGdTry_signals_1: "Click a row to see its numbers.",
  tourGdTry_signals_2: "Filter by unit or kind at the top.",

  tourGdWhat_map: "Notified cases per county from THL open data, for the latest month. Darker means more.",
  tourGdTry_map_1: "Pick a layer, such as MRSA carriage.",
  tourGdTry_map_2: "Click a county to open its numbers and forecast.",

  tourGdWhat_graph: "Patient flow between units: which units share patients.",
  tourGdTry_graph_1: "Click a unit to follow its patients.",

  tourGdWhat_math: "How a chosen signal was calculated: the isolates and the math.",
  tourGdTry_math_1: "Choose a signal in the list; its calculation appears here.",

  tourGdWhat_assistant: "Plain-language answers about the signal you chose.",
  tourGdTry_assistant_1: "Choose a signal; the answers appear here.",

  tourGdWhat_grid: "Every unit side by side over recent weeks, to see which ones differ.",
  tourGdTry_grid_1: "Switch the phenotype or the number of weeks.",

  tourGdWhat_reproduce: "The same analysis as code in Python or R, from the same data cut.",
  tourGdTry_reproduce_1: "Pick Python or R.",

  tourGdWhat_notebook: "Your write-up: notes, data slices and analyses, saved with the project.",
  tourGdTry_notebook_1: "Press + to add a note or an analysis.",
  tourGdTry_notebook_2: "Open a result to see its formula and code.",

  tourGdWhat_coverage: "Which antibiotics are likely to work for a case, ranked for your unit.",
  tourGdTry_coverage_1: "Start with the top row.",
  tourGdTry_coverage_2: "Change the case if it does not fit.",

  tourGdWhat_answer: "The one thing to know right now, in a sentence.",
  tourGdTry_answer_1: "Press Show the evidence to see why.",

  tourGdWhat_chart: "One measure over time, pinned from the data or from a result.",
  tourGdTry_chart_1: "Copy or download it for a report.",

  shellDocs: "Docs",
  docsTitle: "Docs",
  docsAbout:
    "agar is the Tyks antibiotic efficacy indicator: the last four weeks of culture results beside the year, with deviations flagged. A project is a set of windows; each is described below.",
  docsShow: "Show me",
  docsShowTip: "Open a new project with this window",
  docsMethod: "Statistics: the Method page",
  docsError: "Could not open the project. Try again.",
};

export const guideFi: Record<keyof typeof guideEn, string> = {
  tourGdOfferTitle: "Lyhyt kierros tähän näkymään?",
  tourGdOfferBody: "Kursori osoittaa jokaista avointa ikkunaa ja kertoo, mitä se näyttää.",
  tourGdIntro: "Lyhyt katsaus tämän näkymän avoimiin ikkunoihin.",
  tourGdEmpty: "Mitään ei ole auki. Valitse ikkuna painamalla Lisää ikkuna.",
  tourGdOutro: "Voit lisätä ikkunan tai avata työkalun milloin vain. Sivupalkin Opas toistaa tämän.",
  tourGdButton: "Opas",
  tourGdButtonTip: "Lyhyt kierros tämän näkymän ikkunoihin",

  tourGdTitle_chart: "Kaavio",

  tourGdWhat_timeline: "Laboratorion data viikko viikolta, yksi kaista yksikköä kohti. Jokainen kapseli on signaali.",
  tourGdTry_timeline_1: "Napsauta kapselia avataksesi signaalin.",
  tourGdTry_timeline_2: "Napsauta yksikön koodia keskittyäksesi siihen.",

  tourGdWhat_signals: "Kaikki löydetyt signaalit, uusin ensin.",
  tourGdTry_signals_1: "Napsauta riviä nähdäksesi luvut.",
  tourGdTry_signals_2: "Rajaa yksikön tai tyypin mukaan ylhäällä.",

  tourGdWhat_map: "THL:n avoimen datan ilmoitetut tapaukset maakunnittain viimeiseltä kuukaudelta. Tummempi tarkoittaa enemmän.",
  tourGdTry_map_1: "Valitse kerros, esimerkiksi MRSA-kantajuus.",
  tourGdTry_map_2: "Napsauta maakuntaa nähdäksesi luvut ja ennusteen.",

  tourGdWhat_graph: "Potilasvirta yksiköiden välillä: mitkä yksiköt jakavat potilaita.",
  tourGdTry_graph_1: "Napsauta yksikköä seurataksesi sen potilaita.",

  tourGdWhat_math: "Miten valittu signaali laskettiin: eristeet ja laskenta.",
  tourGdTry_math_1: "Valitse signaali listasta; laskenta ilmestyy tähän.",

  tourGdWhat_assistant: "Selkokieliset vastaukset valitusta signaalista.",
  tourGdTry_assistant_1: "Valitse signaali; vastaukset ilmestyvät tähän.",

  tourGdWhat_grid: "Kaikki yksiköt rinnakkain viime viikoilta, jotta näet mitkä poikkeavat.",
  tourGdTry_grid_1: "Vaihda fenotyyppiä tai viikkojen määrää.",

  tourGdWhat_reproduce: "Sama analyysi koodina, Pythonilla tai R:llä, samasta datarajauksesta.",
  tourGdTry_reproduce_1: "Valitse Python tai R.",

  tourGdWhat_notebook: "Oma muistiosi: huomautukset, datarajaukset ja analyysit, tallennettuna projektiin.",
  tourGdTry_notebook_1: "Lisää huomautus tai analyysi +-painikkeella.",
  tourGdTry_notebook_2: "Avaa tulos nähdäksesi kaavan ja koodin.",

  tourGdWhat_coverage: "Mitkä antibiootit todennäköisesti tepsivät tapaukseen, järjestettynä yksikkösi mukaan.",
  tourGdTry_coverage_1: "Aloita ylimmästä rivistä.",
  tourGdTry_coverage_2: "Muuta tapausta, jos se ei sovi.",

  tourGdWhat_answer: "Tärkein asia juuri nyt yhdellä lauseella.",
  tourGdTry_answer_1: "Paina Näytä perustelut nähdäksesi miksi.",

  tourGdWhat_chart: "Yksi mittari ajan yli, kiinnitetty datasta tai tuloksesta.",
  tourGdTry_chart_1: "Kopioi tai lataa se raporttia varten.",

  shellDocs: "Ohjeet",
  docsTitle: "Ohjeet",
  docsAbout:
    "agar on Tyksin antibioottitehon mittari: viimeiset neljä viikkoa viljelytuloksia vuoden rinnalla, poikkeamat merkittyinä. Projekti on joukko ikkunoita; jokainen on kuvattu alla.",
  docsShow: "Näytä",
  docsShowTip: "Avaa uusi projekti tällä ikkunalla",
  docsMethod: "Tilastot: Menetelmä-sivu",
  docsError: "Projektia ei voitu avata. Yritä uudelleen.",
};
