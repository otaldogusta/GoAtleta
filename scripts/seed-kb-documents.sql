-- Replace with your org uuid before running in Supabase SQL Editor
-- Example: set v_org_id = '00000000-0000-0000-0000-000000000000'::uuid;

do $$
declare
  v_org_id uuid := 'REPLACE_WITH_ORG_ID'::uuid;
begin
  insert into public.kb_documents (
    id,
    organization_id,
    title,
    source,
    chunk,
    tags,
    sport,
    level,
    created_at
  )
  values
    (
      'kb-ltd-001',
      v_org_id,
      'LTD Volleyball 3.0 - Progressão por estágios',
      'LTD 3.0',
      'Para evolução técnica em base, a sessão deve priorizar repetição de qualidade, critérios observáveis e progressão do simples para o complexo com feedback curto e objetivo.',
      '["ltd","progressao","tecnica"]'::jsonb,
      'volleyball',
      'development',
      now()
    ),
    (
      'kb-vv-001',
      v_org_id,
      'VolleyVeilig - Bloco preventivo',
      'VolleyVeilig',
      'Cada sessão deve incluir um bloco preventivo no aquecimento focado em ombro, core e controle de aterrissagem para reduzir risco de lesão e melhorar prontidão neuromuscular.',
      '["volleyveilig","preventivo","aquecimento"]'::jsonb,
      'volleyball',
      'development',
      now()
    ),
    (
      'kb-joel-001',
      v_org_id,
      'Gestão de carga por percepção de esforço',
      'Joel SPT Notes',
      'A carga da sessão pode ser ajustada por RPE grupal, reduzindo volume e impacto quando sinais de fadiga aumentam e mantendo qualidade técnica como métrica principal de decisão.',
      '["rpe","carga","fadiga"]'::jsonb,
      'volleyball',
      'development',
      now()
    ),
    (
      'kb-games-001',
      v_org_id,
      'Jogos condicionados para transferência',
      'Coaching Notes',
      'Jogos condicionados com regra de pontuação alinhada ao foco técnico melhoram transferência para contexto real quando combinados com critérios de sucesso mensuráveis.',
      '["jogo-condicionado","transferencia","criterios"]'::jsonb,
      'volleyball',
      'development',
      now()
    )
  on conflict (id) do update
  set
    organization_id = excluded.organization_id,
    title = excluded.title,
    source = excluded.source,
    chunk = excluded.chunk,
    tags = excluded.tags,
    sport = excluded.sport,
    level = excluded.level,
    created_at = excluded.created_at;
end $$;
