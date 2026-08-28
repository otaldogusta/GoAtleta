alter table public.organizations
  add column if not exists timezone text;

update public.organizations organization
set timezone = 'America/Sao_Paulo'
where organization.timezone is null
   or btrim(organization.timezone) = ''
   or not exists (
     select 1
     from pg_catalog.pg_timezone_names timezone_name
     where timezone_name.name = btrim(organization.timezone)
   );

alter table public.organizations
  alter column timezone set default 'America/Sao_Paulo',
  alter column timezone set not null;

alter table public.organizations
  drop constraint if exists organizations_timezone_format_check;
alter table public.organizations
  add constraint organizations_timezone_format_check
  check (
    timezone = btrim(timezone)
    and char_length(timezone) between 3 and 100
  );

create or replace function public.enforce_organization_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.timezone := btrim(new.timezone);
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise exception 'Invalid IANA timezone: %', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_organization_timezone()
  from public, anon, authenticated;

drop trigger if exists organizations_enforce_timezone
  on public.organizations;
create trigger organizations_enforce_timezone
before insert or update of timezone on public.organizations
for each row execute function public.enforce_organization_timezone();

comment on column public.organizations.timezone is
  'IANA timezone used for organization-local operational dates and exports.';

drop function if exists public.get_my_organizations();
create function public.get_my_organizations()
returns table (
  id uuid,
  name text,
  role_level int,
  created_at timestamptz,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organization.id,
    organization.name,
    membership.role_level,
    organization.created_at,
    organization.timezone
  from public.organizations organization
  join public.organization_members membership
    on membership.organization_id = organization.id
  where membership.user_id = (select auth.uid())
  order by organization.created_at desc;
$$;

revoke all on function public.get_my_organizations()
  from public, anon, authenticated;
grant execute on function public.get_my_organizations()
  to authenticated;
