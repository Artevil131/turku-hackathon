// Copy for the signal card (research-unified.md 3.1). Keys are global: prefix them `card`.
//
// The cardHow* sentences state the live method (D-020, D-044: 28-day windows against the
// unit's own last year, 7-day weeks against 56 days, 180 days for a new MRSA or VRE).
// They are pending Artem's review against ENGINE.md sections 2 and 3. cardHowTrend differs
// from the spec's proposal on purpose: the live trend test bins 28-day periods
// (LIVE_SETTINGS.risingTrend), not rolling twelve months, and an alert carries only the
// latest share, so there is no "from" value to show.

export const cardEn = {
  cardTitle: "Signal",
  cardTitleIn: "{what} in {unit}",
  cardTitleWide: "{what} · {unit}",
  cardObserved: "Observed",
  cardUsual: "Usual",
  cardPatients: "{n} patients",
  cardPatientOne: "1 patient",
  cardCultures: "{n} cultures",
  cardUsualValue: "{n} usual",
  cardSurprise: "surprise",
  cardChance: "1 in {n} by chance",
  cardChanceCap: "more than 1 in 1 000 000 by chance",
  cardOdds: "1 in {n}",
  cardOddsCap: "less than 1 in 1 000 000",
  cardSurpriseInfo: "How the surprise scale reads",
  cardHow: "How we calculate it",
  cardHowInfo: "The arithmetic behind this signal",
  cardHowCluster:
    "We count distinct patients with this resistance profile on this unit in the last {days} days ({n}) and compare with how often the profile appeared across the whole hospital in the year before, scaled to this unit's patients ({expected}). The chance of {n} or more by luck is {odds}.",
  cardHowPhenotype:
    "We count distinct patients with this resistance type in the last {days} days on this unit ({n}) and compare with what the unit's own last year predicts ({expected}). The chance of {n} or more by luck is {odds}.",
  cardHowSentinel: "A rule, no test: the first {what} on this inpatient unit in {days} days.",
  cardHowCpe: "A rule, no test: every CPE is an alert.",
  cardHowData:
    "We count cultures this unit sent this week ({n}) against its usual week ({expected}). A drop this large is a feed or sampling problem, not a resistance change.",
  cardHowEmpty:
    "This unit sent no cultures for {n} days, and usually sends about {expected} a day. A gap this long is a feed or sampling problem, not a resistance change.",
  cardHowTrend:
    "We take the resistant share of isolates hospital-wide in each {days}-day period since the data began (now {to}) and test whether the share rises along the periods more steeply than chance allows.",
  cardDetailCluster:
    "Test: the upper tail of a Poisson count, P(Y ≥ {n}) with mean {expected}. Needs at least 3 patients in the window and 50 isolates of the organism and specimen hospital-wide in the baseline year. Alert below p = 0.0001 (D-020).",
  cardDetailPhenotype:
    "Test: the upper tail of a Poisson count, P(Y ≥ {n}) with mean {expected}, the mean from this unit's own share over the year before. Needs at least 2 patients and 50 isolates in the baseline. Alert below p = 0.001 (D-020).",
  cardDetailData:
    "Test: the lower tail of a Poisson count, P(Y ≤ {n}) with mean {expected}, the mean from the 56 days before the week. Alert below p = 0.0001 (D-020).",
  cardDetailEmpty: "Test: the chance of {n} empty days at a daily rate of {expected}, e^(−rate × days). Alert below 0.001 (D-031).",
  cardDetailTrend:
    "Test: one-sided Cochran–Armitage trend test on {days}-day periods, at least 13 of them, 22 organism–drug pairs watched; isolates of an already detected cluster are left out. Alert below p = 0.001 (D-020, D-022). No correction for the 22 pairs is applied.",
  cardDetailSentinel:
    "The rule: an MRSA or VRE isolate in an inpatient unit with none there in the {days} days before; silent for the data's first {days} days (D-021).",
  cardDetailCpe: "The rule: every CPE isolate is an alert on its sample date (D-014).",
  cardUsualSmall: "less than 0.1 usual",
  cardMeansPhenotype: "More {phenotype} than this unit usually has, in {days} days.",
  cardMeansProfile: "More of one rare {organism} profile than expected for this unit, in {days} days.",
  cardMeansData: "Far fewer cultures from this unit than usual this week: a data gap, not a resistance change.",
  cardMeansEmpty: "No cultures from this unit for {n} days: a data gap, not a resistance change.",
  cardMeansTrend: "{antibiotic} resistance in {organism} has been rising across the hospital.",
  cardMeansSentinel: "The first {phenotype} on this unit in {days} days.",
  cardMeansCpe: "A CPE find; every one is an alert.",
  cardReachCount: "Reaches · {n}",
  cardAnalyse: "Analyse this signal",
  cardAnalyseShares: "{event} by week, last {weeks} weeks, {where}",
  cardAnalyseSharesLast: "latest week {share}, 95 % interval {range}, {k} of {n}",
  cardAnalyseRate: "In the signal's window, {from} – {to}, {where}",
  cardAnalyseRateCount: "{n} first isolates, {perWeek} a week, 95 % interval {range}",
  cardAnalyseRateCountPh: "{n} first isolates with {ph}, {perWeek} a week, 95 % interval {range}",
  cardAnalyseRateShare: "{ph} share {share}, 95 % interval {range}, {k} of {n}",
  cardAnalyseMethod:
    "First isolate per patient, organism and specimen; Wilson interval for the share, exact Poisson interval for the count (D-076). The same numbers the Tools window gives for this slice.",
  cardAnalyseLoading: "Computing on this signal's slice…",
  cardAnalyseError: "The isolates for this slice could not be loaded.",
  cardAnalyseNone: "No isolates in this slice to analyse.",
  cardOpenTools: "Open in Tools",
  cardReach: "Reaches",
  cardIsolates: "Isolates behind it ({n})",
  cardGoToDay: "Go to this day",
  cardGoToDayHere: "The clock is already on this day",
  cardShowMap: "Show on map",
  cardMethod: "Method",
  cardEmpty: "Pick a signal: a pill on the timeline, a row in the list, a unit on the flow or a dot on the map.",
  cardFired: "fired {date}",
  cardRegistryFormula: "Formula",
  cardRegistryConstants: "Constants",
  cardRegistryDecisions: "Decisions {list}",
  cardRegistryCode: "TypeScript: {ts} · Python: {py}",
  cardRegistryCodeNoPy: "TypeScript: {ts} · no Python function yet",
  cardRegistryCopy: "Copy to notebook",
  cardRegistryCopied: "Copied",
  cardRegistryManual: "Select and copy this by hand:",
  cardRegistryFallbackNote: "The clipboard is not available here.",
} as const;

