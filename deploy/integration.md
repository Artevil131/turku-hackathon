# Connecting AEI to Tyks and Finnish systems

How the tool would take lab results and reach clinicians in a pilot at
Tyks, from research done on 2026-10-16 (sources at the end; claims marked
*unverified* still need confirming with Varha ICT or the vendors). The
ingest itself is built and tested (`libs/utils/ingest`, D-035).

## The systems

- **Laboratory:** Tyks Laboratories runs Mylab's My+ system. Mylab says
  about 80 % of Finnish clinical lab tests pass through its products.
  Whether Tyks microbiology runs the My+ Mikrobiologia module is
  *unverified*; NordLab and Fimlab moved to it in 2024.
- **Patient record:** Tyks moves from CGI Uranus to **CGI OMNI360** on
  1 December 2026 (Pirkanmaa and Pohjois-Savo make the same change; Varha
  primary care already uses OMNI360). So the pitch is "fed by the lab
  system, launched from OMNI360", not Uranus. Whether OMNI360 supports
  SMART on FHIR app launch is *unverified*; CGI showed FHIR resources at
  FHIR Demo 2024 and 2025. HUS's Apotti (Epic) uses SMART App Launch.
- **National:** Kanta stores lab results as HL7 CDA R2 (Laboratorion CDA
  R2 merkinnät v5.0); its FHIR interfaces do not cover lab data yet.
  Kanta is a per-patient archive, not a live feed. Lab results must be
  exchangeable under the EU health data space (EHDS) from 2031.

## The pilot path

1. **Results in:** Varha's integration engine sends a copy of the My+
   microbiology result feed, **HL7 v2.5.1 ORU^R01**, to AEI's
   `POST /api/ingest`, after a step that replaces patient identifiers with
   pseudonyms. Fallback with no IT work: a nightly flat export from the
   lab system (the WHONET-style file labs already make for THL's Finres).
2. **Codes:** organisms, antibiotics and S/I/R come in THL's national code
   systems (Mikrobinimikkeistö 1.2.246.537.6.241, Mikrobilääkkeet
   1.2.246.537.6.249, Mikrobin herkkyys 1.2.246.537.6.253), the test in
   Kuntaliitto's Laboratoriotutkimusnimikkeistö (1.2.246.537.6.3). AEI
   reads THL's codes for its organisms and antibiotics out of the box
   (fetched from the Kanta code server, D-036; e.g. `7640-22` E. coli,
   `12` keftriaksoni); any other local code is one JSON file
   (`AEI_CODE_MAP`), not code. EUCAST's "I" means susceptible at
   increased exposure and counts as susceptible.
3. **Clinicians:** open AEI from OMNI360 with the ward as context, by
   SMART App Launch if CGI supports it, otherwise a signed link carrying
   the ward code. The doctor types nothing.
4. **Alerts:** pushed to infection control in tools they already use
   (the patient record's task list, e-mail, the hospital's messaging),
   not only on AEI's page.
5. **Forward path:** the same route takes **FHIR R4** Bundles shaped like
   HL7 Europe Laboratory Report 2.1.0, the direction of OMNI360, Kanta and
   EHDS. Kanta CDA is not needed for a pilot.

## Rules that come with it

- **System class:** AEI does not connect to Kanta, so it is a class B
  system: registered with Valvira, not certified through Kela.
- **Medical device:** under the MDR (MDCG 2019-11 Rev.1, 2025), software
  that informs treatment decisions for individual patients is class IIa
  or higher; an aggregate, ward-level antibiogram that suggests nothing
  for a specific patient sits outside the device rules. The suggestion
  list is decision support and needs that classification before clinical
  use.
- **AI:** the EU AI Act's high-risk rules for medical-device AI apply from
  August 2028.
- **Data use:** showing results to the treating clinicians is care use.
  Surveillance and quality use of Varha's own data likely falls under the
  secondary-use act's knowledge-management purpose without a Findata
  permit (*unverified*).

## Try it

    AEI_LOAD_UNTIL=2025-06-01 pnpm dev:api              # data up to 1 June 2025
    uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-14 --format hl7 --pause 2

The script sends each day's real cultures from the dataset as HL7 v2
messages (or `--format fhir` / `csv`); the Urology outbreak alert fires
when the 4 June results arrive.

## Connecting a second hospital

One running AEI can take results from several hospitals (D-051). Tyks,
the dataset's hospital, is the home site and needs no configuration;
every other hospital is one entry in a sites file, not code.

**The file.** `AEI_SITES` names a JSON file (in the containers,
`/config/sites.json`; start from `deploy/container/config/sites.example.json`):
the site's `id` (lower case, e.g. `sata`), names in Finnish and English,
its wellbeing services county as the regional data names it (e.g.
`Satakunnan hyvinvointialue`, so the map can place it), a `token`, and its
units (`code`, `fi`, `en`, `type` in/out, `institution` hospital or
primary_care). Optional: `codeMap`, a code map file relative to the sites
file, merged over the THL defaults for that site only; `guideline`, the
label stored on its results; `guide`, the treatment guide table it uses
(default `varha`). Listing `{ "id": "tyks", "token": "..." }` gives Tyks a
token too; then results without one are refused. A file with a duplicate
id, a duplicate unit code within a site, a missing field or an unknown
county stops the server at startup with every problem listed. The
Connect page (Yhdistä) writes an entry with a fresh random token.

**The token.** A long random shared secret per site, sent as
`Authorization: Bearer <token>` on `POST /api/ingest`. It tells the server
which hospital sent a result; an unknown token is a 401. Keep the file
mode 600 (the server warns otherwise) and out of git. This is pilot
packaging, not hardened authentication (deploy/README.md): no TLS, no
rotation, no per-user access.

**What to send.** The same HL7 v2 ORU^R01, FHIR R4 Bundle or flat export
as Tyks, to the same route, with the header. PV1-3 (HL7), the
Encounter's location (FHIR) or the `ward` column (CSV) carries the
hospital's own unit code; the server stores it qualified as
`<site>/<code>` (`sata/ICU`), so two hospitals may both have an ICU. A
unit the site did not register is kept, stored qualified anyway, with a
warning in the response, and counted on the Connect page. Organisms,
antibiotics and S/I/R use THL's national codes out of the box. Culture
ids must not collide with another hospital's (a culture sent again
replaces the earlier one); a lab-system prefix is enough.

