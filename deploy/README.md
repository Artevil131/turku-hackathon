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
| `/regional` | `data/external/thl` (from `scripts/fetch_thl_ttr.py` and `scripts/fetch_finres.py`; without them `/api/regional` and `/api/national` answer 404) | `AEI_THL_DIR` |
| `/config` | `deploy/container/config` (a site's code map; the sites file `AEI_SITES`) | `AEI_CONFIG_DIR` |

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
`AEI_CODE_MAP` (e.g. `/config/codes.json`), `AEI_SITES` (other hospitals
sending to this server, e.g. `/config/sites.json` started from
`config/sites.example.json`; deploy/integration.md, "Connecting a second
hospital", D-051) and the optional language model
(`AEI_LLM_URL`, `AEI_LLM_MODEL`, `AEI_LLM_KEY`, `AEI_LLM_ACCESS_ID`,
`AEI_LLM_ACCESS_SECRET`). Ports: `AEI_WEB_PORT` (8080) and `AEI_API_PORT`
(8787, published on 127.0.0.1 only, for `scripts/send_lab_results.py`).
`AEI_API_USER` (`node`) sets the API's user. The compose file carries the
API health check itself, since podman-compose builds OCI images, which
drop the image's `HEALTHCHECK`; for a plain `podman build`, add
`--format docker` to keep it.

Research projects persist in the writable named volume `aei-state`, mounted
at `/state` (`AEI_STATE_DIR=/state`): one JSON file per project under
`/state/projects` (D-057). Outside compose, set `AEI_STATE_DIR` to a writable
directory; unset, projects live only in memory. Frozen projects store an
as-of date and fingerprint, not a copy of the dataset (D-058). Anyone who
can reach the demo API can read and edit every project; there is no auth.

This is demo and pilot packaging, not a hardened deployment: no
authentication beyond the sites file's tokens, no TLS, no lab-result persistence
(results posted to `/api/ingest` live in memory until restart), one API
process. A site's token is a plain shared secret sent as `Authorization:
Bearer`, kept in the sites file (mode 600; the server warns at startup if
others can read it); it says which hospital sent a result, it is not
hardened authentication, and without TLS it crosses the network in clear. The web image has no
`/llm` proxy, so the web app's own AI questions stay off in it; the API's
`/api/ask` uses the `AEI_LLM_*` variables. CI builds both images on every
push (`.github/workflows/check.yml`, job `containers`); nothing is pushed
to a registry.


### The language model through the web container

With `AEI_LLM_URL` (and the Cloudflare Access `AEI_LLM_ACCESS_ID` and
`AEI_LLM_ACCESS_SECRET`, see `deploy/myy-llm/README.md`) in the compose
environment and `AEI_LLM_PROXY=1` at build time, the web container passes the
app's two model calls (`GET /llm/v1/models`, `POST /llm/v1/chat/completions`)
to the model and adds the token itself (`40-aei-llm.sh`), so the token never
reaches the browser; every other `/llm` path is a 404. Without `AEI_LLM_URL`
`/llm` is a 404 and the app shows its AI questions as off.

### Running on the team's OCI server

The stack runs on Aapo's OCI host (Oracle Linux 8, aarch64, docker compose)
from a clone in `~/aei`, with the dataset and THL file uploaded under
`~/aei/data`, the model served from Myy, and its settings in
`~/aei/deploy/container/.env` (mode 600, git-ignored). Both ports are bound to
127.0.0.1 there (web 8097, API 8796), so it is reached through SSH:

    ssh -N -L 8097:127.0.0.1:8097 oci      # then http://localhost:8097
    ssh oci 'cd aei && git pull && docker compose -p aei -f deploy/container/compose.yaml up -d --build'   # update

Checked on 2026-10-17: all routes answer through the proxy, the model
answers at `/llm`, and `SMOKE_URL=http://localhost:8097 pnpm smoke` passes
14 of 14.

It is published as the demo at https://yourlab.aapolipponen.com (since
2026-10-17; it replaced aei.aapolipponen.com, now removed). The host's
nginx (`/etc/nginx/conf.d/yourlab.aapolipponen.com.conf`) proxies to the web
container on 127.0.0.1:8097. It is public since 2026-10-17 (the basic auth was
removed; `/etc/nginx/aei.htpasswd` is no longer used), and `/llm/` is limited
to 20 requests a minute per visitor (burst 10) so the model on Myy cannot be
flooded;
haproxy on :443 passes TLS to it, the Let's Encrypt certificate renews by
webroot (`/var/www/yourlab-acme`), and the DNS record is a DNS-only A record
in Cloudflare.
