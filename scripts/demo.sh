#!/usr/bin/env bash
# The demo in one command (DEMO.md): the server holds results up to 1 June 2025, the app opens,
# and on Enter a stand-in laboratory system sends 2 to 14 June as HL7 v2 messages, one day every
# few seconds, until the Urology ESBL E. coli outbreak raises its alert on 4 June.
#
#     pnpm demo                 # or: scripts/demo.sh [seconds between days, default 3]
#
# Ctrl-C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
pause="${1:-3}"

if [ ! -d data/synthetic_microbiology_dataset ]; then
  echo "Unzip the organisers' dataset into data/synthetic_microbiology_dataset/ first (README.md, Running)." >&2
  exit 1
fi
if [ ! -f data/external/thl/regional.json ]; then
  echo "Fetching THL county data for the regional view (a few seconds)..."
  uv run python scripts/fetch_thl_ttr.py || echo "No THL data: the regional view stays empty."
fi

trap 'kill 0' EXIT
AEI_LOAD_UNTIL=2025-06-01 pnpm dev &

until curl -sf http://localhost:8787/api/meta >/dev/null; do sleep 1; done
until curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done
echo
echo "AEI is running at http://localhost:5173 with results up to 1 June 2025."
read -r -p "Press Enter to start the lab feed (2 to 14 June, one day every ${pause} s)... "
uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-14 --format hl7 --pause "$pause"
echo "Feed done. The app keeps running; Ctrl-C to stop."
wait
