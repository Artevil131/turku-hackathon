# deploy

Everything about deployment lives here and nowhere else: infrastructure
definitions, container files, CI/CD pipelines, environment configuration
templates, App Store and web release steps. Secrets are never committed;
only templates naming the variables are.

- `integration.md`: how AEI connects to Tyks's lab system and patient
  record, with sources (D-035).
- `container/`: the API and the web app as containers, for a demo or a
  pilot (below).

## Containers

Two images, built from the repository root, and a compose file wiring them:

| Image | File | Holds |
|---|---|---|
| `aei-api` | `container/Containerfile.api` | Node 22 (`node:22.23.1-slim`) running `apps/api` and the `libs/utils` gears it uses, as TypeScript (no npm dependencies outside the workspace); runs as user `node`, port 8787, health check on `/api/meta` |
| `aei-web` | `container/Containerfile.web` | `apps/web` built with Vite, served by `nginx:1.30.6-alpine` on port 8080; `/api` (and the `/api/live` event stream, unbuffered) proxied to the API |

    podman compose -f deploy/container/compose.yaml up --build    # or: docker compose
    # open http://localhost:8080

Not in the images: the organisers' dataset (not ours to redistribute) and
the THL county file. Both are mounted read-only at run time:

| Mount | Host path (default) | Variable |
|---|---|---|
| `/data` | `data/synthetic_microbiology_dataset` | `AEI_DATASET` |
| `/regional` | `data/external/thl` (from `scripts/fetch_thl_ttr.py`; without it `/api/regional` answers 404) | `AEI_THL_DIR` |
| `/config` | `deploy/container/config` (a site's code map) | `AEI_CONFIG_DIR` |

The API runs as the image's user `node`, who must be able to read the
dataset. If its files are private to you (mode 600), either make them
readable (`chmod -R a+rX data/synthetic_microbiology_dataset`) or, under
rootless podman, set `AEI_API_USER=root`: root in a rootless container is
your own host user. Do not pass `--userns=keep-id` to podman-compose's
`--podman-run-args`; it applies to the web container too, and nginx then
cannot start. The mounts carry `z` so SELinux hosts (Fedora) relabel them.

Checked end to end on 2026-10-17 with rootless podman 5.8 and
podman-compose 1.6 (`AEI_API_USER=root AEI_LOAD_UNTIL=2025-06-01 podman
compose -f deploy/container/compose.yaml up -d --build`): every route
through the nginx proxy, the live stream unbuffered, three days of HL7
posted to `/api/ingest` raising the Urology alert on 4 June, and the
smoke tests (`SMOKE_URL=http://localhost:8080 pnpm smoke`) 13 of 13.

The compose file passes the server's variables through: `AEI_REPLAY_START`,
`AEI_LOAD_UNTIL` (load results up to a date, the rest can arrive through
`/api/ingest`), `AEI_TICK_MS`, `AEI_DAYS_PER_TICK`, `AEI_GUIDELINE`,
`AEI_CODE_MAP` (e.g. `/config/codes.json`) and the optional language model
(`AEI_LLM_URL`, `AEI_LLM_MODEL`, `AEI_LLM_KEY`, `AEI_LLM_ACCESS_ID`,
`AEI_LLM_ACCESS_SECRET`). Ports: `AEI_WEB_PORT` (8080) and `AEI_API_PORT`
(8787, published on 127.0.0.1 only, for `scripts/send_lab_results.py`).
`AEI_API_USER` (`node`) sets the API's user. The compose file carries the
API health check itself, since podman-compose builds OCI images, which
drop the image's `HEALTHCHECK`; for a plain `podman build`, add
`--format docker` to keep it.

This is demo and pilot packaging, not a hardened deployment: no
authentication, no TLS, no persistence (results posted to `/api/ingest`
live in memory until restart), one API process. The web image has no
`/llm` proxy, so the web app's own AI questions stay off in it; the API's
`/api/ask` uses the `AEI_LLM_*` variables. CI builds both images on every
push (`.github/workflows/check.yml`, job `containers`); nothing is pushed
to a registry.

