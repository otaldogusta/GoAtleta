# Regulamentos, indicadores e relatórios operacionais

Leitura do código em 05/10/2026, base `d5120cff`. Este módulo mapeia consumidores e
contratos locais; não atesta atualização das fontes nem execução remota de sincronização.

## Responsabilidades e entradas

Manter fontes/versionamento de regulamentos, interpretar cláusulas por contexto e
apresentar atualizações. Consolidar presença, sessões e scouting em indicadores e
exportações; apresentar agenda, eventos e pausas. Leia ao alterar calendário, regras
de torneio, início do professor/coordenação ou relatórios.

| Arquivo principal | Responsabilidade atual |
| --- | --- |
| [regulation-history.tsx](../../../app/regulation-history.tsx), [RegulationDashboardPanels.tsx](../../../src/screens/regulations/RegulationDashboardPanels.tsx) | Histórico, fontes, versões, diferenças e ações do painel. |
| [regulation-sources.ts](../../../src/api/regulation-sources.ts), [regulation-updates.ts](../../../src/api/regulation-updates.ts) | CRUD escopado de fontes, sync manual, avisos e leitura de atualizações. |
| [regulation-rule-sets.ts](../../../src/api/regulation-rule-sets.ts) | Versões, políticas de ativação, cláusulas e comparação. |
| [regulation-sync-core.ts](../../../supabase/functions/_shared/regulation-sync-core.ts) | Busca, checksum, documentos e nova versão para próximos ciclos. |
| [rules-sync](../../../supabase/functions/rules-sync/index.ts), [rules-sync-admin](../../../supabase/functions/rules-sync-admin/index.ts) | Entradas de sincronização de serviço e administrativa. |
| [clause-engine.ts](../../../src/regulation/clause-engine.ts), [tournament-rule-check.ts](../../../src/regulation/tournament-rule-check.ts) | Resolução de overrides e validação de torneios. |
| [reports/trainer.tsx](../../../app/reports/trainer.tsx), [useTrainerReportsData.ts](../../../src/screens/reports/hooks/useTrainerReportsData.ts) | Período/turma, carga de dados e exportação do relatório de professor. |
| [trainer-report-selectors.ts](../../../src/screens/reports/application/trainer-report-selectors.ts) | Agregação de presença, PSE, sessões e destaques. |
| [reports.ts](../../../src/api/reports.ts), [load-coordination-dashboard.ts](../../../src/screens/coordination/application/load-coordination-dashboard.ts) | Pendências operacionais, membros e leituras do painel. |
| [export-xlsx.ts](../../../src/utils/export-xlsx.ts), [exportStudentsXlsx.ts](../../../src/screens/students/export/exportStudentsXlsx.ts) | Workbook/compartilhamento por plataforma e exportação cadastral. |
| [HomeProfessor.tsx](../../../src/screens/home/HomeProfessor.tsx), [HomeAdmin.tsx](../../../src/screens/home/HomeAdmin.tsx) | Início, aulas e ações; administrador reutiliza `HomeProfessorScreen` com `adminMode`. |
| [calendar.tsx](../../../app/calendar.tsx) | Calendário do professor com turmas, planos, eventos e pausas. |
| [agenda/index.tsx](../../../app/agenda/index.tsx), [student/agenda.tsx](../../../app/student/agenda.tsx) | Agenda por horários de turma, exportação ICS e alias do aluno. |
| [events/index.tsx](../../../app/events/index.tsx), [api/events.ts](../../../src/api/events.ts) | Eventos institucionais, vínculos de turmas e verificação de regras para torneios. |
| [holiday-decisions.ts](../../../src/api/holiday-decisions.ts) | Pausas `no_training`, leitura da decisão por data e RPC `decide_organization_holiday`. |

## Contratos a preservar

- Fontes, versões, cláusulas e atualizações carregam `organizationId`; preservar
  filtros da organização nas leituras, alterações e resolução de regras.
- Versões distinguem `draft`, `active`, `pending_next_cycle`, `archived` e políticas
  `new_cycles_only`, `effective_from`, `immediate`; não substituir esses estados por booleano.
