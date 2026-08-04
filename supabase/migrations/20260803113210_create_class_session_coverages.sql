create table if not exists public.class_session_coverages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  session_date date not null,
  absent_user_id uuid references auth.users(id) on delete set null,
  replacement_user_id uuid references auth.users(id) on delete set null,
  replacement_role text not null default 'substitute'
    check (replacement_role in ('substitute', 'assistant', 'intern')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, class_id, session_date),
  check (absent_user_id is null or replacement_user_id is null or absent_user_id <> replacement_user_id)
);

create index if not exists class_session_coverages_org_date_idx
  on public.class_session_coverages (organization_id, session_date);
create index if not exists class_session_coverages_class_date_idx
  on public.class_session_coverages (class_id, session_date);

alter table public.class_session_coverages enable row level security;

drop policy if exists class_session_coverages_select on public.class_session_coverages;
create policy class_session_coverages_select
  on public.class_session_coverages for select
  using (public.is_org_member(organization_id));

drop policy if exists class_session_coverages_insert on public.class_session_coverages;
create policy class_session_coverages_insert
  on public.class_session_coverages for insert
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.organization_id = organization_id
    )
    and (
      public.is_org_admin(organization_id)
      or exists (
        select 1 from public.class_staff cs
        where cs.organization_id = organization_id
          and cs.class_id = class_id
          and cs.user_id = auth.uid()
          and cs.staff_role in ('head', 'assistant')
      )
    )
  );

drop policy if exists class_session_coverages_update on public.class_session_coverages;
create policy class_session_coverages_update
  on public.class_session_coverages for update
  using (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from public.class_staff cs
      where cs.organization_id = organization_id
        and cs.class_id = class_id
        and cs.user_id = auth.uid()
        and cs.staff_role in ('head', 'assistant')
    )
  )
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.organization_id = organization_id
    )
  );

drop policy if exists class_session_coverages_delete on public.class_session_coverages;
create policy class_session_coverages_delete
  on public.class_session_coverages for delete
  using (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from public.class_staff cs
      where cs.organization_id = organization_id
        and cs.class_id = class_id
        and cs.user_id = auth.uid()
        and cs.staff_role in ('head', 'assistant')
    )
  );

revoke all on public.class_session_coverages from anon;
grant select, insert, update, delete on public.class_session_coverages to authenticated;
