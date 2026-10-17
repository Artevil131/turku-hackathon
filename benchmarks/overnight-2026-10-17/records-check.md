# Records check, overnight 2026-10-17

Scope: closed records 0012, 0013, 0014, 0015, 0016, 0018, 0019, 0020. All eight have `status: accepted`, so none was skipped as `proposed`. Rules: `experiments/TEMPLATE.md` and `benchmarks/overnight-2026-10-17/agent-rules.md` ("The record"). Read-only apart from this file: no existing file was edited, no git operation was run.

Check 7 method: the scope is each record's `## Result` section, up to the next `## ` heading. A prose sentence is flagged when it contains a decimal number (digits.digits) or a percentage (a digit then `%`, or the word "percent") and none of measured, computed, derived, assumed (whole word, any case). A table row is flagged when it carries such a number and neither the row nor the paragraph directly above the table contains one of those words. Sentences are split at full stops, so a flag can sit on a sentence whose tag word is in the neighbouring sentence; the fix there is usually one word. Integers such as 2026 or 1,000 are not counted. Scanner: `/private/tmp/claude-501/-Users-artevil-turku-hackathon/8b806ccc-e503-43fe-9447-c056dd9ca5e4/scratchpad/untagged.py`.

## Summary

| Record | 1 Frontmatter | 2 Headings | 3 "exploratory" | 4 Reproduce command | 5 metrics.json | 6 Figures under 1 MB | 7 Untagged numbers |
|---|---|---|---|---|---|---|---|
| 0012 discounted-beta-binomial | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 11 sentences |
| 0013 dirichlet-organism-mix | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 32 sentences, 23 table rows |
| 0014 pooling-levels | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 14 sentences, 14 table rows |
| 0015 gamma-poisson-guard-band | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 13 sentences |
| 0016 cusum | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 18 sentences, 8 table rows |
| 0018 bocpd | PASS | PASS | PASS | PASS | PASS | PASS | FAIL: 21 sentences |
| 0019 exposure-ranking | PASS | PASS | PASS | PASS, see note | PASS | PASS | FAIL: 15 sentences, 12 table rows |
| 0020 county-forecasts | PASS | PASS | PASS | PASS, see note | PASS | PASS | FAIL: 15 sentences, 13 table rows |

Checks 1, 2, 3, 5 and 6 pass for all eight records. Check 7 fails for all eight.

## 0012 discounted-beta-binomial

File: `experiments/0012-discounted-beta-binomial/README.md`

- Checks 1 to 6: PASS.
- Check 7: FAIL, 11 untagged sentences, no table rows (all 47 table rows are tagged through their captions). First five:
  - L327: "The estimator is deterministic ... every interval below is its 95 % interval."
  - L342: "The hospital-365 estimate scores 0.1368 on the same targets." The previous sentence on the same line carries "(computed)".
  - L352: "The best cell is 0.1376; four settings lie within 0.0005 of it ..."
  - L353: "The plan's rule (larger δ first) gives δ 0.95, M 10, which is the reported row."
  - L382: "C4 mild all, mild spectrum counted and mild all counted also match the shipped row to within 0.1 point ..."

## 0013 dirichlet-organism-mix

File: `experiments/0013-dirichlet-organism-mix/README.md`

- Checks 1 to 6: PASS.
- Check 7: FAIL, 32 untagged sentences and 23 table rows. Table rows L406 to L425 sit under the caption at L401 to L402, which has no tag word. Table rows L496 to L499 sit under the caption at L486 to L492, which has no tag word. First five:
  - L392: "At M = 30 the TUNE Brier falls with M_π: 0.13718, 0.13708, ..."
  - L393: "The minimum (0.13692) lies on the M_π = 300 edge ..."
  - L395: "Eight settings (M_π ≥ 100, any M) are within 0.0001 of it ..."
  - L397: "The one-layer control's TUNE Brier is 0.13719, 0.13705, ..."
  - L401: caption "Metrics against both baseline rows (95 % bootstrap intervals ...)"

## 0014 pooling-levels

File: `experiments/0014-pooling-levels/README.md`

- Checks 1 to 6: PASS.
- Check 7: FAIL, 14 untagged sentences and 14 table rows. Table rows L236 to L250 sit under the caption at L230 to L232, which has no tag word. First five:
  - L217: "CPU time 59.8 s and 73.1 s in two runs ..."
  - L222: "Row chosen on TUNE only (10 windows, ...): P-H 0.13681 (chosen), ..."
  - L230: caption "Metrics (95 % bootstrap intervals ...)."
  - L236: table row "C1 all | 0.1414 (0.1398 to 0.1431) | ..."
  - L237: table row "C1 diff to hospital-365, all | 0 | +0.0003 ..."

## 0015 gamma-poisson-guard-band

File: `experiments/0015-gamma-poisson-guard-band/README.md`

