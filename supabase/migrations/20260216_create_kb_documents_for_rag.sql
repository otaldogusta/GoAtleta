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
drop policy if exists "kb_documents_select_org_member" on public.kb_documents;
create policy "kb_documents_select_org_member"
on public.kb_documents
for select
using (public.is_org_member(kb_documents.organization_id));

-- Insert/update/delete only for org admins (role_level >= 50)
drop policy if exists "kb_documents_insert_org_admin" on public.kb_documents;
create policy "kb_documents_insert_org_admin"
on public.kb_documents
for insert
with check (public.is_org_admin(kb_documents.organization_id));

drop policy if exists "kb_documents_update_org_admin" on public.kb_documents;
create policy "kb_documents_update_org_admin"
on public.kb_documents
for update
using (public.is_org_admin(kb_documents.organization_id))
with check (public.is_org_admin(kb_documents.organization_id));

drop policy if exists "kb_documents_delete_org_admin" on public.kb_documents;
create policy "kb_documents_delete_org_admin"
on public.kb_documents
for delete
using (public.is_org_admin(kb_documents.organization_id));
