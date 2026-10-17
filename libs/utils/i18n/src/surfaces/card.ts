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
    "We count distinct patients with this profile in the last {days} days on this unit ({n}) and compare with what the unit's own last year predicts ({expected}). The chance of {n} or more by luck is {odds}.",
  cardHowPhenotype:
    "We count distinct patients with this resistance type in the last {days} days on this unit ({n}) and compare with what the unit's own last year predicts ({expected}). The chance of {n} or more by luck is {odds}.",
  cardHowSentinel: "A rule, no test: the first {what} here in {days} days.",
  cardHowCpe: "A rule, no test: every CPE is an alert.",
  cardHowData:
    "We count cultures this unit sent this week ({n}) against its usual week ({expected}). A drop this large is a feed or sampling problem, not a resistance change.",
  cardHowEmpty:
    "This unit sent no cultures for {n} days, and usually sends about {expected} a day. A gap this long is a feed or sampling problem, not a resistance change.",
  cardHowTrend:
    "We take the resistant share of isolates in each {days}-day period, now {to}, and test whether the rise is steeper than chance allows.",
  cardReach: "Reaches",
  cardIsolates: "Isolates behind it ({n})",
  cardGoToDay: "Go to this day",
  cardGoToDayHere: "The clock is already on this day",
  cardShowMap: "Show on map",
  cardMethod: "Method",
  cardEmpty: "Pick a signal: a pill on the timeline, a row in the list, a unit on the flow or a dot on the map.",
  cardFired: "fired {date}",
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
    "Laskemme tämän profiilin eri potilaat yksikössä viimeisten {days} päivän ajalta ({n}) ja vertaamme siihen, mitä yksikön oma edellinen vuosi ennustaa ({expected}). Todennäköisyys saada {n} tai enemmän sattumalta on {odds}.",
  cardHowPhenotype:
    "Laskemme tämän resistenssityypin eri potilaat yksikössä viimeisten {days} päivän ajalta ({n}) ja vertaamme siihen, mitä yksikön oma edellinen vuosi ennustaa ({expected}). Todennäköisyys saada {n} tai enemmän sattumalta on {odds}.",
  cardHowSentinel: "Sääntö, ei testiä: ensimmäinen {what} täällä {days} päivään.",
  cardHowCpe: "Sääntö, ei testiä: jokainen CPE on hälytys.",
  cardHowData:
    "Laskemme yksikön tällä viikolla lähettämät viljelyt ({n}) ja vertaamme sen tavalliseen viikkoon ({expected}). Näin suuri pudotus on syöte- tai näytteenotto-ongelma, ei resistenssin muutos.",
  cardHowEmpty:
    "Yksikkö ei lähettänyt viljelyjä {n} päivään, ja se lähettää tavallisesti noin {expected} päivässä. Näin pitkä tauko on syöte- tai näytteenotto-ongelma, ei resistenssin muutos.",
  cardHowTrend:
    "Otamme isolaattien resistentin osuuden jokaiselta {days} päivän jaksolta, nyt {to}, ja testaamme, onko nousu jyrkempi kuin sattuma sallii.",
  cardReach: "Ulottuu",
  cardIsolates: "Isolaatit sen takana ({n})",
  cardGoToDay: "Siirry tähän päivään",
  cardGoToDayHere: "Kello on jo tässä päivässä",
  cardShowMap: "Näytä kartalla",
  cardMethod: "Menetelmä",
  cardEmpty: "Valitse signaali: merkki aikajanalta, rivi listasta, yksikkö virtauksesta tai piste kartalta.",
  cardFired: "hälytti {date}",
};