- Checks 1 to 6: PASS. The `### Deviations from plan` subheading (L601) sits inside Result; the spec does not forbid it.
- Check 7: FAIL, 13 untagged sentences, no table rows (all 51 table rows are tagged through their captions). First five:
  - L406: "Seed 2026 only (seeds 2027 to 2030 are held out ...), 200 trials per injection cell ... rates with 95 % ..."
  - L435: "The plan's rule picks S 26 weeks, no guard band, window 1 week, at q < 0.005."
  - L436: "QUESTIONS C3's proposal (26, 4, 4) is third: 8/40 and 11/40 at q < 0.01."
  - L500: "For comparison the live set re-tuned reaches 92.0 % and 75.0 % ..."
  - L506: "The budget (B = 3 series per ISO week) does nothing at the chosen level ..."

## 0016 cusum

File: `experiments/0016-cusum/README.md`

- Checks 1 to 6: PASS. The "Held-out re-score" section after Interpretation (L437) is allowed by the spec.
- Check 7: FAIL, 18 untagged sentences and 8 table rows. Table rows L296 to L298 sit under the caption at L292, which has no tag word. Table rows L308 to L312 sit under the caption at L304, which has no tag word. First five:
  - L265: "The C5 proposal theta = 2.5 ranked 6th, 10th, 11th and 12th of 12 ..."
  - L267: "At every resolution and guard band theta = 8 beats theta = 2.5 ..."
  - L275: "For the common limit h_S = 7.25, h_sim = 7.11."
  - L284: "Siegmund's approximation is within 20 % of the simulation ..."
  - L286: "Real year-1 episodes are 1.1 to 2.2 times the simulated ..."

## 0018 bocpd

File: `experiments/0018-bocpd/README.md`

- Checks 1 to 6: PASS.
- Check 7: FAIL, 21 untagged sentences, no table rows (all 21 table rows are tagged through their captions). First five:
  - L343: "Pruning run lengths below 1e-4 posterior: no signal differs at the chosen setting ..."
  - L352: "The plan's rule chooses H = 1/26, w = 2, level p < 0.5 ..." The previous sentence on the same line carries "derived".
  - L369: "The plan's grid ends at p < 0.5, so the headline sits at its loosest point."
  - L370: "There the combined row has 3 cluster episodes (1.5 a year) but 13 episodes in all (6.5 a year) ..."
  - L373: "The last column reads the same curve on every episode: the combined row at 2.0 a year detects 10 % ..."

## 0019 exposure-ranking

File: `experiments/0019-exposure-ranking/README.md`

- Check 4: PASS, with a note. The command wraps across L302 and L303 inside one code span (`uv run python` / `experiments/0019-exposure-ranking/run.py`). It renders as one command, but a literal search for the full command string finds no match. Suggest joining the two lines.
- Checks 1, 2, 3, 5 and 6: PASS.
- Check 7: FAIL, 15 untagged sentences and 12 table rows. Table rows L335 to L340 sit under the caption at L330 to L333, which has no tag word; L335 is the header row, flagged for "95 %". Table rows L371 to L377 sit under the caption at L366 to L367, which has no tag word. First five (document order):
  - L335: table header "exposure, alpha | usable events | ... pooled AUC (95 % bootstrap) ..."
  - L337: table row "share, 0.05 | 7 of 24 | 11 | 67 | 0.627 ..."
  - L338: table row "raw, 0.05 | 7 of 24 | 11 | 67 | 0.657 ..."
  - L339: table row "share, 0.001 | 5 of 24 | 5 | 35 | 0.457 ..."
  - L340: table row "raw, 0.001 | 5 of 24 | 5 | 35 | 0.457 ..."

## 0020 county-forecasts

File: `experiments/0020-county-forecasts/README.md`

- Check 4: PASS, with a note. The command wraps across L464 and L465 (`uv run python` / `experiments/0020-county-forecasts/run.py`), as in 0019.
- Checks 1, 2, 3, 5 and 6: PASS. The `## Notes from review (overnight)` section (L682) is after Interpretation and is allowed; it is outside Result and was not scanned.
- Check 7: FAIL, 15 untagged sentences and 13 table rows. Table rows L501 to L507 sit under the caption at L493 to L497, which has no tag word. Table rows L516 to L521 sit under the caption at L509 to L512, which has no tag word. First five:
  - L479: "The best of the 198 cells scored −1.5642 nats per series-month ..."
  - L483: "On the same months persistence scored −1.9503 and seasonal naive −2.1345."
  - L484: "The table is flat: the top 12 cells span 0.020 nats."
  - L485: "Best cell by K: K = 0 −1.5642, K = 1 −1.5755, K = 2 −1.5914 ..."
  - L487: "R2, the per-phenotype cells: MRSA window 24, K = 0, pooled quasi, floor 0.5 ..."
