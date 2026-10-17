#!/bin/sh
# Usability measurement for the design night: U4 (accessibility, contrast),
# U5 (i18n key parity, plus a hint count of JSX literals that bypass t()) and
# U6 (LCP on a production build, Lighthouse mobile with simulated 4G).
#
# usage: measure.sh <label>        e.g. measure.sh before
#
# Steps: production build of @aei/web, vite preview on :4174 (API proxied to
# :8788 through AEI_API_URL), Lighthouse on /, /#doctor, /#research, then the
# i18n check. Lighthouse JSON goes to lighthouse/<label>-<page>.json beside
# this script (gzipped if over 1 MB). The preview server is killed on exit.
set -eu

label=${1:?usage: measure.sh <label>}
case $label in
  *[!A-Za-z0-9_-]*) echo "label may use letters, digits, _ and - only" >&2; exit 2 ;;
esac

dir=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$dir/../../.." && pwd)
web="$root/apps/web"
out="$dir/lighthouse"
port=4174
base="http://localhost:$port"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
work=$(mktemp -d)
server_pid=

cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; fi
  stale=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$stale" ]; then kill $stale 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

if lsof -tiTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $port is already in use; stop that server first" >&2
  exit 1
fi
mkdir -p "$out"
if [ -x "$chrome" ]; then CHROME_PATH=$chrome; export CHROME_PATH; fi

echo "== build (production, @aei/web)"
# One retry: a concurrent pnpm install or store write can fail the first attempt.
if ! (cd "$root" && pnpm --filter @aei/web build) >"$work/build.log" 2>&1; then
  echo "build failed once; retrying in 10 s" >&2
  sleep 10
  if ! (cd "$root" && pnpm --filter @aei/web build) >"$work/build.log" 2>&1; then
    tail -30 "$work/build.log" >&2
    echo "build failed" >&2
    exit 1
  fi
fi

echo "== serve apps/web on $base (API at http://localhost:8788)"
(cd "$web" && AEI_API_URL=http://localhost:8788 exec npx vite preview --port $port --strictPort) \
  >"$work/preview.log" 2>&1 &
server_pid=$!
tries=0
until curl -fsS -o /dev/null "$base/" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 90 ]; then
    echo "preview did not answer in 90 s; log:" >&2
    tail -30 "$work/preview.log" >&2
    exit 1
  fi
  sleep 1
done

run_lighthouse() {
  page=$1; hash=$2
  npx --yes lighthouse@12 "$base/$hash" \
    --only-categories=accessibility,performance \
    --chrome-flags="--headless=new" \
    --output=json --output-path="$out/$label-$page.json" \
    --quiet >"$work/lh-$page.log" 2>&1 || {
      tail -30 "$work/lh-$page.log" >&2
      echo "lighthouse failed for $page" >&2
      exit 1
    }
}

echo "== lighthouse (mobile, simulated 4G)"
run_lighthouse home ""
run_lighthouse doctor "#doctor"
run_lighthouse research "#research"

cat >"$work/summarise.js" <<'EOF'
const fs = require("fs");
const [file, page] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(file, "utf8"));
if (r.runtimeError) {
  console.log(`${page}: lighthouse runtime error ${r.runtimeError.code}`);
  process.exit(1);
}
const a = r.audits;
const score = (x) => (x == null ? "n/a" : String(Math.round(x * 100)));
const sec = (id) => (a[id] && a[id].numericValue != null ? (a[id].numericValue / 1000).toFixed(2) + " s" : "n/a");
const cc = a["color-contrast"];
let contrast = "n/a";
if (cc) {
  const failing = cc.details && cc.details.items ? cc.details.items.length : 0;
  contrast = cc.score === 1 ? "pass" : cc.score === null ? "n/a" : `fail (${failing} failing items)`;
}
console.log(
  `${page.padEnd(9)} a11y=${score(r.categories.accessibility.score)}  contrast=${contrast}  ` +
  `FCP=${sec("first-contentful-paint")}  LCP=${sec("largest-contentful-paint")}  finalUrl=${r.finalUrl}`
);
EOF

echo "== results (U4 a11y and contrast, U6 LCP target 2.5 s)"
for page in home doctor research; do
  node "$work/summarise.js" "$out/$label-$page.json" "$page"
  size=$(wc -c <"$out/$label-$page.json")
  if [ "$size" -gt 1048576 ]; then
    gzip -9 -f "$out/$label-$page.json"
    echo "  $label-$page.json was ${size} bytes; gzipped to $label-$page.json.gz"
  fi
done

echo "== U5 i18n key parity (libs/utils/i18n/src/en.ts, fi.ts)"
cat >"$work/i18n.js" <<'EOF'
const fs = require("fs");
const [dir] = process.argv.slice(2);
const keys = (f) => new Set([...fs.readFileSync(f, "utf8").matchAll(/^  ([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
const en = keys(`${dir}/en.ts`);
const fi = keys(`${dir}/fi.ts`);
const missingInFi = [...en].filter((k) => !fi.has(k));
const missingInEn = [...fi].filter((k) => !en.has(k));
console.log(`en keys=${en.size} fi keys=${fi.size}`);
console.log(`missing in fi (${missingInFi.length}): ${missingInFi.join(", ") || "none"}`);
console.log(`missing in en (${missingInEn.length}): ${missingInEn.join(", ") || "none"}`);
EOF
node "$work/i18n.js" "$root/libs/utils/i18n/src"

echo "== hint only, not a metric: JSX literals that may bypass t()"
src="$web/src"
text=$(grep -rEn --include='*.tsx' '>[^<>{}]*[A-Za-z][^<>{}]*<' "$src" | grep -v '=>' | wc -l | tr -d ' ')
attr=$(grep -rEn --include='*.tsx' '(aria-label|title|placeholder|alt)="[^"{]*[A-Za-z]' "$src" | wc -l | tr -d ' ')
echo "JSX text-like literals: $text lines; literal attributes (aria-label, title, placeholder, alt): $attr lines"

echo "== done: $out/$label-{home,doctor,research}.json"
