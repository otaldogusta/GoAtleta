# Correções da auditoria de código — GoAtleta

Data: 05/09/2026. Trabalho local sobre `8f8810db`, sem commit, push, deploy ou execução de migrações remotas. O relatório de diagnóstico permanece como fotografia anterior às correções em `2026-09-05-code-architecture-audit.md`.

## Resultado

Este documento preserva a primeira etapa. O estado posterior das pendências e da publicação está em [encerramento das correções](2026-09-05-code-audit-closeout.md).

Os contratos de sessão, cache, fila, chamada, planejamento, família e finanças foram corrigidos. Caminhos mortos do planejamento e do Assistant foram removidos depois de migrar seus consumidores. O salvamento semanal da periodização agora é um comando com entrada e resultado explícitos, separado dos estados e modais da rota.

O trabalho cobre os 21 achados da auditoria, com duas distinções: o gate de lint passou a bloquear crescimento e regressão, mas ainda há dívida histórica; as correções de banco e Edge só terão efeito remoto após publicação coordenada.

## Achados e alterações

| Achado | Correção aplicada | Evidência principal |
| --- | --- | --- |
| F01 — refresh tardio | Geração de identidade, refresh compartilhado e escrita de sessão serializada; respostas antigas não restauram nem removem outra conta. | `src/auth/session.ts`; testes de sessão e identidade |
| F02 — cache compartilhado | Namespace por usuário e organização; limpeza completa de chaves antigas/sufixadas; descarte de resposta obsoleta. | `src/db/client.ts`, `classes.ts`, `students.ts`, `OrganizationProvider.tsx` |
| F03 — fila sem origem | Envelope com identidade e organização; flush restrito ao autor; confirmação compara o payload para preservar edições durante envio. Legados sem origem ficam preservados em quarentena, com contagem no suporte. | `pending-write-identity.ts`, `pending-write-storage.ts`, `nfc-sync.ts`; SQLite real em memória |
| F04 — chamada parcialmente apagada | RPC transacional com escopo, validação, auditoria, idempotência e rollback. Mantém as permissões RLS existentes. | `replace_attendance_records_atomically`; 15 cenários SQL |
| F05 — dados privados em telemetria | Remoção de corpos e query values; metadados de requisição permitidos explicitamente. | `src/db/client.ts`; testes com dados sintéticos privados |
| F06 — anonimização quebrada | Campos reais do schema, transação de anonimização, leases, retomada, checkpoint de foto, tentativas limitadas e estados protegidos contra edição do cliente. Revoga vínculos e convites familiares e legados. | `lgpd-deletion-worker.ts`, `lgpd-process-dsr`, SQL LGPD |
| F07 — retry de webhook perdido | Receipt, projeção e conclusão na mesma RPC; falha não confirma entrega; lock e replay idempotente. | `asaas-webhook-handler.ts`, SQL financeiro |
| F08 — mistura de conta/ambiente | Namespace de conexão com organização/conta/ambiente; históricos ambíguos conservados sem origem inventada. Guarda rejeita novas escritas sem namespace e a FK composta impede conexão de outra organização. | Migração financeira, `asaas-sync.ts`, SQL financeiro |
| F09 — totais limitados a 250 | Agregado completo no servidor, separado das páginas; botão para carregar mais. | `src/api/finance.ts`, `ProviderReceivables.tsx`; teste com 301 recebimentos |
| F10 — atleta convertido em responsável | Guarda de identidade na criação, claim e alteração; revogação limpa acesso legado. Exclusão de conta continua compatível com `ON DELETE SET NULL`. | Migração familiar e Edge de convites |
| F11 — rascunho apagado durante carga | Restauração espera catálogo da mesma identidade; turma indisponível não apaga o rascunho. | `workspace-entry.ts`, `app/training/index.tsx` |
| F12 — Assistant no formulário morto | `aiDraft`, importações e links de criação alimentam o workspace ativo. | `workspace-entry.ts`, aplicação de treino e testes de entrada |
| F13 — plano/data inconsistente | Resolução única por data civil e regra de recorrência compartilhada com a camada de dados. | `src/core/resolve-training-plan-for-date.ts`; testes de data e sessão |
| F14 — duplicação após falha do calendário | Exclusão mútua de aplicação; persistência concluída retorna sucesso parcial quando calendário falha; modal não fecha durante gravação. | `apply-training-plan.ts`; regressões de falha parcial e repetição |
| F15 — save antigo sobrescreve outra data | Lock síncrono, bloqueio de navegação e identificação da carga; resposta antiga não muda mapas/toasts. A nova carga reinicia a fase visual. | Teste da rota real com promessa controlada, três cenários |
| F16 — pagador inelegível com acordo ativo | Remoção de `can_pay` e revogação usam a mesma transição auditada para pausar acordos. | `sync_tuition_payer_eligibility`; SQL financeiro |
| F17 — meses externos inacessíveis | Meses disponíveis incluem histórico do provedor, independentemente das invoices locais. | `finance-months.ts`, RPC e testes de meses |
| F18 — timeout mal classificado | Erro de timeout tipado, reconhecido pela política de rede/fila. | `src/db/client.ts`; regressões de timeout |
| F19 — publicação sem gates completos | `validate:app` inclui testes completos, tipos do app, SQL, lint controlado, arquitetura, perf do diff, escopo, JWT, encoding e assets. EAS depende do workflow reutilizável do mesmo commit; Vercel executa `build:verified`. | `package.json`, workflows, `vercel.json` |
| F20 — testes obsoletos e lint inutilizável | Contratos atualizados para os módulos canônicos; regressões comportamentais adicionadas. Baseline de erros anteriores exige poda após correção, bloqueando nova ocorrência e retorno de erro resolvido. | `scripts/lint-hygiene`, testes de auth/convites, novas regressões |
| F21 — dependências vulneráveis | `@xmldom/xmldom` 0.8.15 e decoder 0.5.0; adaptação CommonJS mínima mantém compatibilidade com React Navigation. Postinstall e teste de URL malformada com deadline verificam o contrato. | Overrides, lockfile, patch do decoder; audit de produção sem alertas |

