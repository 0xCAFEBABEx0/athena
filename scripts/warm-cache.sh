#!/usr/bin/env bash
# Request every page of the web app once so the Vercel cache holds it before
# the first visitor arrives. A new deployment starts with an empty cache, and a
# cache miss renders the page (and wakes the CMS and its database).
#
#   scripts/warm-cache.sh https://preview.whoa.me [commit-sha]
#
# With a commit SHA, it first waits (up to 3 min) until the site serves that
# build, since the domain can move to a new deployment a little after it is
# reported ready. Used by .github/workflows/warm-cache.yml.
set -euo pipefail

base="${1:?usage: warm-cache.sh <site-url> [commit-sha]}"
base="${base%/}"
sha="${2:-}"
ua="athena-cache-warmer"
# Preview sits behind Vercel Authentication: with the project's "Protection
# Bypass for Automation" secret (repository secret
# VERCEL_AUTOMATION_BYPASS_SECRET) the requests get through.
headers=()
if [ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  headers=(-H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET")
fi
get() { curl -A "$ua" "${headers[@]}" "$@"; }

# A login redirect (or a block) would make every request below useless, and
# the wait would time out: say so and stop.
probe=$(get -sS -o /dev/null -w '%{http_code} %{redirect_url}' "$base/" || true)
code="${probe%% *}"
if [ "$code" != "200" ]; then
  echo "::warning title=Cache not warmed::$base/ answered ${probe:-no response} (Vercel Authentication? set the VERCEL_AUTOMATION_BYPASS_SECRET repository secret)"
  exit 0
fi

if [ -n "$sha" ]; then
  short="${sha:0:7}"
  for _ in $(seq 1 36); do
    # The /status panel on every page prints the build's short commit.
    if get -fsS "$base/" | grep -q "<dd>$short</dd>"; then
      echo "Serving $short."
      break
    fi
    sleep 5
  done
fi

urls=$(mktemp)
trap 'rm -f "$urls"' EXIT

# Sitemaps list the canonical host; request the host we were given, so the
# bypass secret is never sent anywhere else.
for sitemap in $(get -fsS "$base/sitemap.xml" | grep -o '<loc>[^<]*</loc>' | sed -e 's/<loc>//' -e 's/<\/loc>//' | sed -E "s#^https?://[^/]+#$base#"); do
  { get -fsS "$sitemap" | grep -o '<loc>[^<]*</loc>' | sed -e 's/<loc>//' -e 's/<\/loc>//' >> "$urls"; } || true
done
for prefix in "" /ja /zh; do
  echo "$base$prefix/search-index.json" >> "$urls"
  echo "$base$prefix/rss.xml" >> "$urls"
  # /search is noindex, so it is not in the sitemap.
  echo "$base$prefix/search" >> "$urls"
done
echo "$base/404-not-a-page" >> "$urls"

sort -u "$urls" | sed -E "s#^https?://[^/]+#$base#" |
  xargs -P 4 -n 1 curl -sS -A "$ua" "${headers[@]}" -o /dev/null --max-time 30 \
    -w '%{http_code} %header{x-vercel-cache} %{time_total}s %{url}\n' || true
