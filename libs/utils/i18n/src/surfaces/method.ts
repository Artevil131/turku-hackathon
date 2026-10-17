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
    "Live test (D-020): the count over 28 days against a Poisson mean from the 365 days before, raised at the detector's level. It reads raw weekly counts (D-042). Experiments 0015, 0016 and 0018 are candidates. The p value is a model-based surprise score for one look, not the probability that this is a real outbreak.",
  methodInfo4:
    'Experiment 0019 ranks units by exposure on the patient-flow graph against rewired graphs. Experiment 0020\'s county forecast ships (D-045) and shows in the region view: a smoothed next-month level with a predictive range, not an epidemic forecast. Regional "strong" means the signal survives the Bonferroni correction under the fitted model.',
  methodLiveRule: "the live rule (D-023, D-033)",
  methodLiveTest: "the live test (D-020)",
  methodCandidate: "experiment, candidate — not the live estimate",
  methodShipped: "experiment, shipped (D-045) — shown in the region view",
  methodShippedFigures:
    "Shipped setting: for four-patient injections of a rare, identical resistance profile into this synthetic dataset, 89 % found (95 % interval 84 to 93), median delay 6 days, about 4.5 signal episodes a year, about 1.0 of them cluster episodes (overnight benchmark, 2026-10-17).",
  methodPNote:
    "p is a model-based surprise score for one look, not the probability that this is a real outbreak. Regional strong means it survives the Bonferroni correction under the fitted model.",
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
  methodBbTitle: "Beta-binomial over time",
  methodBbConjugate: "Each week adds its counts to a Beta that stays a Beta; old weeks fade toward the hospital share.",
  methodBbDiscountLabel: "Discount toward the hospital share",
  methodBbUpdateLabel: "Add this week's counts",
  methodBbPredictLabel: "Predict the next isolates",
  methodBbStatus: "Accepted method (D-041), constants open (B1, B3). Experiment 0012 found no gain over the hospital year.",
  methodRule_wilson: "Coverage share, 95 % Wilson interval",
  methodRuleNote_wilson: "Last 365 days: the unit with 30 or more isolates, else its ward type, else the hospital · D-023, D-033",
  methodRule_poisson: "Profile and phenotype excess",
  methodRuleNote_poisson: "Profile / phenotype, 28 days against the unit's past year · D-020",
  methodRule_drop: "Sampling drop",
  methodRuleNote_drop: "Last 7 days against the 56 before · D-020",
  methodRule_empty: "Empty run",
  methodRuleNote_empty: "Days in a row without cultures · D-031",
  methodRule_trend: "Rising trend",
  methodRuleNote_trend: "28-day bins, 22 organism–drug pairs · D-020, D-022",
  methodRule_sentinel: "New in unit",
  methodRuleNote_sentinel: "First MRSA or VRE in an inpatient unit · D-021, D-034",
  methodResult0012: "Brier +0.0002 (−0.0000 to +0.0004) against the hospital year; E1 seen after 48 days.",
  methodResult0013:
    "Brier +0.0001 (−0.0000 to +0.0002); counting two-organism cultures as one episode lowers the top severe pick by 0.5 points.",
  methodResult0014: "The first year picks the hospital pool; no finer pool beats it.",
  methodResult0015:
    "Four-patient rare clusters: 21 % found at 1 episode a year (live set at 3 episodes a year: 92 %, an alternative operating point, not the shipped setting).",
  methodResult0016:
    "Four-patient rare clusters: 67 % at 3.5 episodes a year, 66 % on held-out seeds (live set at 3 episodes a year: 92 %, an alternative operating point, not the shipped setting).",
  methodResult0018: "Four-patient rare clusters: 14 % at 1.5 episodes a year.",
  methodResult0019: "Pooled AUC 0.63 over 24 real episodes, not above rewired graphs (p 0.22).",
  methodResult0020: "Log score +0.40 (0.31 to 0.48) and MAE +0.14 against last month's count.",
  methodAlsoTested: "Also tested, none better at the same noise: Farrington-Noufaily (0017), the live set combined with CUSUM (0022).",
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
    "Käytössä oleva testi (D-020): 28 päivän määrä verrattuna edeltävien 365 päivän Poisson-keskiarvoon, hälytys tunnistimen tasolla. Se lukee raakoja viikkomääriä (D-042). Kokeet 0015, 0016 ja 0018 ovat ehdokkaita. P-arvo on mallipohjainen yllätyspisteluku yhdelle tarkastelulle, ei todennäköisyys sille, että kyseessä on todellinen epidemia.",
  methodInfo4:
    "Koe 0019 järjestää yksiköt altistuksen mukaan potilasvirtaverkossa suhteessa satunnaistettuihin verkkoihin. Kokeen 0020 maakuntaennuste on käytössä (D-045) ja näkyy aluenäkymässä: tasoitettu ensi kuun taso ennustevälillä, ei epidemiaennuste. Alueellinen vahva tarkoittaa, että signaali kestää Bonferroni-korjauksen sovitetussa mallissa.",
  methodLiveRule: "käytössä oleva sääntö (D-023, D-033)",
  methodLiveTest: "käytössä oleva testi (D-020)",
  methodCandidate: "koe, ehdokas — ei käytössä oleva arvio",
  methodShipped: "koe, käytössä (D-045) — näkyy aluenäkymässä",
  methodShippedFigures:
    "Käytössä oleva asetus: neljän potilaan, harvinaisen ja identtisen resistenssiprofiilin pistotesteissä tähän synteettiseen aineistoon löytyi 89 % (95 %:n väli 84–93), mediaaniviive 6 päivää, noin 4,5 signaalijaksoa vuodessa, joista noin 1,0 on rypäsjaksoja (yöbenchmark, 17.10.2026).",
  methodPNote:
    "p on mallipohjainen yllätyspisteluku yhdelle tarkastelulle, ei todennäköisyys sille, että kyseessä on todellinen epidemia. Alueellinen vahva tarkoittaa, että se kestää Bonferroni-korjauksen sovitetussa mallissa.",
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
  methodBbTitle: "Beta-binomiaali ajassa",
  methodBbConjugate: "Jokainen viikko lisää määränsä Betaan, joka pysyy Betana; vanhat viikot haalistuvat kohti sairaalan osuutta.",
  methodBbDiscountLabel: "Diskonttaa kohti sairaalan osuutta",
  methodBbUpdateLabel: "Lisää tämän viikon määrät",
  methodBbPredictLabel: "Ennusta seuraavat löydökset",
  methodBbStatus: "Hyväksytty menetelmä (D-041), vakiot auki (B1, B3). Koe 0012 ei löytänyt parannusta sairaalan vuoteen.",
  methodRule_wilson: "Kattavuusosuus, 95 %:n Wilson-väli",
  methodRuleNote_wilson:
    "Viimeiset 365 päivää: yksikkö, jos löydöksiä on vähintään 30, muuten osastotyyppi, muuten sairaala · D-023, D-033",
  methodRule_poisson: "Profiilin ja fenotyypin ylimäärä",
  methodRuleNote_poisson: "Profiili / fenotyyppi, 28 päivää verrattuna yksikön edelliseen vuoteen · D-020",
  methodRule_drop: "Näytteiden väheneminen",
  methodRuleNote_drop: "Viimeiset 7 päivää verrattuna 56 edelliseen · D-020",
  methodRule_empty: "Tyhjä jakso",
  methodRuleNote_empty: "Peräkkäiset päivät ilman viljelyjä · D-031",
  methodRule_trend: "Nouseva trendi",
  methodRuleNote_trend: "28 päivän jaksot, 22 bakteeri–lääkeparia · D-020, D-022",
  methodRule_sentinel: "Uusi yksikössä",
  methodRuleNote_sentinel: "Ensimmäinen MRSA tai VRE vuodeosastolla · D-021, D-034",
  methodResult0012: "Brier +0,0002 (−0,0000…+0,0004) sairaalan vuoteen verrattuna; E1 näkyi 48 päivän jälkeen.",
  methodResult0013:
    "Brier +0,0001 (−0,0000…+0,0002); kahden bakteerin viljelyn laskeminen yhdeksi jaksoksi laskee vakavan infektion kärkivalintaa 0,5 prosenttiyksikköä.",
  methodResult0014: "Ensimmäinen vuosi valitsee sairaalan joukon; mikään tarkempi joukko ei voita sitä.",
  methodResult0015:
    "Neljän potilaan harvinaiset rypäät: 21 % löydetty, 1 jakso vuodessa (käytössä oleva joukko 3 jaksolla vuodessa: 92 %, vaihtoehtoinen toimintapiste, ei käytössä oleva asetus).",
  methodResult0016:
    "Neljän potilaan harvinaiset rypäät: 67 % 3,5 jaksolla vuodessa, 66 % erillisillä siemenillä (käytössä oleva joukko 3 jaksolla vuodessa: 92 %, vaihtoehtoinen toimintapiste, ei käytössä oleva asetus).",
  methodResult0018: "Neljän potilaan harvinaiset rypäät: 14 % 1,5 jaksolla vuodessa.",
  methodResult0019: "Yhdistetty AUC 0,63 24 todellisessa jaksossa, ei satunnaistettuja verkkoja parempi (p 0,22).",
  methodResult0020: "Log-pistemäärä +0,40 (0,31…0,48) ja MAE +0,14 edellisen kuun määrään verrattuna.",
  methodAlsoTested:
    "Lisäksi kokeiltu, ei parempia samalla kohinalla: Farrington-Noufaily (0017), käytössä oleva joukko yhdistettynä CUSUMiin (0022).",
};
