import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const familyMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260831005113_family_access_foundation.sql",
  ),
  "utf8",
);

const financeMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260831005127_finance_foundation.sql",
  ),
  "utf8",
);

const payerRevocationMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260901000346_pause_tuition_agreements_on_payer_revocation.sql",
  ),
  "utf8",
);

const manualPaymentDateMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260901014911_reject_future_manual_payment_date.sql",
  ),
  "utf8",
);

const functionBody = (source: string, name: string) => {
  const start = source.indexOf(`create or replace function public.${name}`);
  const end = source.indexOf(`revoke all on function public.${name}`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("family access foundation contract", () => {
  test("adds typed family relationships without replacing legacy identity", () => {
    expect(familyMigrationSource).toContain(
      "create table if not exists public.student_relationships",
    );
    expect(familyMigrationSource).toContain(
      "relationship_kind in ('athlete', 'guardian', 'payer', 'viewer')",
    );
    expect(familyMigrationSource).toContain(
      "student_relationships_student_workspace_fkey",
    );
    expect(familyMigrationSource).toContain("students_id_organization_unique");
    expect(familyMigrationSource).toContain(
      "student_relationships_active_athlete_unique",
    );
    expect(familyMigrationSource).toContain(
      "and student.student_user_id is not null",
    );
    expect(familyMigrationSource).not.toMatch(/\bdrop\s+table\b/i);
    expect(familyMigrationSource).not.toMatch(/\bdelete\s+from\b/i);
  });

  test("keeps family permissions explicit and pay implies financial visibility", () => {
    for (const permission of [
      "can_view_profile",
      "can_view_schedule",
      "can_view_attendance",
      "can_view_progress",
      "can_view_health",
      "can_sign_consents",
      "can_view_financial",
      "can_pay",
    ]) {
      expect(familyMigrationSource).toContain(`${permission} boolean`);
    }
    expect(familyMigrationSource).toContain(
      "check (not can_pay or can_view_financial)",
    );
    expect(familyMigrationSource).toContain(
      "create or replace function public.has_student_relationship",
    );
    expect(familyMigrationSource).toContain("else false");
  });

  test("protects relationship tables with RLS and RPC-only writes", () => {
    expect(familyMigrationSource).toContain(
      "alter table public.student_relationships enable row level security",
    );
    expect(familyMigrationSource).toContain(
      "alter table public.student_relationship_invites enable row level security",
    );
    expect(familyMigrationSource).toContain("user_id = (select auth.uid())");
    expect(familyMigrationSource).toContain(
      "public.can_manage_student_invites(student_id, organization_id)",
    );
    expect(familyMigrationSource).toContain(
      "revoke all on table public.student_relationships from public, anon, authenticated",
    );
    expect(familyMigrationSource).toContain(
      "revoke all on table public.student_relationship_invites from public, anon, authenticated",
    );
    expect(familyMigrationSource).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]*to authenticated/i,
    );
  });

  test("uses hashed expiring recipient-scoped invitations", () => {
    expect(familyMigrationSource).toContain(
      "create table if not exists public.student_relationship_invites",
    );
    expect(familyMigrationSource).toContain(
      "check (token_hash ~ '^[0-9a-f]{64}$')",
    );
    expect(familyMigrationSource).toContain(
      "expires_at timestamptz not null default (now() + interval '30 days')",
    );
    expect(familyMigrationSource).toContain(
      "student_relationship_invites_pending_recipient_unique",
    );

    const createInvite = functionBody(
      familyMigrationSource,
      "create_student_relationship_invite_v1",
    );
    expect(createInvite).toContain("pg_advisory_xact_lock");
    expect(createInvite).toContain("invite.invited_email = v_email");
    expect(createInvite).toContain("invite.relationship_kind = v_kind");
    expect(createInvite).not.toContain(
      "where invite.student_id = p_student_id\n      and invite.used_at is null",
    );
  });

  test("keeps preview and claim service-only and enforces claim e-mail", () => {
    const validateInvite = functionBody(
      familyMigrationSource,
      "validate_student_relationship_invite_v1",
    );
    const claimInvite = functionBody(
      familyMigrationSource,
      "claim_student_relationship_invite_v1",
    );

    expect(validateInvite).not.toContain("auth.uid()");
    expect(validateInvite).not.toContain("invited_email");
    expect(validateInvite).toContain("raise exception 'INVITE_INVALID'");
    expect(validateInvite).toContain("raise exception 'INVITE_ALREADY_USED'");
    expect(validateInvite).toContain("raise exception 'INVITE_REVOKED'");
    expect(validateInvite).toContain("raise exception 'INVITE_EXPIRED'");
    expect(familyMigrationSource).toContain(
      "revoke all on function public.validate_student_relationship_invite_v1(text)\n  from public, anon, authenticated",
    );
    expect(familyMigrationSource).toContain(
      "grant execute on function public.validate_student_relationship_invite_v1(text)\n  to service_role",
    );
    expect(claimInvite).toContain(
      "v_invite.invited_email is distinct from v_email",
    );
    expect(claimInvite).toContain("perform pg_advisory_xact_lock");
    expect(familyMigrationSource).toContain(
      "grant execute on function public.claim_student_relationship_invite_v1(text, uuid, text)\n  to service_role",
    );
  });

  test("lists invite metadata to staff without exposing token hashes", () => {
    const listInvites = functionBody(
      familyMigrationSource,
      "list_student_relationship_invites_v1",
    );

    expect(listInvites).not.toContain("token_hash");
    expect(listInvites).toContain("can_manage_student_invites");
    expect(familyMigrationSource).toContain(
      "grant execute on function public.list_student_relationship_invites_v1(uuid, text)\n  to authenticated",
    );
  });

  test("revokes pending invites atomically through a staff-only RPC", () => {
    const revokeInvite = functionBody(
      familyMigrationSource,
      "revoke_student_relationship_invite_v1",
    );

    expect(revokeInvite).toContain("for update");
    expect(revokeInvite).toContain("can_manage_student_invites");
    expect(revokeInvite).toContain("INVITE_ALREADY_USED");
    expect(revokeInvite).toContain("revoked_at = now()");
    expect(familyMigrationSource).toContain(
      "grant execute on function public.revoke_student_relationship_invite_v1(uuid, text)\n  to authenticated",
    );
  });

  test("never maps guardians, payers or viewers into legacy student identity", () => {
    const claimInvite = functionBody(
      familyMigrationSource,
      "claim_student_relationship_invite_v1",
    );
    const legacyUpdate = claimInvite.indexOf(
      "if v_invite.relationship_kind = 'athlete' then\n    update public.students",
    );
    expect(legacyUpdate).toBeGreaterThanOrEqual(0);
    expect(claimInvite).toContain("student_user_id = p_user_id");
    expect(claimInvite).not.toContain(
      "if v_invite.relationship_kind <> 'athlete' then\n    update public.students",
    );
  });

  test("returns only safe family context and an explicit progress placeholder", () => {
    const contexts = functionBody(
      familyMigrationSource,
      "get_my_student_contexts_v1",
    );
    const overview = functionBody(
      familyMigrationSource,
      "get_my_family_overview_v1",
    );

    for (const forbidden of [
      "student.cpf",
      "student.phone",
      "student.login_email",
      "student.birthdate",
      "guardian_phone",
      "health_notes",
      "pain_score",
      "attendance.note",
    ]) {
      expect(contexts).not.toContain(forbidden);
      expect(overview).not.toContain(forbidden);
    }
    expect(overview).toContain("from public.training_sessions session");
    expect(overview).toContain("from public.attendance_logs attendance");
    expect(overview).toContain("progress_semantics_not_modeled_yet");
    expect(overview).not.toContain("student_scouting_logs");
    expect(contexts).toContain(
      "case when relationship.can_view_profile then student.photo_url else null end",
    );
    expect(contexts).toContain(
      "case when relationship.can_view_schedule then class.name else null end",
    );
    expect(overview).toContain(
      "case when relationship.can_view_schedule then class.id else null end",
    );
  });
});

