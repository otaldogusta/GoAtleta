begin;

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

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  );
$$;

revoke all on function public.is_org_member(uuid) from anon, public;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.is_org_admin(uuid) from anon, public;
grant execute on function public.is_org_admin(uuid) to authenticated;

alter table public.kb_documents enable row level security;

drop policy if exists kb_documents_select_org_member on public.kb_documents;
create policy kb_documents_select_org_member
on public.kb_documents
for select
using (public.is_org_member(kb_documents.organization_id));

drop policy if exists kb_documents_insert_org_admin on public.kb_documents;
create policy kb_documents_insert_org_admin
on public.kb_documents
for insert
with check (public.is_org_admin(kb_documents.organization_id));

drop policy if exists kb_documents_update_org_admin on public.kb_documents;
create policy kb_documents_update_org_admin
on public.kb_documents
for update
using (public.is_org_admin(kb_documents.organization_id))
with check (public.is_org_admin(kb_documents.organization_id));

drop policy if exists kb_documents_delete_org_admin on public.kb_documents;
create policy kb_documents_delete_org_admin
on public.kb_documents
for delete
using (public.is_org_admin(kb_documents.organization_id));

do $$
declare
  v_org uuid := 'ORGANIZATION_UUID_AQUI';
begin
  insert into public.kb_documents (id, organization_id, title, source, chunk, tags, sport, level)
  values
    (
      'kb-vb-01',
      v_org,
      'Fundamentos de recepcao no voleibol',
      'manual-tecnico-interno',
      'A recepcao deve priorizar plataforma estavel, ajuste de base e leitura antecipada da trajetoria.',
      '["recepcao","fundamentos","tecnica"]'::jsonb,
      'volleyball',
      'development'
    ),
    (
      'kb-vb-02',
      v_org,
      'Progressao de saque por faixa etaria',
      'ltd-volleyball-guidelines',
      'Iniciar com consistencia e alvo amplo; evoluir para variacao de direcao e pressao situacional.',
      '["saque","progressao","longo-prazo"]'::jsonb,
      'volleyball',
      'development'
    ),
    (
      'kb-vb-03',
      v_org,
      'Controle de carga em microciclo',
      'periodizacao-clube',
      'Alternar sessoes de alta e media intensidade e monitorar resposta subjetiva para reduzir risco.',
      '["carga","periodizacao","microciclo"]'::jsonb,
      'volleyball',
      'development'
    ),
    (
      'kb-vb-04',
      v_org,
      'Ensino de levantamento para base',
      'guia-metodologico',
      'Usar progressao do toque estatico para deslocamento curto antes de incluir tomada de decisao.',
      '["levantamento","base","ensino"]'::jsonb,
      'volleyball',
      'development'
    )
  on conflict (id) do update
    set title = excluded.title,
        source = excluded.source,
        chunk = excluded.chunk,
        tags = excluded.tags,
        sport = excluded.sport,
        level = excluded.level,
        organization_id = excluded.organization_id;
end $$;

commit;

select
  organization_id,
  sport,
  count(*) as docs
from public.kb_documents
group by organization_id, sport
order by docs desc;
