// Copy for the treat area (the doctor's screen). Every key in both languages.
// Names of units, antibiotics and specimens come from the feed, never from here.
// Finnish avoids inflecting feed names (they are inserted as written).

const en = {
  "treat.title": "What has worked here",

  // ---- Signals strip ----
  "treat.signals.label": "Alerts for this unit",
  "treat.signals.more": "+{count} more alerts",
  "treat.signals.moreOne": "+1 more alert",
  "treat.signals.since": "since {date}",
  "treat.signal.patients": "{count} patients",
  "treat.signal.patientsOne": "1 patient",
  "treat.signal.sentinel": "{flag} found {where} · {patients}",
  "treat.signal.surge": "More {flag} than usual {where} · {patients}, about {expected} expected",
  "treat.signal.cluster": "Possible cluster of {organism} {where} · {patients}, about {expected} expected",
  "treat.signal.data-gap": "Results missing {where} · {observed} arrived, about {expected} usual",
  "treat.signal.shift": "{antibiotic} works less often for {organism} {where}",
  "treat.signal.trend": "{antibiotic} resistance rising for {organism} {where}",
  "treat.signal.thisUnit": "on this unit",
  "treat.signal.onUnit": "on {unit}",
  "treat.signal.hospital": "across the hospital",

  // ---- Your patient ----
  "treat.patient.title": "Your patient",
  "treat.jump": "Change unit, site or severity",
  "treat.patient.unit": "Unit",
  "treat.patient.site": "Infection site",
  "treat.patient.severity": "How severe",
  "treat.patient.sex": "Sex",
  "treat.patient.hint": "Optional. Tap to narrow to one sex, tap again to clear.",
  "treat.patient.bacteria": "Likely bacteria",
  "treat.patient.bacteriaHint": "How often each grew in these samples in the last {months} months. The list above covers all of them.",
  "treat.patient.orgShare": "Found in {share} of {n} samples",
  "treat.sex.F": "Woman",
  "treat.sex.M": "Man",
  "treat.severity.mild": "Mild or moderate",
  "treat.severity.severe": "Severe",
  "treat.institution.hospital": "Hospital",
  "treat.institution.primary_care": "Primary care",

  // ---- Basis: what the answer rests on ----
  "treat.result.label": "What has worked",
  "treat.basis.demo": "Demo: the organisers' synthetic Tyks dataset",
  "treat.basis.lead": "Based on {n} first isolates",
  "treat.basis.leadOne": "Based on 1 first isolate",
  "treat.basis.year": "last {months} months",
  "treat.basis.upTo": "up to {date}",
  "treat.basis.inUnits": "all inpatient units",
  "treat.basis.outUnits": "all outpatient units",
  "treat.basis.hospital": "the whole hospital",
  "treat.level.wardType": "{unit} has fewer than {min} first isolates of this kind in {months} months, so the figures are from {level}.",
  "treat.level.hospital": "Too few first isolates on {unit} and units like it, so the figures are from the whole hospital.",
  "treat.sexDropped": "Too few {who} on {unit} for figures of their own: these cover both sexes.",
  "treat.who.F": "women",
  "treat.who.M": "men",

  // ---- Top match ----
  "treat.top.label": "Best match here",
  "treat.top.labelFew": "Too few results to rank",
  "treat.top.covered": "covered {covered} of {known} it is meant for",
  "treat.top.coveredAll": "covered {covered} of {known} with a result",
  "treat.top.interval": "95% range {lo}–{hi}",
  "treat.top.allOrganisms": "Covers {percent} of everything that grows here",
  "treat.top.allOrganismsFew": "Too few results to say how much of everything that grows here it covers",
  "treat.top.notFor": "Does not cover: {list}",
  "treat.top.none": "No single antibiotic reaches {threshold} here.",
  "treat.top.decide": "How often each antibiotic covered what grew in similar samples here. You decide — check your local guideline.",
  "treat.standing.clears": "Reaches {threshold}: the whole 95% range is above it",
  "treat.standing.borderline": "Around {threshold}: the estimate reaches it, the range does not",
  "treat.standing.below": "Below {threshold}",
  "treat.standing.na": "Not assessable: fewer than {min} results, or over a fifth not tested",

  // ---- Figures side by side ----
  "treat.fig.spectrum": "Of the bacteria it is meant for",
  "treat.fig.all": "Of everything that grows here",
  "treat.fig.recent": "Last {weeks} weeks on this unit",
  "treat.fig.value": "{percent} · {works}/{n}",
  "treat.fig.tooFew": "{n} results — too few",
  "treat.fig.tooFewOne": "1 result — too few",
  "treat.fig.none": "No results",

  // ---- The other antibiotics ----
  "treat.list.title": "Other antibiotics",
  "treat.list.clears": "Also reach {threshold}",
  "treat.list.borderline": "Around {threshold}",
  "treat.list.below": "Below {threshold}",
  "treat.list.na": "Not assessable",
  "treat.row.details": "Show details",
  "treat.row.all": "all {percent}",
  "treat.row.untested": "Not tested on: {list}",
  "treat.row.notCovering": "Does not cover: {list}",

  // ---- Combinations ----
  "treat.combo.title": "Pairs for a severe infection",
  "treat.combo.lead":
    "No single antibiotic reaches {threshold}. Pairs that cover at least 2 points more than the better one alone, never two beta-lactams:",
  "treat.combo.gain": "+{points} points over {name} alone",
  "treat.combo.none": "No pair adds enough over a single antibiotic to be suggested.",

  // ---- Empty and errors ----
  "treat.empty.title": "No results for these patients yet",
  "treat.empty.body": "Figures appear as soon as the lab releases {specimen} results for {unit}. Try another infection site or unit.",
  "treat.error.title": "The coverage list could not be loaded",
  "treat.error.body": "The server did not answer. It will be tried again when the next results arrive.",

  // ---- How it is counted ----
  "treat.how.title": "How this is counted",
  "treat.how.first":
    "The first isolate per patient, bacterium and sample type in the last {months} months, so repeat samples don't tilt the figure.",
  "treat.how.level":
    "Figures come from the unit when it has at least {min} first isolates, else from all units of its type, else from the whole hospital.",
  "treat.how.severity":
    "Mild or moderate: judged against 80% of the bacteria each antibiotic is meant for, by mouth only. Severe: against 90% of everything that grows.",
  "treat.how.untested":
    "Natural resistance (EUCAST) counts as not covered. An antibiotic is not assessed when over a fifth of the samples were not tested for it.",
  "treat.how.aware":
    "Badges are the WHO AWaRe groups: first choice, use with care. First-choice antibiotics come first among those that reach the bar.",
  "treat.how.live": "Updates by itself as each new result arrives. The team's backtest found these figures held the following month.",

  // ---- Screen reader summary ----
  "treat.live.summary": "Best match: {name}, covered {percent}.",
  "treat.live.few": "Too few results for a percentage.",
} as const;

