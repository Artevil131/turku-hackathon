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
  methodMath: "Formulas",
  methodBbTitle: "Beta-binomial over time: why each week is two additions",
  methodBbConjugate:
    "A Beta belief about the share times a binomial count gives a Beta again. Shrinking last week's counts by δ before adding this week's keeps it a Beta: old isolates fade, and the cell drifts back toward the hospital share p₀ with the weight of M isolates.",
  methodBbDiscountLabel: "Discount: last week's Beta shrinks toward the hospital prior",
  methodBbUpdateLabel: "Update: add this week's susceptible and resistant isolates",
  methodBbPredictLabel: "Predict: the next isolates follow a Beta-binomial; the estimate is its mean",
  methodBbSymbols:
    "sₜ of nₜ isolates susceptible in week t; an isolate k weeks old weighs δᵏ; own-data weight w = n_eff / (n_eff + M) with n_eff = aₜ + bₜ − M.",
  methodBbExact:
    "Exact as a conjugate filter (Smith 1979; Harvey and Fernandes 1989): discounting keeps the mean and widens the Beta. It is not literally a random walk on the log-odds.",
  methodBbStatus:
    "Status: the method is accepted (D-038), δ and M are open (QUESTIONS B1, B3). Experiment 0012 (δ 0.95, M 10): Brier +0.0002 against the hospital year, E1 seen after 48 days, so the live list keeps the 365-day share.",
  methodRule_wilson: "Coverage share, 95 % Wilson interval",
  methodRuleNote_wilson:
    "k of n first isolates covered over 365 days; the unit if n ≥ 30, else its ward type, else the hospital (D-023, D-033).",
  methodRule_poisson: "Profile and phenotype excess",
  methodRuleNote_poisson:
    "Patients in 28 days against the unit's share over the 365 days before; α 10⁻⁴ for a profile, 10⁻³ for a phenotype (D-020).",
  methodRule_drop: "Sampling drop",
  methodRuleNote_drop: "Cultures in the last 7 days against the 56-day daily mean (D-020).",
  methodRule_empty: "Empty run",
  methodRuleNote_empty: "L days in a row without cultures; λ is the unit's daily mean over the 56 days before (D-031).",
  methodRule_trend: "Rising trend",
  methodRuleNote_trend: "Cochran-Armitage over 28-day bins for 22 organism-drug pairs, one-sided, α 10⁻³ (D-020, D-022).",
  methodRule_sentinel: "New in unit",
  methodRuleNote_sentinel: "The first MRSA or VRE in an inpatient unit for 180 days alerts without a test (D-021, D-034).",
  methodResult0012: "Brier +0.0002 (−0.0000 to +0.0004) against the hospital year; E1 seen after 48 days.",
  methodResult0013:
    "Brier +0.0001 (−0.0000 to +0.0002); counting two-organism cultures as one episode lowers the top severe pick by 0.5 points.",
  methodResult0014: "The first year picks the hospital pool; no finer pool beats it.",
  methodResult0015: "Four-patient rare clusters: 21 % found at 1 episode a year (live set: 92 % at 3).",
  methodResult0016: "Four-patient rare clusters: 67 % at 3.5 episodes a year, 66 % on held-out seeds (live set: 92 %).",
  methodResult0018: "Four-patient rare clusters: 14 % at 1.5 episodes a year.",
  methodResult0019: "Pooled AUC 0.63 over 24 real episodes, not above rewired graphs (p 0.22).",
  methodResult0020: "Log score +0.40 (0.31 to 0.48) and MAE +0.14 against last month's count.",
  methodAlsoTested:
    "Also tested: Farrington-Noufaily (0017), 31 %; an ensemble of the live set and CUSUM (0022), level with the live set at 5 episodes a year. Every rate is for injected copies of one isolate, seed 2026, 200 trials.",
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
  methodMath: "Kaavat",
  methodBbTitle: "Beta-binomiaali ajassa: miksi jokainen viikko on kaksi yhteenlaskua",
  methodBbConjugate:
    "Beta-jakauma osuudesta kertaa binomiaalinen määrä on taas Beta. Kun edellisen viikon määriä pienennetään kertoimella δ ennen tämän viikon lisäämistä, jakauma pysyy Betana: vanhat löydökset haalistuvat ja solu palautuu kohti sairaalan osuutta p₀ M löydöksen painolla.",
  methodBbDiscountLabel: "Diskonttaus: edellisen viikon Beta kutistuu kohti sairaalan prioria",
  methodBbUpdateLabel: "Päivitys: lisää tämän viikon herkät ja resistentit löydökset",
  methodBbPredictLabel: "Ennuste: seuraavat löydökset noudattavat Beta-binomiaalia; arvio on sen keskiarvo",
  methodBbSymbols:
    "sₜ herkkää nₜ löydöksestä viikolla t; k viikkoa vanha löydös painaa δᵏ; oman datan paino w = n_eff / (n_eff + M), n_eff = aₜ + bₜ − M.",
  methodBbExact:
    "Tarkka konjugaattisuodin (Smith 1979; Harvey ja Fernandes 1989): diskonttaus säilyttää keskiarvon ja leventää Betaa. Se ei ole kirjaimellisesti satunnaiskävely log-vetosuhteella.",
  methodBbStatus:
    "Tila: menetelmä on hyväksytty (D-038), δ ja M ovat auki (QUESTIONS B1, B3). Koe 0012 (δ 0,95, M 10): Brier +0,0002 sairaalan vuoteen verrattuna, E1 näkyi 48 päivän jälkeen, joten käytössä oleva lista pitää 365 päivän osuuden.",
  methodRule_wilson: "Kattavuusosuus, 95 %:n Wilson-väli",
  methodRuleNote_wilson:
    "k n:stä ensimmäisestä löydöksestä katettu 365 päivässä; yksikkö jos n ≥ 30, muuten osastotyyppi, muuten sairaala (D-023, D-033).",
  methodRule_poisson: "Profiilin ja fenotyypin ylimäärä",
  methodRuleNote_poisson:
    "Potilaat 28 päivässä verrattuna yksikön osuuteen edeltävän 365 päivän aikana; α 10⁻⁴ profiilille, 10⁻³ fenotyypille (D-020).",
  methodRule_drop: "Näytteiden väheneminen",
  methodRuleNote_drop: "Viljelyt viimeisen 7 päivän aikana verrattuna 56 päivän päiväkeskiarvoon (D-020).",
  methodRule_empty: "Tyhjä jakso",
  methodRuleNote_empty: "L peräkkäistä päivää ilman viljelyjä; λ on yksikön päiväkeskiarvo edeltävän 56 päivän aikana (D-031).",
  methodRule_trend: "Nouseva trendi",
  methodRuleNote_trend: "Cochran-Armitage 28 päivän jaksoissa 22 bakteeri–lääkeparille, yksisuuntainen, α 10⁻³ (D-020, D-022).",
  methodRule_sentinel: "Uusi yksikössä",
  methodRuleNote_sentinel: "Ensimmäinen MRSA tai VRE vuodeosastolla 180 päivään hälyttää ilman testiä (D-021, D-034).",
  methodResult0012: "Brier +0,0002 (−0,0000…+0,0004) sairaalan vuoteen verrattuna; E1 näkyi 48 päivän jälkeen.",
  methodResult0013:
    "Brier +0,0001 (−0,0000…+0,0002); kahden bakteerin viljelyn laskeminen yhdeksi jaksoksi laskee vakavan infektion kärkivalintaa 0,5 prosenttiyksikköä.",
  methodResult0014: "Ensimmäinen vuosi valitsee sairaalan joukon; mikään tarkempi joukko ei voita sitä.",
  methodResult0015: "Neljän potilaan harvinaiset rypäät: 21 % löydetty, 1 jakso vuodessa (käytössä oleva joukko: 92 %, 3 jaksoa).",
  methodResult0016:
    "Neljän potilaan harvinaiset rypäät: 67 % 3,5 jaksolla vuodessa, 66 % erillisillä siemenillä (käytössä oleva joukko: 92 %).",
  methodResult0018: "Neljän potilaan harvinaiset rypäät: 14 % 1,5 jaksolla vuodessa.",
  methodResult0019: "Yhdistetty AUC 0,63 24 todellisessa jaksossa, ei satunnaistettuja verkkoja parempi (p 0,22).",
  methodResult0020: "Log-pistemäärä +0,40 (0,31…0,48) ja MAE +0,14 edellisen kuun määrään verrattuna.",
  methodAlsoTested:
    "Lisäksi kokeiltu: Farrington-Noufaily (0017), 31 %; käytössä olevan joukon ja CUSUMin yhdistelmä (0022), sama kuin käytössä oleva joukko 5 jaksolla vuodessa. Jokainen osuus koskee yhden löydöksen ruiskutettuja kopioita, siemen 2026, 200 koetta.",
};
