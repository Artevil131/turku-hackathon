# Audience: who we build for and what they need

Source: Artem's conversation with the judges, 2026-10-16. This is the
basis for the first judging criterion, demonstrated understanding of the
challenge. CONTEXT.md has the brief, the data and the remaining open
questions.

The judges want a **really convenient tool for two specific audiences**:
the doctor who has to pick an antibiotic now, and the researcher who has
to spot a dangerous bacterium before it spreads. Both look at the same
data, but they ask different questions of it and have very different
amounts of time.

|                  | Doctor                                   | Researcher                                         |
|------------------|------------------------------------------|----------------------------------------------------|
| Question         | Which antibiotic should I start now?     | Is something unusual happening, and where is it spreading? |
| Scope            | My ward, my patient, now                 | One hospital, a network of hospitals, up to worldwide |
| Time available   | Seconds to a minute, during care         | Time to explore and compare                        |
| Input            | What they know about the patient         | Filters, places, periods                           |
| Output           | A short ranked list of antibiotics       | Odd signals, raised without having to hunt for them |
| Criterion served | Suitability, usability                   | Deviations and anomalies, suitability              |

## 1. The doctor: empirical treatment

**Situation.** A patient has a suspected infection. A sample goes to the
lab, but the culture and susceptibility result takes days. Treatment
often cannot wait, so the doctor starts an antibiotic before knowing which
bacterium it is or what it resists: empirical treatment.

**What they rely on today.** Guidelines, experience, and the yearly
hospital-level resistance report, which is too old and too coarse to say
what works on their ward this month (CONTEXT.md).

**What they want.** Enter what they know about the patient and get, at
once, a list of antibiotics likely to work, based on recent results from
their own ward.

**What the doctor could enter.** What is known before the result arrives.
The dataset has fields for some of it; the rest needs the judges or the
team to confirm:

| Input                                           | In the dataset                          |
|-------------------------------------------------|-----------------------------------------|
| Ward or health centre                           | yes (`ward_code`)                        |
| Specimen: urine, blood, wound                   | yes (`specimen`)                         |
| Sex and age                                     | yes (`sex`, `birth_year`, `age_years`); the README notes urinary *E. coli* resistance differs by sex |
| Inpatient day 3 or later (hospital-acquired)    | derivable (`sample_date`, `admission_date`) |
| Suspected or preliminary organism               | organism is in the data; whether a doctor knows it early is to confirm |
| The patient's earlier resistant findings (ESBL, MRSA, ...) | derivable from earlier isolates of the same patient |

