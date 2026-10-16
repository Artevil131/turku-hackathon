---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
