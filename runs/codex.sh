#!/usr/bin/env bash
# Invoke Codex CLI with the canonical prompt. Captures stdout + stderr
# to results/<timestamp>-codex/transcript.txt and a git-style patch of
# what the agent changed.
#
# Requires:
#   - Codex CLI installed (`npm install -g @openai/codex` or equivalent)
#   - $IRV_BETA_KEY in env
#   - optional $IRV_HOST (defaults to https://irv.dev)

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${IRV_BETA_KEY:-}" ]; then
  echo "✗ IRV_BETA_KEY not set."
  echo "  Mint one at \$IRV_HOST/app/admin/agent-beta and export it first."
  exit 1
fi
export IRV_HOST="${IRV_HOST:-https://irv.dev}"

if ! command -v codex >/dev/null 2>&1; then
  echo "✗ codex CLI not found in PATH."
  echo "  Install with: npm install -g @openai/codex   (or the current OpenAI Codex CLI package)"
  exit 1
fi

TS=$(date -u +"%Y-%m-%dT%H-%M")
RUN_DIR="results/${TS}-codex"
mkdir -p "$RUN_DIR"

# Snapshot target/ BEFORE the run so we can diff afterwards.
SNAP_BEFORE=$(mktemp -d)
cp -r target/app "$SNAP_BEFORE/"

echo "→ Running Codex with the canonical prompt (results/${TS}-codex/)"
PROMPT="$(cat runs/prompt.md)"

# Codex CLI takes a prompt — flags vary by version. We use stdin to be
# version-independent. cwd is the target/ dir so the agent's relative
# file edits land in the right place.
(
  cd target
  IRV_BETA_KEY="$IRV_BETA_KEY" IRV_HOST="$IRV_HOST" codex --quiet exec "$PROMPT" 2>&1
) | tee "$RUN_DIR/transcript.txt"

# Snapshot after; diff the two.
diff -ruN "$SNAP_BEFORE/app" target/app > "$RUN_DIR/diff.patch" || true
rm -rf "$SNAP_BEFORE"

# Capture the agent's saved metadata (with PAT redacted in the copy).
if [ -f target/.irv-test.json ]; then
  cp target/.irv-test.json "$RUN_DIR/irv-test.json"
  # Redact the PAT in the saved copy — the real PAT stays in
  # target/.irv-test.json for verify.ts to use, but the results dir
  # ends up shared / inspected, so we don't keep secrets there.
  if command -v jq >/dev/null 2>&1; then
    jq '.pat = "<redacted>"' "$RUN_DIR/irv-test.json" > "$RUN_DIR/irv-test.json.tmp" \
      && mv "$RUN_DIR/irv-test.json.tmp" "$RUN_DIR/irv-test.json"
  fi
fi

echo ""
echo "✓ Codex run captured at $RUN_DIR/"
echo "  · transcript.txt"
echo "  · diff.patch"
[ -f "$RUN_DIR/irv-test.json" ] && echo "  · irv-test.json (PAT redacted)"
echo ""
echo "Next: pnpm verify"
