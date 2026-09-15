-- Finance table stays RPC-only for amounts and contracts. These columns support
-- modality selection and idempotency; existing financial-staff RLS still applies.
grant select (id, organization_id, modality, idempotency_key)
  on public.tuition_plans to authenticated;
