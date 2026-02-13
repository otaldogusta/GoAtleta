-- PR12: sync authenticated profile photo across screens/devices

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  photo_url text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from anon, authenticated, public;

create or replace function public.get_my_profile_photo()
returns table (
  photo_url text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select up.photo_url
  from public.user_profiles up
  where up.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.set_my_profile_photo(
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  insert into public.user_profiles (
    user_id,
    photo_url,
    updated_at
  )
  values (
    auth.uid(),
    nullif(trim(p_photo_url), ''),
    now()
  )
  on conflict (user_id)
  do update set
    photo_url = excluded.photo_url,
    updated_at = now();
end;
$$;

revoke all on function public.get_my_profile_photo() from anon, authenticated, public;
revoke all on function public.set_my_profile_photo(text) from anon, authenticated, public;

grant execute on function public.get_my_profile_photo() to authenticated;
grant execute on function public.set_my_profile_photo(text) to authenticated;
