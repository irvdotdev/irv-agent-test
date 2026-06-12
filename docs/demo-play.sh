#!/usr/bin/env bash
# docs/demo-play.sh — the screenplay for the launch video.
#
# Rendered to video by docs/demo.tape (vhs). Every output shown is a
# REAL artifact captured from the live 2026-06-11/12 rehearsal against
# prod irv.dev — real provisions, real HMAC-verified webhook
# deliveries, real project-log entries. The player paces + typesets
# them; it does not invent them. Commands are displayed as typed for
# readability; the artifacts they "produce" are the genuine responses
# those exact commands returned during the rehearsal.
#
# TEASER=1 plays only the webhook money-shot scene (~25s) for the GIF.

set -euo pipefail
cd "$(dirname "$0")"
A=demo-assets

# ---------- typography ----------
DIM=$'\033[2m'; BOLD=$'\033[1m'; GREEN=$'\033[32m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

type_cmd() { # simulated typing of a command line
  printf "%s" "${GREEN}❯ ${RESET}"
  local s="$1"
  for ((i = 0; i < ${#s}; i++)); do
    printf "%s" "${s:$i:1}"
    sleep 0.018
  done
  printf "\n"
  sleep 0.45
}

say() { printf "%s\n" "${DIM}# $1${RESET}"; sleep 0.9; }
show() { sleep 0.3; sed 's/^/  /' "$A/$1"; }
gap() { printf "\n"; sleep "${1:-1.6}"; }
banner() {
  printf "\n%s\n" "${BOLD}${CYAN}── $1 ──────────────────────────────────────${RESET}"
  sleep 1.1
}

scene_wake() {
  banner "4 · IRV NOTICES — AND WAKES THE AGENT"
  say "a webhook subscription is registered; Irv's insight refresh just ran…"
  type_cmd "tail -f results/webhook-deliveries.jsonl   # the agent's doorbell"
  show 05-deliveries.txt
  gap 4
  say "every delivery HMAC-signed (X-Irv-Signature) · content-fingerprinted · zero duplicates"
  gap 2.5
}

if [ "${TEASER:-0}" = "1" ]; then
  printf '\033[2J\033[H'
  printf "\n%s\n\n" "${BOLD}  irv.dev/agents — when your app breaks, your agent already knows${RESET}"
  sleep 2
  scene_wake
  printf "\n%s\n\n" "${BOLD}  → irv.dev/agents${RESET}"
  sleep 8 # tape stops recording mid-hold; see note at the main finale
  exit 0
fi

printf '\033[2J\033[H'
printf "\n\n%s\n" "${BOLD}      THE APP THAT FIXES ITSELF${RESET}"
printf "%s\n\n" "${DIM}      irv.dev × your agent · everything below is a real recording${RESET}"
sleep 3.5

banner "1 · AN AGENT READS ONE URL"
type_cmd "curl -sL irv.dev/agents | head"
show 01-agents-doc.txt
gap 3
say "one markdown fetch: sign-up, integration, every endpoint, the closed-loop recipe"
gap 2

banner "2 · IT PROVISIONS ITSELF — ONE CALL"
type_cmd 'curl -X POST irv.dev/api/v1/agent-beta/provision -H "Authorization: Bearer $BETA_KEY"'
show 02-provision.json
gap 3.5
say "identity + project + API token, no browser, no sign-up form — ~2 seconds"
gap 2

banner "3 · IT INSTRUMENTS THE APP"
say "Claude found the layout, inserted the snippet — this is the agent's actual diff:"
show 03-diff.txt
gap 3.5
type_cmd 'curl irv.dev/api/v1/projects/$ID/events-freshness?since=24h'
show 04-freshness.json
gap 3
say "data confirmed flowing, 2 seconds after the first event"
gap 2

scene_wake

banner "5 · THE AGENT SHIPS THE FIX — AND IRV STARTS THE CLOCK"
say "the payload carried the fix prompt; the agent applied it, then:"
show 06-shipped.txt
gap 4

# Finale gets its own cleared screen — same visual weight as the title
# card, so the video unambiguously ENDS rather than petering out under
# scene 5's scrollback.
printf '\033[2J\033[H'
printf "\n\n\n\n\n\n\n"
printf "%s\n\n" "${BOLD}      Detected by AI.  Fixed by AI.  Proven with statistics.${RESET}"
printf "%s\n" "${CYAN}      → irv.dev/agents${RESET}"
# Long hold: the tape's Sleep ends the recording partway through this,
# so the card is always the final frame (prompt never reappears).
sleep 12
