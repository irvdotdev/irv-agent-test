#!/usr/bin/env bash
# Pure-curl manual recipe. No agent. If this passes but codex.sh /
# claude.sh fails, the issue is agent prompting; if this fails too,
# the issue is on Irv's side (or your network / beta key).
#
# Idempotent-ish: a fresh provision each run (each call mints a new
# synthetic agent identity), so re-running just stacks more projects
# you can revoke later. Captures everything into a results/<ts>-manual/
# dir like the agent scripts do.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${IRV_BETA_KEY:-}" ]; then
  echo "✗ IRV_BETA_KEY not set."
  exit 1
fi
export IRV_HOST="${IRV_HOST:-https://irv.dev}"

TS=$(date -u +"%Y-%m-%dT%H-%M")
RUN_DIR="results/${TS}-manual"
mkdir -p "$RUN_DIR"
exec > >(tee "$RUN_DIR/transcript.txt") 2>&1

echo "Host:           $IRV_HOST"
echo "Run dir:        $RUN_DIR"
echo ""

# --- 1. Provision ---
echo "[1/5] Provisioning..."
PROVISION_JSON=$(curl -sSL -X POST "$IRV_HOST/api/v1/agent-beta/provision" \
  -H "Authorization: Bearer $IRV_BETA_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"manual-smoke","project_name":"Manual Smoke"}')

if ! command -v jq >/dev/null 2>&1; then
  echo "✗ jq not installed. Install jq to parse the provisioning response."
  exit 1
fi

PAT=$(echo "$PROVISION_JSON" | jq -r .pat)
PROJECT_ID=$(echo "$PROVISION_JSON" | jq -r .project_id)
PROJECT_KEY=$(echo "$PROVISION_JSON" | jq -r .project_key)
DASHBOARD_URL=$(echo "$PROVISION_JSON" | jq -r .dashboard_url)

if [ "$PAT" = "null" ] || [ -z "$PAT" ]; then
  echo "✗ provision failed. Response:"
  echo "$PROVISION_JSON" | jq .
  exit 1
fi

# Save metadata to target/ and the run dir.
echo "$PROVISION_JSON" > target/.irv-test.json
echo "$PROVISION_JSON" | jq '.pat = "<redacted>"' > "$RUN_DIR/irv-test.json"

echo "  ✓ project_id:   $PROJECT_ID"
echo "  ✓ project_key:  $PROJECT_KEY"
echo "  ✓ dashboard:    $DASHBOARD_URL"
echo ""

# --- 2. Verify token ---
echo "[2/5] Verifying token..."
ME=$(curl -sSL "$IRV_HOST/api/v1/me" -H "Authorization: Bearer $PAT")
SCOPES=$(echo "$ME" | jq -r '.auth.scopes | join(",")')
echo "  ✓ scopes: $SCOPES"
echo ""

# --- 3. Insert the snippet ---
echo "[3/5] Inserting snippet into target/app/layout.tsx..."
SNIPPET="        <script async src=\"$IRV_HOST/i.js?p=$PROJECT_KEY\" />"
# Replace the comment-only <head>{ ... }</head> block with one that
# contains the snippet. Idempotent: if a snippet is already present we
# don't double-insert.
if grep -qE "i\.js\?p=pk_" target/app/layout.tsx; then
  echo "  · snippet already present — skipping insert"
else
  # Use perl for portable multi-line edit. Inserts just inside the
  # opening <head> tag.
  perl -i -pe "s|<head>|<head>\n${SNIPPET}|" target/app/layout.tsx
  echo "  ✓ inserted snippet for $PROJECT_KEY"
fi
echo ""

# --- 4. Fire a test event (direct ingest path, no dev server) ---
echo "[4/5] Firing test event..."
TS_MS=$(node -e "process.stdout.write(Date.now().toString())")
INGEST_BODY=$(jq -n \
  --arg pk "$PROJECT_KEY" \
  --arg ts "$TS_MS" \
  '{events:[{project_key:$pk, event:"manual_smoke", timestamp:($ts|tonumber), distinct_id:"manual", session_id:"manual-s1", properties:{source:"manual.sh"}}]}')
curl -sSL -X POST "$IRV_HOST/api/v1/ingest" \
  -H "Content-Type: application/json" -d "$INGEST_BODY" > /dev/null
echo "  ✓ event sent: manual_smoke"
echo ""

# --- 5. Verify it landed ---
echo "[5/5] Polling freshness..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  FRESH=$(curl -sSL "$IRV_HOST/api/v1/projects/$PROJECT_ID/events-freshness?since=2m" \
    -H "Authorization: Bearer $PAT")
  COUNT=$(echo "$FRESH" | jq -r .count)
  if [ "$COUNT" -ge 1 ] 2>/dev/null; then
    LAST=$(echo "$FRESH" | jq -r .last_event_at)
    NAME=$(echo "$FRESH" | jq -r .last_event_name)
    echo "  ✓ count=$COUNT  last=$LAST  event=$NAME"
    echo ""
    echo "✓ Manual recipe end-to-end: PASS"
    echo "  Dashboard: $DASHBOARD_URL"
    exit 0
  fi
  echo "  · attempt $i: count=$COUNT (still polling)"
done

echo ""
echo "✗ Manual recipe: FAIL — no events landed within 20s"
echo "  Run: curl '$IRV_HOST/api/v1/projects/$PROJECT_ID/events-freshness' \\"
echo "         -H 'Authorization: Bearer <pat from .irv-test.json>' | jq"
exit 1
