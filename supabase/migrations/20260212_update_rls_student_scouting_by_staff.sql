-- PR5: student_scouting_logs RLS by class_staff (conditional)

do $$
begin
  if exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'student_scouting_logs'
  ) then
    execute 'alter table public.student_scouting_logs enable row level security';

    execute 'drop policy if exists "student_scouting_logs select trainer" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs select trainer" on public.student_scouting_logs
        for select
        using (
          exists (
            select 1
            from public.classes c
            where c.id::text = student_scouting_logs.classid::text
              and (
                public.is_org_admin(c.organization_id)
                or public.is_class_staff(student_scouting_logs.classid::text)
              )
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs insert trainer" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs insert trainer" on public.student_scouting_logs
        for insert
        with check (
          exists (
            select 1
            from public.classes c
            where c.id::text = student_scouting_logs.classid::text
              and (
                public.is_org_admin(c.organization_id)
                or public.is_class_staff(student_scouting_logs.classid::text)
              )
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs update trainer" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs update trainer" on public.student_scouting_logs
        for update
        using (
          exists (
            select 1
            from public.classes c
            where c.id::text = student_scouting_logs.classid::text
              and (
                public.is_org_admin(c.organization_id)
                or public.is_class_staff(student_scouting_logs.classid::text)
              )
          )
        )
        with check (
          exists (
            select 1
            from public.classes c
            where c.id::text = student_scouting_logs.classid::text
              and (
                public.is_org_admin(c.organization_id)
                or public.is_class_staff(student_scouting_logs.classid::text)
              )
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs delete trainer" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs delete trainer" on public.student_scouting_logs
        for delete
        using (
          exists (
            select 1
            from public.classes c
            where c.id::text = student_scouting_logs.classid::text
              and public.is_org_admin(c.organization_id)
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs select student" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs select student" on public.student_scouting_logs
        for select
        using (
          exists (
            select 1
            from public.students s
            where s.id::text = student_scouting_logs.studentid::text
              and s.classid::text = student_scouting_logs.classid::text
              and s.student_user_id::text = auth.uid()::text
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs insert student" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs insert student" on public.student_scouting_logs
        for insert
        with check (
          exists (
            select 1
            from public.students s
            where s.id::text = student_scouting_logs.studentid::text
              and s.classid::text = student_scouting_logs.classid::text
              and s.student_user_id::text = auth.uid()::text
          )
        )
    $sql$;

    execute 'drop policy if exists "student_scouting_logs update student" on public.student_scouting_logs';
    execute $sql$
      create policy "student_scouting_logs update student" on public.student_scouting_logs
        for update
        using (
          exists (
            select 1
            from public.students s
            where s.id::text = student_scouting_logs.studentid::text
              and s.classid::text = student_scouting_logs.classid::text
              and s.student_user_id::text = auth.uid()::text
          )
        )
        with check (
          exists (
            select 1
            from public.students s
            where s.id::text = student_scouting_logs.studentid::text
              and s.classid::text = student_scouting_logs.classid::text
              and s.student_user_id::text = auth.uid()::text
          )
        )
    $sql$;
  end if;
end $$;
