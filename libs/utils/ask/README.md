# @aei/ask

The optional AI gear: map Finnish or English questions to validated filters,
and phrase alerts without giving the model ownership of their numbers.
No npm runtime dependencies; `@aei/domain` and `@aei/alerts` types. Requires Node >=22
and its built-in fetch. This implements **D-017 to D-019 (AI layer)** in
DECISIONS.md; the operator adds those decision entries.

## Interface

```ts
import { createLlm, llmConfigFromEnv, parseQuestion, explainAlert } from "@aei/ask";

const config = llmConfigFromEnv();
if (config) {
  const llm = createLlm(config);
  const parsed = await parseQuestion(llm, {
    text: "urine E. coli in older men, last 3 months",
    vocabulary: {
      wards: [{ code: "ICU", en: "Intensive care", fi: "Teho-osasto" }],
      specimens: [{ code: "urine", en: "urine", fi: "virtsa" }],
      organisms: ["Escherichia coli"],
    },
    asOf: "2025-06-15", // replay clock, never the wall clock
  });
  // parsed: { filters, ageGroup?, unmatched }
  // Relative three-month period: 2025-03-16 through 2025-06-15.

  const explanation = await explainAlert(llm, {
    lang: "en",
    kind: "carrier",
    summary: "New carrier alert",
    facts: { count: 4, ward: "ICU", date: "2025-06-15" },
    fallback: "{count} carriers in {ward} on {date}.",
  });
  // explanation: { text, source: "model" | "template" }
}
```

`createLlm({ baseUrl, model, apiKey?, fetch?, timeoutMs? })` exposes
`json<T>(messages, { name, schema })`. It calls the OpenAI-compatible
`/v1/chat/completions` endpoint on llama.cpp llama-server, with strict JSON
schema, temperature zero and thinking disabled. Timeout defaults to 20 seconds.
HTTP, timeout and JSON parsing failures throw exported `LlmError`.
`fetch` is injectable for testing. Configuration is read only when requested,
not when the module is imported.

### Filters and validation

`Vocabulary` supplies wards and specimens as `{ code, en, fi }[]` and organisms
as `string[]`. `AskFilters` contains optional `from`, `to`, `ward`, `specimen`,
`organism`, `sex` (`F` or `M`), `ageMin` and `ageMax`.

The model selects only vocabulary values; code drops invented values into
`unmatched`. Dates must be real YYYY-MM-DD dates. Ages must be integers in
0–120; inconsistent age bounds are dropped. Relative periods subtract calendar
days, weeks, months or years from `asOf`, then add a day for an inclusive
interval; month/year subtraction clamps to month end. Explicit dates override
relative bounds, and reversed date bounds are swapped. Output quality does not
throw; request/JSON failures propagate as `LlmError` from `parseQuestion`.

### Fixed age meanings

`AGE_GROUPS` exports these bounds; `AGE_GROUP_LABELS` exports the bilingual labels.
Only these meanings apply to vague age words. Code, not the model, maps the
selected group to filter bounds. Explicit numeric ages override group bounds.

| Key | English | Finnish | Ages (inclusive) |
| --- | --- | --- | --- |
| child | children | lapset | 0–17 |
| adult | adults | aikuiset | 18–64 |
| older | older / elderly | iäkäs / vanhus | 65+ |
| veryOld | very old | erittäin iäkkäät | 80+ |

`null` in a group's upper bound means no upper bound.

### Grounded explanations

**Every number comes from the statistics, never from the model.** The caller
passes computed `facts` and a code-owned `fallback` template. The prompt shows
fact names and values but requires every number, date or count to use a named
`{slot}`. Exported pure `checkSlots(text, factNames)` rejects unknown slots,
digits outside slots, and English/Finnish number words (`NUMBER_WORDS`),
case-insensitively, with Finnish stem-prefix checks for words of length at
least five. Exported pure `fillSlots(text, facts, lang)` substitutes strings
unchanged and formats numbers with `Intl.NumberFormat` (`fi-FI` or `en-GB`).
The model never performs this substitution. Failed checks, malformed output,
and request errors use the trusted fallback instead; `explainAlert` never
throws. Fallback templates and string fact values must be supplied by trusted
application code; the slot check is not a general clinical fact checker.

### Configuration

- `AEI_LLM_URL`: llama-server base URL. Unset/empty disables the optional layer
  (`llmConfigFromEnv` returns `undefined`).
- `AEI_LLM_MODEL`: served model name; passed through as configured (empty string
  if omitted, so deployments should set it).
- `AEI_LLM_KEY`: optional bearer token.

No network requests happen until a caller explicitly uses the client.

## Checks

```sh
pnpm vitest run libs/utils/ask
pnpm biome check libs/utils/ask
pnpm tsc -p libs/utils/ask
```

`alertExplainInput(alert, lang, names)` builds the trusted facts and bilingual
fallback for CPE and D-012 carrier alerts. Elapsed days are computed in code.