## Redução de acoplamento

- `app/training/index.tsx`: cerca de 2.200 linhas líquidas removidas. Formulário inalcançável, handlers e estados sem consumidor saíram após migração dos caminhos ativos.
- `app/assistant/index.tsx`: cerca de 225 linhas líquidas removidas, incluindo seis callbacks descartados.
- `app/periodization/index.tsx`: cerca de 94 linhas líquidas removidas e hook antigo de 214 linhas eliminado. `edit-week-plan.ts` compartilha construção entre prévia e persistência; `save-week-plan.ts` recebe `{scope, existing, plan}`. Setters e fechamento da modal ficam na apresentação.
- Finanças: componentes de recebimentos, tipos de domínio, paginação e seleção de meses separados da composição principal. Agregação financeira continua no servidor.
- Contratos de fila e rollout financeiro documentados em `docs/architecture/offline-write-identity.md` e `docs/architecture/finance-provider-rollout.md`.

O grafo final tem 906 módulos e 3.570 imports internos; arquitetura strict passou com zero violações e baseline arquitetural vazio. Os números de linhas são aproximados e incluem comentários/espaços; não representam complexidade ciclomática.

## Validação local

| Verificação | Resultado |
| --- | --- |
| Jest completo | 410 suítes, 2.330 testes passaram |
| Regressão adicional de chamada | 3 testes da rota real passaram; novo arquivo criado após o inventário da execução completa |
| Repetição final de chamada + ratchet | 2 suítes, 8 testes passaram |
| PostgreSQL em memória | Três suítes PGlite; chamada com 15 cenários, finanças com 18, LGPD com ownership, rollback, lease, retomada, armazenamento e revogação |
| SQLite | Teste em banco real `:memory:` para armazenamento/ack da fila; sem skip |
| TypeScript do app | Passou |
| Deno | Check dos quatro Edge financeiros/familiares alterados e de `lgpd-process-dsr` passou |
| Arquitetura strict | Passou; zero violações |
| Performance strict do pacote recente | 74 telas verificadas usando base `6011a364` e worktree |
| Performance de release | Passou; base Git explícita. Ausência de histórico foi testada e bloqueia o gate |
| Escopo, JWT, encoding e assets | Passaram |
| Lockfile e patches | `npm ci --dry-run --ignore-scripts` e a repetição completa do postinstall passaram |
| Dependências de produção | `npm audit --omit=dev`: zero vulnerabilidades reportadas |
| Build web | Exportação concluída fora do repositório, com upload Sentry desativado |

