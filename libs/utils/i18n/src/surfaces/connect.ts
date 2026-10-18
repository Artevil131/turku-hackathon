// Copy for the Connect page (apps/web/src/components/connect). Keys are global: prefix `connect`.

export const connectEn = {
  connectNav: "Connect",
  connectTitle: "Connect data sources",
  connectLead:
    "agar reads laboratory results in the formats Finnish laboratory systems already send, and sets them beside open national data. Each source below is checked live from this server.",
  connectNow: "Connected now",
  connectNext: "Ready to connect",
  connectStatusOn: "Connected",
  connectStatusReady: "Receiving",
  connectStatusOff: "Not connected",
  connectStatusChecking: "Checking…",
  connectStatusPlanned: "Via the same route",
  connectLabTitle: "Laboratory results",
  connectLabBody:
    "The organisers' synthetic microbiology dataset: {cultures} cultures, {isolates} isolates and {results} susceptibility results from {from} to {to}, released one day at a time.",
  connectLisTitle: "Laboratory information system",
  connectLisBody:
    "POST /api/ingest takes HL7 v2.5.1 ORU^R01, a FHIR R4 Bundle (HL7 Europe Laboratory Report) or a CSV export. A corrected report replaces the earlier one; new results reach every open screen at once.",
  connectThlTitle: "THL communicable disease register",
  connectThlBody:
    "Monthly MRSA, ESBL, VRE and CPE cases by wellbeing services county, {from} to {to}, fetched {fetched}. Open data, CC BY 4.0.",
  connectThlSource: "Monthly MRSA, ESBL, VRE and CPE cases by wellbeing services county. Open data, CC BY 4.0.",
  connectGeoTitle: "Statistics Finland county boundaries",
  connectGeoBody: "Wellbeing services county polygons for the regional map. Open data, CC BY 4.0.",
  connectCodesTitle: "THL code sets (Kanta code server)",
  connectCodesBody:
    "Mikrobinimikkeistö and Mikrobilääkkeet codes are built in, so messages coded nationally are read without a mapping. A site's own codes can be added as a JSON code map.",
  connectEhrTitle: "Patient transfers (EHR, HL7 ADT)",
  connectEhrBody:
    "Unit moves drive the patient-flow view; in the demo they come from the dataset. Admission and transfer messages (ADT A01–A03) are the pilot's next feed.",
  connectWhonetTitle: "WHONET and Finres exports",
  connectWhonetBody: "Laboratories that export isolate tables (WHONET, Finres reporting) send them as CSV through the same route.",
  connectTryTitle: "Try a laboratory message",
  connectTryLead:
    "Pick a format, edit the message if you like, and check it. The check runs the server's own reader in your browser; nothing is sent or stored.",
  connectLoadSample: "Load example",
  connectCheck: "Check message",
  connectMessage: "Message",
  connectDetected: "Read as {format}",
  connectUnknown: "Not recognised: send HL7 v2 (starting MSH|), a FHIR Bundle (JSON) or CSV with a header row.",
  connectParsed: "{patients} patients · {cultures} cultures · {isolates} isolates · {results} results",
  connectOrganisms: "Organisms",
  connectWarnings: "Warnings",
  connectNoWarnings: "No warnings: every code was recognised.",
  connectSendTitle: "Sending from a laboratory system",
  connectSendBody: "The same message, sent by the laboratory system or an integration engine:",
  connectDemoNote: "Demo: the laboratory results are synthetic; THL and Statistics Finland data are real.",
};

