# AI layer: quick start for Vaishnav

The AI model runs on Aapo's machine and is reachable at
`https://aei-llm.aapolipponen.com`. Only `apps/api` talks to it; the web
app talks to `apps/api` as usual, so the secret never reaches the browser.

## 1. Credentials

Aapo sends you a small file. Save it outside the repo, e.g. `~/aei-llm.env`:

    AEI_LLM_URL=https://aei-llm.aapolipponen.com
    AEI_LLM_MODEL=qwen3.5-4b
    AEI_LLM_ACCESS_ID=...
    AEI_LLM_ACCESS_SECRET=...

## 2. Run

    set -a; . ~/aei-llm.env; set +a
    pnpm dev

Without the file loaded, everything still runs; the AI parts are just off.

## 3. What the web gets (`@aei/contract`)

- `meta.ai`: `true` when the API has the model. Hide the AI UI otherwise.
- `client.ask({ text, lang })` turns a plain question ("urine E. coli in
  older men, last 3 months") into
  `{ filters, ageGroup?, unmatched }`. `filters` is an ordinary
  `IsolateQuery`: pass it to `client.isolates()` and show it as chips.
  `unmatched` lists words it couldn't use.
- `client.explain(alertId, lang)` returns `{ text, source }`: a short
  plain-language explanation of an alert, written by code (a template).
  `client.explain(alertId, lang, "model")` asks the AI to reword it. That's
  opt-in and experimental (D-029): its Finnish is unreliable. `source` says
  which one you got. A rejected AI text comes back as the template.
- `client.coverage({ ward, specimen, sex?, severity? })` is the doctor's
  list of what covers the likely organisms (D-023 to D-028): per-antibiotic
  shares with intervals, `suggestions`, and `combinationSuggestions` when
  no single drug is enough. Pure statistics, no AI.

The AI never produces numbers on screen. All counts come from the
existing code. All of these are on `ui/web-app`.

## If it doesn't answer

Ask Aapo. The model only runs while his job is up.
