#!/usr/bin/env bash
# The least the page's Python kernel needs without the full JupyterLite build (build.sh, which also needs
# micromamba for R): the `aei` wheel and its pointer under apps/web/public/notebook/pypi. Needs uv.
#
#   apps/notebook/wheel.sh [OUT]     default OUT: apps/web/public/notebook
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="${1:-$root/apps/web/public/notebook}"
mkdir -p "$out/pypi"
rm -f "$out"/pypi/aei-*.whl
uv build -q --wheel "$root/libs/utils/py" -o "$out/pypi"
printf '{"wheel": "%s"}\n' "$(cd "$out/pypi" && ls aei-*.whl)" > "$out/pypi/aei.json"
chmod -R a+rX "$out/pypi"
echo "aei wheel in $out/pypi ($(cat "$out/pypi/aei.json"))"
