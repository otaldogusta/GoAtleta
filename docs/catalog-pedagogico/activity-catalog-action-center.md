# Activity Catalog Action Center

## Objetivo

O Action Center transforma a auditoria interna do Catalogo GoAtleta em uma area pratica para decisao pedagogica.

Ele ajuda a responder:

- quais pontos precisam de atencao primeiro;
- quais variantes devem ser revisadas;
- quais habilidades precisam de expansao;
- quais achados podem virar uma proxima branch;
- como copiar um pacote de acao em Markdown sem acessar dados sensiveis.

## Fontes

O painel continua derivado apenas de:

- `buildActivityCatalogAuditReport(trainingPlans)`;
- `buildActivityCatalogInsights(auditReport)`;
- catalogo estatico em TypeScript;
- metadados `TrainingPlan.pedagogy.blocks.activities[].catalog`.

Nao ha nova busca no Supabase dentro do core, nova tabela, migration, analytics remoto ou persistencia de filtros.

## O que mostra

- resumo executivo com familias, variantes, usos, insights altos, variantes nunca usadas e referencias antigas;
- centro de acao com insights filtraveis por prioridade;
- detalhe de insight em modal;
- variantes relacionadas quando o proprio relatorio permite inferir;
- referencias desconhecidas quando existirem;
- export copiavel em Markdown;
- export copiavel em JSON;
- pacote Markdown de acao por insight.

## Privacidade

O export e agregado e orientado ao catalogo.

Pode incluir:

- contagens;
- skills;
- `familyId`;
- `variantId`;
- titulos de variantes do catalogo;
- insights;
- evidencias e acoes sugeridas.

Nao deve incluir:

- nomes de alunos;
- emails;
- professores;
- unidades;
- nomes reais de turmas;
- scouting bruto;
- relatorios comportamentais;
- conteudo completo de planos.

## Limites

O Action Center nao:

- chama IA ou LLM;
- altera planos;
- altera `TrainingPlan`;
- altera `decisionTrace`;
- altera PDF;
- adiciona atividades ao catalogo automaticamente;
- mede qualidade real da aula;
- substitui revisao pedagogica humana.

## Fluxo local-first

Toda evolucao do painel deve ser validada localmente antes de PR:

```bash
npm run web -- --port 8081
```

Smoke minimo:

- `/reports` carrega sem erro de console relevante;
- `/coord/reports` carrega sem erro de console relevante;
- se a sessao tiver permissao admin/coord, abrir a aba `Catalogo`;
- validar resumo, insights, detalhe e botoes de copia/export.

Se a sessao local nao exibir a aba admin, os testes de componente devem cobrir o conteudo interno e a limitacao deve ser registrada no PR.
