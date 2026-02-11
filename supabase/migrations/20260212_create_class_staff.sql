-- PR5: Class staff mapping (admin all / staff assigned)

create table if not exists public.class_staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_role text not null check (staff_role in ('head', 'assistant', 'intern')),
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create index if not exists class_staff_org_id on public.class_staff(organization_id);
create index if not exists class_staff_class_id on public.class_staff(class_id);
create index if not exists class_staff_user_id on public.class_staff(user_id);
create index if not exists class_staff_org_user on public.class_staff(organization_id, user_id);

alter table public.class_staff enable row level security;

drop policy if exists "class_staff select org member" on public.class_staff;
create policy "class_staff select org member" on public.class_staff
  for select
  using (public.is_org_member(class_staff.organization_id));

drop policy if exists "class_staff insert admin" on public.class_staff;
create policy "class_staff insert admin" on public.class_staff
  for insert
  with check (
    public.is_org_admin(class_staff.organization_id)
    and exists (
      select 1
      from public.classes c
      where c.id = class_staff.class_id
        and c.organization_id = class_staff.organization_id
    )
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = class_staff.organization_id
        and om.user_id = class_staff.user_id
    )
  );

drop policy if exists "class_staff update admin" on public.class_staff;
create policy "class_staff update admin" on public.class_staff
  for update
  using (public.is_org_admin(class_staff.organization_id))
  with check (
    public.is_org_admin(class_staff.organization_id)
    and exists (
      select 1
      from public.classes c
      where c.id = class_staff.class_id
        and c.organization_id = class_staff.organization_id
    )
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = class_staff.organization_id
        and om.user_id = class_staff.user_id
    )
  );

drop policy if exists "class_staff delete admin" on public.class_staff;
create policy "class_staff delete admin" on public.class_staff
  for delete
  using (public.is_org_admin(class_staff.organization_id));

create or replace function public.is_class_staff(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.class_staff cs
    where cs.class_id = _class_id
      and cs.user_id = auth.uid()
  );
$$;

create or replace function public.is_class_head(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.class_staff cs
    where cs.class_id = _class_id
      and cs.user_id = auth.uid()
      and cs.staff_role = 'head'
  );
$$;

revoke all on function public.is_class_staff(text) from anon, public;
grant execute on function public.is_class_staff(text) to authenticated;

revoke all on function public.is_class_head(text) from anon, public;
grant execute on function public.is_class_head(text) to authenticated;

revoke all on table public.class_staff from anon;
grant select, insert, update, delete on table public.class_staff to authenticated;

insert into public.class_staff (organization_id, class_id, user_id, staff_role)
select
  c.organization_id,
  c.id,
  c.owner_id,
  'head'
from public.classes c
where c.owner_id is not null
  and c.organization_id is not null
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = c.organization_id
      and om.user_id = c.owner_id
  )
on conflict (class_id, user_id) do nothing;
