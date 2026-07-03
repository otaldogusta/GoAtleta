-- PR12: student photo storage bucket and access policies

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'student-photos',
  'student-photos',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_student_photo_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_parts text[];
  v_org_id uuid;
  v_student_id text;
begin
  v_parts := storage.foldername(p_object_name);

  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  if v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_org_id := v_parts[1]::uuid;
  v_student_id := nullif(v_parts[2], '');

  if v_student_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_org_id
      and om.user_id = auth.uid()
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.students s
    where s.id = v_student_id
      and s.organization_id = v_org_id
      and s.student_user_id = auth.uid()
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_manage_student_photo_object(text) from anon, public;
grant execute on function public.can_manage_student_photo_object(text) to authenticated;

drop policy if exists "student_photos public read" on storage.objects;
create policy "student_photos public read"
  on storage.objects
  for select
  using (bucket_id = 'student-photos');

drop policy if exists "student_photos insert scoped" on storage.objects;
create policy "student_photos insert scoped"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'student-photos'
    and public.can_manage_student_photo_object(name)
  );

drop policy if exists "student_photos update scoped" on storage.objects;
create policy "student_photos update scoped"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'student-photos'
    and public.can_manage_student_photo_object(name)
  )
  with check (
    bucket_id = 'student-photos'
    and public.can_manage_student_photo_object(name)
  );

drop policy if exists "student_photos delete scoped" on storage.objects;
create policy "student_photos delete scoped"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'student-photos'
    and public.can_manage_student_photo_object(name)
  );
