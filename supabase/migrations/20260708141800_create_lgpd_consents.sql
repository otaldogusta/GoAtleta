create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.students(id) on delete cascade not null,
  guardian_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  purpose text not null check (purpose in (
    'general_registration',
    'marketing',
    'health_data',
    'image_rights',
    'communication',
    'physical_assessments',
    'share_with_guardians'
  )),
  legal_basis text not null default 'consent',
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  version text not null default '1.0',
  document_hash text,
  ip_address text,
  user_agent text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consents enable row level security;

create or replace function private.set_lgpd_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_lgpd_updated_at() from public;

create policy "Users can read own generated or managed consents"
on public.consents
for select
to authenticated
using (
  created_by = auth.uid()
  or guardian_id = auth.uid()
);

create policy "Organizations can read student consents"
on public.consents
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.organization_members om
      on om.organization_id = s.organization_id
    where s.id = consents.student_id
      and s.organization_id = consents.organization_id
      and om.user_id = auth.uid()
      and om.role_level >= 10
  )
);

create policy "Users can insert own consents"
on public.consents
for insert
to authenticated
with check (
  (created_by = auth.uid() or guardian_id = auth.uid())
  and exists (
    select 1
    from public.students s
    where s.id = consents.student_id
      and s.organization_id = consents.organization_id
      and (
        s.student_user_id = auth.uid()
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = s.organization_id
            and om.user_id = auth.uid()
            and om.role_level >= 10
        )
      )
  )
);

create policy "Users can update own consents"
on public.consents
for update
to authenticated
using (
  created_by = auth.uid()
  or guardian_id = auth.uid()
)
with check (
  (created_by = auth.uid() or guardian_id = auth.uid())
  and exists (
    select 1
    from public.students s
    where s.id = consents.student_id
      and s.organization_id = consents.organization_id
      and (
        s.student_user_id = auth.uid()
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = s.organization_id
            and om.user_id = auth.uid()
            and om.role_level >= 10
        )
      )
  )
);

-- Trigger for updated_at
create trigger handle_updated_at before update on public.consents
  for each row execute function private.set_lgpd_updated_at();
