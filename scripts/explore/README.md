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

## Finland map (finland.html)

Monthly case counts of MRSA, ESBL *E. coli*, VRE and CPE per wellbeing
services county from THL's communicable disease register, turned into a
rate per 100,000 per year with a Gamma posterior whose prior is the
county's university-hospital catchment (pseudo-population chosen in the
page). Map coloured by the estimate or by the interval width, a time
slider, a fan chart per county, and the table. Tyks is marked.

Needs the open data first (git-ignored, under `data/external/`):

    uv run python scripts/fetch_thl_ttr.py          # THL county series (D-025, D-037)
    uv run python scripts/fetch_county_geometry.py  # county polygons

then open http://127.0.0.1:8765/scripts/explore/finland.html with the
same server as above. Sources are THL (fact_ttr_cases) and Statistics
Finland county polygons, both CC BY 4.0. County population is recovered
from cases and incidence in the THL series. The newest months in the
register may be incomplete because of reporting lag.

## Pressure surface (surface.html)

The county estimates smoothed into one continuous surface over Finland
(Gaussian kernel, bandwidth slider), drawn as a height field on a canvas
with drag-to-rotate, drag-to-tilt and scroll-to-zoom. Dashed contours of
the same surface. The five university hospitals and one central hospital
per county are marked and linked along the referral tree; arrows run
along the links from the higher-rate end to the lower with width
proportional to the difference, the flow term of a diffusion model on the
referral network. Pulses along the links and around the hospitals are
decoration. The surface is a picture of pressure between 23 numbers, not
a measurement; the stepped map carries the numbers.
