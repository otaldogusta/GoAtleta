do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_acwr_limits_check'
  ) then
    alter table public.classes
      add constraint classes_acwr_limits_check
      check (acwr_low < acwr_high);
  end if;
end $$;
