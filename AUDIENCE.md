# Audience: who we build for and what they need

Source: Artem's conversation with the judges, 2026-10-16. This is the
basis for the first judging criterion, demonstrated understanding of the
challenge. CONTEXT.md has the brief, the data and the remaining open
questions.

The judges want a **really convenient tool for two specific audiences**, and
said the same continuous signal has many more readers (section 3):
the doctor who has to pick an antibiotic now, and the researcher who has
to spot a dangerous bacterium before it spreads. Both look at the same
data, but they ask different questions of it and have very different
amounts of time.

|                  | Doctor                                   | Researcher                                         |
|------------------|------------------------------------------|----------------------------------------------------|
| Question         | Which antibiotic should I start now?     | Is something unusual happening, and where is it spreading? |
| Scope            | My ward, my patient, now                 | One hospital, a network of hospitals, up to worldwide |
| Time available   | Seconds to a minute, during care         | Time to explore and compare                        |
| Input            | None: ward preset, one-click filters     | Filters, places, periods                           |
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

**What they want.** Open the tool and see, at once, a list of
antibiotics likely to work on their ward, based on recent results from
that ward.

**The doctor types nothing.** Empirical treatment means there is no lab
result yet, so there is nothing to input. The doctor also has no time to
fill in a form. The view is driven by filters that are already in the
dataset: the ward is preset for the user, and the doctor can narrow by
specimen and, where it changes the answer, by patient group. Each filter
is one click, with a sensible default already selected.

| Filter                                          | In the dataset                          |
|-------------------------------------------------|-----------------------------------------|
| Ward or health centre (preset)                  | yes (`ward_code`)                        |
| Specimen: urine, blood, wound                   | yes (`specimen`)                         |
| Sex and age group                               | yes (`sex`, `birth_year`, `age_years`); the README notes urinary *E. coli* resistance differs by sex |
| Inpatient day 3 or later (hospital-acquired)    | derivable (`sample_date`, `admission_date`) |
| Period: last four weeks or last year            | derivable (`sample_date`)                |

Organism is not a filter for the doctor: the organism is what the pending
culture will tell them. The tool shows the likely organisms for the
chosen specimen on that ward (for example, how often urine on urology
grows *E. coli*) and the antibiotics that cover them.

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

## 3. Everyone else: the same signal, more readers

Source: a judge told Artem (2026-10-16) that a continuous signal of
bacteria across connected hospitals is useful for many people beyond the
doctor, researchers among them. So the doctor and the researcher stay the
two audiences we design the screens for, and the audiences below are
served by the same engine through filters, exports and alerts, not by
separate products. "Usable for everyone" means: one set of numbers, one
language, and each reader finds their question answered without
learning the others' views.

Which of these get a screen, a filter, an export or only a line in the
pitch is a team decision. The metrics named here are what each group
asks for, not what we have decided to compute.

| Audience | Their question | Scope and time | Metrics they want | Filters they use | How they would use the tool |
|----------|----------------|----------------|-------------------|------------------|-----------------------------|
| **Ward doctor** (primary) | Which antibiotic should I start now? | My ward, last 4 weeks, seconds | Susceptible % per antibiotic for the likely organisms, isolate count, 4-week versus annual, reliability label | Ward (preset), specimen, sex, age group, hospital-acquired | The default screen, no input |
| **Infection prevention and control** (hygiene nurses, hospital epidemiologist) | Is something spreading, where, since when? | Whole hospital and the wards that share patients, days to weeks | New ESBL / MRSA / VRE / CPE isolates per ward per week, clusters in time and place, hospital-acquired share, wards sharing patients with a signal ward | Flag, organism, ward, period, hospital-acquired | Signal list with evidence, newest first; alerts |
| **Antibiotic stewardship team** (infectious-disease physicians, pharmacists) | Should the empirical guideline for this ward change? | Ward and hospital, months to a year | Resistance trend per organism and antibiotic over rolling windows, annual antibiogram per ward, share of isolates covered by each first-line option | Ward, organism, antibiotic, specimen, period | Trend views, side-by-side antibiograms, export for the guideline |
| **Clinical microbiologist / the lab** | Is this a real change or a problem with our data or tests? | Whole lab, days | Cultures per ward per week, positivity rate, antibiotics tested per organism, new or missing organism names, results arriving late | Ward, specimen, organism, period | Data-quality signals; the lab is the first to know when a feed breaks |
| **Researchers** (clinical, academic) | How does resistance develop, and what drives it? | One or several hospitals, years | De-duplicated first-isolate counts and resistance % by any grouping, with denominators and confidence intervals, consistent over time | Everything in the dataset, any period | Filterable export (CSV, API) with the counting rules applied and stated |
| **Regional and national surveillance** (THL, Finres, EARS-Net) | What is the picture across hospitals, and does it match the region? | County, country, Europe, monthly to yearly | Aggregates in the format they already publish: resistance % per organism, antibiotic and specimen, flagged-case counts per month, compared against the open regional and national figures | Organism, antibiotic, specimen, region, period | Hospital figures next to THL and Finres figures; a feed they could ingest |
| **Hospital management** | Is our resistance situation getting better or worse, and where? | Hospital, quarters to years | A few headline figures: ESBL and MRSA share, resistance to key first-line antibiotics, number of signals raised and acted on | Period | A summary page or a line in the pitch, nothing more |

