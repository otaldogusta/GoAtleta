-- Narrow self-service capability: no general UPDATE access to students.
create or replace function private.set_my_student_photo(p_student_id text, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_url text := nullif(btrim(p_photo_url), '');
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select organization_id into v_org_id from public.students
  where id = p_student_id and student_user_id = auth.uid()
  for update;
  if not found or v_org_id is null then
    raise exception 'Student access denied' using errcode = '42501';
  end if;
  v_path := v_org_id::text || '/' || p_student_id || '/avatar';
  if v_url is not null then
    if v_url !~ '^https://[a-z0-9]+\.supabase\.co/'
      or split_part(split_part(v_url, '?', 1), '/storage/v1/object/public/student-photos/', 2) <> v_path
      or not exists (select 1 from storage.objects where bucket_id = 'student-photos' and name = v_path)
    then
      raise exception 'Invalid student photo' using errcode = '22023';
    end if;
  end if;
  update public.students set photo_url = v_url
  where id = p_student_id and student_user_id = auth.uid();
end;
$$;
revoke all on function private.set_my_student_photo(text, text) from public, anon, authenticated;
grant execute on function private.set_my_student_photo(text, text) to authenticated;

create or replace function public.set_my_student_photo(p_student_id text, p_photo_url text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_my_student_photo(p_student_id, p_photo_url); $$;
revoke all on function public.set_my_student_photo(text, text) from public, anon, authenticated;
grant execute on function public.set_my_student_photo(text, text) to authenticated;