export const connectFi: Record<keyof typeof connectEn, string> = {
  connectNav: "Yhdistä",
  connectTitle: "Yhdistä aineistolähteet",
  connectLead:
    "agar lukee laboratoriotulokset niissä muodoissa, joita suomalaiset laboratoriojärjestelmät jo lähettävät, ja asettaa ne avoimen kansallisen datan rinnalle. Jokaisen alla olevan lähteen tila tarkistetaan suoraan tältä palvelimelta.",
  connectNow: "Yhdistetty nyt",
  connectNext: "Valmiina yhdistettäväksi",
  connectStatusOn: "Yhdistetty",
  connectStatusReady: "Vastaanottaa",
  connectStatusOff: "Ei yhdistetty",
  connectStatusChecking: "Tarkistetaan…",
  connectStatusPlanned: "Samaa reittiä",
  connectLabTitle: "Laboratoriotulokset",
  connectLabBody:
    "Järjestäjien synteettinen mikrobiologian aineisto: {cultures} viljelyä, {isolates} eristettä ja {results} herkkyystulosta ajalta {from}–{to}, julkaistuna päivä kerrallaan.",
  connectLisTitle: "Laboratoriotietojärjestelmä",
  connectLisBody:
    "POST /api/ingest ottaa vastaan HL7 v2.5.1 ORU^R01 -viestit, FHIR R4 -kokoelman (HL7 Europe Laboratory Report) tai CSV-viennin. Korjattu vastaus korvaa aiemman; uudet tulokset näkyvät heti jokaisella avoimella näytöllä.",
  connectThlTitle: "THL:n tartuntatautirekisteri",
  connectThlBody:
    "MRSA-, ESBL-, VRE- ja CPE-tapaukset kuukausittain hyvinvointialueittain, {from}–{to}, haettu {fetched}. Avoin data, CC BY 4.0.",
  connectThlSource: "MRSA-, ESBL-, VRE- ja CPE-tapaukset kuukausittain hyvinvointialueittain. Avoin data, CC BY 4.0.",
  connectGeoTitle: "Tilastokeskuksen aluerajat",
  connectGeoBody: "Hyvinvointialueiden rajat aluekarttaa varten. Avoin data, CC BY 4.0.",
  connectCodesTitle: "THL:n koodistot (Kanta-koodistopalvelu)",
  connectCodesBody:
    "Mikrobinimikkeistön ja Mikrobilääkkeet-koodiston koodit ovat valmiina, joten kansallisesti koodatut viestit luetaan ilman muunnostaulua. Paikalliset koodit voi lisätä JSON-koodikarttana.",
  connectEhrTitle: "Potilassiirrot (potilastietojärjestelmä, HL7 ADT)",
  connectEhrBody:
    "Yksikkösiirrot ohjaavat potilasvirtanäkymää; demossa ne tulevat aineistosta. Tulo- ja siirtoviestit (ADT A01–A03) ovat pilotin seuraava syöte.",
  connectWhonetTitle: "WHONET- ja Finres-viennit",
  connectWhonetBody: "Eristetaulukoita vievät laboratoriot (WHONET, Finres-raportointi) lähettävät ne CSV-muodossa samaa reittiä.",
  connectTryTitle: "Kokeile laboratorioviestiä",
  connectTryLead:
    "Valitse muoto, muokkaa viestiä halutessasi ja tarkista se. Tarkistus käyttää palvelimen omaa lukijaa selaimessasi; mitään ei lähetetä eikä tallenneta.",
  connectLoadSample: "Lataa esimerkki",
  connectCheck: "Tarkista viesti",
  connectMessage: "Viesti",
  connectDetected: "Luettu muodossa {format}",
  connectUnknown: "Muotoa ei tunnistettu: lähetä HL7 v2 (alkaa MSH|), FHIR-kokoelma (JSON) tai otsikkorivillinen CSV.",
  connectParsed: "{patients} potilasta · {cultures} viljelyä · {isolates} eristettä · {results} tulosta",
  connectOrganisms: "Mikrobit",
  connectWarnings: "Varoitukset",
  connectNoWarnings: "Ei varoituksia: kaikki koodit tunnistettiin.",
  connectSendTitle: "Lähetys laboratoriojärjestelmästä",
  connectSendBody: "Sama viesti laboratoriojärjestelmän tai integraatiomoottorin lähettämänä:",
  connectDemoNote: "Demo: laboratoriotulokset ovat synteettisiä; THL:n ja Tilastokeskuksen aineistot ovat todellisia.",
};
