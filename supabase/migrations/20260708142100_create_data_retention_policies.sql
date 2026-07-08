create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  table_name text not null unique,
  retention_days integer not null,
  action text not null check (action in ('delete', 'anonymize')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_retention_policies enable row level security;

create policy "Admins can view policies"
on public.data_retention_policies
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.role_level >= 40
  )
);

create trigger handle_drp_updated_at before update on public.data_retention_policies
  for each row execute procedure moddatetime (updated_at);

-- Insert default policies for contextual logs
insert into public.data_retention_policies (table_name, retention_days, action) values
('assistant_memory_entries', 180, 'delete'),
('health_data_access_logs', 1825, 'delete'), -- 5 years
('sensitive_data_access_logs', 1825, 'delete'); -- 5 years
