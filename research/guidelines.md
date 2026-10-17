# What a Finnish ward doctor is given today, and where our screen can add to it

Background notes with sources (2026-10-17, Claude Code operated by Aapo).
Decides nothing; the open choices are QUESTIONS.md section H. The guide PDFs
were read with `pdftotext`; page numbers refer to the PDFs.

## 1. The hospital's own empirical-treatment guide

Every wellbeing services county publishes one. For Tyks it is Varha's
**Mikrobilääkesuositus**, 69 pages, dated 13.4.2026, public at
<https://hoito-ohjeet.fi/fi/Ohjepankki/YHTEINEN/Mikrobil%C3%A4%C3%A4kesuositus.pdf>
(Varha's guideline bank). Comparable guides: HUS *Mikrobilääkehoito-opas*
(27.2.2026, <https://www.hus.fi/sites/default/files/2026-02/mikrobilaakehoito-opas.pdf>),
Pirkanmaa *Antibioottiopas* (17.2.2025, <https://www.pirha.fi/documents/d/guest/antibioottiopas>),
OYS *Antibioottiopas* (<https://oys.fi/wp-content/uploads/2025/11/Antibioottiopas.pdf>).

What the Varha guide gives the doctor:

- **A checklist before starting** (section 1.1, p. 7): focus, likely
  organism, hospital-acquired or community, then three resistance
  questions: resistant findings in the patient's risk data or cultures
  **within the previous year** relevant to the focus (ESBL, CPE, VRE for
  urinary and gut sepsis; MRSA for skin and severe pneumonia); antibiotics
  **within 3 months**; foreign hospital care within 12 months or travel in
  Asia or Africa within 6 months.
- **A local susceptibility table** (section 2, p. 8): share of strains
  susceptible (S %) at Tyks Clinical Microbiology **in 2021**, per organism
  and drug class, with each organism's share of positive blood cultures.
  Read from the PDF (layout garbled, verify against the page):

  | Organism (share of blood-culture positives) | S % |
  |---|---|
  | *E. coli* (25 %) | cefuroxime 91, fluoroquinolone 90, pip-tazo 99, meropenem 100 |
  | *S. aureus* (13 %) | cloxacillin 95, vancomycin 100, cefuroxime 98 |
  | β-haemolytic streptococci (8 %) | penicillin 100, cloxacillin 100, cefuroxime 100 |
  | Pneumococcus (4 %) | penicillin 100 (non-CNS), cefuroxime 95, levofloxacin 100, meropenem 100 |
  | *K. pneumoniae* (4 %) | cefuroxime 91, fluoroquinolone 98, pip-tazo 93, meropenem 100 |
  | *E. faecalis* (3 %) | ampicillin 99, vancomycin 100, pip-tazo 100 (imipenem 99, meropenem none) |
  | *P. aeruginosa* (2 %) | ciprofloxacin 97, pip-tazo 95, meropenem 98 |

  The guide says this table is for choosing empirical treatment of a
  severe infection needing hospital care, and when the organism is known
  but the susceptibility result is not yet.
- **Syndrome → drug, dose, route, duration** (sections 6 and 7). Urinary
  (7.4.1, p. 36–37): cystitis in women: trimethoprim 160 mg × 2, or
  nitrofurantoin 75 mg × 2, or pivmecillinam 200 mg × 3 / 400 mg × 2, 3
  days; ESBL cystitis by susceptibility, e.g. nitrofurantoin, fosfomycin
  3 g once, or pivmecillinam 400 mg × 3. Pyelonephritis: cefuroxime 1.5 g
  × 3 iv or ciprofloxacin 500 mg × 2 po; **ESBL carrier: ertapenem 1 g × 1
  iv**. Men, afebrile: trimethoprim or sulfa-trimethoprim 7 days;
  nitrofurantoin or fosfomycin if the prostate is not tender. Men, febrile:
  fluoroquinolone or iv cefuroxime, 10–14 days. Sepsis of unknown focus,
  community onset (6.2.1, p. 19–20): **cefuroxime 1.5 g × 4 iv**; ESBL
  carrier: ertapenem or meropenem; MRSA carrier: add vancomycin; recent
  travel in the tropics: meropenem + doxycycline. Healthcare-associated
  sepsis (hospital stay or antibiotics over 7 days): pip-tazo 4 g × 4 or
  meropenem. Urinary-source sepsis (6.3.1): cefuroxime 1.5 g × 3 iv.
  Wound infections (7.1.4, p. 29–30): mild: flucloxacillin or cefalexin
  po, clindamycin if β-lactam allergy, MRSA carrier by susceptibility;
  moderate: cloxacillin or cefuroxime iv; severe: pip-tazo or meropenem;
  "check recent culture findings" repeated at every tier.
- **Carrier rules everywhere.** The guide changes the empirical choice for a
  known ESBL, MRSA, CPE or VRE carrier in each syndrome, and tells the
  doctor to consult infectious diseases for CPE and VRE.

What it does **not** give: anything by unit or ward type; anything more
recent than 2021 in the table (the guide is dated 2026); counts or
intervals behind the percentages; urine or wound figures (the table is
blood-culture organisms); any comparison with the rest of Finland; any
signal that something is changing right now.

HUS's guide points to "HUSLABin ohjekirja: Helsingin ja Uudenmaan alueen
herkkyystilastoja" (p. 8) for regional statistics and repeats "huomioi
aiemmat virtsalöydökset, erityisesti ESBL-kantajuus" at cystitis and
pyelonephritis (p. 16–17). The Pirkanmaa guide names the ESBL risk
groups: prior cephalosporin or fluoroquinolone use, travel, foreign
hospital care (p. 11).

## 2. National guidance

**Käypä hoito, Virtsatieinfektiot** (Duodecim, update of 18.6.2019,
<https://www.kaypahoito.fi/5-keskeista-paivitysta-virtsatieinfektiot-kaypa-hoito-suositukseen>):
uncomplicated cystitis in women: nitrofurantoin, pivmecillinam,
trimethoprim or fosfomycin, 3 days; men without fever: trimethoprim or
sulfa-trimethoprim; pyelonephritis: a fluoroquinolone stays first line
(5–7 days women, 10–14 men) despite the EMA restrictions; fluoroquinolones
otherwise reserved for more serious infections. The recommendation says
local resistance affects the choice but quotes no threshold. The
Terveyskirjasto summary quotes *E. coli* resistance of about 16 % to
trimethoprim, 3 % to pivmecillinam and 0.5 % to nitrofurantoin
(<https://www.terveyskirjasto.fi/dlk00615>).

The hospital guides are consistent with Käypä hoito on urinary infection;
they add the hospital's iv choices, the carrier rules and the doses.

## 3. Finres: the national susceptibility figures

THL with the FiRe laboratory network (24 labs, about 95 % of Finnish
susceptibility tests) publishes a public cube, CC BY 4.0, yearly 2008–2025,
updated 8.10.2026:
<https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite>. National only;
genus, not species; five specimen types (blood, pus and other, faeces,
throat, urine); 42 antibiotics plus the ESBL, MRSA and VRE flags; measures:
strains, tests, S, I, R, %R with a 95 % interval.

**JSON-stat API, verified 2026-10-17.** The cube answers the same URL
pattern as the TTR cube `aei.thl` already uses, but members are addressed
by dimension id with a trailing dot, and several members are joined with
dots; the `L` level suffix returns 403 here. Dimension ids
(`fact_lite.dimensions.json`): time 9–26 = 2008–2025; organism 56
Escherichia, 58 Klebsiella, 64 Staphylococcus, 55 Enterococcus, 61
Pseudomonas, 54 Enterobacter, 65 Streptococcus; antibiotic 149 AMP, 169
MEC, 180 TZP, 165 CXM, 164 CRO, 162 CAZ, 168 MEM, 182 CIP, 187 TMP, 174 NIT,
189 VAN, 166 CLI, 153 ESBL, 170 MRSA, 188 VRE; spec_type 195 urine, 190
blood, 191 pus and other; measure 196 strains, 197 tests, 200 R, 201 %R,
202 and 203 the interval. Example:

    https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite.json?row=organism-56.58.&column=antibiotic-182.187.&filter=spec_type-195&filter=time-26.&filter=measure-201

The 2023–2025 cells for our organisms and antibiotics (414 cells) were
pulled once by hand into `data/external/thl/finres_cells_2023_2025.csv`
(git-ignored, like the TTR data of D-025); a fetch script would replace
that file.

**Finland 2025 against the synthetic hospital's 2025 (all isolates, quick
count, not first isolates).** The dataset tracks Finres closely, so a
national column on the screen will read as "like the country" most of the
time and stand out when it does not:

| Specimen, organism, drug | Finres 2025 %R (tests) | Synthetic hospital 2025 %R (tests) |
|---|---|---|
| urine *E. coli* ciprofloxacin | 7.4 (89 634) | 8.2 (3 543) |
| urine *E. coli* trimethoprim | 18.7 (77 978) | 19.2 |
| urine *E. coli* nitrofurantoin | 0.5 (72 717) | 0.5 |
| urine *E. coli* mecillinam | 2.8 (78 254) | 2.6 |
| urine *E. coli* cefuroxime | 6.6 (89 939) | 8.9 |
| urine *E. coli* ESBL | 3.5 (89 944) | – |
| urine *K. pneumoniae* nitrofurantoin | not tested nationally | 35.2 (660) |
| urine Enterococcus nitrofurantoin | 8.5 (10 385) | 0.3 (*E. faecalis*, 585) |
| blood *E. coli* ciprofloxacin | 9.7 (3 064) | 12.2 (115) |
| blood *E. coli* cefuroxime | 10.2 (4 387) | 14.8 |
| blood *E. coli* pip-tazo | 3.7 (3 695) | 7.0 |
| blood *S. aureus* MRSA | 3.6 (2 339) | 3.4 (cefoxitin screen, 89) |
| blood Enterococcus VRE | 0.3 (727) | 0 (39) |

Cells Finres leaves empty for our drugs: ampicillin and trimethoprim on
blood *E. coli* and *Klebsiella* (tested, %R not published), ceftriaxone,
ceftazidime and pip-tazo on urine Enterobacterales, mecillinam on blood.
Finres reports genus, so Enterococcus mixes *E. faecalis* and *E. faecium*
(hence 8.5 % nitrofurantoin resistance nationally against 0.3 % for *E.
faecalis* here); the screen must say "genus, Finland" when it shows it.

## 4. The gaps, in order of value to the doctor

1. **The carrier rule is in every guide and nowhere on our screen.** The
   dataset has each isolate's ESBL, MRSA, VRE and CPE flags, the patient
   id and the sample date; `@aei/alerts` already keeps carrier trails per
   patient (D-022). The guide's own rule is "resistant finding within the
   previous year for this focus". QUESTIONS B6 (annotate and move down,
   do not change the number) is still open.
2. **Hospital-acquired onset.** The guide splits community and
   healthcare-associated sepsis and gives different drugs; the record
   strip shows an onset toggle that is disabled because the API has no
   onset filter (QUESTIONS A2, B5). `admission_date` is present on about
   40 % of isolates (inpatients), so onset is computable for them.
3. **The guide beside the data.** Doctors reconcile two sources in their
   heads: the guide's first choice and our list. Showing the guide's
   choice for the syndrome as a row marker ("guide's first choice") and its
   standing against the bar closes that loop. The table is small (about
   ten syndromes, two or three drugs each, from the Varha PDF) and is
   configuration per site, not analysis.
4. **A national reference.** One Finres column per row ("Finland 2025:
   7 % resistant, genus, 89 634 tests") says whether the unit's figure is
   a local matter or the country's. Free with the fetch above.
5. **Syndrome words.** The guide is organised by syndrome (cystitis,
   pyelonephritis, urosepsis, sepsis of unknown focus, wound); our strip
   says urine, blood, wound and mild or severe. A syndrome chooser that
   sets specimen, severity, sex default and the guide's row is pure UI
   once the mapping is written down.
6. **Freshness.** The guide's table is from 2021. Our figures carry their
   window and date; saying so beside the guide's year is the tool's
   strongest argument.

Out of the dataset's reach, but in every guide: dose, route, renal
adjustment, allergy alternative, interactions. A guideline table carries
route and the allergy alternative for free; dose and renal adjustment stay
in the guide, linked.
