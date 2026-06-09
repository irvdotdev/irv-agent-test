#!/usr/bin/env bash
# Invoke Claude CLI with the canonical prompt. Mirror image of codex.sh
# so results are directly comparable.
#
# Requires:
#   - Claude CLI installed (`npm install -g @anthropic-ai/claude-code` or
#     equivalent — the package name has shifted; use whatever's current)
#   - $IRV_BETA_KEY in env
#   - optional $IRV_HOST (defaults to https://irv.dev)
#
# NOTE on autonomy
#   This script runs Claude with normal permission gates — you'll see
#   approval prompts for shell commands + file edits, same as a normal
#   `claude` session. That's intentional: full-autonomous mode would
#   let an agent run arbitrary commands without you watching, which
#   isn't worth the speed bump for a 5-minute test run.
#
#   If you want fully unattended runs anyway, append
#   `--dangerously-skip-permissions` to the claude invocation below.
#   You're opting into that, not the harness.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${IRV_BETA_KEY:-}" ]; then
  echo "✗ IRV_BETA_KEY not set."
  echo "  Mint one at \$IRV_HOST/app/admin/agent-beta and export it first."
  exit 1
fi
export IRV_HOST="${IRV_HOST:-https://irv.dev}"

# Find the Claude CLI binary. The name has churned (`claude` /
# `claude-code` / `anthropic-claude`); try the common ones.
CLAUDE_BIN=""
for cand in claude claude-code anthropic-claude; do
  if command -v "$cand" >/dev/null 2>&1; then
    CLAUDE_BIN="$cand"
    break
  fi
done
if [ -z "$CLAUDE_BIN" ]; then
  echo "✗ Claude CLI not found in PATH (tried: claude, claude-code, anthropic-claude)."
  echo "  Install with: npm install -g @anthropic-ai/claude-code   (or current package)"
  exit 1
fi

TS=$(date -u +"%Y-%m-%dT%H-%M")
RUN_DIR="results/${TS}-claude"
mkdir -p "$RUN_DIR"

SNAP_BEFORE=$(mktemp -d)
cp -r target/app "$SNAP_BEFORE/"

echo "→ Running $CLAUDE_BIN with the canonical prompt (results/${TS}-claude/)"
echo "  You'll see permission prompts; approve to let the agent proceed."
PROMPT="$(cat runs/prompt.md)"

# `--print` runs a single non-interactive turn and exits. Approval
# prompts still surface; that's the intent (see note at the top).
(
  cd target
  echo "$PROMPT" | IRV_BETA_KEY="$IRV_BETA_KEY" IRV_HOST="$IRV_HOST" \
    "$CLAUDE_BIN" --print 2>&1
) | tee "$RUN_DIR/transcript.txt"

diff -ruN "$SNAP_BEFORE/app" target/app > "$RUN_DIR/diff.patch" || true
rm -rf "$SNAP_BEFORE"

if [ -f target/.irv-test.json ]; then
  cp target/.irv-test.json "$RUN_DIR/irv-test.json"
  if command -v jq >/dev/null 2>&1; then
    jq '.pat = "<redacted>"' "$RUN_DIR/irv-test.json" > "$RUN_DIR/irv-test.json.tmp" \
      && mv "$RUN_DIR/irv-test.json.tmp" "$RUN_DIR/irv-test.json"
  fi
fi

echo ""
echo "✓ Claude run captured at $RUN_DIR/"
echo "  · transcript.txt"
echo "  · diff.patch"
[ -f "$RUN_DIR/irv-test.json" ] && echo "  · irv-test.json (PAT redacted)"
echo ""
echo "Next: pnpm verify"
