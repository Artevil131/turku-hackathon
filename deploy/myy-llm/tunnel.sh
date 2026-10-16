#!/usr/bin/env bash
# Forwards localhost:8023 to the AI model served on myy (deploy/myy-llm/serve.sh
# started with AEI_LLM_PUBLIC=0) over ssh, for operators with access to
# compute@myy. Everyone else uses https://aei-llm.aapolipponen.com. Ctrl-C closes it.
set -euo pipefail
PORT="${AEI_LLM_PORT:-8023}"
echo "export AEI_LLM_URL=http://127.0.0.1:$PORT AEI_LLM_MODEL=qwen3.5-4b"
exec ssh -N -L "$PORT:127.0.0.1:$PORT" compute@myy