**What the answer must show.** Not just a ranking, but why the doctor can
trust it: how many results it rests on, how recent they are, and whether
the ward's own data was enough or a wider pool was used. Most four-week
ward figures fall below the 30-isolate rule (CONTEXT.md, "The core
tension"), so this is the hard part of the doctor's view.

**Boundary.** The tool supports the decision; the doctor makes it. A
tool that recommends treatment may count as a medical device under EU
rules, which is worth stating in the pitch rather than ignoring.

## 2. The researcher: stopping spread early

**Who.** People who try to prevent the spread of harmful bacteria: hospital
infection prevention and control teams, clinical microbiologists,
hospital epidemiologists, and public-health surveillance staff (in
Finland, THL). The judges compared it to COVID: seeing an outbreak coming
before it arrives. The difference is that our data is bacterial, so the
outbreaks in question are resistant bacteria (for example ESBL-producing
*E. coli*, MRSA, VRE, carbapenemase-producing CPE) moving through wards
and hospitals.

**What they want.**

- **Continuous data from one hospital**: what happens there, as it
  happens.
- **A network view**: how hospitals are connected, regionally, across
  Finland, and further out to continents and worldwide, using all the open
  data we can get, for the most accurate picture.
- **Odd signals raised for them**: the tool finds unusual patterns and
  shows them, instead of the researcher digging through charts. This is
  where the data science goes, and it maps directly onto the fourth
  judging criterion.

**A network is already in the dataset.** Of the 8,829 patients with at
least one culture, 6,477 have cultures from two or more units (computed).
The emergency department shares the most patients with the other units:
2,077 patients with internal medicine A, 1,888 with urology, 1,858 with
surgery (computed). Patients also carry one of five home areas. The
dataset has no explicit transfer records; whether shared patients and
sample dates are a fair proxy for movement between units is for the team
to decide. Beyond the nine units, the network has to come from open data
(see "Research" below).

## What both audiences share

- The same underlying data, counted the same way (first isolate, minimum
  counts), so the doctor's list and the researcher's view never disagree.
- Trust: every number shows what it rests on.
- Freshness: results appear as soon as they exist, not once a year.

A link between the two is worth raising with the judges: a signal the
researcher sees (resistance rising on a ward) may also matter to the
doctor treating a patient on that ward today.

## Open questions this raises

1. What exactly does the doctor know and enter at the moment of choosing,
   and is organism ever known that early?
2. Should the doctor see the researcher's signals for their ward?
3. Open data is mostly national or regional yearly percentages, while our
   hospital data is per isolate per day. How should the two levels be
   compared? (A data-science decision for the team.)
4. Which signals count as "odd" for a researcher, and how early is early
   enough to act? (Research below, then a team decision.)

## Research

### What researchers struggle with

Full notes and sources: research/researcher-needs.md. What matters for
the tool:

- **Analysis falls on a few people without time or skills** (112 UK
  interviews). The tool has to do the counting and comparing itself, not
  hand over raw tables.
- **Ward-by-ward review misses outbreaks.** In one US outbreak, 10
  patients were on 8 different wards and nobody connected them until
  genome sequencing did. That makes the case for the network view, even
  inside one hospital.
- **Teams watch a short list of organisms and miss the rest.** Of 70
  clusters that usual surveillance missed in 10 hospitals, 83% involved
  organisms the teams did not routinely target, and about half kept
  growing after they could first have been detected. In Finland,
  carbapenemase genes have moved between species, so watching one species
  at a time is not enough.
- **Detection tools trade misses against alert volume.** On the same
  hospital's data, one tool raised 9 alerts in seven years and missed
  small shifts; others raised 319 and 472. How many signals a researcher
  can act on is a design question for us, not only a statistical one.
- **Counting is often done wrong.** Of 22 laboratory surveillance systems
  reviewed, only 8 explicitly removed duplicate isolates. Doing the
  first-isolate rule automatically and showing it is a selling point.
- **National reporting is yearly** (Finres), and its coverage has
  weakened in recent years.

### Why the network view matters

- University hospitals are **hubs** of referral networks and receive
  colonised patients first (Netherlands, MRSA). Tyks is a university
  hospital, so it sits where a regional problem would show up early.
- Hospitals that share many patients carry similar resistant strains (UK
  and Ireland, MRSA genomes), and facilities with more patient-sharing
  links have more carbapenem-resistant bacteria (Illinois).
- In France, CPE moved from imported cases to local spread through
  patient transfers, out from a few regional hubs.
- In Finland, 63% of CPE cases with data had travel or hospital care
  abroad (2012–2018), which is the argument for looking beyond the region
  and the country.

### Open data for the wider network

Full inventory: research/open-data.md. In short:

- **Region (Finland):** THL's communicable-disease register gives monthly
  MRSA, ESBL, CPE and VRE case counts for every wellbeing services county,
  Varsinais-Suomi included, through October 2026, with an open API. It is
  the only open source that reaches below country level and updates
  monthly.
- **Finland:** the public Finres cube gives yearly national resistance
  percentages per organism, antibiotic and specimen (CC BY 4.0), but no
  region or hospital breakdown.
- **Nordics, Europe, world:** yearly country-level percentages (ECDC
  EARS-Net, WHO GLASS, Nordic reports). The ECDC Atlas forbids
  redistributing its exports, so we link to it rather than bundle it.
- **Spread between places:** NCBI Pathogen Detection has over a million
  isolates worldwide with genetic clusters, updated daily, the clearest
  open evidence of the same strain in different places.
- **Missing:** there is no open data on patient transfers between Finnish
  hospitals. Within the dataset, shared patients between units are the
  only network signal we have.

Every open source is coarser than our hospital data: counts or yearly
percentages, by country or county, against per-isolate daily results. How
to compare across those levels is a decision for the team.

## Who works on what

| Person   | Focus                         |
|----------|-------------------------------|
| Artem    | Data science and statistics   |
| Vaishnav | App, UX and UI                |
| Apa      | A bit of everything           |
