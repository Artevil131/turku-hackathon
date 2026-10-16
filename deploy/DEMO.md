# Running the AEI demo

How to bring up the full demo, the live replay plus the optional AI layer,
on any presenter's laptop. The AI model runs on myy and is reached over the
internet. Nothing heavy runs on the laptop.

> **Status 2026-10-16 22:00:** the model endpoint is live and tested. The
> ask field and the alert "Explain" button land with the web wiring now in
> progress on `ui/web-app`. Until they do, steps 1–4 still apply and the app
> simply runs without AI.

## Who does what

| Role | Who | Needs |
|---|---|---|
| Operator | Aapo | `cj` on nipsu (submits the model job to myy) |
| Presenter | anyone, e.g. Vaishnav | Node ≥ 22, pnpm, the dataset zip, a service token from Aapo |

---

## A. Operator: start the model (2 h before the demo)

From the repo root on nipsu:

```bash
cj run --snap -p myy -g -n aei-llm -c 4 -m 8G -t 12h --tag aei-llm -- bash deploy/myy-llm/serve.sh qwen
```

- It prints a job id. Check `cj ls`: `RUNNING` means it's serving within
  ~5 s of starting.
- **Start early.** myy holds new jobs while its desktop is busy, so a job
  can sit `PENDING` for a while. Once running it is never preempted. The
  limit is 12 h.
- `qwen` is the default model. `gemma` is the alternative; experiment
  0003 decides between them. If you switch, presenters set
  `AEI_LLM_MODEL=gemma-4-e4b`.
- Only one model job at a time: `cj cancel <old id>` before starting another.

Check it from anywhere (with your own token, `~/.config/aei/llm-aapo.env`):

```bash
set -a; . ~/.config/aei/llm-aapo.env; set +a
curl -s https://aei-llm.aapolipponen.com/v1/models \
  -H "CF-Access-Client-Id: $AEI_LLM_ACCESS_ID" \
  -H "CF-Access-Client-Secret: $AEI_LLM_ACCESS_SECRET"
```

A JSON list naming `qwen3.5-4b` means it's up.

Give each presenter their own credentials file (Vaishnav's is
`~/.config/aei/llm-vaishnav.env`). Send it privately, never in a shared
channel or in git.

---

## B. Presenter: set up the laptop (once)

1. **Get the code and the data**

   ```bash
   git clone <repo> turku-hackathon && cd turku-hackathon
   git checkout ui/web-app
   pnpm install
   ```

   Unzip the organiser's dataset so that
   `data/synthetic_microbiology_dataset/cultures.csv` exists.

2. **Put the credentials file somewhere outside the repo**, e.g.
   `~/aei-llm.env`. It looks like this:

   ```
   AEI_LLM_URL=https://aei-llm.aapolipponen.com
   AEI_LLM_MODEL=qwen3.5-4b
   AEI_LLM_ACCESS_ID=<client id>.access
   AEI_LLM_ACCESS_SECRET=<client secret>
   ```

3. **Test the token** (macOS / Linux):

   ```bash
   set -a; . ~/aei-llm.env; set +a
   curl -s -o /dev/null -w '%{http_code}\n' https://aei-llm.aapolipponen.com/v1/models \
     -H "CF-Access-Client-Id: $AEI_LLM_ACCESS_ID" \
     -H "CF-Access-Client-Secret: $AEI_LLM_ACCESS_SECRET"
   ```

   `200` is good. See the troubleshooting table below for anything else.

---

## C. Presenter: run the demo

```bash
set -a; . ~/aei-llm.env; set +a     # load the AI credentials into this shell
pnpm dev                            # API on :8787, website on :5173
```

Windows PowerShell instead of the first line:

```powershell
Get-Content $HOME\aei-llm.env | ? { $_ -match '^\w+=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
```

The API log should say the AI layer is on and name the model. Open
**http://localhost:5173**.

Without the credentials loaded, `pnpm dev` still works: the ask field is
hidden and alert explanations use their fixed templates.

---

## D. The demo itself

The replay starts on **2025-05-12** (D-015), three weeks before the Urology
ESBL *E. coli* cluster. Let it play and the outbreak arrives.

**Ask in plain language** (doctor or research view), in either language:

| English | Finnish |
|---|---|
| urine E. coli in older men, last 3 months | virtsan E. coli iäkkäillä miehillä, viimeiset 3 kuukautta |
| Klebsiella pneumoniae in blood cultures in the ICU | Klebsiella pneumoniae veriviljelyissä teho-osastolla |
| S. aureus from wounds in Surgery in the past 30 days | S. aureus haavanäytteistä kirurgialla viimeisen 30 päivän aikana |
| E. coli in Urology over the last two weeks | E. coli urologialla kahden viime viikon aikana |

The question becomes **filter chips** you can see and remove. Point out:

- "older" always means 65+, from one fixed table (D-019), not the model's guess.
- "last 3 months" counts back from the **replay date**, not today.
- Words the filters can't express (e.g. "ESBL", "young") show up as "not
  understood" instead of being guessed.
- **Every number on screen comes from the statistics.** The model only
  picks filters.

**Explain an alert:** press *Explain* on an alert for a short plain-language
reading. The model writes the sentences, but every number, date and count
in them is filled in by code from the alert itself. If the model writes a
number of its own, its text is thrown away and a fixed template is shown
(marked *template*).

---

## E. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `curl` gives **401/403** | token wrong or revoked | check the two `AEI_LLM_ACCESS_*` values; ask Aapo for a new token |
| `curl` gives **502 / 530** | tunnel up but no model, or job not running | operator: `cj ls`; restart with step A |
| job stays `PENDING` | myy's desktop is busy | wait; this is why step A is 2 h early |
| ask field missing | API started without the env loaded | stop `pnpm dev`, load the env (step C), start again |
| "assistant unavailable" | model job ended mid-demo (12 h limit) | operator restarts step A; the rest of the app keeps working |
| explanation marked *template* | model's text failed the number check | expected now and then; the template is correct |
| slow first answer | model warming up | ask once before going on stage |

## F. After the demo

- Operator: `cj cancel <job id>` frees myy's GPU and takes the URL dark.
- To cut off a presenter: Cloudflare Zero Trust → Access → Service
  credentials → revoke their token. Tokens expire 2027-01-14 anyway.

Details of the setup are in `deploy/myy-llm/README.md`; the reasons are
D-017 to D-019 in DECISIONS.md.
