-- Student and trainer access are intentionally separate predicates, but two
-- permissive PUBLIC policies make Postgres evaluate both policy objects for
-- every request and trigger the advisor once for every inherited role.
-- Joining the existing predicates with OR preserves the exact access result.
do $migration$
declare
  policy_group record;
  policy_name text;
  using_expression text;
  check_expression text;
begin
  for policy_group in
    select
      cmd,
      array_agg(policyname order by policyname) as policy_names,
      string_agg(format('(%s)', coalesce(qual, 'true')), ' or ' order by policyname) as combined_using,
      string_agg(
        format('(%s)', coalesce(with_check, qual, 'true')),
        ' or '
        order by policyname
      ) as combined_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_scouting_logs'
      and permissive = 'PERMISSIVE'
      and roles = '{public}'::name[]
      and cmd in ('SELECT', 'INSERT', 'UPDATE')
    group by cmd
    having count(*) > 1
  loop
    using_expression := policy_group.combined_using;
    check_expression := policy_group.combined_check;

    foreach policy_name in array policy_group.policy_names
    loop
      execute format(
        'drop policy %I on public.student_scouting_logs',
        policy_name
      );
    end loop;

    if policy_group.cmd = 'SELECT' then
      execute format(
        'create policy %I on public.student_scouting_logs for select to public using (%s)',
        'student_scouting_logs select authorized',
        using_expression
      );
    elsif policy_group.cmd = 'INSERT' then
      execute format(
        'create policy %I on public.student_scouting_logs for insert to public with check (%s)',
        'student_scouting_logs insert authorized',
        check_expression
      );
    elsif policy_group.cmd = 'UPDATE' then
      execute format(
        'create policy %I on public.student_scouting_logs for update to public using (%s) with check (%s)',
        'student_scouting_logs update authorized',
        using_expression,
        check_expression
      );
    end if;
  end loop;
end
$migration$;
