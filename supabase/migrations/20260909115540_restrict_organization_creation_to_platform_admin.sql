-- Organization provisioning is a commercial/platform operation.
-- Ordinary authenticated accounts must enter through an approved invite or an
-- existing organization membership; the client cannot self-provision tenants.
revoke all on function public.create_organization_with_admin(text)
  from public, anon, authenticated;

grant execute on function public.create_organization_with_admin(text)
  to service_role;

comment on function public.create_organization_with_admin(text) is
  'Platform-only organization provisioning. Call from a trusted administrative service after explicit access approval.';
