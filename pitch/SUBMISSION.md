# Hackathon Submission Description & Pitch Narrative

> **Note:** This text is structured in the exact cadence and persuasive arc of your winning **L1NX** submission, updated for **agar**.

---

Our project is created to solve **Tyks Laboratories’** specific challenge – the blindness and dangerous slowness of once-a-year hospital resistance reporting. Current antimicrobial surveillance is too slow and too coarse. Hospitals compile resistance tables once a year, averaged across the entire institution, while an individual patient's culture takes 48 to 72 hours to grow. Because an infection worsens in hours and resistant clones spread across a ward in days, a year-old hospital-wide PDF is already obsolete at the bedside. If a five-drug-resistant ESBL *E. coli* strain appears in four patients on the Urology ward inside three weeks, a hospital-wide annual report hides the spike in the average. Under the old method, your clinicians are still prescribing from last year’s spreadsheet while the resistant clone is already spreading from bed to bed.

**OUR SOLUTION:** **agar** is a real-time, working clinical and epidemiological platform built to fix this problem. By ingesting live laboratory results (HL7 v2.5.1) and running measured statistical detectors in milliseconds, **agar** makes ward-level empirical antibiotic selection and outbreak detection as fast and effortless as possible.

Our system combines these in one, easy-to-use platform:

**Ward-Specific Empirical Coverage:** Live antibiotic rankings tailored to the doctor’s exact unit, specimen site (Urine, Blood, Wound), and clinical severity—computed strictly on deduplicated first-isolate patient episodes (CLSI M39).

**Three-Zone Clinical Readiness:** Automatically divides antibiotics into three actionable tiers based on clinical severity thresholds (**80% for mild**, **90% for severe/sepsis**):
- **START WITH (Green ✓):** Clears the efficacy threshold with Narrow / WHO Access antibiotics ranked first to preserve broad-spectrum reserves.
- **ALSO GOOD ENOUGH (✓):** Proven alternatives when the first-line agent is contraindicated.
- **NOT A FIRST CHOICE (✕):** Below the safety threshold on this ward—flagged with exact Wilson 95% confidence intervals.

**28-Day Ward Pulse Beside 365-Day Baseline:** Every antibiotic row pairs the stable 365-day ward coverage with the unit’s raw **last 28 days (`k / n` and `%`)**, exposing sudden local shifts right next to the annual baseline.

**Compound Instant Search:** Type natural clinical shorthand—`"urology e. coli"`, `"icu blood severe meropenem"`, or `"med-a esbl"`—and jump straight to a pre-filtered bedside answer or ward signal in seconds.

**Measured Clone & Cluster Detection:** Built-in Poisson profile-excess and phenotype detectors benchmarked against **200 planted synthetic outbreaks**—catching 4-patient resistant clone clusters **89% of the time** with a **6-day median delay** and ~1 cluster alert per year.

**Cross-Ward Patient Transfer Graph:** Maps shared resistant isolates and patient movements across all 9 hospital and primary-care units (`ER`, `ICU`, `MED-A`, `MED-B`, `SURG`, `URO`, `GER`, `HC-N`, `HC-S`) to trace transmission corridors.

**Regional, National & European Surveillance Radar:** Connects local hospital wards to live **THL national register signals** across Finnish counties (with Benjamini-Hochberg false-discovery control across 8,250 county-months) and **ECDC European baselines**.

**Automated Lab Data-Hygiene Monitor:** Runs **15 continuous quality checks** on every incoming batch—catching 3-day ward sampling dropouts in **93% of trials**, duplicate isolates, and EUCAST intrinsic-resistance anomalies before bad data can corrupt clinical advice.

**But that’s not all. agar is built to be an all-in-one reproducible research workbench:**

**A Modular Research Canvas:** A multi-window workspace where epidemiologists combine interactive timelines, ward maps, transfer graphs, and plain-language mathematical explanations in one view.

**Continuous & Frozen Research Projects:** Pin any ward, phenotype, or time window into a persistent project—keep it **Continuous** for live ward surveillance, or **Freeze** a snapshot so numbers never shift under a paper in progress.

**Interactive Notebook Sandbox:** Pin any signal, cohort slice, detector test, or comparison chart directly into a structured analytical notebook alongside clinical hypotheses.

**1-Click Reproducible Science Bundle Export:** Download any finding as a self-contained, peer-review-ready bundle containing the exact filtered `CSV`, zero-dependency base-R script (`analysis.R`), Python pipeline (`analysis.py` + `.ipynb`), and publication-ready LaTeX methods (`method.tex`).

**agar** delivers ward-level antibiotic intelligence in seconds, on any browser or iPhone, for maximum clinical access. Live HL7 stream, measured outbreak detection, shared epidemiological picture. No year-old PDFs, no black-box guesses, no delays.

**Speed is a treatment. agar puts it at the bedside.**
