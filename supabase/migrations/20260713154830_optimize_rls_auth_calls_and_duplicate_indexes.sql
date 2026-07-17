-- Cache stable auth helper results once per statement instead of once per row.
-- The transformation preserves each policy command, role list and predicate.
do $migration$
declare
  policy_record record;
  optimized_qual text;
  optimized_check text;
  alter_statement text;
begin
  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'auth\.(uid|jwt|role|email)\(\)'
        or coalesce(with_check, '') ~ 'auth\.(uid|jwt|role|email)\(\)'
      )
  loop
    optimized_qual := policy_record.qual;
    optimized_check := policy_record.with_check;

    if optimized_qual is not null then
      optimized_qual := regexp_replace(
        optimized_qual,
        'auth\.(uid|jwt|role|email)\(\)',
        '(select auth.\1())',
        'g'
      );
      optimized_qual := regexp_replace(
        optimized_qual,
        '\(select\s+\(select\s+auth\.(uid|jwt|role|email)\(\)\)\)',
        '(select auth.\1())',
        'g'
      );
    end if;

    if optimized_check is not null then
      optimized_check := regexp_replace(
        optimized_check,
        'auth\.(uid|jwt|role|email)\(\)',
        '(select auth.\1())',
        'g'
      );
      optimized_check := regexp_replace(
        optimized_check,
        '\(select\s+\(select\s+auth\.(uid|jwt|role|email)\(\)\)\)',
        '(select auth.\1())',
        'g'
      );
    end if;

    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if optimized_qual is not null then
      alter_statement := alter_statement || format(' using (%s)', optimized_qual);
    end if;

    if optimized_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', optimized_check);
    end if;

    execute alter_statement;
  end loop;
end
$migration$;

-- These indexes were byte-for-byte identical. Keep the established shorter name.
drop index if exists public.students_org_rg_normalized_idx;
