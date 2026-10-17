# @aei/domain

Types and code lists of the synthetic microbiology dataset: wards, antibiotics,
specimens, organisms, phenotypes, and the row types of the four CSV files plus
`IsolateRecord` (one isolate with its culture, patient and results joined).
Facts of the data only; no counting rules or statistics. Two fixed
definitions live here because several gears share them: the age-group
table (`AGE_GROUPS`, D-019; used by `@aei/ask` and `@aei/coverage`) and
hospital onset (`isHospitalOnset`, day 3 of the stay or later; used by
`@aei/detect` and `@aei/coverage`).

Interface: `WARDS`, `ANTIBIOTICS`, `SPECIMENS`, `ORGANISMS`, `PHENOTYPES`,
`HOME_AREAS`, `AGE_GROUPS`, `shortOrganism()`, `isWardCode()`,
`isAntibioticCode()`, `isAgeGroup()`, `inAgeGroup()`, `isHospitalOnset()`,
and the types.

Relies on: D-003, D-004, D-019, D-047.
