# Dados, sincronização e segurança

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

Supabase mantém dados e autorização remotos. O cliente combina REST/RPC, cache
por identidade e fila offline; SQLite nativo e armazenamento web têm adaptações
próprias. Segurança também atravessa cada módulo, não fica restrita a esta pasta.

| Entrada | Responsabilidade |
| --- | --- |
| [client.ts](../../../src/db/client.ts), [rest.ts](../../../src/api/rest.ts) | Requisições, identidade de sessão e tradução de erros |
| [session.ts](../../../src/auth/session.ts), [organization-async-identity.ts](../../../src/core/organization-async-identity.ts) | Invalidar operações quando identidade/organização mudam |
| [pending-write-identity.ts](../../../src/db/pending-write-identity.ts), [pending-write-storage.ts](../../../src/db/pending-write-storage.ts) | Capturar origem, serializar e deduplicar escritas |
| [nfc-sync.ts](../../../src/db/nfc-sync.ts) | Processar fila, pausar e conservar falhas/quarentena |
| [sqlite.ts](../../../src/db/sqlite.ts), [sqlite.web.ts](../../../src/db/sqlite.web.ts) | Persistência por plataforma |
| [migrations](../../../supabase/migrations/), [auth middleware](../../../supabase/functions/_shared/middlewares/auth.ts) | Schema/RLS/RPC e autenticação Edge |
| [BiometricGate.tsx](../../../src/security/BiometricGate.tsx) | Bloqueio local da interface; não substitui autorização remota |
| [lgpd-process-dsr](../../../supabase/functions/lgpd-process-dsr/index.ts), [lgpd-deletion-worker.ts](../../../supabase/functions/_shared/lgpd-deletion-worker.ts) | Solicitações e processamento de exclusão |
| [lgpd-export](../../../supabase/functions/lgpd-export/index.ts), [lgpd-retention-cron](../../../supabase/functions/lgpd-retention-cron/index.ts) | Exportação e retenção; exigir contexto e autorização próprios |

## Contratos a preservar

- Anexos de eventos usam bucket privado e FK organização/evento; RPCs de
  preparar/finalizar/remover exigem o administrador canônico e serializam a cota.
  Leitura segue a audiência existente do evento; URLs duram 60s e a sessão/origem
  capturadas invalidam respostas antigas. Schema/Storage ativados com autorização
  em 29/10 e smoke real de arquivos sintéticos concluído, sem publicar frontend.
  [Contrato, limites e limpeza](../../ui/AGENDA_ANOTACOES_ANEXOS_2026-10-29.md).

- Compartilhamento da quadra usa cópia isolada, tabela sem grants diretos e
  RPCs de gerenciamento restritas à turma/organização/autor. Leitura pública
  exige ID e código de 256 bits, guardado como hash; sem consulta ao documento
  original. Migration aplicada com autorização em 27/10; grants e RLS remotos
  conferidos. Smoke autenticado e publicação do cliente permanecem separados.
  [Contrato e limites](../../ui/QUADRA_COMPARTILHAMENTO_2026-10-27.md).

- A leitura financeira usa `get_student_financial_statuses_v1`, JSON escalar
  com até 5.000 IDs por chamada, `SECURITY INVOKER` e RLS/grants de tabela
  preservados. Só a ausência exata da assinatura permite os GETs legados;
  mudanças de contexto rejeitam o resultado. Migration aplicada apenas no
  Supabase isolado da tarefa em 25/10, sem ativação remota.
- Cache de leitura web usa IndexedDB com commit de transação; chaves continuam
  por usuário/workspace/organização. Legado AsyncStorage continua legível sem
  promoção na leitura; gravação nova não usa localStorage. Falha do cache não
  confirma persistência offline. Limpeza de leitura preserva auth, preferências
  e fila durável. Nativo conserva AsyncStorage. [Contrato e validações locais](../../operations/performance-lists-memory-local-2026-10-25.md).
- Uma requisição iniciada pela conta A não pode ser repetida com a sessão da B.
  Cache de leitura inclui usuário e organização; fila durável não é cache descartável.
- Em 23/10, turmas passaram a buscar unidades/classes em paralelo com guarda de
  sessão/geração. Aniversários usam projeção mínima e cache separado: offline,
  preservar a projeção mais recente, inclusive vazia; diretório novo invalida a
  projeção anterior. [Contrato, testes e limites locais](../../operations/performance-local-2026-10-23.md).
- Escrita offline captura `origin.userId` e `origin.organizationId` antes do envio.
  Envelope `queueVersion: 2`; legado sem origem fica em quarentena, sem apropriação
  pelo usuário atual. Confirmação não deve apagar edição posterior ao payload enviado.
- RLS e validação de recurso no servidor continuam obrigatórias mesmo com filtros
  de organização no frontend. JWT válido não concede todas as permissões.
- Na leitura de `attendance_logs`, a migration de 24/10 prepara os escopos
  autorizados uma vez por instrução em helpers privados que delegam aos
  autorizadores canônicos. O ramo do próprio aluno mantém o RLS de `students`;
  escritas/grants/helpers antigos não mudam. Revogações são relidas na próxima
  instrução, sem TTL de permissão. Política inesperada faz a migration abortar.
  Aplicada somente no banco isolado; [contrato e evidências](../../operations/performance-boot-soak-local-2026-10-24.md).