- O sincronizador detecta alteração por checksum e cria/reutiliza versão pendente
  para próximos ciclos. Detectar um documento não autoriza reescrever ciclos anteriores.
- Um torneio existente conserva seu `existingRuleSetId`; novo torneio consulta a
  versão aplicável. Evento que não é torneio retorna sem essa validação.
- O motor aplica o primeiro override compatível com o contexto; sem correspondência
  usa `baseValue`. Preservar precedência e tipos de cláusula.
- Painel operacional não pode transformar falha crítica de membros/convites em
  snapshot vazio de sucesso; indicadores opcionais carregam depois e podem falhar à parte.
- Relatórios devem conservar recorte de mês/turma, deduplicação da sessão mais recente
  por turma/data e normalização de percentuais. Exportação deve refletir o recorte exibido.
- Planilhas mantêm cabeçalhos em [export-schemas.ts](../../../src/utils/export-schemas.ts) e adaptador comum
  para escrita/download/compartilhamento; não replicar lógica de exportação em cada tela.
- Eventos e decisões de feriado conservam organização e recorte de data; o calendário
  do professor exclui aulas com pausa explícita ao compor o dia.
- A agenda do aluno usa sua turma/organização e abre `/student-plan` com `classId` e
  `date`. Ela deriva horários das turmas; não presume paridade com eventos/pausas do calendário.

## Decisões atuais e limites

- `/reports` redireciona a `/coord/management`; `/coord/dashboard` usa `HomeAdmin`.
  Não recuperar uma arquitetura antiga só pelo nome de rota.
- `/regulation-sources` é alias do histórico; não é um segundo painel independente.
- O Assistente tem [regulation-resolver.ts](../../../supabase/functions/assistant/regulation-resolver.ts)
  para consumir esse domínio; uma resposta textual não substitui a versão persistida.
- Correção local posterior em 05/10: `rules-sync-admin` usa `req` consistentemente
  no handler/CORS/headers. [12 testes do handler](../../../supabase/functions/_shared/__tests__/rules-sync-admin-handler.test.ts)
  reproduziram a falha anterior e passaram após a correção; dependências remotas simuladas.
- Download, parsing da fonte, cron, autorização remota e entrega de avisos não foram
  exercitados. Checksums e painel existente não comprovam atualização normativa correta.

## Documentação existente e precedência

- [Fronteira da coordenação](../../audits/2026-09-05-coordination-data-boundary.md):
  decisões de carga ainda reconhecíveis no código; métricas/testes e publicação são históricos.
- [Catálogo pedagógico](../../catalog-pedagogico/README.md): índice próprio para auditoria
  de uso de atividades; consultar os documentos de insights apenas quando esse painel mudar.
- [Índice documental](../../README.md): entrada para guias especializados existentes;
  arquivos em `archive` ou propostas não prevalecem sobre contratos atuais verificados.

## Validação relevante

Organização inicial: inspeção estática. A [correção local posterior](../../operations/consultation-and-rules-sync-local.md)
registra testes executados e limitações; sem sincronização remota nesta tarefa.
O [runtime local posterior](../../operations/consultation-authenticated-local-smoke-2026-10-05.md)
validou o handler real com Auth/PostgREST isolados e fonte inativa, sem download
ou publicação da função.

- [Testes de regulamento](../../../src/regulation/__tests__/): overrides, duração mínima,
  avisos e exclusão de eventos não torneio; [regulation-updates.test.ts](../../../src/api/__tests__/regulation-updates.test.ts).
- [Seletores de relatório](../../../src/screens/reports/application/__tests__/trainer-report-selectors.test.ts),
  [reports.test.ts](../../../src/api/__tests__/reports.test.ts) e [testes da coordenação](../../../src/screens/coordination/application/__tests__/).
- [Testes do início](../../../src/screens/home/__tests__/), [feriados](../../../src/core/__tests__/holidays.test.ts)
  e [eventos na agenda do professor](../../../src/screens/planning/application/__tests__/professor-agenda-events.test.ts).
- Ao mudar persistência/regras/escopo, usar nível de dados da [escada](../../operations/validation-ladder.md);
  exportação e sincronização exigem conferência do artefato/fluxo real afetado.
