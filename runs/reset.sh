#!/usr/bin/env bash
# Reset the target/ app back to its pristine baseline so the next agent
# run starts fresh. Drops:
#   - any Irv snippet the agent inserted into layout.tsx
#   - the captured PAT / project metadata in target/.irv-test.json
#   - any node_modules-y junk that might have leaked outside target/
#
# Leaves target/node_modules alone (slow to reinstall).

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Restore layout.tsx from the baseline copy. We keep the baseline
#    next to the working copy so the reset is a trivial copy operation,
#    not a git reset (the harness doesn't assume the user has a clean
#    git working tree).
if [ -f runs/baseline-layout.tsx ]; then
  cp runs/baseline-layout.tsx target/app/layout.tsx
  echo "✓ Restored target/app/layout.tsx from baseline"
else
  echo "⚠ runs/baseline-layout.tsx not found — first reset?"
  cp target/app/layout.tsx runs/baseline-layout.tsx
  echo "✓ Saved current layout.tsx as the baseline. Re-run reset.sh next time."
fi

# 2. Drop the captured PAT / project metadata.
rm -f target/.irv-test.json
echo "✓ Removed target/.irv-test.json (if present)"

# 3. Drop any agent-created files in target/ root that aren't supposed
#    to be there. Whitelist what we keep; anything else gets nuked.
KEEP=(
  "app"
  "public"
  "node_modules"
  ".next"
  "package.json"
  "tsconfig.json"
  "next-env.d.ts"
  "next.config.mjs"
  ".gitignore"
)
shopt -s nullglob dotglob
for entry in target/*; do
  base=$(basename "$entry")
  keep=0
  for k in "${KEEP[@]}"; do
    if [ "$base" = "$k" ]; then keep=1; break; fi
  done
  if [ $keep -eq 0 ]; then
    rm -rf "$entry"
    echo "  · removed unexpected target/$base"
  fi
done

echo ""
echo "Ready for the next agent run."
