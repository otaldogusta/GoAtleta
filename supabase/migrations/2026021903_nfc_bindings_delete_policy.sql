-- NFC1.5: allow admins to remove NFC tag bindings

drop policy if exists nfc_bindings_delete on public.nfc_tag_bindings;
create policy nfc_bindings_delete
on public.nfc_tag_bindings
for delete
using (public.is_org_admin(organization_id));

grant delete on table public.nfc_tag_bindings to authenticated;
