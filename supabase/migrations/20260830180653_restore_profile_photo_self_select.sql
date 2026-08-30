-- Re-enable the authenticated self-read needed by Storage upserts without
-- restoring anonymous object enumeration for the public profile photo bucket.
drop policy if exists "profile_photos select own" on storage.objects;
create policy "profile_photos select own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Keep a single permissive SELECT policy for authenticated Storage access.
-- Earlier migrations intentionally consolidate policies to avoid evaluating
-- several equivalent permissive policies for every object lookup.
do $migration$
declare
  policy_names name[];
  policy_name name;
  combined_using text;
  replacement_name constant text := 'authenticated_205252f34a_select';
begin
  select
    array_agg(policyname order by policyname),
    string_agg(format('(%s)', coalesce(qual, 'true')), ' or ' order by policyname)
  into policy_names, combined_using
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'
    and permissive = 'PERMISSIVE'
    and roles = '{authenticated}'::name[];

  if coalesce(cardinality(policy_names), 0) <= 1 then
    return;
  end if;

  foreach policy_name in array policy_names
  loop
    execute format('drop policy %I on storage.objects', policy_name);
  end loop;

  execute format(
    'create policy %I on storage.objects for select to authenticated using (%s)',
    replacement_name,
    combined_using
  );
end
$migration$;
