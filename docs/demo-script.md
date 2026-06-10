# Demo script — "The app that fixes itself"

> The launch-post video. ~3 minutes final cut. Everything on screen is real: real API, real webhook, real agent, real measured outcome. No mocks.

## The one-sentence pitch

**Watch an app break, watch the AI analyst catch it, watch an agent fix it — and watch the analytics prove the fix worked.**

## Pre-production checklist

- [ ] Beta key minted at `irv.dev/app/admin/agent-beta` (label: `demo-video`)
- [ ] `cloudflared` or `ngrok` installed (`brew install cloudflared`)
- [ ] Codex CLI and/or Claude CLI installed + authed
- [ ] Terminal theme: large font, dark, minimal prompt (the receiver's output is a star of the show)
- [ ] Browser windows pre-arranged: demo app (localhost:5173) · Irv dashboard · terminal
- [ ] Run the WHOLE flow once off-camera. Timing of the insight refresh is the one nondeterministic beat — know your latency before filming.

## Scene 0 — Setup (off-camera)

```bash
cd irv-agent-test
export IRV_BETA_KEY=bk_…
export IRV_HOST=https://irv.dev

# Provision + instrument (or let the agent do it on camera — see Variant B)
./runs/manual.sh                      # → captures PAT/project into target/.irv-test.json
export IRV_TOKEN=$(jq -r .pat target/.irv-test.json)
export IRV_PROJECT_ID=$(jq -r .project_id target/.irv-test.json)
export IRV_PROJECT_KEY=$(jq -r .project_key target/.irv-test.json)

# Baseline: ~15 min of healthy traffic so the dashboard has a "before"
node runs/traffic.mjs --minutes 15 --rate 20

# Refresh insights once so the baseline is the LLM's reference point
curl -sS -X POST "$IRV_HOST/api/v1/insights/refresh?project_key=$IRV_PROJECT_KEY" \
  -H "Authorization: Bearer $IRV_TOKEN" | jq '.insights | length'
```

## Scene 1 — "This is a normal app" (0:00–0:20)

- Demo app on screen: landing page → click Sign up → form works.
- Cut to Irv dashboard: visitors flowing, signups counting up.
- VO: *"This is a demo app instrumented with Irv — one script tag. Signups are healthy."*

## Scene 2 — Subscribe the agent (0:20–0:45)

Terminal, three commands, on camera:

```bash
# 1. Tunnel
cloudflared tunnel --url http://localhost:8787
# → prints https://<random>.trycloudflare.com

# 2. Subscribe Irv to wake the agent
curl -sS -X POST "$IRV_HOST/api/v1/subscriptions" \
  -H "Authorization: Bearer $IRV_TOKEN" -H "Content-Type: application/json" \
  -d '{"project_key":"'$IRV_PROJECT_KEY'","url":"https://<random>.trycloudflare.com/","events":["insight.critical","insight.created"]}'
# → { id, secret: "whsec_…" }   ← copy the secret

# 3. Start the receiver
IRV_WEBHOOK_SECRET=whsec_… node runs/webhook-receiver.mjs
# → "irv webhook receiver listening…"
```

VO: *"I've registered a webhook. When Irv finds something critical, it won't wait for anyone to check a dashboard — it calls my agent."*

## Scene 3 — The break (0:45–1:10)

```bash
./runs/break.sh
# 💥 broke it: signup submit button is now type="button"
git -C . diff target/app/signup/page.tsx     # show the one-token diff
```

- Cut to the app: click Sign up → **nothing happens.** Page looks perfect.
- VO: *"One token. type submit became type button. The page renders, the button clicks, nothing submits. No error, no crash — the bug every refactor ships eventually."*
- Start broken traffic in a background pane:

```bash
node runs/traffic.mjs --broken --minutes 15 --rate 20
```

## Scene 4 — Irv notices (1:10–1:40)

```bash
curl -sS -X POST "$IRV_HOST/api/v1/insights/refresh?project_key=$IRV_PROJECT_KEY" \
  -H "Authorization: Bearer $IRV_TOKEN" > /dev/null
```

(In production this fires on the daily cadence or any dashboard visit; for the video we trigger it.)

**The money shot**: the receiver pane lights up —

```
━━━ 14:22:31 · insight.critical · ✓ signature verified ━━━
  CRITICAL · Signups collapsed: /signup pageviews steady, conversions at zero
  fingerprint: a1b2c3d4e5f60718
  ── fix prompt ──
  │ The signup form on /signup is receiving traffic but producing
  │ zero signup_completed events since ~14:05 …
```

VO: *"Irv compared the traffic shape, saw views steady and conversions flatlined, wrote up the diagnosis — and woke my agent. Signed payload, verified."*

## Scene 5 — The agent fixes it (1:40–2:30)

Paste the receiver's suggested command (or have the agent already watching the log):

```bash
claude "Irv flagged: signups collapsed — /signup gets traffic but zero conversions.
Investigate the app in ./target, find the bug, fix it, then mark the insight shipped:
POST $IRV_HOST/api/v1/insights/<id>/track?project_key=$IRV_PROJECT_KEY&event=shipped&platform=claude-code"
```

On camera: the agent greps the signup page, spots `type="button"`, explains why that kills submission, makes the one-token fix, shows the diff, calls mark-shipped.

- Confirm: `./runs/unbreak.sh` → *"✓ signup form is healthy — nothing to do"* (the agent already fixed it — this beat lands well)
- Cut to app: click Sign up → **works again.**
- Restart healthy traffic: `node runs/traffic.mjs --minutes 15 --rate 20`

## Scene 6 — The proof (2:30–3:00)

- Irv dashboard: signups recovering on the chart.
- The outcomes panel: the shipped fix listed, outcome clock running.
- For the final frame, show a pre-baked completed outcome (from the off-camera rehearsal run a week earlier):

```
✓ Signup conversion fix · shipped via claude-code · day-7: +38% · was_improvement: true
```

VO: *"And this is the part nobody else has. Irv doesn't just detect and fix — it measures. Seven days later: signups up 38%, confidence interval excludes zero. The loop is closed: detected by AI, fixed by AI, **proven** with statistics."*

End card: **irv.dev/agents — point your agent at it.**

## Variant B (longer cut): the agent onboards itself first

Open with Scene 0 ON camera: `codex "Visit irv.dev/agents and onboard this app"` — the agent provisions, instruments, verifies, all autonomously (~90 extra seconds). Stronger for a technical audience; the short cut is better for the feed.

## Known risks + mitigations

| Risk | Mitigation |
|---|---|
| Insight refresh doesn't produce a critical drop-off insight from synthetic traffic | Rehearse off-camera; tune traffic volume/duration until reliable. The asymmetry (views steady, conversions zero) is the strongest signal we can feed it. If severity lands at `warn`, subscribe to `insight.created` too (we do, above). |
| LLM phrasing of the insight varies between takes | It always will — that's fine, it's real. Pick the take with the best wording. |
| Tunnel URL changes between takes | Recreate the subscription each take (delete + create is two curls). |
| Day-7 outcome can't happen inside one video | Pre-bake it: run the full loop a week before filming so a completed outcome exists for Scene 6. |
