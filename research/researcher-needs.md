# Researchers and infection control: needs, pain points, evidence

Background research for AUDIENCE.md, collected 2026-10-16 by Claude Code
(operated by Artem) from web search and Europe PMC abstracts; most full
texts were not readable, so claims rest on abstracts. Items marked
**[unverified]** are only partly checked. This describes the field; it does
not choose any method for us (AGENTS.md).

## 1. Who they are and how they work

- **Hospital infection prevention and control (IPC) teams.** In Finland,
  infection-control units with infection-control nurses
  (hygieniahoitajat). The clinical microbiology lab notifies the unit of
  each new multidrug-resistant (MDR) finding; the unit arranges screening
  of the carrier and contact tracing of exposed patients, and coordinates
  isolation and cohorting.
  - Example of the Finnish workflow (Etelä-Pohjanmaa wellbeing county, not
    Varha): [MDR guideline](https://www.hyvaep.fi/uploads/2025/06/moniresistenttien-mikrobien-torjuntaohje-.docx)
- **Routine surveillance, HUS example.** Each unit's hygiene contact person
  reviews infections monthly and reports them to the ward; the area's
  hygiene nurse validates them. Legal basis: Health Care Act §8 and
  Communicable Diseases Act §17.
  - [HUS HLI seuranta, ilmoittaminen ja raportointi (3/2026)](https://www.hus.fi/sites/default/files/2026-04/hoitoon-liittyvien-infektioiden-hli-seuranta-ilmoittaminen-ja-raportointi-tarkastettu-3_2026.pdf)
- **US equivalents.** Infection preventionists and hospital
  epidemiologists, who judged automated cluster alerts in a 43-hospital
  study.
  - [Baker et al., ICHE 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC9451926)
- **National and international level.** Finland: THL, through the Finres
  resistance database, the national CPE strain collection and the SIRO
  hospital-infection programme. Europe: ECDC EARS-Net. Global: WHO GLASS.

## 2. Pain points

- **Data work falls on a few people, and data is hard to reach.** 112 UK
  interviews (41 policymakers, 71 health professionals): collection and
  analysis often fell to a few people lacking time or skills; some
  underestimated what data already existed.
  - [BMC Public Health 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7053143/)
- **Usual surveillance misses clusters** (Baker 2020, 10 hospitals):
  - only 9 of 51 clusters found by usual surveillance were statistically
    significant;
  - of 70 clusters the usual methods missed, 83% involved organisms the
    teams did not routinely target;
  - about half kept growing after the point where they could first have
    been detected.
- **Simple ward rules are crude.** The typical "3 cases of one pathogen on
  one ward within 2 weeks" covers few pathogens and ignores baseline and
  random variation.
  - [Huang et al., PLoS Med 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2826381/)
- **Outbreaks cross wards, so ward-by-ward review misses them.** In one
  UPMC outbreak, 10 patients were on 8 different wards; nobody noticed
  until genome sequencing linked them (press, not peer-reviewed).
  - [University of Pittsburgh, EDS-HAT](https://www.medschool.pitt.edu/node/933)
- **Systems are not interoperable.** Most automated surveillance systems
  were built inside single hospitals with different methods and
  definitions, which blocks comparison across hospitals.
  - [PRAISE roadmap, Clin Microbiol Infect 2021](https://hal.sorbonne-universite.fr/hal-03425453v1)
- **Export from lab systems and manual re-entry** (low and middle-income
  settings, not Nordic): in Nepal only 2 of 10 trained hospitals still used
  WHONET, partly because their lab system could not export; in Thailand
  labs re-enter results by hand.
  - [PLOS ONE 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12212552/),
    [Oxford Global Health](https://www.globalhealth.ox.ac.uk/publication/2096730)
- **Duplicates and sampling bias.** Of 22 laboratory-based AMR
  surveillance systems reviewed, only 8 explicitly removed duplicate
  isolates and only 4 were free of significant sampling bias.
  - [Can J Infect Dis Med Microbiol 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3222764)
  - EARS-Net counts only the first invasive (blood or cerebrospinal fluid)
    isolate per patient per year:
    [ECDC](https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data)
- **Finnish coverage is weakening.** Finres 2023: national coverage is
  still good but has clearly weakened in recent years.
  - [Räisänen et al., THL Työpaperi 63/2024](https://julkari.fi/handle/10024/149986)
- **Alert volume.** No survey of IPC staff on alert fatigue was found. The
  closest evidence, one hospital 2014–2021: WHONET-SaTScan raised 9
  alerts and missed small baseline shifts and sporadic organisms; CLAR
  raised 319; a percentile rule 472. Clinical relevance and timing still
  need study.
  - [Sim, Pinto, van Mourik, ARIC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11210035/)
- **Reporting delay.** No source with numbers on EARS-Net or Finres
  reporting lag was found **[unverified]**.

## 3. Signals they care about, and existing tools

- **What is concerning.** In the 43-hospital study, infection
  preventionists wanted alerts for 81% of 230 clusters found. The ones
  rated moderately or highly concerning were large, strongly significant,
  or involved *C. difficile* or MDR organisms (Baker 2020).
- **WHONET-SaTScan.** Free software running a space-time permutation scan
  on routine microbiology data plus admission, discharge and transfer
  data, finding clusters by ward or service (Huang 2010, Baker 2020).
  Participating programmes felt it would improve detection; few alerts in
  the Utrecht comparison (Sim 2024).
- **CLAR and percentile rules.** Caught sporadic organisms and small
  baseline shifts, with many more alerts (Sim 2024).
- **EDS-HAT (UPMC).** Whole-genome sequencing plus health-record mining to
  link patients; estimated 62 infections and 5 deaths prevented and about
  USD 700k saved over 2 years; funding named as the main barrier.
  - [Healio 2023](https://www.healio.com/news/infectious-disease/20230518/genomic-surveillance-detects-helps-stop-hospital-outbreaks)
- **Look beyond single species (Finland).** Carbapenemase genes (KPC-3,
  OXA-48) moved between species on plasmids across three Finnish
  healthcare organisations; the authors argue surveillance should not be
  limited to single species.
  - [Piispa et al., Front Microbiol 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12209321/)

## 4. Spread across hospital networks

- **Netherlands.** On Dutch national referral data, a hospital's MRSA
  prevalence depends on its position in the referral network; university
  hospitals are hubs and receive colonised patients first.
  - [Donker, Wallinga, Grundmann, PLoS Comput Biol 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2841613/)
- **UK and Ireland.** 1,085 EMRSA-15 genomes from 52 hospitals: hospitals
  in the same referral region, or sharing many patients, have similar MRSA
  populations; most introductions come from hospitals that send many
  patients.
  - [Donker et al., Microbial Genomics 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5605955)
- **Illinois.** Facilities with more patient-sharing connections had
  higher CRE rates (about +6% per extra connection in rural facilities).
  - [Ray et al., CID 2016, summary](https://journalclub.wustl.edu/2016/08/04/spread-of-carbapenem-resistant-enterobacteriaceae-among-illinois-healthcare-facilities-the-role-of-patient-sharing/)
- **France 2012–2015.** Around 2013 the CPE epidemic shifted from imported
  cases to local spread through patient transfers, radiating from a few
  regional hubs.
  - [Scientific Reports 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7483561/)
- **Nursing homes (Netherlands).** Long stays can let nursing homes drive
  and sustain epidemics **[unverified, search snippet]**.
  - [PMC5718398](https://pmc.ncbi.nlm.nih.gov/articles/PMC5718398)
- **Finland.** The largest Finnish CPE clusters reportedly spread to
  several facilities through patient transfers **[unverified]**.

## 5. Finnish specifics

- **Finres (THL).** Clinical microbiology labs send susceptibility data to
  THL, merged into the Finres database (part of the National Infectious
  Diseases Register). Yearly report with 10-year trends; Finres 2023 is
  the latest found.
  - [THL reports](https://thl.fi/aiheet/infektiotaudit-ja-rokotukset/seurantajarjestelmat-ja-rekisterit/mikrobilaakeresistenssin-seuranta/mikrobilaakeresistenssin-tutkimusryhma-fire/mikrobilaakeresistenssin-seurantaraportit)
  - About 2 million human isolates a year **[unverified]**:
    [Ruokavirasto seminar summary](https://www.ruokavirasto.fi/globalassets/teemat/zoonoosikeskus/mikrobilaakeresistenssi/finres_vet_seminaari2021_yhteenveto.pdf)
- **CPE in Finland 2012–2018.** 231 strains from 202 patients, mostly
  found by screening; 63% of cases with data had travel or hospital care
  abroad; nearly a third were not found by screening, suggesting hidden
  transmission.
  - [Räisänen et al., EJCMID 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7427707)
- **SIRO.** THL's hospital-infection programme since 1999, focused on
  surgery; hospitals choose what they report.
  - [Eduskunta KK 660/2013](https://www.eduskunta.fi/pdf/KK+660/2013)
- **Varha / Tyks.** No public Varha AMR surveillance report found. Yle
  reported a serious VRE epidemic in Varsinais-Suomi (article over 6 years
  old): [Yle](https://yle.fi/a/3-11086156). Tyks staff are the best source
  for the current workflow.
- **Finland's 2030 targets.** Lower antibiotic consumption, fewer MRSA and
  resistant *E. coli* / *K. pneumoniae* bloodstream infections.
  - [ECDC country sheet](https://antibiotic.ecdc.europa.eu/sites/default/files/documents/Country-sheet-Finland.pdf)

## Gaps

No peer-reviewed survey of IPC staff on alert fatigue or reporting delay,
no numbers on EARS-Net or Finres lag, no current Varha surveillance
documentation.
