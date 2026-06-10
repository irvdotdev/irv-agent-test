#!/usr/bin/env node
// runs/webhook-receiver.mjs — local receiver for Irv agent webhooks.
//
// Listens for HMAC-signed deliveries from Irv, verifies the signature,
// pretty-prints each event, and appends raw deliveries to
// results/webhook-deliveries.jsonl for later inspection.
//
// Usage:
//   IRV_WEBHOOK_SECRET=whsec_… node runs/webhook-receiver.mjs [port]
//
// Reaching this from prod Irv requires a public URL — Vercel can't
// POST to your laptop's localhost. Two options:
//   cloudflared tunnel --url http://localhost:8787     (no account needed)
//   ngrok http 8787
// Then register the printed public URL:
//   curl -sS -X POST https://irv.dev/api/v1/subscriptions \
//     -H "Authorization: Bearer $IRV_TOKEN" -H "Content-Type: application/json" \
//     -d '{"project_key":"'$IRV_PROJECT_KEY'","url":"https://<tunnel-host>/","events":["insight.critical","anomaly.detected"]}'
// …and export the returned secret as IRV_WEBHOOK_SECRET before starting
// this receiver (or restart it with the secret once you have it).

import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8787);
const SECRET = process.env.IRV_WEBHOOK_SECRET ?? "";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_DIR = join(ROOT, "results");
const LOG_FILE = join(LOG_DIR, "webhook-deliveries.jsonl");

if (!SECRET) {
  console.warn(
    "⚠ IRV_WEBHOOK_SECRET not set — deliveries will be logged but signatures CANNOT be verified.\n" +
      "  Export the whsec_… secret from your subscription-create response and restart.",
  );
}

mkdirSync(LOG_DIR, { recursive: true });

// The exact verification snippet documented at irv.dev/agents §7.9 —
// if this receiver verifies, any receiver built from the docs will.
function verify(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch
  }
}

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("irv webhook receiver — POST deliveries here\n");
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const event = req.headers["x-irv-event"] ?? "(no event header)";
    const delivery = req.headers["x-irv-delivery"] ?? "(no delivery id)";
    const signature = req.headers["x-irv-signature"] ?? "";
    const verified = verify(rawBody, signature, SECRET);

    // ACK fast — the dispatch contract gives us 5s; do nothing slow here.
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');

    let payload = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // keep raw
    }

    const record = {
      received_at: new Date().toISOString(),
      event,
      delivery,
      signature_verified: verified,
      payload: payload ?? rawBody,
    };
    appendFileSync(LOG_FILE, `${JSON.stringify(record)}\n`);

    // Pretty console output — this is what's on screen in the demo.
    const stamp = new Date().toLocaleTimeString();
    const sigMark = SECRET ? (verified ? "✓ signature verified" : "✗ SIGNATURE FAILED") : "– unverified (no secret)";
    console.log(`\n━━━ ${stamp} · ${event} · ${sigMark} ━━━`);
    if (payload?.data) {
      const d = payload.data;
      if (d.card?.title) console.log(`  ${d.severity?.toUpperCase() ?? ""} · ${d.card.title}`);
      if (d.series) console.log(`  ${d.series} ${d.direction === -1 ? "dropped" : "spiked"} — z=${d.z_score?.toFixed?.(1)}`);
      if (d.fingerprint) console.log(`  fingerprint: ${d.fingerprint}`);
      if (d.lovable_prompt) {
        console.log("  ── fix prompt ──");
        console.log(
          String(d.lovable_prompt)
            .split("\n")
            .map((l) => `  │ ${l}`)
            .join("\n"),
        );
        console.log("\n  → hand this to your agent:");
        console.log(
          `    claude "Irv flagged: ${d.card?.title ?? "an issue"}. Apply this fix to the app in ./target, then mark it shipped via POST $IRV_HOST/api/v1/insights/${d.id}/track?project_key=$IRV_PROJECT_KEY&event=shipped&platform=claude-code"`,
        );
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`irv webhook receiver listening on http://localhost:${PORT}`);
  console.log(`deliveries logged to ${LOG_FILE}`);
  console.log(`\nexpose it publicly with ONE of:`);
  console.log(`  cloudflared tunnel --url http://localhost:${PORT}`);
  console.log(`  ngrok http ${PORT}`);
});
