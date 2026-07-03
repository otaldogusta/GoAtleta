-- PR5 follow-up: secure owner fallback with org membership check

alter table public.classes enable row level security;

drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_staff(classes.id)
    or (classes.owner_id = auth.uid() and public.is_org_member(classes.organization_id))
  );

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer" on public.classes
  for update
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or (classes.owner_id = auth.uid() and public.is_org_member(classes.organization_id))
  )
  with check (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or (classes.owner_id = auth.uid() and public.is_org_member(classes.organization_id))
  );
