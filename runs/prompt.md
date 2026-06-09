You are onboarding this Next.js project (in `target/`) to Irv analytics
end-to-end. You have one credential — `IRV_BETA_KEY` — in the environment.
Host: `$IRV_HOST` (defaults to https://irv.dev).

Constraints

- Never echo `IRV_BETA_KEY` or the provisioned PAT to stdout. They are secrets.
- Don't commit `target/.irv-test.json` — it's gitignored by design and contains the PAT.
- Don't add the snippet manually before doing step 1. Provisioning gives you the project key — use the real one.
- Do everything from inside `target/` unless explicitly told otherwise.

Steps

1. **Provision.** POST `$IRV_HOST/api/v1/agent-beta/provision` with
   `Authorization: Bearer $IRV_BETA_KEY` and body
   `{ "agent_name": "<your name>", "project_name": "Irv Demo App" }`.
   The response contains `pat`, `project_id`, `project_key`, `dashboard_url`,
   `snippet_url`, `snippet_html`, and `next_steps`.

   **Save the response** to `target/.irv-test.json` so the verify step can
   read what you got. Use the exact shape returned. Treat the `pat` as a
   secret — do not log it.

2. **Verify the token.** `GET $IRV_HOST/api/v1/me` with `Authorization: Bearer <pat>`.
   Confirm the response includes `scopes: ["read","write"]` and a project whose
   `project_key` matches what step 1 returned. Halt with an error if it doesn't.

3. **Insert the snippet.** Open `target/app/layout.tsx`. Inside the existing
   `<head>` element add exactly:

       <script async src="$IRV_HOST/i.js?p=<project_key>" />

   Replace `<project_key>` with the actual `pk_...` value from step 1.
   Replace `$IRV_HOST` with the actual host. Use JSX syntax.

4. **Fire a test event.** You have two choices — pick one:
    - (a) Start the Next.js dev server (`pnpm dev` inside `target/`), open
      `http://localhost:5173/signup`, fill the email field, submit. The
      autocapture snippet records the page view + form submit.
    - (b) Send the test event directly with a POST to `$IRV_HOST/api/v1/ingest`:

          curl -sS -X POST "$IRV_HOST/api/v1/ingest" \
            -H "Content-Type: application/json" \
            -d "{\"events\":[{\"project_key\":\"<pk>\",\"event\":\"agent_smoke\",\"timestamp\":$(date +%s%3N),\"distinct_id\":\"agent\",\"session_id\":\"agent-s1\",\"properties\":{\"agent\":\"<your name>\"}}]}"

   Path (b) is simpler if running a dev server is awkward in your environment.

5. **Verify events landed.** Poll `GET $IRV_HOST/api/v1/projects/<project_id>/events-freshness?since=2m`
   with `Authorization: Bearer <pat>` every 2 seconds for up to 30 seconds.
   Stop as soon as the response shows `count >= 1`.

6. **Report.** Print:
    - `dashboard_url` (so the user can open it)
    - `count` + `last_event_at` + `last_event_name` from the freshness response
    - A one-sentence summary of what you instrumented

If anything errors, debug and retry — but never start over from scratch
(don't provision a second identity). The whole point is to make this work
end-to-end on one run.