**What they all have in common** is what the engine already does for the
doctor and the researcher: first-isolate counting, minimum counts shown,
every number with its evidence, continuous updating, and signals raised
rather than hunted. The differences are grouping, time span and output
format.

**What this means for the build.**

- Filters and groupings live in `libs/utils`, once, so every view and
  every export uses the same counting.
- Every figure travels with its isolate count, period and reliability
  label, so an export is as honest as the screen.
- Signals carry a plain reason and their evidence, so infection control,
  the lab and management can each read the same signal.
- One export or API endpoint over the filtered first-isolate data covers
  researchers and surveillance at little cost.
- The open regional and national figures (research/open-data.md) are
  shown next to the hospital's, which is what surveillance and
  stewardship both ask for.

**How to say it to the judges.** One engine, several readers: the doctor
sees a list, infection control sees signals, researchers get the data,
surveillance gets a feed. We demo the first two and show the rest in a
slide or a single export.

## What both audiences share

- The same underlying data, counted the same way (first isolate, minimum
  counts), so the doctor's list and the researcher's view never disagree.
- Trust: every number shows what it rests on.
- Freshness: results appear as soon as they exist, not once a year.

A link between the two is worth raising with the judges: a signal the
researcher sees (resistance rising on a ward) may also matter to the
doctor treating a patient on that ward today.

## Open questions this raises

1. Which patient groups change the doctor's answer enough to deserve a
   filter (sex and specimen clearly; age and hospital-acquired to check)?
2. Should the doctor see the researcher's signals for their ward?
3. Open data is mostly national or regional yearly percentages, while our
   hospital data is per isolate per day. How should the two levels be
   compared? (A data-science decision for the team.)
4. Which signals count as "odd" for a researcher, and how early is early
   enough to act? (Research below, then a team decision.)

## The brief is the data-science goal

The judges' two audiences widen the brief; they do not replace it. The
challenge text gives a concrete specification, and that specification is
the direct goal of the data analysis, in this order:

1. **Resistance percentages per antibiotic and organism**, computed from
   the **first isolate per patient per period** and shown only when they
   rest on **at least 30 isolates**. Both rules come from the organiser's
   README and are the first thing a microbiologist on the jury will check.
2. **Two time windows side by side: the previous four weeks and the
   annual figure.** The four-week figure is what the doctor needs; the
   annual figure is what exists today and is the reference the four-week
   figure is compared against.
3. **Filtering by the dataset's own parameters**: ward, specimen,
   organism, antibiotic, sex, age, inpatient or outpatient, period.
4. **Continuous updating**: the figures change as new results arrive. With
   a fixed dataset this means replaying it as if results arrived day by
   day (CONTEXT.md, "Continuously updated with a fixed dataset").
5. **Deviations and anomalies**: once 1–4 produce a stream of figures over
   time, the data science detects when a figure moves away from its own
   history or from the rest of the hospital, and raises it.

Everything else (the network of hospitals, open data, real datasets) is
built on top of these five and is a plus, not a substitute. If time runs
short, 1–5 ship and the rest is told in the pitch.

The small-count problem is inside point 1: most four-week ward figures
fall below 30 isolates (CONTEXT.md, "The core tension"). What to show in
that case is the central statistical decision and goes to the team and
DECISIONS.md.

## The four criteria: what each means and how to score on it

Each criterion is 25%. The notes below say what we think a judge is
looking for, what in our tool answers it, and what would lose points.
Concrete examples use the dataset's own wards and organisms.

### 1. Demonstrated understanding of the challenge (25%)

**What the judge asks.** Do they know who this is for, why yearly
hospital-level reports fail them, and what the data can and cannot say?

**How to show it.**

- Open the pitch with the doctor's situation: a patient on urology with a
  suspected urinary infection, the culture result is three days away, the
  last resistance report is from last year and covers the whole hospital.
- Say out loud the two counting rules and why they exist: repeats of the
  same patient inflate resistance, and 5 isolates cannot give a percentage.
