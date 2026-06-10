#!/usr/bin/env node
// runs/traffic.mjs — synthetic traffic for the demo project.
//
// Fires a realistic-looking event stream at Irv's ingest endpoint:
// visitors land, view pages, and a fraction complete signup. The
// --broken flag simulates the demo's "someone shipped a bug" moment:
// pageviews keep flowing but signups flatline — exactly the shape
// Irv's drop-off detection looks for.
//
// Usage:
//   IRV_HOST=https://irv.dev IRV_PROJECT_KEY=pk_… node runs/traffic.mjs            # healthy traffic
//   IRV_HOST=https://irv.dev IRV_PROJECT_KEY=pk_… node runs/traffic.mjs --broken   # signups flatline
//   … --minutes 10 --rate 6        # duration + events-per-minute knobs
//
// Ingest is project-key authenticated — no PAT needed (same as the
// browser snippet). Ctrl-C to stop early.

const HOST = (process.env.IRV_HOST ?? "https://irv.dev").replace(/\/$/, "");
const PK = process.env.IRV_PROJECT_KEY ?? "";
if (!PK) {
  console.error("✗ IRV_PROJECT_KEY not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const BROKEN = args.includes("--broken");
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
const MINUTES = num("--minutes", 5);
const PER_MINUTE = num("--rate", 12);

const PAGES = ["/", "/", "/", "/pricing", "/signup", "/signup", "/docs"];
const REFERRERS = ["https://google.com", "https://news.ycombinator.com", "", "", ""];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function send(events) {
  const res = await fetch(`${HOST}/api/v1/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) console.error(`  ingest ${res.status}`);
  return res.ok;
}

function visitorSession() {
  // One synthetic visitor: 1-3 pageviews, then (when healthy) a 30%
  // chance of completing signup. When --broken, the signup NEVER
  // completes — the page still gets viewed (the visitor tried), the
  // conversion event just never fires. That asymmetry (views steady,
  // conversions gone) is the signal Irv keys on.
  const visitor = `demo-${Math.random().toString(36).slice(2, 10)}`;
  const session = `s-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const events = [];
  const pageCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < pageCount; i++) {
    events.push({
      project_key: PK,
      event: "$pageview",
      timestamp: now + i * 1500,
      distinct_id: visitor,
      session_id: session,
      properties: { $url: pick(PAGES), $referrer: pick(REFERRERS) },
    });
  }
  const wantsSignup = Math.random() < 0.3;
  if (wantsSignup) {
    events.push({
      project_key: PK,
      event: "$pageview",
      timestamp: now + pageCount * 1500,
      distinct_id: visitor,
      session_id: session,
      properties: { $url: "/signup" },
    });
    if (!BROKEN) {
      events.push({
        project_key: PK,
        event: "signup_completed",
        timestamp: now + pageCount * 1500 + 2000,
        distinct_id: visitor,
        session_id: session,
        properties: { plan: pick(["free", "free", "pro"]) },
      });
    }
  }
  return events;
}

console.log(
  `${BROKEN ? "🔴 BROKEN" : "🟢 healthy"} traffic → ${HOST} (${PK}) · ${PER_MINUTE}/min for ${MINUTES} min`,
);

let sent = 0;
const interval = setInterval(
  async () => {
    const events = visitorSession();
    if (await send(events)) {
      sent += events.length;
      process.stdout.write(
        `\r  ${sent} events sent${BROKEN ? " (signups suppressed)" : ""}        `,
      );
    }
  },
  Math.max(500, 60_000 / PER_MINUTE),
);

setTimeout(
  () => {
    clearInterval(interval);
    console.log(`\n✓ done — ${sent} events total`);
    process.exit(0);
  },
  MINUTES * 60_000,
);
