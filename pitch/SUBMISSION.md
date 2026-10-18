# Submission: agar

## Punchline

agar: the right antibiotic for doctors, live outbreak alerts for infection control, and a notebook that does the statistics for researchers. All from one live lab feed.

## Description

Our project is created to solve Tyks Laboratories' and Mylab's specific challenge – antibiotic resistance reported too late and too coarsely. Today the hospital's resistance report is compiled once a year, as one number for the whole hospital. But a patient's first antibiotic is chosen before their culture grows, two to three days before the lab knows which bacterium it is. The doctor chooses it from that yearly report. On Monday, 12 May, a patient on Internal medicine A needs an antibiotic now. On the same ward, seven patients have grown ESBL bacteria that resist many common antibiotics, where 1.4 is usual. In a hospital-wide yearly average those seven patients disappear. Under the old method, the doctor prescribes from last year's table while a resistant clone moves from bed to bed.

**OUR SOLUTION:** agar is a real-time, working platform that turns the results a laboratory already sends into answers for everyone who acts on them. It reads lab results as they arrive (HL7 v2.5.1, FHIR or CSV), keeps every number current ward by ward, and raises what is unusual without anyone having to look for it. It is not a dashboard: every user builds their own workspace from windows they add and link.

**For doctors, in one click:**

**The Right First Antibiotic:** For the doctor's own ward, specimen (urine, blood, wound) and severity, agar ranks the antibiotics by how many patients they covered, against an 80 % bar for mild and 90 % for severe infection. "Start with mecillinam, covers 97 %", with the alternatives beside it.

**Last 4 Weeks Beside the Year:** Every antibiotic shows the last four weeks next to the whole year, exactly as the brief asks, with 4 weeks, 90 days, a year or any custom period one click away.

**When Nothing Is Enough:** When no single antibiotic clears the bar, as for a severe blood infection in the ICU, agar suggests the pair that does.

**Honest Small Numbers:** Counted on each patient's first isolate. Below 30 results agar says so and falls back to the ward type, then the hospital, instead of showing a noisy percentage.

**Type, Don't Click:** "urology e. coli" or "icu blood severe" opens the answer.

**For infection control, watching every ward live:**

**Signals Found For You:** Clusters of the same resistant bacterium, an ESBL or MRSA rise above a ward's usual, a resistant organism new to a unit, rising trends and sampling gaps. Each signal says how unlikely it is by chance ("1 in 35,148") and how it was calculated.

**One Live Picture:** A timeline of every ward with replay, a unit grid, patient flow showing which wards share patients, and a map of THL's national register for the whole of Finland.

**Data Checks:** 15 plausibility checks on every incoming batch, so a ward that stops sending samples shows as a data problem, not as resistance falling.

**But that's not all. agar is built to be a full research notebook:**

**No More Spreadsheets:** The question, the slice of data, each analysis and its chart live in one notebook, next to the live timeline and signals.

**Statistics, Done For You:** Pick a slice of the data, and agar gives the rate, a comparison of two periods, the share over time or a Bayesian estimate, each with its uncertainty, its formula and the Python or R code to reproduce it.

**Frozen Projects:** Keep a project live, or freeze it on a date so the numbers never change under a paper in progress.

**One-Click Export:** The filtered data, R and Python scripts, a Jupyter notebook, LaTeX methods and the chart, in one bundle, or reproduced straight in the browser.

**Built for the lab's own systems:** Results come in as HL7, the format the laboratory system already sends. Every visitor's projects stay in their own browser, and the public demo accepts no uploads, so no one sees anyone else's work.

**We measured it.** We planted 200 four-patient outbreaks per scenario into the three-year dataset. agar found 89 % of them (95 % CI 84–93 %), a median of 6 days after the first case, at about 4.5 alerts a year, and none of 8 methods from the surveillance literature beat it by the criteria we set before testing. All four test events in the data were caught; the ICU MRSA on day 0. Built and tested on the organisers' synthetic dataset; Finnish and English.

**Technologies:** TypeScript, React, Vite and Node.js (web app and live API), HL7 v2.5.1 ingest, Python (pandas, NumPy, SciPy, statsmodels) for analysis and our `aei` package, JupyterLite, R and LaTeX export, THL open data, llama.cpp for optional natural-language search, Docker with nginx. Built with Claude, Gemini and VS Code.

agar delivers ward-level antibiotic advice in seconds, on any browser. Live lab data, measured alerts, reproducible research. No yearly PDFs, no black boxes, no delays.

**Speed is a treatment. agar puts it on the ward.**

## The rest of the form

- **Project name:** agar
- **Challenge:** Antibiotic efficacy indicator (AEI), Tyks Laboratories × Mylab
- **Technologies used:** see the Technologies line above
- **Video:** `pitch/agar-video-final.mp4` (1:58), uploaded to YouTube as Public
- **Demo:** https://agar.aapolipponen.com
- **Source code:** https://github.com/Artevil131/turku-hackathon (public)
- **Credited:** yes
- **Pitch deck (PDF):** `pitch/agar pitch.pdf`
- **Phone numbers and Discord usernames:** the team's own
