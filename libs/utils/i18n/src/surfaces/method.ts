// Copy for the Method page (apps/web/src/components/method). Keys are global: prefix `method`.

export const methodEn = {
  methodNav: "Method",
  methodTitle: "How the numbers are made",
  methodLead: "Each step shows the live rule and the experiments beside it.",
  methodStep1: "Coverage",
  methodStep2: "Organism mix",
  methodStep3: "Detection",
  methodStep4: "Spread",
  methodSentence1: "The share of isolates a drug covers, with its 95 % Wilson interval.",
  methodSentence2: "Experiment only: the mix is estimated apart from susceptibility.",
  methodSentence3: "A count is judged against its usual level.",
  methodSentence4: "Which units patients came from, and where counties rise.",
  methodInfo1:
    "Live rule (D-023, D-033): the unit's last 365 days if it has 30 isolates, else its ward type, else the hospital. Experiments 0012 and 0014 test other estimates; the list does not use them.",
  methodInfo2: "Experiment 0013 multiplies each organism's share by its susceptibility. The live list pools all organisms.",
  methodInfo3:
    "Live test (D-020): the count over 28 days against a Poisson mean from the 365 days before, raised at the detector's level. It reads raw weekly counts (D-039). Experiments 0015, 0016 and 0018 are candidates.",
  methodInfo4:
    "Experiment 0019 ranks units by exposure on the patient-flow graph against rewired graphs. Experiment 0020 forecasts county counts a month ahead against last month's count.",
  methodLiveRule: "the live rule (D-023, D-033)",
  methodLiveTest: "the live test (D-020)",
  methodCandidate: "experiment, candidate — not the live estimate",
  methodHospital: "inside the hospital",
  methodRegional: "regional",
  methodCaption: "Experiment {n} · {name} · branch overnight/experiments · experiment record",
  methodCoverageLine: "{drug} · {unit} · urine · {covered} of {known} · as of {date}",
  methodAlertLine: "{unit} · {phenotype} · alert {date} · as of {asOf}",
  methodLoading: "Loading…",
  methodUnavailable: "Not available.",
  methodNoAlert: "No detector alert with a count yet.",
  methodName0012: "discounted Beta-binomial over time",
  methodName0013: "Dirichlet organism mix",
  methodName0014: "pooling levels",
  methodName0015: "Gamma-Poisson with guard band",
  methodName0016: "CUSUM",
  methodName0018: "Bayesian change-point detection",
  methodName0019: "exposure ranking",
  methodName0020: "county forecast skill",
  methodAlt0012:
    "Line chart over 2025: coverage of one drug in one unit as the discounted estimate with its 90 % band, against the flat hospital year, with weekly covered and not covered counts below.",
  methodAlt0013:
    "Stacked bars: each organism's share of isolates, with its susceptible share and interval, next to the combined coverage against the threshold.",
  methodAlt0014:
    "Interval plot: coverage with the hospital, inpatient or outpatient, ward class and unit as the pool, each with its counts, against the threshold.",
  methodAlt0015:
    "Weekly patients with a phenotype in one unit, baseline weeks in grey and the window in black, the predictive range at the right and the first signal marked.",
  methodAlt0016:
    "Two panels for one unit: new patients per week against the expected rate, and the CUSUM evidence rising past the alarm limit on the alarm day.",
  methodAlt0018:
    "Weekly counts with the filtered rate and its 80 % band after a change, and below it the probability of a recent change against its alert level.",
  methodAlt0019:
    "Bars: each unit's share of inflow from the source unit against the band of 1,000 rewired graphs, with the eight-week outcome beside it.",
  methodAlt0020:
    "Interval plot: one-month-ahead forecast skill against persistence, pooled and by phenotype, for the Poisson model and seasonal naive.",
};

