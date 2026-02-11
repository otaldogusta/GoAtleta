-- PR5: classes RLS by class_staff

alter table public.classes enable row level security;

drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_staff(classes.id)
    or classes.owner_id = auth.uid()
  );

drop policy if exists "classes insert trainer" on public.classes;
create policy "classes insert trainer" on public.classes
  for insert
  with check (public.is_org_admin(classes.organization_id));

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer" on public.classes
  for update
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or classes.owner_id = auth.uid()
  )
  with check (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or classes.owner_id = auth.uid()
  );

drop policy if exists "classes delete trainer" on public.classes;
create policy "classes delete trainer" on public.classes
  for delete
  using (public.is_org_admin(classes.organization_id));