- `get_monthly_attendance_summary_v1` agrega o mês civil como `SECURITY INVOKER`,
  com organização explícita, RLS existente e execução somente por autenticados.
  Um JSON escalar conserva todos os grupos; falha não gera total parcial. Detalhes
  e nomes são lidos no clique XLSX, sob guarda de identidade/organização/geração.
  [Migration, equivalência e ativação apenas local](../../operations/performance-boot-soak-local-2026-10-24.md).
- No preflight remoto de 25/10, a policy de presenças tinha ramo legado ausente
  na fixture isolada: o guard da migration RLS abortaria, e nenhuma migration foi
  aplicada no destino. Resumo mensal tem compatibilidade paginada somente para
  assinatura RPC ausente; permissões e erros não acionam esse fallback.
  [Catálogo, decisão e limites](../../operations/performance-web-release-2026-10-25.md).
- A RPC aditiva `get_activity_review_context_v1` atende somente a coordenação
  administrativa: `SECURITY INVOKER`, gate de administrador e grants só para
  `authenticated`, mantendo o RLS das tabelas. Retorna turma/dia e revisões para a
  sugestão de pausa; o leitor legado permanece como compatibilidade até a ativação.
  As duas migrations de leitura e os índices de 24/10 foram aplicados só no banco
  isolado da tarefa. [Medições e validação](../../operations/performance-stress-local-2026-10-24.md).
- Consultoria mantém contexto capturado por operação e armazenamento v2 por
  usuário/organização, separado da fila geral. Legado v1 permanece intacto, sem
  adoção automática. GET/DELETE aceitam identidade esperada, como POST/PATCH.
  Ver [contrato e evidência da correção local](../../operations/consultation-and-rules-sync-local.md).
- Chamada usa `replace_attendance_records` transacional, sem fallback DELETE/POST.
  Aplicação remota da migration precisa de evidência separada da existência do SQL.
- Scouting por jogada usa `apply_scouting_command`: trava/revisão por sessão,
  recibo idempotente e escrita atômica de pontos, ações e contagens legadas.
  Rascunho e comando pendente incluem usuário/organização/sessão. Migration
  `20261007112922` aplicada e gravação real validada em 07/10; `rally_event_id` e
  `capture_zone` preservam campos legados homônimos. [Evidência e limites](../../ui/SCOUTING_IMPLEMENTACAO_2026-10-07.md).
- Não registrar tokens, conteúdo privado ou links de recuperação. A sanitização de
  [navegação](../../../src/observability/navigation-privacy.ts) remove parâmetros e
  normaliza segmentos conhecidos; novos eventos devem ser revisados explicitamente.
- Scouting em vídeo tem documento editável por organização/sessão/fingerprint,
  separado das estatísticas e da projeção compartilhada somente leitura. A
  [migration](../../../supabase/migrations/20261017004249_scouting_video_documents.sql)
  usa RPCs de staff/admin, revisão esperada e recibo de intenção idempotente;
  sessão concluída permite leitura, sem novas gravações. Cache mantém usuário,
  origem e pendências; conflito exige escolha e cópia de ambas as versões.
  Backend ativado em 17/10, com RLS/grants e gravação real conferidos;
  [ativação e publicação](../../operations/scouting-sync-release-2026-10-17.md). Ver
  [contrato do estúdio](../../ui/SCOUTING_VIDEO_IMPLEMENTACAO_2026-10-12.md#sincronização-editável-entre-aparelhos--16102026).

## Decisões e fontes

- [Identidade offline](../../architecture/offline-write-identity.md): contrato atual
  confirmado nas implementações acima; inclui manejo conservador do legado.
- [Segurança](../../security/overview.md): referência de postura. A quantidade de
  checks é definida pela [escada de validação](../../operations/validation-ladder.md),
  sem transformar toda edição documental em release.
- [Auditorias de setembro](../../audits/2026-09-05-code-audit-closeout.md) e
  [arquivo de segurança](../../archive/security/): evidência histórica, não auditoria
  do ambiente atual. Não reaplicar planos antigos automaticamente.

## Validação relevante

Testes localizados, **não executados nesta organização documental**:
[identity-and-offline](../../../src/db/__tests__/identity-and-offline.test.ts),
[pending-writes-nfc](../../../src/db/__tests__/pending-writes-nfc.test.ts),
[biometric-lock](../../../src/security/__tests__/biometric-lock.test.ts),
[account-deletion-contract](../../../supabase/functions/_shared/__tests__/account-deletion-contract.test.ts).
Para alterar esses contratos: testes focados, `typecheck:app`, `check:org-scope`,
casos negativos de conta/organização e SQL isolado conforme a escada. Harnesses:
[chamada atômica](../../../scripts/validation/attendance-atomic-sql.mjs) e
[LGPD](../../../scripts/validation/lgpd-deletion-sql.mjs).
Mocks e checks estáticos não certificam RLS nem exclusão real em produção.
Na continuação local de 05/10, os testes de identidade/offline e os novos casos de
consultoria foram executados; resultados no relatório vinculado acima.
