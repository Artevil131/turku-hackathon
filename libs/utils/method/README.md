# @aei/method

The method registry (D-075): one entry per detector or rule that says what it computes. Each
entry has the formula (LaTeX source), a one-line plain reading in English and Finnish, the
constants with their values and decisions, where the code lives (TypeScript path and function,
Python function in `aei.detect`), the decisions it relies on, and a notebook snippet.

    METHODS                     // the seven entries, keyed by MethodId
    methodOf(alert)            // the entry for an alert, or null (carrier arrivals)
    fillSnippet(method, values) // the notebook snippet with {ward}, {organism}, {from}, {to} filled

Constants are read from `LIVE_SETTINGS` (`@aei/detect`) and `NEW_IN_UNIT_DAYS` (`@aei/alerts`)
at load time. One exception is the minimum of 50 baseline isolates, which `detectors.ts` keeps
beside the test rather than in the settings; it is written here as `MIN_BASELINE_ISOLATES`.

Readers: the signal card's ⓘ (`apps/web/.../math/AlertMath.tsx`). Planned: the Method page, the
export's Methods paragraph (D-064), and the research package's `methods.json`.

Relies on: D-014, D-020, D-021, D-022, D-031, D-034, D-042, D-044, D-075. Tests: `src/registry.test.ts`.
