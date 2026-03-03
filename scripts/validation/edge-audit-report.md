Edge Function Audit Report
=========================

Date: 2026-03-03
Repo path: supabase/functions/

Summary of quick findings (automated + manual):

- Functions discovered (Deno.serve present):
  - auto-link-student (webhook) — has secret validation (AUTH_HOOK_SECRET or SUPABASE_AUTH_HOOK_SECRET) and returns 500 if missing.
  - invite-link — public redirect endpoint (intentionally `verify_jwt = false` in config).
  - students-import — server function using SUPABASE_SERVICE_ROLE_KEY.
  - revoke-student-access, send-push, rules-sync-admin, rules-sync, link-metadata, kb_ingest, assistant, create-student-invite, claim-student-invite, claim-trainer-invite — present and Deno.serve-based.

- `supabase/config.toml` shows 8 functions with `verify_jwt = true` and 2 functions (`auto-link-student`, `invite-link`) set to `false` (intended).

- Service role key usage: `SUPABASE_SERVICE_ROLE_KEY` is used only inside server functions and scripts (good). No client-side leakage found in `app/` or `src/` (grep scan limited to repository files).

- Quick code-level notes:
  - `auto-link-student/index.ts` uses `getHookSecret()` and will throw/return 500 if secret missing — this prevents accidental open webhook.
  - `invite-link/index.ts` is intentionally public and performs a redirect only; review if redirect target needs additional safelisting.
  - No obvious functions exposing service role keys to client code were found (grep for `SUPABASE_SERVICE_ROLE_KEY` limited to `supabase/functions` and `scripts`).

Recommendations (immediate):

1. Ensure all Edge function environments in production have `AUTH_HOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` set (release checklist already references these variables).
2. Add request logging for auth failures in Edge functions (401/500) to central logs (Sentry or function logs) for rapid detection.
3. Add per-function rate limits at the edge (Cloudflare or API gateway) for high-risk functions: `students-import`, `rules-sync-admin`, `assistant`.
4. Run endpoint integration tests hitting each Edge function with and without JWT/secret to confirm behaviors.

Files inspected (paths):
- supabase/config.toml
- supabase/functions/auto-link-student/index.ts
- supabase/functions/invite-link/index.ts
- supabase/functions/* (grep for Deno.serve)

Audit status: quick pass — no immediate secret leaks found, but recommend endpoint testing and rate-limiting.