O postinstall teve uma falha inicial de timeout de 2 segundos no probe de image-size enquanto Metro/validadores concorriam pela máquina. O patch estava aplicado; os probes isolados e a repetição completa do postinstall passaram. O dry-run do npm verifica o lockfile e não equivale a uma instalação limpa completa com todos os scripts executados.

Evidências detalhadas ficam em `.codex-tmp/code-audit-fixes-2026-09-05/`; não devem ser confundidas com provas de deploy. O build foi exportado para `C:/Users/gusta/AppData/Local/Temp/goatleta-code-audit-fixes-20260905-web-build`.

## Smoke no localhost

Validada navegação autenticada de coordenação, painel financeiro, biblioteca/visualização de plano, abertura da preparação de aplicação e cancelamento sem gravação. A data do plano e da preparação permaneceu `01/09/2026`. A visão da aula de `08/09/2026` corretamente não reutilizou esse plano pontual.

Também foram abertas a navegação de periodização, lista de turmas e chamada; a chamada concluiu a carga e liberou os controles de data, mantendo Salvar desabilitado sem alterações. Não foram submetidas gravações de presença, aplicação de planos, anonimização, emissão, pagamento ou convites contra o backend remoto. Os cenários destrutivos e concorrentes foram exercitados apenas com dados sintéticos nos testes.

A compilação inicial do Metro foi lenta e houve overlay transitório enquanto o hook de periodização era substituído; após estabilização, a navegação foi retomada. Isso não foi tratado como confirmação de UX durante o estado intermediário.

## Pendências explícitas

1. **Publicação coordenada ainda não realizada.** Há quatro novas migrações locais e cinco Edge alterados. A migração financeira é incompatível com os Edge antigos: seguir o documento de rollout, publicando os Edge financeiros novos primeiro e acompanhando a janela de respostas 503. Não fazer rollback para o schema/Edge antigos após namespace novo conter dados.
2. **Banco remoto ainda não validado.** PGlite executa SQL real, mas usa uma conexão serializada; não substitui teste concorrente com múltiplas conexões, storage real, políticas/extensions completas do projeto ou reconciliação das migrações aplicadas. A RPC de chamada deve existir antes da versão nova do cliente.
3. **Dívida de lint reduzida, não zerada.** Erros caíram de 357 para 309 e warnings de 279 para 222. Restam 219 diagnósticos de refs, 41 de memoização, 42 de setState em efeito, quatro de pureza e três de texto JSX. São diagnósticos que exigem triagem por arquivo; não equivalem a 309 bugs comprovados. `npm run lint` continua reportando essa dívida. Nenhuma regra foi desativada para obter o gate.
4. **Instrumentação global de performance.** O check do diff passou. Uma varredura adicional de todas as rotas apontou 25 arquivos sem markers exigidos pelo script; alguns são wrappers/redirects e precisam triagem de responsabilidade. O resultado não mede latência nem afirma que todas as telas estão instrumentadas. Releases sem base Git disponível falham, em vez de assumir diff vazio.
5. **Rotas ainda grandes.** Periodização, alunos, perfis e coordenação continuam candidatas a extrações incrementais de casos de uso e apresentação. O novo baseline de lint não pode crescer; ao corrigir um erro, incluir a poda correspondente no mesmo pacote.
6. **Pendências de produto permanecem separadas.** Checkout/pagamento real, reconciliação completa entre Asaas e mensalidades locais, reativação/reatribuição de acordos, estornos/cancelamentos e progresso familiar exigem entregas próprias. As flags de dinheiro real e emissão do provedor continuam desabilitadas.

O runtime de ferramentas foi alinhado ao Node 24 já usado localmente, incluindo CI e a configuração de build por `engines`. Nenhuma variável de ambiente remota ou segredo foi alterado. Artefatos e alterações anteriores do usuário foram preservados.
