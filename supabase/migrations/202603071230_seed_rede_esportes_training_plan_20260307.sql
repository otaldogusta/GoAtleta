with target_class as (
  select
    c.id as classid,
    c.organization_id
  from public.classes c
  join public.organizations o on o.id = c.organization_id
  where o.name ilike 'Rede Esportes%'
    and (
      c.name ilike 'Turma 8-11%'
      or c.name ilike 'Turma 8 11%'
    )
  order by c.created_at desc
  limit 1
),
payload as (
  select
    ('tp_20260307_' || replace(classid, '-', '_')) as id,
    classid,
    organization_id,
    'Plano de Aula - Mini Voleibol (07/03/2026)' as title,
    to_jsonb(array[
      'mini-volei',
      'turma-8-11',
      'fundamentos',
      'coordenacao'
    ]::text[]) as tags,
    to_jsonb(array[
      'Passar a bola pela frente e pelas costas',
      'Passar a bola entre as pernas em formato de 8',
      'Rolar a bola de um ponto ao outro',
      'Deslocamento em posicao de sapo com bola'
    ]::text[]) as warmup,
    to_jsonb(array[
      'Duplas: deslocamento com quique (bilateral e unilateral) e retorno de costas',
      'Duplas: toque com quique previo e passe ao colega',
      'Duplas: manchete com quique previo e passe ao colega',
      'Circuito: saltos no cone (1 perna, outra perna, 2 pernas)',
      'Circuito: saque por baixo em alvo + toque para o outro lado',
      'Jogo 1x1 com 1 quique permitido e rotacao rapida'
    ]::text[]) as main,
    to_jsonb(array[
      'Feedback rapido: facil, dificil e atividade preferida',
      'Confirmacao da chamada',
      'Alongamentos leves (bracos, pernas e tronco)',
      'Grito final da equipe: 1, 2, 3, REDE'
    ]::text[]) as cooldown,
    '15 min' as warmuptime,
    '35 min' as maintime,
    '10 min' as cooldowntime,
    array[6]::int[] as applydays,
    '2026-03-07'::date as applydate,
    '2026-03-07T10:00:00-03:00' as createdat
  from target_class
)
insert into public.training_plans (
  id,
  classid,
  organization_id,
  title,
  tags,
  warmup,
  main,
  cooldown,
  warmuptime,
  maintime,
  cooldowntime,
  applydays,
  applydate,
  createdat
)
select
  p.id,
  p.classid,
  p.organization_id,
  p.title,
  p.tags,
  p.warmup,
  p.main,
  p.cooldown,
  p.warmuptime,
  p.maintime,
  p.cooldowntime,
  p.applydays,
  p.applydate,
  p.createdat
from payload p
where not exists (
  select 1
  from public.training_plans tp
  where tp.classid = p.classid
    and tp.title = p.title
    and tp.applydate = p.applydate
);