export const cardFi: Record<keyof typeof cardEn, string> = {
  cardTitle: "Signaali",
  cardTitleIn: "{what} yksikössä {unit}",
  cardTitleWide: "{what} · {unit}",
  cardObserved: "Havaittu",
  cardUsual: "Tavallinen",
  cardPatients: "{n} potilasta",
  cardPatientOne: "1 potilas",
  cardCultures: "{n} viljelyä",
  cardUsualValue: "{n} tavallisesti",
  cardSurprise: "yllättävyys",
  cardChance: "1 : {n} sattumalta",
  cardChanceCap: "yli 1 : 1 000 000 sattumalta",
  cardOdds: "1 : {n}",
  cardOddsCap: "alle 1 : 1 000 000",
  cardSurpriseInfo: "Näin yllättävyysasteikko luetaan",
  cardHow: "Näin se lasketaan",
  cardHowInfo: "Signaalin takana oleva laskenta",
  cardHowCluster:
    "Laskemme tämän resistenssiprofiilin eri potilaat tällä yksiköllä viimeisten {days} päivän ajalta ({n}) ja vertaamme siihen, kuinka usein profiili esiintyi koko sairaalassa edellisenä vuonna, suhteutettuna tämän yksikön potilaisiin ({expected}). Todennäköisyys saada {n} tai enemmän sattumalta on {odds}.",
  cardHowPhenotype:
    "Laskemme tämän resistenssityypin eri potilaat yksikössä viimeisten {days} päivän ajalta ({n}) ja vertaamme siihen, mitä yksikön oma edellinen vuosi ennustaa ({expected}). Todennäköisyys saada {n} tai enemmän sattumalta on {odds}.",
  cardHowSentinel: "Sääntö, ei testiä: ensimmäinen {what} tällä vuodeosastolla {days} päivään.",
  cardHowCpe: "Sääntö, ei testiä: jokainen CPE on hälytys.",
  cardHowData:
    "Laskemme yksikön tällä viikolla lähettämät viljelyt ({n}) ja vertaamme sen tavalliseen viikkoon ({expected}). Näin suuri pudotus on syöte- tai näytteenotto-ongelma, ei resistenssin muutos.",
  cardHowEmpty:
    "Yksikkö ei lähettänyt viljelyjä {n} päivään, ja se lähettää tavallisesti noin {expected} päivässä. Näin pitkä tauko on syöte- tai näytteenotto-ongelma, ei resistenssin muutos.",
  cardHowTrend:
    "Otamme isolaattien resistentin osuuden koko sairaalassa jokaiselta {days} päivän jaksolta aineiston alusta (nyt {to}) ja testaamme, nouseeko osuus jaksojen myötä jyrkemmin kuin sattuma sallii.",
  cardDetailCluster:
    "Testi: Poisson-jakauman ylähäntä, P(Y ≥ {n}) odotusarvolla {expected}. Vaatii vähintään 3 potilasta ikkunassa ja 50 organismin ja näytetyypin isolaattia koko sairaalassa vertailuvuonna. Hälytys, kun p < 0,0001 (D-020).",
  cardDetailPhenotype:
    "Testi: Poisson-jakauman ylähäntä, P(Y ≥ {n}) odotusarvolla {expected}, odotusarvo yksikön omasta osuudesta edellisenä vuonna. Vaatii vähintään 2 potilasta ja 50 isolaattia vertailujaksolla. Hälytys, kun p < 0,001 (D-020).",
  cardDetailData:
    "Testi: Poisson-jakauman alahäntä, P(Y ≤ {n}) odotusarvolla {expected}, odotusarvo viikkoa edeltävien 56 päivän keskiarvosta. Hälytys, kun p < 0,0001 (D-020).",
  cardDetailEmpty: "Testi: todennäköisyys {n} tyhjälle päivälle päivätahdilla {expected}, e^(−tahti × päivät). Hälytys alle 0,001 (D-031).",
  cardDetailTrend:
    "Testi: yksisuuntainen Cochran–Armitage-trenditesti {days} päivän jaksoille, vähintään 13 jaksoa, 22 seurattua organismi–lääke-paria; jo tunnistetun rypään isolaatit jätetään pois. Hälytys, kun p < 0,001 (D-020, D-022). 22 parin monivertailua ei korjata.",
  cardDetailSentinel:
    "Sääntö: MRSA- tai VRE-isolaatti vuodeosastolla, jolla ei ollut sellaista edeltävinä {days} päivänä; hiljainen aineiston ensimmäiset {days} päivää (D-021).",
  cardDetailCpe: "Sääntö: jokainen CPE-isolaatti on hälytys näytepäivänään (D-014).",
  cardUsualSmall: "alle 0,1 tavallisesti",
  cardMeansPhenotype: "Enemmän {phenotype}-löydöksiä kuin tällä yksiköllä tavallisesti on, {days} päivässä.",
  cardMeansProfile: "Enemmän yhtä harvinaista {organism} -profiilia kuin tälle yksikölle on odotettavissa, {days} päivässä.",
  cardMeansData: "Selvästi vähemmän viljelyjä tältä yksiköltä kuin tavallisesti tällä viikolla: aineistokatko, ei resistenssin muutos.",
  cardMeansEmpty: "Ei viljelyjä tältä yksiköltä {n} päivään: aineistokatko, ei resistenssin muutos.",
  cardMeansTrend: "{antibiotic}resistenssi ({organism}) on ollut nousussa koko sairaalassa.",
  cardMeansSentinel: "Ensimmäinen {phenotype} tällä yksiköllä {days} päivään.",
  cardMeansCpe: "CPE-löydös; jokainen on hälytys.",
  cardReachCount: "Ulottuu · {n}",
  cardAnalyse: "Analysoi tämä signaali",
  cardAnalyseShares: "{event} viikoittain, viimeiset {weeks} viikkoa, {where}",
  cardAnalyseSharesLast: "viimeisin viikko {share}, 95 % väli {range}, {k}/{n}",
  cardAnalyseRate: "Signaalin ikkunassa {from} – {to}, {where}",
  cardAnalyseRateCount: "{n} ensimmäistä isolaattia, {perWeek} viikossa, 95 % väli {range}",
  cardAnalyseRateCountPh: "{n} ensimmäistä isolaattia, joilla {ph}, {perWeek} viikossa, 95 % väli {range}",
  cardAnalyseRateShare: "{ph}-osuus {share}, 95 % väli {range}, {k}/{n}",
  cardAnalyseMethod:
    "Yksi isolaatti potilasta, organismia ja näytetyyppiä kohti; osuudelle Wilsonin väli, määrälle tarkka Poisson-väli (D-076). Samat luvut kuin Työkalut-ikkuna antaa tälle rajaukselle.",
  cardAnalyseLoading: "Lasketaan signaalin rajauksella…",
  cardAnalyseError: "Rajauksen isolaatteja ei voitu ladata.",
  cardAnalyseNone: "Rajauksessa ei ole isolaatteja analysoitavaksi.",
  cardOpenTools: "Avaa Työkaluissa",
  cardReach: "Ulottuu",
  cardIsolates: "Isolaatit sen takana ({n})",
  cardGoToDay: "Siirry tähän päivään",
  cardGoToDayHere: "Kello on jo tässä päivässä",
  cardShowMap: "Näytä kartalla",
  cardMethod: "Menetelmä",
  cardEmpty: "Valitse signaali: merkki aikajanalta, rivi listasta, yksikkö virtauksesta tai piste kartalta.",
  cardFired: "hälytti {date}",
  cardRegistryFormula: "Kaava",
  cardRegistryConstants: "Vakiot",
  cardRegistryDecisions: "Päätökset {list}",
  cardRegistryCode: "TypeScript: {ts} · Python: {py}",
  cardRegistryCodeNoPy: "TypeScript: {ts} · Python-funktiota ei vielä ole",
  cardRegistryCopy: "Kopioi muistioon",
  cardRegistryCopied: "Kopioitu",
  cardRegistryManual: "Valitse ja kopioi tämä käsin:",
  cardRegistryFallbackNote: "Leikepöytä ei ole käytettävissä tässä.",
};
