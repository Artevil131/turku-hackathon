# @aei/contract

The contract between the AEI server and its clients (D-006): routes, request
and response types, live event types, and a typed client.

| Route | Method | Returns |
|---|---|---|
| `/api/meta` | GET | `Meta`: dataset range, code lists and `ai` (LLM configured) |
| `/api/clock` | GET | `ClockState` |
| `/api/clock` | POST `ClockCommand` | `ClockState` (play, pause, step, seek, configure) |
| `/api/isolates?from&to&ward&specimen&organism&sex&ageMin&ageMax` | GET | `IsolatesResponse`: arrived isolates only |
| `/api/relations?days` | GET | `RelationsResponse`: patient flows and carrier links for the `days` up to the clock (D-011 to D-013) |
| `/api/alerts?from` | GET | `AlertsResponse`: CPE and carrier alerts up to the clock (D-014) |
| `/api/ingest` | POST HL7 v2 / FHIR Bundle / CSV | lab results from a laboratory system, parsed by `@aei/ingest` (D-035); returns what was accepted, new alert ids and warnings |
| `/api/regional?group&region` | GET | `RegionalResponse`: THL county series of MRSA, ESBL, VRE and CPE and their regional signals, months before the clock only (D-025, D-037); 404 until `scripts/fetch_thl_ttr.py` has run |
| `/api/live` | SSE | `LiveEvent`: `clock`, `arrivals`, `alerts`, `reset` |

`createAeiClient({ baseUrl })` wraps them, with `live(onEvent)` for the
stream. Any server, TypeScript today or Rust later, serves exactly this.

Relies on: D-005, D-006, D-011 to D-014, D-037. Tests: `src/contract.test.ts`.

## Optional assistant

- `POST /api/ask` with `{text: string, lang: "en" | "fi"}` returns
  `AskResponse {asOf, filters: IsolateQuery, ageGroup?, unmatched: string[]}`.
  `asOf` is the replay date used to resolve relative periods. No LLM: 503;
  upstream/model request failure: 502. No model-generated counts are returned.
- `GET /api/explain?id=<alert id>&lang=en|fi` returns
  `ExplainResponse {id, text, source: "model" | "template"}`. Only released
  alerts are available (unknown/unreleased ids: 404). Works without an LLM
  using a trusted bilingual template. Responses are cached by id and language.
- `client.ask(text, lang)` and `client.explain(id, lang)` wrap these routes.
  HTTP failures throw `ApiError`, whose `status` supports recoverable UI states.

Isolate sex filters use `F` or `M`; age bounds are inclusive years, including 0.
Omitted bounds do not filter. Isolates never extend past the replay clock.
