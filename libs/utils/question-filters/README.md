# @aei/question-filters

A plain-language question becomes filters the user can see and change: the
pure part, with no network. The model only picks from the feed's code lists
and names a relative period; every value it returns is checked against the
code lists again, and the period is resolved against the feed's as-of date.
The model never supplies a figure or a date.

    chatRequest(text, lang, meta, model, format)   // OpenAI-compatible request body: prompt and JSON schema from FeedMeta
    parseReply(content)                            // the model's JSON
    validateAnswer(raw, meta, asOf, question?)     // AiAnswer: only codes that exist, only what the question said
    resolvePeriod(period, asOf, earliest?)         // "last N months" -> dates
    toAskAnswer(answer), isEmptyAnswer, inAgeGroup, AGE_GROUPS, MAX_PERIOD, MAX_QUESTION_CHARS

The caller sends the request (the web app through its dev-server proxy,
`/llm`) and passes the reply back. Given the question, `validateAnswer`
drops a specimen, sex, age, onset or period the question gives no trace of,
so the model cannot add a filter on its own.

**Relation to `@aei/ask`.** Both implement D-019. `@aei/ask` is the server
side: it calls the model itself (Node `fetch`, `llmConfigFromEnv`), takes
the dataset's vocabulary (`@aei/domain`) and serves `/api/ask` and
`/api/explain`. This gear is the browser side over the feed's `FeedMeta`,
with no network and no credentials, so the app's Ask works against any feed
through a proxy. If the team routes Ask only through `/api/ask`, this gear
can be retired.

Relies on: D-004, D-017, D-019, D-029. Tests: `src/questions.test.ts`.