**What the site sees.** Its own units in the doctor's list and the
research views, with every figure computed within that hospital: a unit
falls back to the same hospital's ward type and hospital, never to the
pool of all sites, and the detectors compare a unit with the rest of its
own hospital. `GET /api/sites` lists every site with its status (home,
connected, awaiting its first message), its rows up to the clock and its
feed (messages, last arrival, warnings, rejected).

**What is shared.** Patient flow and carrier trails are computed over
every site: a patient sampled at Tyks Urology and later at Satasairaala's
ICU is a move between hospitals, and a carrier's trail follows them. That
needs patient identifiers that are the same at both hospitals (the
pseudonymisation step must be shared). The network view shows those
moves; the alerts feed can show all hospitals together.

**Try it (demo only).** The organisers' data has one hospital, so the
demo relabels the same synthetic cultures as Satasairaala's: culture and
patient ids are prefixed `sata-`, except a seeded fraction of patients
who keep their ids and so appear at both hospitals. These are not
Satasairaala's data.

    AEI_LOAD_UNTIL=2025-06-01 AEI_SITES=deploy/container/config/sites.example.json pnpm dev:api
    uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-05 --format hl7 \
        --site sata --token example-sata-token-replace-me-7f3c91d2a4b8e605 --shared-patients 0.2
    curl -s localhost:8787/api/sites

## Sources

- Mylab at Tyks: https://mylabgroup.com/fi/asiakastarinat/tyks-laboratoriot/ ; https://www.mylab.fi/fi/ratkaisut/
- Fimlab and NordLab move to My+ Mikrobiologia: https://fimlab.fi/ajankohtaista/pohjanmaa-tutkimus-23052-li-mikrnho-siirtyy-my-mikrobiologia-jarjestelmaan-21-5-2024-muutoksia-vastausmuodoissa/
- Tyks HL7 link into Weblab: https://www.tyks.fi/ammattilaiselle/genomiikan-laboratorion-kautta-tilattavat-alihankintatutkimukset-varha-yksikoille
- Tyks to OMNI360 in December 2026: https://www.varha.fi/fi/ajankohtaista/tyks-siirtyy-kayttamaan-uutta-potilastietojarjestelmaa-joulukuussa-2026
- CGI at FHIR Demo 2025: https://fhir.fi/en/demo2025/cgi/ ; Finnish SMART IG: https://hl7.fi/fhir/finnish-smart/
- Kanta lab CDA v5.0: https://www.kanta.fi/jarjestelmakehittajat/laboratorion-cda-r2-merkinnat ; FHIR in Kanta: https://www.kanta.fi/en/professionals/fhir-technology-and-kanta
- FI Base 2.0.0 and terminology: https://hl7.fi/fhir/finnish-base-profiles/terminology.html
- THL code systems on the Kanta code server: https://koodistopalvelu.kanta.fi/ (Mikrobinimikkeistö, Mikrobilääkkeet, Mikrobin herkkyys); REST API https://koodistopalvelu.kanta.fi/codeserver/resources/apidocs/v8/openapi.yaml
- HL7 Europe Laboratory Report 2.1.0: https://hl7.eu/fhir/laboratory/notes.html
- HL7 v2.5.1 table 0078 (OBX-8 S/I/R): https://hl7.eu/HL7v2x/v251/hl7v251tab0078.htm
- EUCAST I in Finnish labs: https://fimlab.fi/ajankohtaista/kanta-hame-keski-suomi-pirkanmaa-paijat-hame-muutoksia-mikrobilaakeherkkyyksien-tulkinnoissa-1-2-2023-alkaen/
- MDCG 2019-11 Rev.1: https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en
- System classes A and B: https://www.kanta.fi/jarjestelmakehittajat/sertifiointi
