#!/usr/bin/env bash
# Serves one GGUF model with llama.cpp's OpenAI-compatible server on myy's GPU
# (RTX 3070 Ti, 8 GB, shared with the desktop), as a Slurm job, and publishes
# it at https://aei-llm.aapolipponen.com through a Cloudflare Tunnel that runs
# inside the same job: the URL is live exactly as long as the job. Installed by
# scripts/fetch-llm.sh. Usage from the repo root on nipsu:
#
#   cj run --snap -p myy -g -n aei-llm -c 4 -m 5G -t 12h --tag aei-llm -- bash deploy/myy-llm/serve.sh [MODEL]
#
# MODEL: qwen (default) or gemma. AEI_LLM_PUBLIC=0 skips the tunnel (then
# reach it with deploy/myy-llm/tunnel.sh). Cloudflare Access lets through only
# requests carrying a service token (deploy/myy-llm/README.md); the server
# itself listens on myy's loopback only.
# The myy partition never preempts, but a job may wait hours to start while
# the desktop is busy: start it well ahead of a demo.
set -euo pipefail

HOME_DIR="${AEI_LLM_HOME:-$HOME/aei-llm}"
BIN="$HOME_DIR/llama.cpp"
case "${1:-qwen}" in
  qwen)  MODEL="$HOME_DIR/models/qwen3.5-4b-q8_0.gguf";        ALIAS=qwen3.5-4b ;;
  gemma) MODEL="$HOME_DIR/models/gemma-4-e4b-it-qat-q4_0.gguf"; ALIAS=gemma-4-e4b ;;
  *) echo "unknown model: $1 (qwen|gemma)" >&2; exit 2 ;;
esac
PORT=8023 # the tunnel's ingress points at 127.0.0.1:8023

echo "[$(date -Is)] aei-llm job ${SLURM_JOB_ID:-?} on $(hostname): $ALIAS on 127.0.0.1:$PORT"
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader || true

pids=()
cleanup() {
  kill "${pids[@]}" 2>/dev/null || true
  wait || true
  # The job cgroup's memory peak, for sizing -m (peak + 20 %).
  local cg; cg="/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup | head -1)"
  while [ "$cg" != /sys/fs/cgroup ] && [ ! -f "$cg/memory.peak" ]; do cg="${cg%/*}"; done
  [ -f "$cg/memory.peak" ] && echo "[$(date -Is)] memory.peak $(( $(cat "$cg/memory.peak") / 1048576 )) MiB (${cg#/sys/fs/cgroup})" || true
}
trap cleanup EXIT TERM INT

# Short context and two slots: questions and alert explanations are a few
# hundred tokens. Small batches keep each GPU dispatch short, so the desktop
# on the same card does not stutter. The prompt cache in host RAM defaults
# to 8 GiB and grew until the job was OOM-killed (2026-10-16); 256 MiB is
# plenty for two short slots. The model is mmapped: with every layer on the
# GPU its pages are reclaimable cache, not resident memory.
LD_LIBRARY_PATH="$BIN${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$BIN/llama-server" -m "$MODEL" --alias "$ALIAS" \
  --host 127.0.0.1 --port "$PORT" \
  -ngl 999 -fa on -c 8192 --parallel 2 -b 512 -ub 256 --cache-ram 256 \
  --jinja --no-webui &
pids+=($!)

if [ "${AEI_LLM_PUBLIC:-1}" != 0 ]; then
  "$HOME_DIR/cloudflared" tunnel --no-autoupdate --loglevel warn run --token-file "$HOME_DIR/tunnel-token" &
  pids+=($!)
  echo "[$(date -Is)] tunnel up: https://aei-llm.aapolipponen.com"
fi

# Either process ending ends the job.
wait -n "${pids[@]}"
