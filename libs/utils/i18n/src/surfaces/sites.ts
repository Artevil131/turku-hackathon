// Copy for hospitals on one server (D-051): the hospital selector, the page header line, and the
// Connect page's hospital list and "Connect a hospital" panel. Keys are global: prefix `site` or `connectSite`/`connectAdd`.

export const sitesEn = {
  siteLabel: "Hospital",
  siteAll: "All hospitals",
  siteFor: "Figures for {site}",
  siteForAll: "Figures for all hospitals. Each unit is still compared only within its own hospital.",
  siteSettingHint:
    "Which hospital's units and figures every page shows. Moves of patients between hospitals show in the network view, also for one hospital.",
  siteMenu: "Change hospital",

  connectSitesTitle: "Hospitals on this server",
  connectSitesLead:
    "Each hospital sends its results with its own token. Its units are stored as <hospital>/<unit>, and its coverage figures and alerts are computed within that hospital only.",
  connectSiteHome: "Home site",
  connectSiteConnected: "Receiving",
  connectSiteAwaiting: "Awaiting first message",
  connectSiteCounts: "{cultures} cultures, {isolates} isolates and {patients} patients up to {date}; {units} units.",
  connectSiteFeed: "{messages} messages since the server started; last at {at} ({format}, {accepted} cultures accepted).",
  connectSiteNoFeed: "No messages since the server started.",
  connectSiteHomeFeed: "The dataset, released one day at a time; messages without a token count here.",
  connectSiteIssues: "{warnings} warnings, {unregistered} cultures in units the hospital did not register, {rejected} messages refused.",
  connectSiteCounty: "County: {county}",

  connectAddTitle: "Connect a hospital",
  connectAddLead:
    "Adding a hospital is configuration, not code: one entry in the server's sites file (AEI_SITES) and a restart. The entry and its token are made here in your browser and sent nowhere.",
  connectAddStep1: "Fill in the hospital and its units below.",
  connectAddStep2: 'Add the entry to the sites file\'s "sites" list, keep the file mode 600 and out of git, and restart the server.',
  connectAddStep3:
    "Give the token to the hospital's integration engine. It sends results to the endpoint below with the header Authorization: Bearer <token>.",
  connectAddStep4: "The hospital shows here as Receiving after its first message, and in the hospital selector.",
  connectAddId: "Id (lower-case letters, digits, -)",
  connectAddIdTaken: "This id is already in use on this server.",
  connectAddIdInvalid: "Use lower-case letters, digits and -.",
  connectAddNameFi: "Name in Finnish",
  connectAddNameEn: "Name in English",
  connectAddCounty: "Wellbeing services county",
  connectAddUnits: "Units, one per line: code; Finnish name; English name; in or out",
  connectAddUnitsInvalid: "Line {line}: give code; Finnish name; English name; in or out.",
  connectAddEntry: "Entry for sites.json",
  connectAddToken: "New token",
  connectAddCopy: "Copy",
  connectAddCopied: "Copied",
  connectAddEndpoint: "Endpoint",
  connectAddExamples: "Sending, with the token",
  connectAddQualified:
    "Every unit code the hospital sends is stored as {id}/<code> (for example {example}), so two hospitals may both have an ICU. A code not listed in the entry is kept and stored the same way, with a warning. Patient flow and carrier trails are shared between hospitals; coverage and alerts stay within each hospital.",
  connectAddTokenNote:
    "The token is a plain shared secret, pilot packaging rather than hardened authentication: whoever holds it can send results as this hospital. Send it only over TLS.",
  connectCheckSite: "Check as",
  connectCheckUnits: "Units as stored: {units}",
  connectCheckUnregistered: "Not registered for this hospital (kept, with a warning): {units}",
  connectCheckSiteMap: "A hospital's own code map, if it has one, is applied on the server only.",
} as const;

