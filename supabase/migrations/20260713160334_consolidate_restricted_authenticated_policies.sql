-- Policies declared TO PUBLIC are inherited by every database role. Where anon
-- has no table privilege at all, narrowing the policy role to authenticated
-- cannot remove a permission the client previously possessed.
do $migration$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where roles = '{public}'::name[]
      and not has_table_privilege(
        'anon',
        format('%I.%I', schemaname, tablename),
        'SELECT,INSERT,UPDATE,DELETE'
      )
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$migration$;

-- Multiple permissive policies for the same role and command are equivalent
-- to a single policy whose predicates are joined by OR. Consolidating them
-- keeps the authorization result unchanged while avoiding repeated policy
-- evaluation for every row.
do $migration$
declare
  policy_group record;
  policy_name text;
  using_expression text;
  check_expression text;
  replacement_name text;
begin
  for policy_group in
    select
      schemaname,
      tablename,
      cmd,
      array_agg(policyname order by policyname) as policy_names,
      string_agg(format('(%s)', coalesce(qual, 'true')), ' or ' order by policyname) as combined_using,
      string_agg(
        format('(%s)', coalesce(with_check, qual, 'true')),
        ' or '
        order by policyname
      ) as combined_check
    from pg_policies
    where permissive = 'PERMISSIVE'
      and roles = '{authenticated}'::name[]
    group by schemaname, tablename, cmd
    having count(*) > 1
  loop
    using_expression := policy_group.combined_using;
    check_expression := policy_group.combined_check;
    replacement_name := format(
      'authenticated_%s_%s',
      substr(md5(policy_group.schemaname || '.' || policy_group.tablename), 1, 10),
      lower(policy_group.cmd)
    );

    foreach policy_name in array policy_group.policy_names
    loop
      execute format(
        'drop policy %I on %I.%I',
        policy_name,
        policy_group.schemaname,
        policy_group.tablename
      );
    end loop;

    if policy_group.cmd = 'SELECT' then
      execute format(
        'create policy %I on %I.%I for select to authenticated using (%s)',
        replacement_name,
        policy_group.schemaname,
        policy_group.tablename,
        using_expression
      );
    elsif policy_group.cmd = 'INSERT' then
      execute format(
        'create policy %I on %I.%I for insert to authenticated with check (%s)',
        replacement_name,
        policy_group.schemaname,
        policy_group.tablename,
        check_expression
      );
    elsif policy_group.cmd = 'UPDATE' then
      execute format(
        'create policy %I on %I.%I for update to authenticated using (%s) with check (%s)',
        replacement_name,
        policy_group.schemaname,
        policy_group.tablename,
        using_expression,
        check_expression
      );
    elsif policy_group.cmd = 'DELETE' then
      execute format(
        'create policy %I on %I.%I for delete to authenticated using (%s)',
        replacement_name,
        policy_group.schemaname,
        policy_group.tablename,
        using_expression
      );
    end if;
  end loop;
end
$migration$;
