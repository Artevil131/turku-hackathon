# @aei/domain

Types and code lists of the synthetic microbiology dataset: wards, antibiotics,
specimens, organisms, phenotypes, and the row types of the four CSV files plus
`IsolateRecord` (one isolate with its culture, patient and results joined).
Facts of the data only; no counting rules or statistics.

Interface: `WARDS`, `ANTIBIOTICS`, `SPECIMENS`, `ORGANISMS`, `PHENOTYPES`,
`shortOrganism()`, `isWardCode()`, `isAntibioticCode()`, and the types.

Relies on: D-003, D-004.
