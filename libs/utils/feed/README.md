# @aei/feed

The data feed the AEI web app reads, and its browser client. Any laboratory
system that serves this drives the app: code lists, the results released so
far, and new results as they are released. Nothing here names a unit,
organism, antibiotic, specimen or date.

    import type { Feed, FeedMeta, Result, FeedClock, FeedEvent, FeedCommand } from "@aei/feed";   // types only, no DOM
    import { httpFeed } from "@aei/feed/http";                                                  // browser client

- `@aei/feed` (`src/types.ts`) is types only, so the engine gears
  (`@aei/isolates`, `@aei/empiric`, `@aei/signals`, `@aei/question-filters`)
  use it without the DOM lib.
- `@aei/feed/http` (`src/http.ts`): `httpFeed(base = "")` is a `Feed` over
  `GET /api/meta`, `GET /api/clock`, `POST /api/clock`,
  `GET /api/isolates?from=&to=` and the server-sent events of `GET /api/live`
  (`clock`, `arrivals`, `reset`). Needs `fetch` and `EventSource`.

**Relation to `@aei/contract`.** `@aei/contract` is the AEI server's whole
API (D-006): every route, with the dataset's own field names (`datasetStart`,
`wards`, `records`) and server-only routes (relations, alerts, ask, explain,
coverage). `@aei/feed` is the smaller format the web app depends on: only
the results and their code lists, named generically, so a laboratory system
that is not the AEI server can serve it too. `http.ts` maps the development
server's field names to it, there and nowhere else. If the team makes the
contract the only format, `http.ts` becomes a thin adapter over
`createAeiClient` and these types can be re-exported from the contract.

Relies on: D-004, D-005, D-006. Tests: `src/http.test.ts`.