describe("finance foundation contract", () => {
  test("separates SaaS subscriptions from tuition receivables", () => {
    for (const table of [
      "plan_catalog",
      "organization_subscriptions",
      "merchant_accounts",
      "tuition_plans",
      "tuition_agreements",
      "invoices",
      "payments",
      "provider_events",
      "finance_audit_events",
    ]) {
      expect(financeMigrationSource).toContain(
        `create table if not exists public.${table}`,
      );
    }

    const subscriptionTable = financeMigrationSource.slice(
      financeMigrationSource.indexOf(
        "create table if not exists public.organization_subscriptions",
      ),
      financeMigrationSource.indexOf(
        "create table if not exists public.merchant_accounts",
      ),
    );
    const invoiceTable = financeMigrationSource.slice(
      financeMigrationSource.indexOf(
        "create table if not exists public.invoices",
      ),
      financeMigrationSource.indexOf(
        "create table if not exists public.payments",
      ),
    );
    expect(subscriptionTable).not.toContain("student_id");
    expect(subscriptionTable).not.toContain("agreement_id");
    expect(invoiceTable).not.toContain("subscription_id");
  });

  test("uses integer cents, BRL and canonical states", () => {
    expect(financeMigrationSource).toContain(
      "amount_cents bigint not null check (amount_cents > 0)",
    );
    expect(financeMigrationSource).toContain(
      "currency text not null default 'BRL' check (currency = 'BRL')",
    );
    expect(financeMigrationSource).toContain(
      "status in ('draft', 'open', 'pending', 'paid', 'overdue', 'void', 'refunded')",
    );
    expect(financeMigrationSource).toContain(
      "method in ('pix', 'boleto', 'card', 'cash', 'bank_transfer', 'other')",
    );
  });

  test("stores provider reconciliation identifiers but no credential fields", () => {
    for (const field of [
      "external_customer_id",
      "external_subscription_id",
      "external_account_id",
      "external_invoice_id",
      "external_payment_id",
      "external_event_id",
      "payload_hash",
    ]) {
      expect(financeMigrationSource).toContain(field);
    }
    expect(financeMigrationSource).not.toMatch(
      /\b(access_token|refresh_token|api_key|client_secret|private_key)\b/i,
    );
    expect(financeMigrationSource).not.toContain("payload jsonb");
  });

  test("enables RLS, checks financial access and exposes no direct writes", () => {
    for (const table of [
      "organization_subscriptions",
      "merchant_accounts",
      "tuition_plans",
      "tuition_agreements",
      "invoices",
      "payments",
      "provider_events",
      "finance_audit_events",
    ]) {
      expect(financeMigrationSource).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(financeMigrationSource).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }
    expect(financeMigrationSource).toContain(
      "public.has_org_member_permission(organization_id, 'financial')",
    );
    expect(financeMigrationSource).toContain(
      "public.has_student_relationship(organization_id, student_id, 'financial')",
    );
    expect(financeMigrationSource).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]*to authenticated/i,
    );
    expect(financeMigrationSource).not.toContain(
      "grant select on table public.tuition_plans to authenticated",
    );
    expect(financeMigrationSource).not.toContain(
      "grant select on table public.invoices to authenticated",
    );
  });

  test("provides the UI read contracts with organization permission checks", () => {
    for (const rpc of [
      "get_organization_finance_dashboard_v1",
      "list_organization_invoices_v1",
      "get_my_family_finance_v1",
      "list_tuition_plans_v1",
      "list_tuition_agreements_v1",
    ]) {
      expect(financeMigrationSource).toContain(
        `create or replace function public.${rpc}`,
      );
      expect(financeMigrationSource).toContain(
        `grant execute on function public.${rpc}`,
      );
    }
    expect(
      functionBody(
        financeMigrationSource,
        "get_organization_finance_dashboard_v1",
      ),
    ).toContain("public.has_org_member_permission(p_org_id, 'financial')");
    expect(
      functionBody(financeMigrationSource, "list_tuition_plans_v1"),
    ).toContain("public.has_org_member_permission(p_org_id, 'financial')");
    expect(
      functionBody(financeMigrationSource, "list_tuition_agreements_v1"),
    ).toContain("public.has_org_member_permission(p_org_id, 'financial')");
  });

  test("serializes and rejects conflicting idempotent writes", () => {
    for (const rpc of [
      "create_tuition_plan_v1",
      "create_tuition_agreement_v1",
      "issue_tuition_invoice_v1",
      "record_manual_payment_v1",
    ]) {
      const source = functionBody(financeMigrationSource, rpc);
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("IDEMPOTENCY_KEY_REQUIRED");
      expect(source).toContain("IDEMPOTENCY_KEY_REUSED");
      expect(source).toContain(
        "public.has_org_member_permission(p_org_id, 'financial')",
      );
    }
    expect(financeMigrationSource).toContain("invoices_idempotency_unique");
    expect(financeMigrationSource).toContain("payments_idempotency_unique");
    expect(financeMigrationSource).toContain("provider_events_external_unique");
  });

  test("locks invoices, prevents overpayment and audits manual payments", () => {
    const manualPayment = functionBody(
      financeMigrationSource,
      "record_manual_payment_v1",
    );
    expect(manualPayment).toContain("for update");
    expect(manualPayment).toContain("PAYMENT_EXCEEDS_BALANCE");
    expect(manualPayment).toContain("'confirmed'");
    expect(manualPayment).toContain("insert into public.finance_audit_events");
    expect(manualPayment).toContain("manual_payment_recorded");
  });
});

