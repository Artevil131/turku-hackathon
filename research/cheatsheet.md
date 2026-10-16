# Cheatsheet: the basics behind the AEI tool

Quick reference for the codes in the dataset and the epidemiology behind
empirical antibiotic treatment. Describes the field, decides nothing.
Sources: the dataset README, CLSI M39, WHO GLASS, EUCAST, THL Finres.

## The chain from patient to number

    patient → culture (a sample) → isolate (a bacterium found in it)
            → susceptibility result (S or R for one antibiotic)

| Term | Meaning |
|---|---|
| Culture | One sample from a patient (urine, blood, wound) grown in the lab. Result: positive, negative, or mixed growth. |
| Isolate | One bacterial species identified in a culture. A culture can have 0, 1 or 2. |
| Susceptibility testing (AST) | Testing an isolate against each antibiotic. |
| S | Susceptible: the antibiotic works against this isolate. |
| R | Resistant: it does not. |
| I | "Susceptible, increased exposure": works at a higher dose. Real labs report it; this dataset does not. |
| Breakpoint | The lab cutoff that turns a measurement into S or R. Set by EUCAST in Europe and revised yearly, so an R can become an S when the rules change, not the bacteria. |
| Intrinsic resistance | A species that is always resistant to a drug by nature. Never counted in statistics. EUCAST publishes the list. |
| Empirical treatment | Starting an antibiotic before the patient's own result is back, based on what usually works locally. |
| Antibiogram | The table of %S per organism and antibiotic that a hospital publishes, today once a year. |
| First isolate | The first isolate of a species from one specimen type of a patient in a period. Later ones are duplicates and are dropped, otherwise one chronic patient dominates the figure. |
| Hospital-acquired (HA) | Sample taken on day 3 of the stay or later (WHO GLASS: more than 2 calendar days after admission). Earlier, or outpatient, is community-acquired (CA). |
| AMR | Antimicrobial resistance. |

## Units

| Code | Unit | Note |
|---|---|---|
| ED | Emergency department | Outpatient, hospital. Shares the most patients with every other unit. |
| MED-A | Internal medicine A | Inpatient ward. |
| MED-B | Internal medicine B | Inpatient ward. |
| SURG | Surgery | Inpatient ward. |
| URO | Urology | Inpatient ward, urinary tract, many urine samples. |
| ICU | Intensive care unit | Few, very sick, heavily treated patients. Highest resistance, smallest numbers. |
| GER | Geriatrics | Inpatient ward, elderly. |
| PHC-N | Health centre North | Primary care, outside the hospital. |
| PHC-S | Health centre South | Primary care. Shares no patients with PHC-N. |

## Specimens

| Specimen | What it means clinically |
|---|---|
| Urine | Urinary tract infection, the most common infection treated empirically. Most isolates. |
| Blood | Bloodstream infection, serious. Few isolates, high stakes. National and European surveillance (Finres, EARS-Net) is mostly blood. |
| Wound | Skin and soft tissue, surgical sites. |

## Organisms (isolates in the dataset)

| Organism | Isolates | Gram | What it typically causes | Watch for |
|---|---|---|---|---|
| *Escherichia coli* | 11,534 | negative | Most urinary infections, many bloodstream infections from the gut or urine. | ESBL |
| *Staphylococcus aureus* | 3,017 | positive | Skin, wound and bloodstream infections. | MRSA |
| *Enterococcus faecalis* | 2,385 | positive | Urinary and bloodstream infections, especially in hospital. | VRE |
| *Klebsiella pneumoniae* | 2,384 | negative | Urinary, lung and bloodstream infections in hospital. | ESBL, CPE |
| *Proteus mirabilis* | 1,725 | negative | Urinary infections, catheters, elderly. | Intrinsically resistant to nitrofurantoin. |
| *Pseudomonas aeruginosa* | 1,653 | negative | Hospital infections in ICU, wounds, lungs. | Resistant to most oral drugs by nature. |
| *Citrobacter freundii* | 874 | negative | Hospital urinary and wound infections. | Intrinsic resistance to several beta-lactams. |
| *Klebsiella oxytoca* | 621 | negative | Like *K. pneumoniae*, milder. | ESBL |
| *Staphylococcus saprophyticus* | 378 | positive | Urinary infections in young women. | Usually easy to treat. |

Gram-negative and Gram-positive are the two big families. Most drugs work
on one family but not the other, which is why half the antibiogram is
blank.

## Resistance flags on an isolate

