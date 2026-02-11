-- Add organization_id to classes for workspace filtering
alter table public.classes
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists classes_organization_id on public.classes(organization_id);

-- Backfill existing classes to the owner's earliest organization membership
update public.classes c
set organization_id = (
  select om.organization_id
  from public.organization_members om
  where om.user_id = c.owner_id
  order by om.created_at asc
  limit 1
)
where c.organization_id is null
  and c.owner_id is not null
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = c.owner_id
  );

-- Update class policies to allow organization members (fallback to owner on legacy rows)
drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (
    is_trainer()
    and (
      (organization_id is null and owner_id = auth.uid())
      or (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = classes.organization_id
            and om.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "classes insert trainer" on public.classes;
create policy "classes insert trainer" on public.classes
  for insert
  with check (
    is_trainer()
    and (
      (organization_id is null and owner_id = auth.uid())
      or (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = classes.organization_id
            and om.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer" on public.classes
  for update
  using (
    is_trainer()
    and (
      (organization_id is null and owner_id = auth.uid())
      or (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = classes.organization_id
            and om.user_id = auth.uid()
        )
      )
    )
  )
  with check (
    is_trainer()
    and (
      (organization_id is null and owner_id = auth.uid())
      or (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = classes.organization_id
            and om.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "classes delete trainer" on public.classes;
create policy "classes delete trainer" on public.classes
  for delete
  using (
    is_trainer()
    and (
      (organization_id is null and owner_id = auth.uid())
      or (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = classes.organization_id
            and om.user_id = auth.uid()
        )
      )
    )
  );
