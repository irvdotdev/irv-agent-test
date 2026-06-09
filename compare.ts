// compare.ts — eyeball-level diff between the most recent codex run
// and the most recent claude run. Same prompt, same target, two agents.
//
// Output is a side-by-side summary table of: pass/fail per check,
// duration, lines-changed in target/. The full diffs are available
// per-run under results/<ts>-<agent>/diff.patch.

import { promises as fs } from "node:fs";
import path from "node:path";

interface Verdict {
  pass: boolean;
  duration_ms: number;
  checks: { name: string; pass: boolean; detail: string }[];
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

async function main() {
  const resultsRoot = path.join(ROOT, "results");
  const dirs = await fs.readdir(resultsRoot, { withFileTypes: true }).catch(() => []);
  const byAgent: Record<string, string[]> = { codex: [], claude: [], manual: [] };
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    if (d.name.endsWith("-codex")) byAgent.codex.push(d.name);
    else if (d.name.endsWith("-claude")) byAgent.claude.push(d.name);
    else if (d.name.endsWith("-manual")) byAgent.manual.push(d.name);
  }

  const latestCodex = byAgent.codex.sort().pop();
  const latestClaude = byAgent.claude.sort().pop();

  if (!latestCodex && !latestClaude) {
    console.log("No codex or claude runs found under results/. Run ./runs/codex.sh first.");
    process.exit(1);
  }

  const [codex, claude] = await Promise.all([
    latestCodex ? loadRun(path.join(resultsRoot, latestCodex)) : null,
    latestClaude ? loadRun(path.join(resultsRoot, latestClaude)) : null,
  ]);

  // Same-prompt headline:
  console.log(`codex:  ${latestCodex ?? "—"}    ${verdictLine(codex?.verdict)}`);
  console.log(`claude: ${latestClaude ?? "—"}    ${verdictLine(claude?.verdict)}`);
  console.log("");

  if (!codex || !claude) {
    console.log(
      codex
        ? "(claude run missing — run ./runs/claude.sh to compare)"
        : "(codex run missing — run ./runs/codex.sh to compare)",
    );
    process.exit(0);
  }

  // Side-by-side check table.
  const checkNames = Array.from(
    new Set([...codex.verdict.checks.map((c) => c.name), ...claude.verdict.checks.map((c) => c.name)]),
  );
  for (const name of checkNames) {
    const c = codex.verdict.checks.find((x) => x.name === name);
    const cl = claude.verdict.checks.find((x) => x.name === name);
    console.log(`${mark(c?.pass)} codex   ${mark(cl?.pass)} claude   ${name}`);
  }
  console.log("");

  // Line-count of the agent's changes.
  console.log(`codex   diff: ${codex.diffLines} lines`);
  console.log(`claude  diff: ${claude.diffLines} lines`);
  console.log("");
  console.log(`Full diffs:`);
  console.log(`  results/${latestCodex}/diff.patch`);
  console.log(`  results/${latestClaude}/diff.patch`);
}

function mark(pass: boolean | undefined): string {
  if (pass === undefined) return "·";
  return pass ? "✓" : "✗";
}

function verdictLine(v: Verdict | undefined): string {
  if (!v) return "(no verdict)";
  const passed = v.checks.filter((c) => c.pass).length;
  return `${v.pass ? "PASS" : "FAIL"} ${passed}/${v.checks.length}  ${v.duration_ms}ms`;
}

async function loadRun(dir: string): Promise<{ verdict: Verdict; diffLines: number } | null> {
  try {
    const [verdictRaw, diffRaw] = await Promise.all([
      fs.readFile(path.join(dir, "verdict.json"), "utf8"),
      fs.readFile(path.join(dir, "diff.patch"), "utf8").catch(() => ""),
    ]);
    return {
      verdict: JSON.parse(verdictRaw) as Verdict,
      diffLines: diffRaw.split("\n").length,
    };
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error("compare.ts crashed:", err);
  process.exit(2);
});
