#!/bin/sh
# Screenshots of the running web app at phone and laptop width, with headless Chrome.
# usage: shoot.sh <base-url> <label> [surface...]   e.g. shoot.sh http://localhost:5174 before home doctor
# Writes <surface>-<label>-<width>.png next to this script. Surface "home" is the root.
set -eu
base=$1; label=$2; shift 2
dir=$(cd "$(dirname "$0")" && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for surface in "${@:-home doctor research settings}"; do
  for size in "390,844:phone" "1280,860:laptop"; do
    wh=${size%%:*}; name=${size##*:}
    case $surface in home) hash="" ;; *) hash="#$surface" ;; esac
    perl -e "alarm shift; exec @ARGV" 25 "$chrome" --headless=new --hide-scrollbars --disable-gpu --no-first-run \
      --user-data-dir="$(mktemp -d)" --window-size="$wh" --timeout=7000 \
      --screenshot="$dir/$surface-$label-$name.png" "$base/$hash" >/dev/null 2>&1 || true
  done
done
ls -1 "$dir" | grep -- "-$label-" || true
