# @aei/ingest

Lab results as a laboratory system sends them, turned into the dataset's
own rows (patients, cultures, isolates, susceptibility), so the
detectors, alerts and coverage list work on live data unchanged (D-035).

    ingest(body, detectFormat(body, contentType), { maps, guideline })   // -> IngestResult (rows + warnings)
    parseHl7Message / parseHl7Batch      // HL7 v2.5.1 ORU^R01
    parseFhirBundle                      // FHIR R4 Bundle (HL7 Europe Laboratory Report 2.1.0 shape)
    parseIsolateCsv                      // flat WHONET-style export, one row per isolate
    extendCodeMaps({ wards: { KARDIO: "MED-A" }, organisms: { "urn:oid:1.2.246.537.6.241|<code>": "Escherichia coli" } })
    mergeResults(a, b)                   // a culture sent again replaces the earlier one

| Format | Read from |
|---|---|
| HL7 v2 ORU^R01 | PID-3/7/8 patient; PV1-3 ward, PV1-44 admission; OBR-3 culture id, OBR-7 or SPM-17 collection; SPM-4 or OBR-15 specimen; organism OBX per isolate (OBX-4); susceptibility OBX (OBX-3 antibiotic, OBX-8 S/I/R) in the culture OBR or a child OBR (OBR-26 sub-id, OBR-29 parent); phenotype OBX (ESBL, MRSA, VRE, CPE) |
| FHIR R4 Bundle | DiagnosticReport (identifier, subject, specimen, encounter, result); Patient (identifier, gender, birthDate); Specimen (type, collection); Encounter (location, period.start); organism Observation with hasMember, opening susceptibility panels (LOINC 29576-6); interpretation S/I/R |
| Flat export | patient_id, sex, birth_year or birth_date, culture_id or specimen_number, sample_date or spec_date, ward, admission_date, specimen or spec_type, organism, esbl/mrsa/vre/cpe, one column per antibiotic (WHONET code or name) |

Codes go through `CodeMaps`: defaults cover SNOMED CT organisms and
specimens, HL7 table 0487, WHONET antibiotic codes and names in English,
Finnish and Latin; `FINNISH_SYSTEMS` names the THL and Kuntaliitto code
systems for a site's map. Anything unmapped is a warning, not a guess.
EUCAST "I" (susceptible, increased exposure) counts as S.

Tested in `src/ingest.test.ts`; `libs/utils/py/tests/test_ingest_roundtrip.py`
sends two weeks of the dataset through all three formats (built by
`aei.messages`) and requires the same rows back.

Relies on: D-004, D-035.