| Flag | Full name | What it means | Why it matters |
|---|---|---|---|
| ESBL | Extended-spectrum beta-lactamase producer | *E. coli* or *Klebsiella* that destroys most penicillins and cephalosporins. | Leaves carbapenems as the main option. Common and rising. |
| MRSA | Methicillin-resistant *Staphylococcus aureus* | *S. aureus* resistant to all beta-lactams. | Treated with vancomycin. Classic hospital outbreak organism. |
| VRE | Vancomycin-resistant enterococci | *Enterococcus* that resists vancomycin too. | Very few options left. Spreads in wards. |
| CPE | Carbapenemase-producing Enterobacterales | *E. coli*, *Klebsiella* and relatives that destroy carbapenems, the last-line drugs. | The most feared. One case is an alert. Notifiable to THL in Finland. |

## Antibiotics

| Code | Name | Class | Used for | Reported for |
|---|---|---|---|---|
| AMP | Ampicillin | Penicillin | Old, narrow. Many *E. coli* are resistant. | all |
| MEC | Mecillinam | Penicillin | Uncomplicated urinary infection, Nordic first choice. | urine |
| TZP | Piperacillin-tazobactam | Penicillin + inhibitor | Broad, IV, serious hospital infections. | all |
| FOX | Cefoxitin | Cephalosporin, used as a screen | Not a treatment here: a positive screen means MRSA. | all |
| CXM | Cefuroxime | Cephalosporin, 2nd generation | Common empirical choice for urinary and respiratory infection. | all |
| CRO | Ceftriaxone | Cephalosporin, 3rd generation | Broad, IV, sepsis and pneumonia. Resistance to it marks ESBL. | all |
| CAZ | Ceftazidime | Cephalosporin, 3rd generation | Covers *Pseudomonas*. | all |
| MEM | Meropenem | Carbapenem | Last line for Gram-negatives. Resistance marks CPE. | all |
| CIP | Ciprofloxacin | Fluoroquinolone | Oral, broad, urinary and others. Resistance rising, side effects. | all |
| TMP | Trimethoprim | Trimethoprim | Oral, urinary infection. | urine |
| NIT | Nitrofurantoin | Nitrofuran | Oral, bladder infection only. | urine |
| VAN | Vancomycin | Glycopeptide | Gram-positives: MRSA, enterococci. Resistance marks VRE. | all |
| CLI | Clindamycin | Lincosamide | Gram-positives, skin and soft tissue. | all |

"Reported for urine" means the lab only tests and reports that drug on
urine isolates, because it only reaches the bladder.

Rough family rule: penicillins, cephalosporins and carbapenems are the
beta-lactams, the workhorse family. ESBL defeats the first two, CPE
defeats all three. Vancomycin and clindamycin are for Gram-positives.
Ciprofloxacin and trimethoprim are oral drugs for Gram-negatives.

## How the numbers are counted (surveillance rules)

1. Take only first isolates: per patient, per species, per specimen
   type, per period.
2. Drop intrinsically resistant combinations.
3. %S = susceptible / (susceptible + resistant) for one organism and one
   drug.
4. Show a percentage only when it rests on at least 30 isolates.
   At n=30, an 80% figure really means somewhere between 61% and 92%.
5. Stratify by what changes the answer: specimen, unit, hospital versus
   community onset, sex.

## How a doctor uses it

- Guess the likely organisms from the syndrome: urine is mostly *E. coli*,
  wound is mostly *S. aureus*.
- For each drug, the chance it works is the sum over organisms of
  (how likely that organism) × (its %S to the drug).
- Rules of thumb: do not use a drug empirically when local resistance is
  above 20% for bladder infection or above 10% for serious infection.
  Aim for 90% coverage in sepsis.
- Prefer the narrowest drug that is good enough, to slow resistance.
- Patient factors that raise resistance: earlier ESBL/MRSA/VRE/CPE
  finding, hospital stay of 3+ days, recent antibiotics, male sex for
  urinary infection, old age, ICU.

## How the researcher uses it

| Signal | Meaning | Urgency |
|---|---|---|
| Sentinel case | First CPE or VRE ever, or in a unit. One case is enough. | Same day |
| Cluster | Several cases of the same organism and flag in one unit in a few weeks. | Days |
| Trend | %R to a drug rising over months. | Weeks, change guidance |
| Divergence | One unit much worse than the rest of the hospital. | Weeks |
| Data problem | Sampling drops, results missing, breakpoint version changes. | Check before any of the above |

Resistant bacteria move inside patients, so units and hospitals that
share many patients pass them to each other. The shared-patient matrix
in the explorer is the only movement signal in our data.

## Reference systems

- THL Finres: Finland's yearly national resistance report.
- ECDC EARS-Net: European network, yearly, invasive (blood) isolates.
- WHO GLASS: global surveillance, defines the counting rules.
- CLSI M39: the US standard for building a cumulative antibiogram.
- EUCAST: European breakpoints, the S/R cutoffs the lab applies.
