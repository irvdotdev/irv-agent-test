// verify.ts — black-box post-run assertions.
//
// Reads target/.irv-test.json (the bundle the agent saved from its
// provisioning call), hits Irv's live API to confirm the token works
// and events landed, and inspects target/app/layout.tsx to confirm
// the snippet was inserted correctly.
//
// Writes the verdict to the most recent results/<timestamp>-<agent>/
// directory so each run has its own pass/fail record.

import { promises as fs } from "node:fs";
import path from "node:path";

interface CapturedBundle {
  pat: string;
  project_id: string;
  project_key: string;
  project_name?: string;
  dashboard_url?: string;
  snippet_url?: string;
}

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

interface Verdict {
  pass: boolean;
  duration_ms: number;
  host: string;
  project_id: string | null;
  project_key: string | null;
  dashboard_url: string | null;
  checks: CheckResult[];
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const HOST = (process.env.IRV_HOST ?? "https://irv.dev").replace(/\/$/, "");

async function main() {
  const started = Date.now();
  const checks: CheckResult[] = [];

  // ---- Load the captured bundle ----
  const bundlePath = path.join(ROOT, "target", ".irv-test.json");
  let bundle: CapturedBundle | null = null;
  try {
    const raw = await fs.readFile(bundlePath, "utf8");
    bundle = JSON.parse(raw) as CapturedBundle;
    checks.push({
      name: "bundle: target/.irv-test.json exists + parses",
      pass: true,
      detail: `project_id=${bundle.project_id} project_key=${bundle.project_key}`,
    });
  } catch (err) {
    checks.push({
      name: "bundle: target/.irv-test.json exists + parses",
      pass: false,
      detail: `not found or invalid JSON — did the agent save it? (${(err as Error).message})`,
    });
    return writeVerdict(checks, started, null);
  }

  const { pat, project_id, project_key } = bundle;

  // ---- Token works ----
  try {
    const res = await fetch(`${HOST}/api/v1/me`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) {
      checks.push({
        name: "PAT: GET /api/v1/me with the captured PAT",
        pass: false,
        detail: `status ${res.status} — PAT may be invalid or revoked`,
      });
    } else {
      const me = (await res.json()) as {
        auth?: { scopes?: string[] };
        projects?: { id: string; key: string }[];
      };
      const scopes = me.auth?.scopes ?? [];
      const hasProject = (me.projects ?? []).some(
        (p) => p.id === project_id && p.key === project_key,
      );
      checks.push({
        name: "PAT: scopes include read+write",
        pass: scopes.includes("read") && scopes.includes("write"),
        detail: `granted: [${scopes.join(", ")}]`,
      });
      checks.push({
        name: "PAT: project from bundle is listed under /api/v1/me",
        pass: hasProject,
        detail: hasProject
          ? `${project_id} found`
          : `expected ${project_id}; saw [${(me.projects ?? []).map((p) => p.id).join(", ")}]`,
      });
    }
  } catch (err) {
    checks.push({
      name: "PAT: GET /api/v1/me with the captured PAT",
      pass: false,
      detail: `network error: ${(err as Error).message}`,
    });
  }

  // ---- Snippet inserted into layout.tsx ----
  const layoutPath = path.join(ROOT, "target", "app", "layout.tsx");
  try {
    const src = await fs.readFile(layoutPath, "utf8");
    // We look for the i.js script tag with the captured project_key.
    // Accept either single or double quotes; tolerate self-closing or
    // explicit </script> form; allow any host (so a wrong host still
    // shows up as a fail with the actual URL surfaced).
    const re = new RegExp(`i\\.js\\?p=${escapeRegExp(project_key)}`);
    const has = re.test(src);
    // Surface the snippet line so the verdict shows what's there.
    const snippetLineMatch = src.match(/<script[^>]*irv[^>]*\/?>/);
    checks.push({
      name: `snippet: layout.tsx contains i.js?p=${project_key}`,
      pass: has,
      detail: has
        ? snippetLineMatch?.[0] ?? "found"
        : snippetLineMatch
          ? `wrong project_key — saw ${snippetLineMatch[0]}`
          : "no <script ...irv... > tag in layout.tsx",
    });
  } catch (err) {
    checks.push({
      name: "snippet: layout.tsx readable",
      pass: false,
      detail: `couldn't read layout.tsx: ${(err as Error).message}`,
    });
  }

  // ---- Events landed ----
  try {
    const url = `${HOST}/api/v1/projects/${project_id}/events-freshness?since=10m`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) {
      checks.push({
        name: "freshness: GET /events-freshness returns 200",
        pass: false,
        detail: `status ${res.status}`,
      });
    } else {
      const freshness = (await res.json()) as {
        count: number;
        last_event_at: string | null;
        last_event_name: string | null;
      };
      checks.push({
        name: "freshness: at least one event in the last 10 minutes",
        pass: freshness.count >= 1,
        detail:
          freshness.count >= 1
            ? `count=${freshness.count} last=${freshness.last_event_name} @ ${freshness.last_event_at}`
            : "count=0 — the snippet may not be firing, or the dev server isn't running",
      });
    }
  } catch (err) {
    checks.push({
      name: "freshness: GET /events-freshness",
      pass: false,
      detail: `network error: ${(err as Error).message}`,
    });
  }

