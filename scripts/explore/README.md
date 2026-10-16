# Data explorer

A single static page for looking through the synthetic microbiology
dataset: antibiogram, counts per unit and organism, weekly timeline,
shared-patient matrix between units, and a record browser with CSV export.
Filters: unit, specimen, organism, sex, age, onset (sample on day 3 of the
stay or later), window (4 weeks, 12 months, all) as of a chosen date, and
the first-isolate rule (per patient, organism, specimen, inside the window).

It is a throwaway tool for the team, not part of the product, and uses no
framework or library, so it depends on nothing in DECISIONS.md.

Run from the repository root:

    python3 -m http.server 8765 --bind 127.0.0.1

then open http://127.0.0.1:8765/scripts/explore/
