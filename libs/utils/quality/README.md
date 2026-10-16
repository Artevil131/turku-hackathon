# @aei/quality

Plausibility checks on lab data in the dataset's row shape (D-038). Each
check is a fact, not a threshold, and only reports: rows are never
changed or dropped.

    checkRows(rows, { asOf })   // -> Finding[] {check, severity, id, message}
    summarize(findings)         // -> CheckSummary[] per check, errors first

| Check | Severity | Flags |
|---|---|---|
| `duplicate-id` | error | a patient, culture or isolate id twice |
| `duplicate-result` | error | one antibiotic reported twice for an isolate |
| `missing-link` | error | a culture without its patient, an isolate without its culture, a result without its isolate |
| `isolate-count` | error | `n_isolates` against the isolate rows; a positive culture without isolates or a negative one with them |
| `sample-before-birth` | error | sampled before the patient's birth year |
| `admission-after-sample` | error | admitted after the sample was taken |
| `future-sample` | error | sampled after `asOf` |
| `age-mismatch` | suspect | age not the sample year minus birth year (or one less) |
| `ward-type` | suspect | inpatient or outpatient against the unit's type |
| `intrinsic-susceptible` | suspect | S to an antibiotic the organism resists by nature; EUCAST asks to check identification and test (`@aei/eucast`) |
| `no-breakpoint-reported` | suspect | a result where EUCAST gives no breakpoint |
| `specimen-antibiotic` | suspect | a urine-only antibiotic on blood or wound |
| `inferred-contradiction` | suspect | a result against what EUCAST infers from the isolate's others (staphylococci from cefoxitin, *E. faecalis* piperacillin-tazobactam from ampicillin) |
| `phenotype-organism` | suspect | ESBL or CPE outside Enterobacterales, MRSA outside *S. aureus*, VRE outside *E. faecalis* |
| `phenotype-result` | suspect | MRSA flag against the cefoxitin result, VRE flag against vancomycin |

On the organisers' dataset (10,000 patients, 46,792 cultures, 24,571
isolates, 172,381 results) every check passes. The server runs them over
all its rows (`GET /api/quality`) and on every `POST /api/ingest`
payload, whose response lists the findings.

Relies on: D-004, D-038. Tests: `src/quality.test.ts`.
