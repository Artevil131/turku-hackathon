# @aei/i18n

UI copy in Finnish and English (D-010), shared by every app so wording stays
the same, plus the dataset's own Finnish and English names.

- `t(locale, key, vars?)`: message lookup with `{name}` placeholders. Keys
  are typed from `src/en.ts`; `src/fi.ts` must have every key (tested).
- `wardName`, `antibioticName`, `specimenName`, `homeAreaName`,
  `phenotypeName`, `formatDate`, `formatMonth`, `formatPercent`.
- `LOCALES`: the supported locales, `fi` and `en`.

Relies on: D-010. Tests: `src/i18n.test.ts`.
