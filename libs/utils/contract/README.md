# @aei/contract

The contract between the AEI server and its clients (D-006): routes, request
and response types, live event types, and a typed client.

| Route | Method | Returns |
|---|---|---|
| `/api/meta` | GET | `Meta`: dataset range and code lists |
| `/api/clock` | GET | `ClockState` |
| `/api/clock` | POST `ClockCommand` | `ClockState` (play, pause, step, seek, configure) |
| `/api/isolates?from&to&ward&specimen&organism` | GET | `IsolatesResponse`: arrived isolates only |
| `/api/live` | SSE | `LiveEvent`: `clock`, `arrivals`, `reset` |

`createAeiClient({ baseUrl })` wraps them, with `live(onEvent)` for the
stream. Any server, TypeScript today or Rust later, serves exactly this.

Relies on: D-005, D-006. Tests: `src/contract.test.ts`.