  // ---- No secret leakage ----
  // The PAT is allowed to live in target/.irv-test.json (gitignored).
  // The beta key should NOT appear anywhere in target/ or results/.
  const leakRoots = ["target", "results"];
  let leaks: string[] = [];
  for (const root of leakRoots) {
    leaks = leaks.concat(await findLeaks(path.join(ROOT, root)));
  }
  checks.push({
    name: "secrets: no bk_… anywhere in target/ or results/",
    pass: leaks.length === 0,
    detail: leaks.length === 0 ? "clean" : `LEAK in: ${leaks.join(", ")}`,
  });

  await writeVerdict(checks, started, bundle);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recursively grep for the beta-key prefix. Returns paths where it
 *  was found. Doesn't follow symlinks; skips node_modules + .next.
 *
 *  Note on the explicit `encoding: "utf8"` on readdir: without it, newer
 *  @types/node typings the returned Dirent's `name` as `Buffer` for
 *  forward-compat. Pinning the encoding here gives us a `Dirent<string>`
 *  so the equality checks below typecheck. */
async function findLeaks(root: string): Promise<string[]> {
  const out: string[] = [];
  type StringDirent = { name: string; isDirectory: () => boolean; isFile: () => boolean };
  let entries: StringDirent[];
  try {
    entries = (await fs.readdir(root, {
      withFileTypes: true,
      encoding: "utf8",
    })) as unknown as StringDirent[];
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === ".git") continue;
    const p = path.join(root, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await findLeaks(p)));
    } else if (ent.isFile()) {
      // Skip enormous binaries — only scan files <512KB.
      const stat = await fs.stat(p);
      if (stat.size > 512 * 1024) continue;
      try {
        const buf = await fs.readFile(p, { encoding: "utf8" });
        if (/\bbk_[0-9a-f]{32}\b/.test(buf)) {
          out.push(path.relative(ROOT, p));
        }
      } catch {
        // unreadable / non-UTF8 — skip
      }
    }
  }
  return out;
}

async function writeVerdict(
  checks: CheckResult[],
  started: number,
  bundle: CapturedBundle | null,
): Promise<void> {
  const pass = checks.every((c) => c.pass);
  const verdict: Verdict = {
    pass,
    duration_ms: Date.now() - started,
    host: HOST,
    project_id: bundle?.project_id ?? null,
    project_key: bundle?.project_key ?? null,
    dashboard_url: bundle?.dashboard_url ?? null,
    checks,
  };

  // Latest results dir → write verdict.json inside.
  const resultsRoot = path.join(ROOT, "results");
  try {
    const dirs = (await fs.readdir(resultsRoot, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    if (dirs.length > 0) {
      const target = path.join(resultsRoot, dirs[0], "verdict.json");
      await fs.writeFile(target, JSON.stringify(verdict, null, 2));
      console.log(`Wrote ${path.relative(ROOT, target)}`);
    }
  } catch {
    // results dir might not exist yet — skip
  }

  // Pretty-print to stdout.
  console.log("");
  console.log(`Host:       ${HOST}`);
  if (bundle?.project_id) console.log(`Project:    ${bundle.project_id} (${bundle.project_key})`);
  if (bundle?.dashboard_url) console.log(`Dashboard:  ${bundle.dashboard_url}`);
  console.log("");
  for (const c of checks) {
    console.log(`${c.pass ? "✓" : "✗"} ${c.name}`);
    console.log(`    ${c.detail}`);
  }
  console.log("");
  console.log(pass ? "✓ PASS" : "✗ FAIL");
  console.log(`(${verdict.duration_ms}ms)`);

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("verify.ts crashed:", err);
  process.exit(2);
});
