---
version: 1
slug: "apps-web-src-app-tsx"
primary_target: "apps/web/src/App.tsx"
related_targets: []
---

# Surface: AEI web app (apps/web)

Scope: the home page (role choice), the Doctor branch, the Research branch, Settings. Mode: Operate.
Audience: doctors choosing empirical treatment (under a minute, ward PC or phone); epidemiology/AMR researchers and infection control looking for early signals.
Constraints: light mode only (dark tokens dormant); language lives in Settings, not on working pages; every figure shows its isolate count; resistance figures are examples until the counting method is decided; when four weeks is too thin the doctor list shows the 12-month figure tagged "12 mo" (provisional, CONTEXT.md question 7).
Unresolved: counting method, deviation detection, relation and profile models, regional/national data.

## Direction contract

THESIS: One shared picture of the laboratory data, two working branches: the doctor gets a recommendation in one click, the researcher gets the data. Built like the order-entry screens staff already use: a narrow context form on the left, the result on the right, details in a drawer. Refuses the BI dashboard and the decorative map-as-home.

OWN-WORLD: Clinical white. Frosted white panels on a pale ground, one hospital blue for selection and primary actions, orange only as resistance shading, amber for resistant finds and fallbacks, red/green only on deltas with a glyph. One sans (Geist), tabular figures. Glass ply is the only rank.

STORY: Home shows the last four weeks of resistant finds and asks for a role. The doctor picks unit, infection site and organism (most common first) and reads the ranked antibiotics, with a window on what is going around: the units that send patients here, where resistant finds turned up, and which organisms are widespread across units and home regions. The researcher filters signals, opens one to see where its patients go next and the same patient's other finds, and moves to antibiograms, monthly trends and unit relations.

FIRST VIEWPORT: Top bar with mark, Home / Doctor / Research, replay clock, settings gear. Doctor at 1440: patient form (290px), ranked list, spread window (360px). Research: filter form, result with tabs Signals / Antibiogram / Trends / Unit relations.

FORM: Order-entry panel (surface seed 561f64f72a7dc358adbd5237e9214b94), within the Susceptibility Analyzer world redirected to clinical white (seed 820180b1).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
