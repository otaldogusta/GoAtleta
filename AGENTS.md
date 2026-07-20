# GoAtleta agent rules

## Delivery flow

- Use `http://localhost:8081` as the first UI/UX validation loop. Do not use a Vercel preview as the first place to decide whether an interface is correct.
- Keep changes local when the user asks for an "ajuste local". Commit, push, pull requests, previews, merges, promotions, and production deploys require the scope requested in the current task.
- Prefer a Vercel preview for remote validation. Never deploy or promote to production, merge a release-triggering change, or run a production release command without explicit user authorization in the current task.
- Before publishing, run checks proportional to the change. The normal baseline is focused tests, `npm run typecheck:app`, `npm run check:org-scope`, `git diff --check`, `npm run build`, and an authenticated smoke test of the affected flow on `localhost:8081`.
- Treat a successful build or preview as a validation gate, not as proof that production is complete. Report the deployment target, URL, status, commit, and any pending production gate.

## Production and data safety

- Never add, change, remove, print, or commit production secrets or environment-variable values. Any production environment change requires explicit authorization and an impact check.
- Preserve Supabase as the GoAtleta data and authorization source of truth. Vercel capabilities or plugin suggestions do not authorize replacing the existing architecture.
- Preserve authentication, organization/workspace isolation, and RLS boundaries. Run `npm run check:org-scope` whenever a change can affect scoped data or navigation.
- Do not expose private Google Drive content or metadata. Global academic knowledge may use only explicitly curated and sanitized projections.
- Preserve unrelated working-tree changes and local artifacts when staging, committing, or deploying.
