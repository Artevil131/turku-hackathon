# Open AMR data for the network view

Inventory of open or freely accessible data that could place one hospital
in a wider network (region, Finland, Europe, world). Collected 2026-10-16
by Claude Code (operated by Artem) by web search and page fetch; nothing
downloaded. **[unverified]** marks what could not be confirmed on a primary
page. Which sources we use, and how they are combined with the hospital
data, is a team decision (DECISIONS.md).

## Headlines

1. **THL's communicable-disease register cube is the best Finnish regional
   source.** By wellbeing services county (all 21, plus Helsinki and
   Åland, including Varsinais-Suomi), month, age group and sex, through
   October 2026. Covers MRSA, ESBL *E. coli* / *K. pneumoniae*, CPE and
   VRE, carriage and blood/CSF. Free, with a JSON API.
2. **The public Finres cube is national only.** Year 2008–2025 × 14
   organism genera × 42 antibiotics × 5 specimen types, with S/I/R counts,
   %R and 95% CI, CC BY 4.0. No region, hospital or lab breakdown; the
   full cube needs a login.
3. **No open data on patient transfers or hospital networks exists for
   Finland.** Hospital discharge data (Hilmo) needs a Findata permit. Only
   the administrative structure is open.

## Inventory

### Finland

- **Finres public cube** (THL with the FiRe lab network: 24 labs, about
  95% of Finnish susceptibility tests).
  [Cube](https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite),
  [summaries](https://sampo.thl.fi/pivot/prod/fi/finres/),
  [dimensions JSON](https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite.dimensions.json).
  - Country level; yearly 2008–2025, updated 08.10.2026.
  - Genus × antibiotic × specimen (blood, pus/other, faeces, throat,
    urine); strains, tests, S/I/R, %R, 95% CI. No age, sex, region, lab.
  - Web pivot, CSV/Excel export, JSON API. "© THL 2026, CC BY 4.0".
  - Use: national baseline per organism, antibiotic and specimen.
    Breakpoints moved to EUCAST in 2011, so earlier years are not directly
    comparable.
- **Finres full and MDR cubes** (THL). Login-restricted (HTTP 401); may
  have lab or region breakdowns **[unverified]**. Could be requested from
  THL.
- **Communicable disease register (TTR) cases cube** (THL).
  [Cube](https://sampo.thl.fi/pivot/prod/fi/ttr/cases/fact_ttr_cases).
  - Wellbeing services county, with municipalities below; year and month,
    1995 to October 2026, updated monthly.
  - Case counts for MRSA, ESBL, CPE (*K. pneumoniae*, *E. coli*,
    *E. cloacae*), VRE; age group, sex.
  - Web pivot, CSV export, JSON API. THL open data is generally CC BY 4.0;
    the footer on this cube was not seen **[unverified]**.
  - Use: Varsinais-Suomi against the other counties, monthly, and how
    resistant organisms appear across neighbouring counties.
- **THL AMR statistics and Finres yearly reports.**
  [Statistics](https://thl.fi/en/data-and-statistics/infectious-diseases/antimicrobial-resistance),
  [reports](https://thl.fi/aiheet/infektiotaudit-ja-rokotukset/seurantajarjestelmat-ja-rekisterit/mikrobilaakeresistenssin-seuranta/mikrobilaakeresistenssin-tutkimusryhma-fire/mikrobilaakeresistenssin-seurantaraportit).
  National narrative and indicators (for example invasive MRSA 2.0 per
  100,000 in 2025). Regional tables **[unverified]**.
- **THL open data API** in general: JSON, JSONP, JSON-stat; R packages
  `openthl` and `sotkanet`; CC BY 4.0 according to the package docs
  **[unverified on THL's own terms page]**.

### Nordic neighbours

- **Sweden, Folkhälsomyndigheten notifiable-disease statistics**:
  [ESBL-CARBA](https://www.folkhalsomyndigheten.se/statistik-och-data/hitta-statistik-och-data/esbl-carba-statistik/).
  County (län) level, cases and incidence per 100,000 by age and sex,
  2016–2026. The Swedish counterpart of the TTR cube. Download format
  **[unverified]**.
- **Swedres-Svarm** (Sweden):
  [reports](https://www.sva.se/en/what-we-do/antibiotics/svarm-resistance-monitoring/swedres-svarm-reports/).
  National, yearly, web report and PDFs; terms not stated.
- **NORM / NORM-VET** (Norway):
  [2024 report](https://www.fhi.no/en/publ/2025/norm-og-norm-vetusage-of-antimicrobial-agents-and-occurrence-of-antimicrobial-resistance-in-norway/).
  National, yearly, PDF tables only.
- **DANMAP** (Denmark): [danmap.org](https://www.danmap.org/). National,
  yearly, PDF; a dashboard exists **[unverified]**.

### Europe

- **ECDC Surveillance Atlas, EARS-Net**:
  [Atlas](https://atlas.ecdc.europa.eu/public/index.aspx?Dataset=27&HealthTopic=4).
  - 30 EU/EEA countries, country level only; invasive isolates (blood,
    CSF); %R by organism and antibiotic; yearly, latest 2024.
  - CSV export from the Atlas.
  - **Terms:** acknowledge Member States and ECDC; respect low cell
    counts; do not redistribute exported datasets without ECDC's written
    consent ([disclaimer](https://atlas.ecdc.europa.eu/public/disclaimer.htm)).
    So link to it or acknowledge it rather than bundle it.
- **WHO/Europe and ECDC joint report (CAESAR + EARS-Net)**:
  [report](https://www.who.int/europe/publications/i/item/9789289062619).
  About 44 countries of the WHO European Region, 2024 data, PDF.

### World

- **WHO GLASS**:
  [dashboard](https://worldhealthorg.shinyapps.io/glass-dashboard/),
  [portal](https://data.who.int/dashboards/amr/overview).
  110 countries; median %R by pathogen and antibiotic, by region and
  income; 2016–2023. CC BY 4.0 plus WHO terms. Bulk AMR download
  **[unverified]**.
- **NCBI Pathogen Detection**:
  [site](https://www.ncbi.nlm.nih.gov/pathogens/),
  [FTP](https://ftp.ncbi.nlm.nih.gov/pathogen/Results/).
  - Over a million isolates worldwide, **per isolate**: collection date,
    country (sometimes city), source, resistance genes, AST phenotypes,
    and genetic clusters (SNP distances, trees).
  - Updated about daily; FTP TSV/Parquet, web browser, Google BigQuery.
  - No licence statement found **[unverified]**.
  - Use: the clearest open evidence of spread between places, since a
    cluster links genetically close isolates across countries. Finnish
    isolates can be filtered by location.
- **Vivli AMR Register** (industry surveillance, e.g. Pfizer ATLAS, GSK
  SOAR): [amr.vivli.org](https://amr.vivli.org/).
  Per-isolate MICs with basic demographics, many countries. Free
  registration, then a reviewed request; likely too slow for a hackathon.
  Finnish coverage **[unverified]**.
- **ResistanceMap** (One Health Trust):
  [map](https://resistancemap.onehealthtrust.org/AntibioticResistance.php).
  Country %R maps; no download found. Visual reference only.
- **Our World in Data**: [antibiotics](https://ourworldindata.org/antibiotics).
  AMR deaths (from GRAM), antibiotic consumption; CC BY 4.0. Context
  layers.
- **GRAM / IHME GBD 2021**:
  [record](https://ghdx.healthdata.org/record/ihme-data/gbd-2021-bacterial-amr-estimates-forecasts-1990-2050).
  Modelled AMR deaths and DALYs, 204 countries, 1990–2021 with forecasts
  to 2050. Modelled, not observed: burden context, not a benchmark.
  Terms **[unverified]**.
- **CDC AR & Patient Safety Portal** (US):
  [arpsp.cdc.gov](https://arpsp.cdc.gov/). US state level, hospital-acquired
  infections; an example of benchmarking by facility type, not comparable
  to Finnish lab data.

## Finnish regional structure (open)

- **Wellbeing services counties**: 21 plus Helsinki, with a
  municipality-to-county mapping; the region dimension of the THL cubes.
  Boundaries on Statistics Finland's free
  [WFS/WMS](https://geo.stat.fi/geoserver/wfs?service=WFS&request=GetCapabilities)
  (layer name not identified).
- **Five collaboration areas**
  ([Ministry of Finance](https://vm.fi/hyvinvointi-ja-yhteistyoalueet)).
  Western Finland: Varsinais-Suomi, Satakunta, Pohjanmaa (Government
  Decree 91/2022). Before 2023, the Tyks special responsibility area had
  62 municipalities (2014 figure).

One possible nesting this allows, for the team to judge: Tyks →
Varsinais-Suomi → Western Finland collaboration area → Finland → EU/EEA →
world, with county data from the TTR cube, national from Finres, Europe
from the ECDC Atlas, world from GLASS, and genetic links between places
from NCBI. Note that these levels differ in what they count (isolates vs
cases, all specimens vs invasive only) and in time resolution (day, month,
year).

## Gaps

Licence terms for ResistanceMap, GRAM, the Nordic reports and NCBI; GLASS
bulk export; Vivli fields and Finnish coverage. No open transfer data for
Finland.
