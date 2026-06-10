#!/usr/bin/env bash
# runs/unbreak.sh — revert the demo bug (or verify the agent's fix).
#
# If the agent fixed it, this is a no-op that says so. If you're
# resetting between takes, it restores the file from git.

set -euo pipefail
cd "$(dirname "$0")/.."

FILE=target/app/signup/page.tsx

if grep -q 'type="submit"' "$FILE"; then
  echo "✓ signup form is healthy (type=\"submit\" present) — nothing to do"
  exit 0
fi

git checkout -- "$FILE"
echo "✓ restored $FILE from git"