describe("payer revocation finance guard", () => {
  test("pauses historical active agreements with an ineligible payer and audits the repair", () => {
    expect(payerRevocationMigrationSource).toContain(
      "with paused_agreements as (",
    );
    expect(payerRevocationMigrationSource).toContain(
      "relationship.status <> 'active'",
    );
    expect(payerRevocationMigrationSource).toContain(
      "or not relationship.can_pay",
    );
    expect(payerRevocationMigrationSource).toContain(
      "'paused_ineligible_payer_backfill'",
    );
    expect(payerRevocationMigrationSource).not.toMatch(/\bdelete\s+from\b/i);
  });

  test("pauses active agreements inside the relationship revocation transaction", () => {
    const revokeRelationship = functionBody(
      payerRevocationMigrationSource,
      "revoke_student_relationship_v1",
    );
    const pauseAgreement = revokeRelationship.indexOf(
      "update public.tuition_agreements agreement",
    );
    const revokeRelationshipRow = revokeRelationship.indexOf(
      "update public.student_relationships relationship",
    );

    expect(revokeRelationship).toContain("for update");
    expect(pauseAgreement).toBeGreaterThanOrEqual(0);
    expect(revokeRelationshipRow).toBeGreaterThan(pauseAgreement);
    expect(revokeRelationship).toContain(
      "'paused_payer_relationship_revoked'",
    );
    expect(revokeRelationship).toContain(
      "insert into public.finance_audit_events",
    );
  });

  test("revalidates and locks the payer before locking the agreement for issuance", () => {
    const issueInvoice = functionBody(
      payerRevocationMigrationSource,
      "issue_tuition_invoice_v1",
    );
    const payerLock = issueInvoice.indexOf(
      "select relationship.*\n    into v_payer_relationship",
    );
    const agreementLock = issueInvoice.indexOf(
      "select agreement.*\n    into v_agreement",
      payerLock,
    );

    expect(payerLock).toBeGreaterThanOrEqual(0);
    expect(agreementLock).toBeGreaterThan(payerLock);
    expect(issueInvoice).toContain("relationship.status = 'active'");
    expect(issueInvoice).toContain("relationship.can_pay");
    expect(issueInvoice).toContain("raise exception 'PAYER_RELATIONSHIP_INVALID'");
    expect(issueInvoice.slice(payerLock, agreementLock)).toContain("for update");
    expect(issueInvoice.slice(agreementLock)).toContain("for update");
  });
});

describe("manual payment date guard", () => {
  test("rejects future dates inside the financial RPC", () => {
    const manualPayment = functionBody(
      manualPaymentDateMigrationSource,
      "record_manual_payment_v1",
    );

    expect(manualPayment).toContain("PAYMENT_DATE_IN_FUTURE");
    expect(manualPayment).toContain("America/Sao_Paulo");
    expect(manualPaymentDateMigrationSource).not.toMatch(/\bdelete\s+from\b/i);
    expect(manualPaymentDateMigrationSource).not.toMatch(/\bdrop\s+table\b/i);
  });
});
