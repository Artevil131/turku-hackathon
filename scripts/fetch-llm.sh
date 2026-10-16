#!/usr/bin/env bash
# Downloads the llama.cpp server (CUDA build) and the candidate GGUF models
# for the optional AI layer into $AEI_LLM_HOME (default ~/aei-llm), checking
# every file against its pinned sha256. Idempotent: files already present and
# verified are skipped, partial downloads resume.
#
# Run on myy as a Slurm job (no GPU needed), from the repo root on nipsu:
#   cj run --snap -p myy -n aei-fetch-llm -c 2 -m 1G -t 2h --tag aei-llm -- bash scripts/fetch-llm.sh
#
# Total about 10 GB: llama.cpp b11700 + CUDA 13.4 runtime (~0.6 GB), cloudflared,
# Qwen3.5-4B Q8_0 (4.5 GB), gemma-4-E4B-it QAT q4_0 (5.2 GB).
set -euo pipefail

HOME_DIR="${AEI_LLM_HOME:-$HOME/aei-llm}"
LLAMA_TAG=b11700
mkdir -p "$HOME_DIR/models" "$HOME_DIR/dl"

fetch() { # url sha256 dest
  local url=$1 sha=$2 dest=$3
  if [ -f "$dest" ] && echo "$sha  $dest" | sha256sum -c --status; then
    echo "ok      $dest"; return
  fi
  echo "fetch   $url"
  curl -fL --retry 5 --retry-delay 10 -C - -o "$dest.part" "$url"
  echo "$sha  $dest.part" | sha256sum -c --quiet
  mv "$dest.part" "$dest"
}

GH=https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_TAG
fetch "$GH/llama-$LLAMA_TAG-bin-ubuntu-cuda-13.4-x64.tar.gz" \
  8f9d3ce07508307edf07c28ba40c34ad387c8ba163d8aecc5c54fd8e067c8e5e "$HOME_DIR/dl/llama.tar.gz"
fetch "$GH/cudart-llama-$LLAMA_TAG-bin-ubuntu-cuda-13.4-x64.tar.gz" \
  9f017e8b7370bf5b87374de646d2782882300db3585a0da0a707e79cd02993f2 "$HOME_DIR/dl/cudart.tar.gz"

BIN="$HOME_DIR/llama.cpp-$LLAMA_TAG"
if [ ! -x "$BIN/llama-server" ]; then
  rm -rf "$BIN.tmp" && mkdir -p "$BIN.tmp"
  tar -xzf "$HOME_DIR/dl/llama.tar.gz" -C "$BIN.tmp" --strip-components=1
  tar -xzf "$HOME_DIR/dl/cudart.tar.gz" -C "$BIN.tmp" --strip-components=1
  mv "$BIN.tmp" "$BIN"
fi
ln -sfn "$BIN" "$HOME_DIR/llama.cpp"

# Cloudflare Tunnel client: serve.sh runs it inside the job to publish the
# server at https://aei-llm.aapolipponen.com (deploy/myy-llm/README.md).
fetch https://github.com/cloudflare/cloudflared/releases/download/2026.10.1/cloudflared-linux-amd64 \
  3bfc539f45d2620c71debb7a86be0efa737ed5ccbad9eb85c787116900e5c586 "$HOME_DIR/cloudflared"
chmod +x "$HOME_DIR/cloudflared"

HF=https://huggingface.co
fetch "$HF/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q8_0.gguf" \
  10cc391b403021dd11c614679d2fd92f611c3681d29e29651b717316965d61e1 "$HOME_DIR/models/qwen3.5-4b-q8_0.gguf"
fetch "$HF/google/gemma-4-E4B-it-qat-q4_0-gguf/resolve/main/gemma-4-E4B_q4_0-it.gguf" \
  676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee "$HOME_DIR/models/gemma-4-e4b-it-qat-q4_0.gguf"

ls -la "$BIN" | head -5
LD_LIBRARY_PATH="$BIN" "$BIN/llama-server" --version || true
df -h "$HOME_DIR" | tail -1
