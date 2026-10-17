#!/usr/bin/env bash
# Builds the Reproduce window's JupyterLite site (D-062, D-063): JupyterLab in
# the browser with a Python kernel (Pyodide, loaded from its CDN, with the
# `aei` wheel) and an R kernel (xeus-r, packed here and served by us).
#
#   apps/notebook/build.sh [OUT]     default OUT: apps/web/public/notebook
#
# Needs uv and micromamba on PATH (or MICROMAMBA=/path/to/micromamba). The R
# environment is cached in apps/notebook/build/; delete it to refresh.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="$(realpath -m "${1:-$root/apps/web/public/notebook}")"
mm="${MICROMAMBA:-micromamba}"
export MAMBA_ROOT_PREFIX="${MAMBA_ROOT_PREFIX:-$here/build/mamba}"
cd "$here"

rm -rf build/wheels
uv build -q --wheel "$root/libs/utils/py" -o build/wheels

env="$here/build/envs/xeus-r"
if [ ! -d "$env" ]; then
  "$mm" create -q -y -p "$env" --platform emscripten-wasm32 \
    -c https://repo.prefix.dev/emscripten-forge-dev -c https://repo.prefix.dev/conda-forge \
    xeus-r r-jsonlite r-digest r-readr
fi

PATH="$(dirname "$(command -v "$mm")"):$PATH" uv run jupyter lite build \
  --lite-dir "$here" --contents files --no-sourcemaps \
  --piplite-wheels build/wheels/aei-*.whl \
  --XeusAddon.prefix="$env" \
  --output-dir "$out"
# Keep the static root entry, but never shadow the API's live project listings.
rm -rf "$out/api/contents/projects"
# The AEI theme (D-062, README.md): copied beside the site and linked after
# JupyterLab's own stylesheet in each page that loads it.
cp "$here/theme/aei-theme.css" "$out/aei-theme.css"
for page in "$out/index.html:aei-theme.css" "$out/lab/index.html:../aei-theme.css"; do
  file="${page%%:*}"
  href="${page#*:}"
  [ -f "$file" ] || { echo "no $file to theme" >&2; exit 1; }
  perl -0pi -e "s#</head>#<link rel=\"stylesheet\" href=\"$href\">\n</head>#" "$file"
done

# uv writes the wheel as 0600; nginx in the web image runs as another user and must read every file.
chmod -R a+rX "$out"
echo "JupyterLite site in $out ($(du -sh "$out" | cut -f1))"