- Name the core tension (recent and local versus reliable) and show how
  the tool handles it, rather than hiding it.
- Show the two audiences and their different questions (the table at the
  top of this file).
- Mention that a treatment recommendation may be a medical device, and
  that the tool therefore supports the decision rather than making it.
- Mention the real surveillance landscape (Finres yearly, THL monthly
  counts, EARS-Net yearly by country) and where our tool sits in it.

**What loses points.** Treating the data as a generic table; a percentage
with no isolate count behind it; not knowing what ESBL or empirical
treatment means when asked.

### 2. Suitability to the challenge description and the insight (25%)

**What the judge asks.** Does the tool do what the text asks (four weeks
and annual, filters, continuous), and does it go beyond a BI dashboard
as the insight demands?

**How to show it.**

- The default screen already answers the doctor's question with no
  interaction: ward preset, last four weeks, antibiotics ranked, annual
  figure next to each for comparison.
- Every filter in the brief works, and changing one updates every number.
- The "continuous" demo: a clock that advances through the dataset and
  the numbers, charts and alerts move with it. Include a day where
  something happens.
- The step beyond BI: the tool interprets. "Nitrofurantoin for urine on
  urology: 94% susceptible in the last four weeks, on 41 first isolates,
  in line with the yearly 93%." A dashboard shows the bar; we say what it
  means and whether it can be trusted.
- The researcher's view and the regional comparison show that the same
  engine serves both audiences.

**What loses points.** A tool that only shows yearly figures; filters that
exist but do nothing; a world map with no data behind it; building the
network view at the cost of the four-week view.

### 3. Usability (25%)

**What the judge asks.** Could a doctor get an answer in the time they
have, without training, and would a researcher find the odd signal
without hunting?

**How to show it.**

- **Zero-input default for the doctor.** Open the tool, see the list.
  Time to the first useful answer under five seconds, counted in the demo.
- **Every number carries its evidence**: isolate count, period, and a
  plain label for reliability (for example "41 isolates, last 4 weeks" or
  "too few on this ward, showing hospital-wide").
- **One language for both audiences.** Susceptible and resistant, not
  S/R codes; organism names as the lab writes them; antibiotic names, not
  WHONET codes.
- **Fit for the place it is used.** Readable on a ward computer and a
  phone, high contrast, large tap targets, no hover-only information.
- **Signals come to the user.** The researcher opens a list of what
  changed, newest first, each with a one-line reason and a link to the
  evidence. They do not scan nine wards by thirteen antibiotics.
- **Test it on someone outside the team** before the demo, time them,
  and say so in the pitch.

**What loses points.** A dense dashboard of small charts; percentages
without counts; requiring the user to know the dataset's column names;
anything that needs a tutorial.

### 4. Detecting deviations and anomalies (25%)

**What the judge asks.** Does the tool notice when something changes or
looks wrong, and tell the user, instead of leaving it to the eye?

**Kinds of deviation to look for in this data** (which ones to implement
and how to detect them is a team decision for DECISIONS.md):

- **A rising trend**: resistance of *E. coli* to ciprofloxacin on
  internal medicine A climbs over several four-week windows while the
  hospital total stays flat.
- **A cluster**: several ESBL-positive isolates on one ward within a short
  period, or the same resistant organism appearing in several wards that
  share patients (the dataset has shared patients between units).
- **A rare finding**: any CPE or VRE isolate is a signal on its own, since
  these are rare and reportable.
- **A ward out of line with the rest**: the ICU's resistance for one
  antibiotic sits far from the other wards' for the same period.
- **A data-quality deviation**: a ward sends far fewer or more cultures
  than usual, a new organism name appears, an antibiotic stops being
  tested, or results arrive late. Catching these shows the team knows
  surveillance data breaks before it lies.
- **A change against the outside**: the ward diverges from the regional
  THL count or the national Finres percentage.

**How to show it.**

- Keep a list of signals with a plain-language reason, the evidence, and
  the date it was first visible. Replay the dataset and show the signal
  appearing on the day the data would have shown it.
- Be honest about alert volume: say how many signals the tool raised over
  three years and how a researcher would act on that many. The research
  shows tools either miss shifts or drown users (research/researcher-needs.md).
- If the synthetic dataset contains planted anomalies, find them and show
  them. If it does not, plant one in the replay and say so.
- Connect the two audiences: when a signal concerns the doctor's ward, it
  appears on the doctor's screen as one line, not as a chart.

**What loses points.** A threshold line on a chart with no notification;
raising an alert on 4 isolates; signals that cannot be explained; no way
to see why a signal fired.

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
