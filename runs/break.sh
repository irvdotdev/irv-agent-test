#!/usr/bin/env bash
# runs/break.sh — introduce the demo bug.
#
# Changes the signup form's submit button from type="submit" to
# type="button" — the classic silent breakage: the page renders
# perfectly, the button clicks, nothing happens. Pageviews keep
# flowing; signup_completed flatlines. Irv notices the asymmetry.
#
# This is deliberately a ONE-TOKEN diff: realistic (refactors do this
# constantly), invisible to the eye, and findable by an agent reading
# the code — which is the point of the demo. Revert with unbreak.sh.

set -euo pipefail
cd "$(dirname "$0")/.."

FILE=target/app/signup/page.tsx

if grep -q 'type="button"' "$FILE"; then
  echo "already broken — signup submit is type=\"button\""
  exit 0
fi

# macOS + GNU sed compatible in-place edit.
perl -i -pe 's/type="submit"/type="button"/' "$FILE"

if grep -q 'type="button"' "$FILE"; then
  echo "💥 broke it: signup submit button is now type=\"button\" (form never submits)"
  echo "   run healthy traffic with --broken to match:  node runs/traffic.mjs --broken"
  echo "   revert: ./runs/unbreak.sh"
else
  echo "✗ couldn't apply the break — check $FILE manually"
  exit 1
fi
