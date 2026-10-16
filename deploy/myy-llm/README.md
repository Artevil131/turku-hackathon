# myy-llm: the model behind the plain-language layer

The optional AI layer (`@aei/ask`, D-017 to D-019) needs an
OpenAI-compatible chat endpoint. For the hackathon that is a small model
(Qwen3.5-4B or gemma-4-E4B, chosen by experiments/0003) served by llama.cpp
on **myy**'s RTX 3070 Ti (8 GB, also the desktop's card), as a Slurm job.
The same job runs a Cloudflare Tunnel, so the server is reachable from
anywhere at

    https://aei-llm.aapolipponen.com

while the job runs, and nowhere when it does not. Cloudflare Access sits in
front: a request without a valid service token is refused at Cloudflare's
edge and never reaches myy (D-018). The server itself listens only on
myy's loopback.

The app works without it: with no `AEI_LLM_URL` the API reports `ai: false`,
the web hides the ask field, and alerts keep their template explanations.

## Using it (any teammate, any machine)

You need a service token (a Client ID and a Client Secret) from Aapo. Each
person gets their own, so one can be revoked without the others. Put
them in the environment of `apps/api`, e.g. a `.env` you source before
`pnpm dev` (never commit it):

    AEI_LLM_URL=https://aei-llm.aapolipponen.com
    AEI_LLM_MODEL=qwen3.5-4b
    AEI_LLM_ACCESS_ID=<client id>.access
    AEI_LLM_ACCESS_SECRET=<client secret>

Check that it is up:

    curl -s https://aei-llm.aapolipponen.com/v1/models \
      -H "CF-Access-Client-Id: $AEI_LLM_ACCESS_ID" \
      -H "CF-Access-Client-Secret: $AEI_LLM_ACCESS_SECRET"

A JSON list of one model means it works. A 401/403 means the token is
wrong. A 502/530 means the tunnel is up but nothing is serving (the job is
not running or still loading).

## Running it (operator, from the repo root on nipsu)

Once, to install llama.cpp, cloudflared and both models (~10 GB, pinned
sha256) into `~compute/aei-llm` on myy:

    cj run --snap -p myy -n aei-fetch-llm -c 2 -m 1G -t 2h --tag aei-llm -- bash scripts/fetch-llm.sh

The tunnel token goes in `~compute/aei-llm/tunnel-token` (mode 600). It is
not in git. Then, for each session or demo:

    cj run --snap -p myy -g -n aei-llm -c 4 -m 8G -t 12h --tag aei-llm -- bash deploy/myy-llm/serve.sh qwen

- `qwen` or `gemma` picks the model. The served name (`AEI_LLM_MODEL`) is
  `qwen3.5-4b` or `gemma-4-e4b`.
- **Start it well before a demo.** The `myy` partition never preempts a
  running job, but myy drains itself while the desktop is busy, so a job
  can wait a long time to *start*. The limit is 12 h; resubmit after that.
- `cj log ID -f` shows the server log. `cj cancel ID` stops it, and the URL
  goes dark with it.
- `AEI_LLM_PUBLIC=0` skips the tunnel. `deploy/myy-llm/tunnel.sh` then
  forwards it to `localhost:8023` over ssh, for anyone with `compute@myy` access.

## Cloudflare objects (account of aapolipponen.com)

| Object | Name | Notes |
|---|---|---|
| Tunnel | `aei-llm` | remotely managed; ingress `aei-llm.aapolipponen.com` → `http://127.0.0.1:8023` |
| DNS | `aei-llm.aapolipponen.com` | proxied CNAME to the tunnel |
| Access app | `AEI LLM` | self-hosted, one Service Auth policy |
| Service tokens | `aei-vaishnav`, `aei-aapo` | 90 days, expire 2027-01-14 |

To add a teammate, create a service token in Zero Trust → Access → Service
credentials and add it to the `AEI service tokens` policy. To cut someone
off, revoke their token. To take everything down, delete the Access app,
the DNS record and the tunnel.
