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
| [CalendarEventEditor.tsx](../../../src/screens/calendar/CalendarEventEditor.tsx), [api/events.ts](../../../src/api/events.ts) | Eventos na Agenda, vínculos de turmas e verificação de regras para torneios; /events permanece como alias. |
| [holiday-decisions.ts](../../../src/api/holiday-decisions.ts) | Pausas `no_training`, leitura da decisão por data e RPC `decide_organization_holiday`. |

## Contratos a preservar

- A Agenda é a entrada única de eventos. O editor explícito abre na data selecionada,
  mantendo mês/unidade/lista ao fechar; detalhe e edição podem ocorrer no calendário.
  Aliases antigos e links de detalhe são preservados. Regras de torneios, gestão
  administrativa e leitura restrita de atletas continuam existentes.
  [Composição e validação local](../../ui/AGENDA_EVENTOS_INTEGRADOS.md).

- Relatórios por intervalo e chamadas globais leem conjuntos completos sob cap
  do servidor. Chamada usa cursor data/ID e índice aditivo, validado só em backend
  isolado local. Totais, erros e negação devem conservar seus estados distintos;
  [carga pesada, tempos e limites](../../operations/performance-stress-local-2026-10-24.md).

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
- PDF web usa uma única fronteira assíncrona compartilhada em
  [pdf-runtime.web](../../../src/pdf/pdf-runtime.web.tsx), incluindo documentos e
  renderer; preservar dados/HTML/nome de arquivo capturados antes do await.
  Nativo conserva a exportação HTML. Evidência e limites do pacote local de
  24/10 em [Desempenho local](../../operations/performance-local-2026-10-23.md).
- Eventos e decisões de feriado conservam organização e recorte de data; o calendário
  do professor exclui aulas com pausa explícita ao compor o dia. O mês compacto
  seleciona uma data e exibe sua agenda completa por horário; filtros afetam
  tanto os marcadores quanto a lista. No ajuste Samsung de 26/10, calendário e
  lista passaram a uma coluna em todas as larguras, substituindo as duas colunas.
  A semana começa no domingo; o mês usa suas 4–6 semanas reais e pontos por dia.
  O topo móvel foi unificado; coluna de até 440px, seletor direto de mês/ano
  e barra rápida de 48px conservam a densidade sem esticar em telas largas.
  Dias passados ficam atenuados, mantendo a
  seleção legível. Unidade usa seletor ancorado com Todas como padrão; retorno
  de turma conserva a unidade escolhida. No celular, `CalendarWeekPager` permite
  rolagem horizontal com encaixe entre as semanas da grade, mantendo o dia da
  semana selecionado; o título abre o seletor de mês/ano.
  Calendário e lista diária ficam no fluxo da página, sem modal/portal ou fundo escuro.
  `useEventSheetGesture` compartilha o progresso entre `CalendarFold` e a lista:
  subir recolhe o mês até a semana selecionada; descer no início da lista expande
  o mês. A altura liberada passa para os eventos durante o próprio arrasto.
  O encaixe usa posição/velocidade; deslocamento excedente rola a lista.
  A barrinha só clareia no hover/pressionamento; roda/trackpad acumulam distância
  também no desktop, sobre grid e lista. O topo não duplica um botão de dobra;
  Enter/Espaço na grade conservam a alternativa de teclado. Na web, mês e
  paginador semanal permanecem montados por todo o gesto/encaixe; o mês traduzido
  cobre a semana enquanto o paginador mede/alinha, evitando troca com quadro vazio.
  O adapter controla um único encaixe de 180ms; novo gesto cancela timer/conclusão
  anterior. Wheel aguarda 350ms de pausa, e endpoints habilitam a lista imediatamente.
  Na web, ganho 0,5 na dobra e 1 na lista transferem a sobra nos dois sentidos
  sem novo gesto; medidas atuais limitam a rolagem, e abertura explícita normaliza
  a lista. [Referência e validação de gestos em 27/10](../../ui/AGENDA_GESTOS_REFERENCIA_2026-10-27.md).
  A leitura dos planos
  mostra indicador ao lado do ano sem acrescentar faixa ou deslocar a agenda.
  Referência observada na Agenda Samsung via ADB em 23/10. Movimento reduzido
  elimina a animação de encaixe, preservando o acompanhamento do gesto.
  Testes cobrem contração intermediária de 30/60 px, retenção dos sete eventos
  e ausência de posicionamento absoluto. APK local Perf instalado por ADB em 23/10
  com bundle embarcado (OTA desabilitado somente nesse APK), mantendo dados.
  Teste físico no Samsung confirmou arrasto mês/semana no fluxo e acesso ao último
  dos sete eventos. O paginador realinha a semana selecionada após medir o conteúdo
  nativo, evitando abrir na primeira semana por uma chamada prematura de scroll.
  No Android, o adaptador `useNativeCalendarGesture.native` usa Gesture Handler e
  Reanimated já instalados: uma distância compartilhada consome primeiro a
  contração do mês e depois a lista, permitindo reversão no mesmo toque.
  Coordenadas absolutas evitam realimentação causada pelo painel em movimento;
  a inércia permanece na lista e não expande o mês sozinha. Em 23/10, duas
  posições mantidas no Samsung confirmaram deslocamento adicional de 100/100 px,
  passagem mês/lista sem soltar, reversão e acesso ao último evento. Web mantém
  seu adaptador de ponteiro/roda; comparação física não é benchmark de FPS.
  `NativeCalendarFold` mantém mês e paginador montados no mesmo viewport
  durante gesto, reversão e encaixe. A visibilidade muda na thread de UI;
  `interacting` controla apenas interação/acessibilidade, sem remontar o calendário.
  Teste de regressão confirma uma montagem do paginador em sete posições. APK
  instalado em 23/10 às 16:52 e conferido no Samsung: três recolhimentos gravados,
  264 frames extraídos sem desaparecimento da seleção. Arrasto e inversão rápida
  preservaram dia 24; swipe horizontal e Hoje permaneceram funcionais.
  O paginador começa no offset da semana selecionada e só altera a data após
  um swipe horizontal real terminar; scroll de montagem/alinhamento é ignorado.
  Touch-down interrompe a animação e incrementa a geração do gesto; callbacks
  antigos não encerram a interação nova. Em 23/10, ciclos rápidos preservaram
  dia 24 e Hoje (23), mantendo o swipe horizontal intencional de 24 para 31.
- A agenda do aluno usa sua turma/organização e abre `/student-plan` com `classId` e
  `date`. Ela deriva horários das turmas; não presume paridade com eventos/pausas do calendário.

## Decisões atuais e limites

- Continuação local de 24/10: a abertura do relatório mensal lê contagens por
  turma/dia via `get_monthly_attendance_summary_v1`, `SECURITY INVOKER` sob o RLS
  vigente; não baixa os registros individuais. XLSX busca o mês completo no clique,
  com proteção de identidade/organização/mês/geração até o download. A nova
  migration habilita a leitura agregada. No preflight de 25/10, foi encontrado
  o servidor remoto sem essa RPC: somente ausência exata da assinatura permite
  ler/agregar o mês completo pelo leitor paginado canônico, sob o mesmo RLS.
  Negação, falha, payload inválido ou troca de contexto mantêm erro sem total parcial.
  [Compatibilidade de release](../../operations/performance-web-release-2026-10-25.md).
  [Comparação, testes e ativação local](../../operations/performance-boot-soak-local-2026-10-24.md).
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
