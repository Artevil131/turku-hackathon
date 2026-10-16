---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent:
---

# 0003 Which small model should power the plain-language layer, in Finnish and English?

## Goal

Choose the model behind `@aei/ask` (D-017): Qwen3.5-4B (Q8_0, 4.5 GB) or
gemma-4-E4B-it (Google's QAT q4_0, 5.2 GB). Both fit myy's 8 GB RTX 3070 Ti
next to the desktop. The doctors type in Finnish as often as in English, so
the choice depends on how well each model turns a question in either
language into the right filters, and on how often its alert explanations
pass the number check (D-019) instead of falling back to the template.

## Hypothesis

1. Both models get at least 17 of the 20 English questions fully right
   (every filter field equal to the label).
2. gemma-4-E4B gets at least as many Finnish questions fully right as
   Qwen3.5-4B. The Gemma line is trained for broad multilingual use; this
   is the prediction being tested, not an established fact.
3. At least 80 % of each model's explanations pass `checkSlots` in both
   languages.

## Experiment

- **Questions:** `questions.json`, 20 English questions with a Finnish
  translation of each (40 in all), written before any model was run and
  labelled with the expected `AskFilters`. Everything is resolved against
  the replay date 2025-06-15. They cover each ward, specimen and organism,
  vague age words (the table in D-019), explicit ages, relative periods in
  days, weeks, months and years, explicit dates (Finnish `1.1.–31.3.2025`
  style included), number words ("two weeks", "puolen vuoden"), words the
  filters cannot express (ESBL, "young"; they must not become filters),
  and a follow-up fragment ("what about Health centre South").
- **Pipeline under test:** `parseQuestion` from `@aei/ask` end to end
  (prompt, JSON schema, code-side validation), against llama.cpp b11700
  `llama-server` on myy (`deploy/myy-llm/serve.sh qwen|gemma`), temperature 0,
  thinking off.
- **Metric:** a question counts as fully right when the parsed `filters`
  equal the label exactly (all fields; `unmatched` is not scored). Reported
  per language, plus per-field errors. Latency per question is recorded
  (median and maximum), measured on myy, which is not a timing node, so
  latencies compare the two models on the same node only.
- **Explanations:** the 20 newest alerts up to 2025-06-15 (D-014,
  `@aei/alerts`), each explained in English and Finnish (40 per model).
  Metric: share that pass `checkSlots`. The texts are saved so a person
  can read them for clinical sense. This experiment makes no claim on
  that.
- **Runs:** one run per model. Temperature 0 makes the output
  deterministic up to GPU arithmetic, so there is no seed spread to report.
  With 20 questions per language, a difference of one or two questions is
  noise and is not claimed.
- **Decision rule (agreed before the run):** take the model with more
  questions fully right over all 40. If they are within 2, take the one
  with more Finnish questions right; if those are also within 2, take the
  one with the higher explanation pass rate, then the faster one.
- **Command:** with a model serving and the env from
  `deploy/myy-llm/README.md`: `node experiments/0003-small-llm-bakeoff/run.ts <label>`,
  which writes `out/<label>.json`.

## Result

All numbers computed, one run per model per round, temperature 0, replay
date 2025-06-15, llama.cpp b11700 on myy. Outputs are in `out/run*-*.json`
(local, not in git).

| Round 4 (final pipeline) | Qwen3.5-4B Q8_0 | gemma-4-E4B QAT q4_0 |
|---|---|---|
| Test questions fully right (of 40) | **35** (en 19, fi 16) | 28 (en 13, fi 15) |
| Held-out questions fully right (of 20) | **19** (en 10, fi 9) | 11 (en 6, fi 5) |
| Main error | sex 2, age 5 | dates 36 (leaves `period` empty) |
| Explanations passing the check (of 40) | 22 (en 10, fi 12) | 21 (en 7, fi 14) |
| Median latency, question / explanation | 1.2 s / 0.8 s | 0.9 s / 0.7 s |

By the rule fixed in the plan (most questions fully right over the 40;
35 against 28, more than 2 apart), **Qwen3.5-4B** is chosen.

Hypotheses: 1 refuted for Gemma (13 of 20 English, below 17) and held for
Qwen (19). 2 refuted (Gemma 15 against Qwen 16 in Finnish,
though a gap of 1 is within the noise). 3 refuted for both (about 55 % pass, not 80 %).

**Deviations from plan.**
- Round 1 (Qwen: 15 of 40, explanations 0 of 40) exposed two pipeline
  bugs, not model limits. Explanations were sent with no user turn, which
  Qwen's chat template rejects, so every one fell back to the template.
  The question prompt did not say how to map sex or Finnish inflected
  unit names, and it let the model read "older" into Geriatrics. Both
  were fixed in `@aei/ask`. Because the prompt was revised after seeing
  errors on these 40 questions, the test-set scores from round 2 on are
  optimistic. A held-out set (`holdout.json`, 10 pairs, sha256
  16bcff1c…, written before the revised prompt ran) was added and never
  used for tuning. It is the honest score.
- Round 3: the model copied fact values instead of writing `{slots}`.
  Values containing digits are now hidden from the model (it sees only
  `{name}`), and verbatim copies are re-slotted before the check.
- Round 3 also showed a correct number used wrongly ("exceeding the
  expected 1.5 by a factor of < 0.001": the p-value read as a ratio). The
  p-value is no longer given to the model.
- The alerts explained are the newest 20 from `buildAlerts`. Carrier
  arrivals stopped being alerts during the run (D-022).
- The serve job was OOM-killed once by llama-server's default 8 GiB host
  prompt cache. It is now capped at 256 MiB, with a 5 GB request.

## Interpretation

For turning questions into filters, Qwen3.5-4B is good enough: 19 of 20
held-out questions fully right in both languages, about 1 s each. Its
misses are on sex and explicit ages, and the chips show both, so the
doctor can correct them.

For explanations, neither model is good enough to show doctors as the
default. Half of the texts fail the number check. Of those that pass,
many Finnish ones have invented or wrong words ("Päivämökki Geriatria",
"kulttuureja" for viljelyjä, "infektiohallintalähetys") or misread a
date as a period ("viimeisen 2025-05-18 aikana"). The check guarantees
where each number comes from, not what the sentence claims about it. The
code-written templates were correct every time. The strongest
alternative explanation is the prompt, not the models; a 4B model is
also near the bottom of what can write clinical Finnish. Next: decide
whether explanations default to the template (model text opt-in, or
English only), or try a larger model on chili for explanations only.
