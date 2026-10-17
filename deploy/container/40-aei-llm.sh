#!/bin/sh
# Writes /etc/nginx/aei-llm.inc before nginx starts (the image runs /docker-entrypoint.d/* in order).
# With AEI_LLM_URL set, /llm passes the app's two language-model calls to that server and adds the
# Cloudflare Access service token, so the token stays on the server; without it, /llm is a 404 and
# the app reports its AI questions off.
set -eu
out=/etc/nginx/aei-llm.inc
if [ -z "${AEI_LLM_URL:-}" ]; then
  echo 'location /llm/ { return 404; }' > "$out"
  exit 0
fi
url="${AEI_LLM_URL%/}"
url="${url%/v1}"
host=$(printf '%s' "$url" | sed -E 's#^[a-z]+://([^/:]+).*#\1#')
headers=""
[ -n "${AEI_LLM_ACCESS_ID:-}" ] && headers="$headers proxy_set_header CF-Access-Client-Id \"$AEI_LLM_ACCESS_ID\";"
[ -n "${AEI_LLM_ACCESS_SECRET:-}" ] && headers="$headers proxy_set_header CF-Access-Client-Secret \"$AEI_LLM_ACCESS_SECRET\";"
[ -n "${AEI_LLM_KEY:-}" ] && headers="$headers proxy_set_header Authorization \"Bearer $AEI_LLM_KEY\";"
common="proxy_ssl_server_name on; proxy_set_header Host $host; proxy_http_version 1.1; proxy_set_header Connection \"\";$headers"
cat > "$out" <<CONF
location = /llm/v1/models { limit_except GET { deny all; } proxy_pass $url/v1/models; $common proxy_read_timeout 10s; }
location = /llm/v1/chat/completions { limit_except POST { deny all; } proxy_pass $url/v1/chat/completions; $common proxy_read_timeout 120s; client_max_body_size 1m; }
location /llm/ { return 404; }
CONF
