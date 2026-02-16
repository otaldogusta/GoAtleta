-- PR3 RAG: knowledge base table in Supabase (server-side retrieval)

create table if not exists public.kb_documents (
  id text primary key,
  organization_id uuid not null,
  title text not null default '',
  source text not null default '',
  chunk text not null default '',
  embedding jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  sport text not null default '',
  level text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_kb_documents_org_sport
  on public.kb_documents (organization_id, sport);

create index if not exists idx_kb_documents_org_created_at
  on public.kb_documents (organization_id, created_at desc);

alter table public.kb_documents enable row level security;

-- Read for org members
create policy "kb_documents_select_org_member"
on public.kb_documents
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = kb_documents.organization_id
      and om.user_id = auth.uid()
  )
);

-- Insert/update/delete only for org admins (role_level >= 50)
create policy "kb_documents_insert_org_admin"
on public.kb_documents
for insert
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = kb_documents.organization_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  )
);

create policy "kb_documents_update_org_admin"
on public.kb_documents
for update
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = kb_documents.organization_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = kb_documents.organization_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  )
);

create policy "kb_documents_delete_org_admin"
on public.kb_documents
for delete
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = kb_documents.organization_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  )
);