export const sitesFi: Record<keyof typeof sitesEn, string> = {
  siteLabel: "Sairaala",
  siteAll: "Kaikki sairaalat",
  siteFor: "Luvut: {site}",
  siteForAll: "Luvut kaikista sairaaloista. Jokaista osastoa verrataan silti vain oman sairaalansa lukuihin.",
  siteSettingHint:
    "Minkä sairaalan osastot ja luvut sivut näyttävät. Potilaiden siirrot sairaaloiden välillä näkyvät verkostonäkymässä myös yhden sairaalan valinnalla.",
  siteMenu: "Vaihda sairaala",

  connectSitesTitle: "Palvelimeen yhdistetyt sairaalat",
  connectSitesLead:
    "Jokainen sairaala lähettää tuloksensa omalla tunnisteellaan. Sen osastot tallennetaan muodossa <sairaala>/<osasto>, ja sen kattavuusluvut ja hälytykset lasketaan vain sairaalan omista tuloksista.",
  connectSiteHome: "Kotisairaala",
  connectSiteConnected: "Vastaanottaa",
  connectSiteAwaiting: "Odottaa ensimmäistä viestiä",
  connectSiteCounts: "{cultures} viljelyä, {isolates} isolaattia ja {patients} potilasta {date} asti; {units} osastoa.",
  connectSiteFeed: "{messages} viestiä palvelimen käynnistymisen jälkeen; viimeisin {at} ({format}, {accepted} viljelyä hyväksytty).",
  connectSiteNoFeed: "Ei viestejä palvelimen käynnistymisen jälkeen.",
  connectSiteHomeFeed: "Aineisto julkaistaan päivä kerrallaan; ilman tunnistetta tulevat viestit lasketaan tähän.",
  connectSiteIssues:
    "{warnings} varoitusta, {unregistered} viljelyä osastoilta, joita sairaala ei ole rekisteröinyt, {rejected} hylättyä viestiä.",
  connectSiteCounty: "Hyvinvointialue: {county}",

  connectAddTitle: "Yhdistä sairaala",
  connectAddLead:
    "Sairaalan lisääminen on asetus, ei koodia: yksi merkintä palvelimen sairaalatiedostoon (AEI_SITES) ja uudelleenkäynnistys. Merkintä ja tunniste tehdään tässä selaimessa eikä niitä lähetetä minnekään.",
  connectAddStep1: "Täytä alle sairaala ja sen osastot.",
  connectAddStep2:
    'Lisää merkintä sairaalatiedoston "sites"-luetteloon, pidä tiedoston oikeudet 600 ja tiedosto poissa gitistä, ja käynnistä palvelin uudelleen.',
  connectAddStep3:
    "Anna tunniste sairaalan integraatiomoottorille. Se lähettää tulokset alla olevaan osoitteeseen otsakkeella Authorization: Bearer <tunniste>.",
  connectAddStep4: "Sairaala näkyy tässä tilassa Vastaanottaa ensimmäisen viestinsä jälkeen, ja sairaalavalinnassa.",
  connectAddId: "Tunnus (pienet kirjaimet, numerot, -)",
  connectAddIdTaken: "Tunnus on jo käytössä tällä palvelimella.",
  connectAddIdInvalid: "Käytä pieniä kirjaimia, numeroita ja viivaa.",
  connectAddNameFi: "Nimi suomeksi",
  connectAddNameEn: "Nimi englanniksi",
  connectAddCounty: "Hyvinvointialue",
  connectAddUnits: "Osastot, yksi riville: koodi; nimi suomeksi; nimi englanniksi; in tai out",
  connectAddUnitsInvalid: "Rivi {line}: anna koodi; nimi suomeksi; nimi englanniksi; in tai out.",
  connectAddEntry: "Merkintä sites.json-tiedostoon",
  connectAddToken: "Uusi tunniste",
  connectAddCopy: "Kopioi",
  connectAddCopied: "Kopioitu",
  connectAddEndpoint: "Osoite",
  connectAddExamples: "Lähettäminen tunnisteen kanssa",
  connectAddQualified:
    "Jokainen sairaalan lähettämä osastokoodi tallennetaan muodossa {id}/<koodi> (esimerkiksi {example}), joten kahdella sairaalalla voi kummallakin olla teho-osasto ICU. Merkinnästä puuttuva koodi säilytetään samassa muodossa varoituksen kanssa. Potilasvirrat ja kantajien reitit ovat sairaaloille yhteisiä; kattavuus ja hälytykset pysyvät sairaalakohtaisina.",
  connectAddTokenNote:
    "Tunniste on yksinkertainen jaettu salaisuus, pilotin pakkaus eikä vahvaa tunnistautumista: sen haltija voi lähettää tuloksia tämän sairaalan nimissä. Lähetä sitä vain TLS-yhteydellä.",
  connectCheckSite: "Tarkista sairaalana",
  connectCheckUnits: "Osastot tallennettuina: {units}",
  connectCheckUnregistered: "Sairaalalle rekisteröimättömät (säilytetään varoituksen kanssa): {units}",
  connectCheckSiteMap: "Sairaalan oma koodikartta, jos sillä on sellainen, otetaan käyttöön vain palvelimella.",
};