export const methodFi: Record<keyof typeof methodEn, string> = {
  methodNav: "Menetelmä",
  methodTitle: "Miten luvut syntyvät",
  methodLead: "Jokaisessa vaiheessa käytössä oleva sääntö ja sen vieressä kokeet.",
  methodStep1: "Kattavuus",
  methodStep2: "Bakteerijakauma",
  methodStep3: "Havaitseminen",
  methodStep4: "Leviäminen",
  methodSentence1: "Lääkkeen kattamien löydösten osuus ja sen 95 %:n Wilson-väli.",
  methodSentence2: "Vain koe: jakauma arvioidaan erillään herkkyydestä.",
  methodSentence3: "Määrää verrataan sen tavalliseen tasoon.",
  methodSentence4: "Mistä yksiköistä potilaat tulivat ja missä maakunnissa luvut nousevat.",
  methodInfo1:
    "Käytössä oleva sääntö (D-023, D-033): yksikön viimeiset 365 päivää, jos löydöksiä on 30, muuten osastotyyppi, muuten sairaala. Kokeet 0012 ja 0014 kokeilevat muita arvioita; lista ei käytä niitä.",
  methodInfo2: "Koe 0013 kertoo kunkin bakteerin osuuden sen herkkyydellä. Käytössä oleva lista yhdistää kaikki bakteerit.",
  methodInfo3:
    "Käytössä oleva testi (D-020): 28 päivän määrä verrattuna edeltävien 365 päivän Poisson-keskiarvoon, hälytys tunnistimen tasolla. Se lukee raakoja viikkomääriä (D-039). Kokeet 0015, 0016 ja 0018 ovat ehdokkaita.",
  methodInfo4:
    "Koe 0019 järjestää yksiköt altistuksen mukaan potilasvirtaverkossa suhteessa satunnaistettuihin verkkoihin. Koe 0020 ennustaa maakuntien määrät kuukauden eteenpäin ja vertaa edellisen kuun määrään.",
  methodLiveRule: "käytössä oleva sääntö (D-023, D-033)",
  methodLiveTest: "käytössä oleva testi (D-020)",
  methodCandidate: "koe, ehdokas — ei käytössä oleva arvio",
  methodHospital: "sairaalan sisällä",
  methodRegional: "alueellinen",
  methodCaption: "Koe {n} · {name} · haara overnight/experiments · koetiedot",
  methodCoverageLine: "{drug} · {unit} · virtsa · {covered} / {known} · tilanne {date}",
  methodAlertLine: "{unit} · {phenotype} · hälytys {date} · tilanne {asOf}",
  methodLoading: "Ladataan…",
  methodUnavailable: "Ei saatavilla.",
  methodNoAlert: "Ei vielä tunnistimen hälytystä, jossa on määrä.",
  methodName0012: "diskontattu beta-binomiaali ajan yli",
  methodName0013: "Dirichlet-bakteerijakauma",
  methodName0014: "yhdistämistasot",
  methodName0015: "Gamma-Poisson ja suojaväli",
  methodName0016: "CUSUM",
  methodName0018: "bayesilainen muutoskohdan havaitseminen",
  methodName0019: "altistuksen järjestys",
  methodName0020: "maakuntaennusteiden taito",
  methodAlt0012:
    "Viivakuvio vuodelta 2025: yhden lääkkeen kattavuus yhdessä yksikössä diskontattuna arviona 90 %:n vyöhykkeineen, verrattuna sairaalan tasaiseen vuoteen, alla viikoittaiset katetut ja kattamattomat määrät.",
  methodAlt0013:
    "Pinotut palkit: kunkin bakteerin osuus löydöksistä sekä herkkien osuus ja väli, vieressä yhdistetty kattavuus rajaa vasten.",
  methodAlt0014:
    "Välikuvio: kattavuus kun joukkona on sairaala, vuode- tai avo-osasto, osastoluokka tai yksikkö, kullakin määrät, rajaa vasten.",
  methodAlt0015:
    "Viikoittaiset potilaat, joilla on tietty fenotyyppi yhdessä yksikössä: vertailuviikot harmaina ja ikkuna mustana, ennusteväli oikealla ja ensimmäinen signaali merkittynä.",
  methodAlt0016:
    "Kaksi kuvaa yhdestä yksiköstä: uudet potilaat viikossa odotettua tasoa vasten sekä CUSUM-näyttö, joka ylittää hälytysrajan hälytyspäivänä.",
  methodAlt0018:
    "Viikkomäärät ja suodatettu taso 80 %:n vyöhykkeineen muutoksen jälkeen, alla viimeaikaisen muutoksen todennäköisyys hälytystasoa vasten.",
  methodAlt0019:
    "Palkit: kunkin yksikön osuus lähdeyksikön potilasvirrasta 1 000 satunnaistetun verkon vyöhykettä vasten, vieressä kahdeksan viikon tulos.",
  methodAlt0020:
    "Välikuvio: yhden kuukauden ennusteen taito suhteessa edelliseen kuukauteen, yhteensä ja fenotyypeittäin, Poisson-mallille ja kausittaiselle naiville mallille.",
};
