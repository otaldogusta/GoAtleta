# Release Checklist (GoAtleta)

## Before merge
- [ ] Migrations applied (dev/staging/prod):
  - 20260120_enable_rls_and_ownership.sql
  - 2026012101_add_login_email_students.sql
  - 2026012102_trainer_invites.sql
  - 2026012103_absence_notices.sql
- [ ] Tables exist: trainer_invites, absence_notices
- [ ] Column exists: students.login_email
- [ ] RLS enabled and policies active

## After deploy
- [ ] Functions deployed:
  - auto-link-student
  - claim-trainer-invite
  - assistant (if updated)
  - link-metadata (if updated)
- [ ] Supabase secrets set:
  - SUPABASE_SERVICE_ROLE_KEY
  - AUTH_HOOK_SECRET
- [ ] Webhook auth.users INSERT -> auto-link-student
  - Authorization header matches AUTH_HOOK_SECRET
- [ ] PostgREST schema reload:
  - select pg_notify('pgrst', 'reload schema');

## QA quick pass
- [ ] Student linked by login_email -> student_user_id filled
- [ ] Student role sees only Home/Agenda/Plano/Comunicados/Perfil
- [ ] Trainer role sees trainer home and management screens
- [ ] Pending account shows pending screen (no access to trainer area)
- [ ] Trainer invite works (valid code -> trainers.user_id created)
- [ ] Absence notice flow works (student creates, trainer confirms/ignores)

## EAS Update discipline
- [ ] Run `npm run release:check`
- [ ] Publish candidate on preview: `npm run update:preview`
- [ ] Validate smoke tests in preview channel
- [ ] Promote verified update to production: `npm run update:promote`
- [ ] If promote is unavailable for the target runtime, publish directly: `npm run update:production`
