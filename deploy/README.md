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

The container user must be able to read the dataset: make the files
readable (`chmod -R a+rX data/synthetic_microbiology_dataset`), or with
rootless podman run as your own user (`podman run --userns=keep-id`).
The mounts carry `z` so SELinux hosts (Fedora) relabel them.

The compose file passes the server's variables through: `AEI_REPLAY_START`,
`AEI_LOAD_UNTIL` (load results up to a date, the rest can arrive through
`/api/ingest`), `AEI_TICK_MS`, `AEI_DAYS_PER_TICK`, `AEI_GUIDELINE`,
`AEI_CODE_MAP` (e.g. `/config/codes.json`) and the optional language model
(`AEI_LLM_URL`, `AEI_LLM_MODEL`, `AEI_LLM_KEY`, `AEI_LLM_ACCESS_ID`,
`AEI_LLM_ACCESS_SECRET`). Ports: `AEI_WEB_PORT` (8080) and `AEI_API_PORT`
(8787, published on 127.0.0.1 only, for `scripts/send_lab_results.py`).
Build with `--format docker` under podman to keep the health check.

This is demo and pilot packaging, not a hardened deployment: no
authentication, no TLS, no persistence (results posted to `/api/ingest`
live in memory until restart), one API process. The web image has no
`/llm` proxy, so the web app's own AI questions stay off in it; the API's
`/api/ask` uses the `AEI_LLM_*` variables. CI builds both images on every
push (`.github/workflows/check.yml`, job `containers`); nothing is pushed
to a registry.