const fi: Record<keyof typeof en, string> = {
  "treat.title": "Mikä on tehonnut täällä",

  "treat.signals.label": "Hälytykset tälle yksikölle",
  "treat.signals.more": "+{count} muuta hälytystä",
  "treat.signals.moreOne": "+1 muu hälytys",
  "treat.signals.since": "{date} alkaen",
  "treat.signal.patients": "{count} potilasta",
  "treat.signal.patientsOne": "1 potilas",
  "treat.signal.sentinel": "{flag} löytynyt {where} · {patients}",
  "treat.signal.surge": "Tavallista enemmän {flag} {where} · {patients}, odotettu noin {expected}",
  "treat.signal.cluster": "Mahdollinen rypäs: {organism} {where} · {patients}, odotettu noin {expected}",
  "treat.signal.data-gap": "Tuloksia puuttuu {where} · {observed} saapunut, tavallisesti noin {expected}",
  "treat.signal.shift": "{antibiotic} tehoaa harvemmin: {organism} {where}",
  "treat.signal.trend": "{antibiotic}: resistenssi yleistyy, {organism} {where}",
  "treat.signal.thisUnit": "tässä yksikössä",
  "treat.signal.onUnit": "({unit})",
  "treat.signal.hospital": "koko sairaalassa",

  "treat.patient.title": "Potilaasi",
  "treat.jump": "Vaihda yksikkö, infektiokohta tai vaikeusaste",
  "treat.patient.unit": "Yksikkö",
  "treat.patient.site": "Infektiokohta",
  "treat.patient.severity": "Vaikeusaste",
  "treat.patient.sex": "Sukupuoli",
  "treat.patient.hint": "Valinnainen. Napauta rajataksesi yhteen sukupuoleen, uudelleen poistaaksesi.",
  "treat.patient.bacteria": "Todennäköiset bakteerit",
  "treat.patient.bacteriaHint":
    "Kuinka usein kukin kasvoi näissä näytteissä viimeisten {months} kuukauden aikana. Yllä oleva lista kattaa ne kaikki.",
  "treat.patient.orgShare": "Löytyi {share} näytteistä ({n})",
  "treat.sex.F": "Nainen",
  "treat.sex.M": "Mies",
  "treat.severity.mild": "Lievä tai keskivaikea",
  "treat.severity.severe": "Vaikea",
  "treat.institution.hospital": "Sairaala",
  "treat.institution.primary_care": "Perusterveydenhuolto",

  "treat.result.label": "Mikä on tehonnut",
  "treat.basis.demo": "Demo: järjestäjien synteettinen Tyks-aineisto",
  "treat.basis.lead": "Perustuu {n} ensimmäiseen löydökseen",
  "treat.basis.leadOne": "Perustuu 1 ensimmäiseen löydökseen",
  "treat.basis.year": "viimeiset {months} kuukautta",
  "treat.basis.upTo": "{date} asti",
  "treat.basis.inUnits": "kaikki vuodeosastot",
  "treat.basis.outUnits": "kaikki avohoidon yksiköt",
  "treat.basis.hospital": "koko sairaala",
  "treat.level.wardType": "{unit}: alle {min} ensimmäistä löydöstä {months} kuukaudessa, joten luvut ovat yksiköistä: {level}.",
  "treat.level.hospital": "Liian vähän ensimmäisiä löydöksiä ({unit} ja vastaavat yksiköt), joten luvut ovat koko sairaalasta.",
  "treat.sexDropped": "Liian vähän tuloksia ({who}, {unit}) omiin lukuihin: luvut kattavat molemmat sukupuolet.",
  "treat.who.F": "naiset",
  "treat.who.M": "miehet",

  "treat.top.label": "Paras vaihtoehto täällä",
  "treat.top.labelFew": "Liian vähän tuloksia järjestykseen",
  "treat.top.covered": "tehosi {covered}/{known} bakteerista, joihin se on tarkoitettu",
  "treat.top.coveredAll": "tehosi {covered}/{known} tuloksesta",
  "treat.top.interval": "95 %:n vaihteluväli {lo}–{hi}",
  "treat.top.allOrganisms": "Tehoaa {percent} kaikista täällä kasvaneista bakteereista",
  "treat.top.allOrganismsFew": "Liian vähän tuloksia sanomaan, kuinka suureen osaan kaikista bakteereista se tehoaa",
  "treat.top.notFor": "Ei tehoa: {list}",
  "treat.top.none": "Mikään yksittäinen antibiootti ei yllä tähän: {threshold}.",
  "treat.top.decide":
    "Kuinka usein kukin antibiootti on tehonnut vastaavissa näytteissä täällä. Sinä päätät – tarkista paikallinen hoito-ohje.",
  "treat.standing.clears": "Yltää tasoon {threshold}: koko 95 %:n vaihteluväli on sen yläpuolella",
  "treat.standing.borderline": "Noin {threshold}: arvio yltää, vaihteluväli ei",
  "treat.standing.below": "Alle {threshold}",
  "treat.standing.na": "Ei arvioitavissa: alle {min} tulosta tai yli viidennes testaamatta",

  "treat.fig.spectrum": "Niistä bakteereista, joihin se on tarkoitettu",
  "treat.fig.all": "Kaikista täällä kasvaneista bakteereista",
  "treat.fig.recent": "Viimeiset {weeks} viikkoa tässä yksikössä",
  "treat.fig.value": "{percent} · {works}/{n}",
  "treat.fig.tooFew": "{n} tulosta – liian vähän",
  "treat.fig.tooFewOne": "1 tulos – liian vähän",
  "treat.fig.none": "Ei tuloksia",

  "treat.list.title": "Muut antibiootit",
  "treat.list.clears": "Yltävät myös tasoon {threshold}",
  "treat.list.borderline": "Noin {threshold}",
  "treat.list.below": "Alle {threshold}",
  "treat.list.na": "Ei arvioitavissa",
  "treat.row.details": "Näytä tiedot",
  "treat.row.all": "kaikista {percent}",
  "treat.row.untested": "Ei testattu: {list}",
  "treat.row.notCovering": "Ei tehoa: {list}",

  "treat.combo.title": "Yhdistelmät vaikeaan infektioon",
  "treat.combo.lead":
    "Mikään yksittäinen antibiootti ei yllä tasoon {threshold}. Parit, jotka kattavat vähintään 2 prosenttiyksikköä enemmän kuin parempi yksinään, eivät koskaan kaksi beetalaktaamia:",
  "treat.combo.gain": "+{points} %-yks. verrattuna pelkkään: {name}",
  "treat.combo.none": "Mikään pari ei lisää tarpeeksi yksittäiseen antibioottiin verrattuna.",

  "treat.empty.title": "Näille potilaille ei ole vielä tuloksia",
  "treat.empty.body":
    "Luvut tulevat näkyviin heti, kun laboratorio julkaisee tuloksia (näyte: {specimen}, {unit}). Kokeile toista infektiokohtaa tai yksikköä.",
  "treat.error.title": "Tehoamislistaa ei saatu ladattua",
  "treat.error.body": "Palvelin ei vastannut. Yritetään uudelleen, kun seuraavat tulokset saapuvat.",

  "treat.how.title": "Miten tämä lasketaan",
  "treat.how.first":
    "Ensimmäinen löydös potilasta, bakteeria ja näytetyyppiä kohden viimeisten {months} kuukauden aikana, jotta toistonäytteet eivät vääristä lukua.",
  "treat.how.level":
    "Luvut ovat yksiköstä, kun siinä on vähintään {min} ensimmäistä löydöstä, muuten kaikista samantyyppisistä yksiköistä, muuten koko sairaalasta.",
  "treat.how.severity":
    "Lievä tai keskivaikea: verrataan 80 %:iin niistä bakteereista, joihin kukin antibiootti on tarkoitettu, vain suun kautta annettavat. Vaikea: verrataan 90 %:iin kaikista kasvaneista.",
  "treat.how.untested":
    "Luontainen resistenssi (EUCAST) lasketaan tehottomaksi. Antibioottia ei arvioida, jos yli viidennestä näytteistä ei ole testattu sille.",
  "treat.how.aware": "Merkinnät ovat WHO:n AWaRe-ryhmät: ensisijainen, harkiten. Tasoon yltävistä ensisijaiset näytetään ensin.",
  "treat.how.live":
    "Päivittyy itsestään jokaisen uuden tuloksen myötä. Ryhmän takautuva testi osoitti lukujen pitäneen seuraavana kuukautena.",

  "treat.live.summary": "Paras vaihtoehto: {name}, tehosi {percent}.",
  "treat.live.few": "Liian vähän tuloksia prosenttiin.",
};

export const treat = { en, fi };
