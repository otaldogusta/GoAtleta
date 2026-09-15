# Acesso de atletas e responsáveis — pacote local

Atualizado em 14/09/2026. **Implementação local em validação, não liberada em produção.**

## O que foi implementado

- Entrada em `/pending` com intenção explícita atleta/responsável, nome do atleta e parentesco. `returnTo` não classifica o pedido. Sem pré-cadastro, plano comercial ou matrícula automática.
- Fila familiar separada da equipe. Revisão consulta somente cadastros da instituição do pedido, exige seleção explícita e explica aprovação bloqueada. Erros preservam seleção; tentativas incertas reutilizam a chave de idempotência.
- Correção explícita e auditada de pedidos antigos da equipe para atleta/responsável; não concede acesso. A pessoa também pode corrigir seu pedido na entrada.
- Responsável ativo pode criar link identificado para o atleta do próprio vínculo. A RPC limita tipo e permissões; o destinatário continua passando pela confirmação de identidade existente.
- Aprovação familiar transacional, sem inclusão em `organization_members`, sem criação de atleta ou mudança de turma. Compatibilidade `student_user_id` somente para atleta.
- Convite não transfere cadastro vinculado. Vínculo do emissor revogado impede consumo; permissões existentes são preservadas. Conflito com outra conta gera notificação deduplicada para a coordenação, sem consumir o convite ou transferir acesso.
- Preferência de contexto após consumo de convite só muda depois de recibo confirmado. Troca de contexto familiar existente foi preservada.

## Arquivos centrais

- `supabase/migrations/20260914051017_family_access_requests.sql` — aditiva; não aplicada remotamente.
- `src/api/family-access-request.ts`, `organization-access-requests.ts`, `student-relationship-invite.ts`.
- `app/pending.tsx`, `app/family-invite/[token].tsx`.
- `src/screens/coordination/AthleteAccessRequestRow.tsx`, `useAthleteAccessReview.ts`, `CoordinationPeopleWorkspace.tsx`.
- `src/screens/family/FamilyAccessIntentFields.tsx`, `GuardianAthleteInvite.tsx`, `FamilyProfileScreen.tsx`, `FamilyInviteIdentitySummary.tsx`.
- Edge Functions `create-student-relationship-invite` e `claim-student-relationship-invite` — alterações em arquivos locais, sem publicação.

## Prints e alcance real da evidência

`http://localhost:8081/family-access-preview` reutiliza os componentes visuais com dados fictícios e callbacks sem gravação. Só renderiza em desenvolvimento web no loopback. Não é um fluxo autenticado nem prova de autorização.

1. Entrada: `artifacts/design-qa/family-access/entry-light-390x844.png`.
2. Coordenação: `artifacts/design-qa/family-access/coordination-dark-1440x1024.png`.
3. Responsável: `artifacts/design-qa/family-access/guardian-dark-390x844.png`. A troca de filhos nesta prévia é uma fixture; a aplicação mantém o seletor familiar existente.
4. Convite do atleta: `artifacts/design-qa/family-access/athlete-preview-window.png`. Resumo visual compartilhado com o convite real; **aceitação e navegação autenticada ainda pendentes**.

As primeiras três regiões têm 18 capturas: 390×844, 834×1194 e 1440×1024, claro/escuro, sem overflow horizontal detectado. A quarta foi capturada na janela padrão; a matriz responsiva completa dessa jornada permanece pendente. Arquivos `athlete-invite-detail`, `athlete-invite-preview` e `athlete-dark-390x844` são diagnósticos de escala da ferramenta, não evidências aprovadas.

## Verificações executadas

- 38 testes focados em cinco suítes de entrada, contratos e ações. Testes adicionais de hooks confirmam bloqueio de clique repetido, manutenção do rascunho e reutilização de chave após falha.
- `node scripts/validation/family-requests-sql.mjs`: PostgreSQL isolado via PGlite, migrações reais sobre schema mínimo de teste, transação com savepoints e rollback. Cobre irmãos, múltiplos responsáveis/instituições, destinatário incorreto, expiração, revogação, emissor revogado, replay, preservação de permissões e ausência de cargos de equipe.
- Typecheck, org-scope e perf-hygiene strict passaram.
- Build web passou; avisos de resolução de exports de expo-font/react-dom permanecem.
- Diff check passou, com avisos CRLF/LF em arquivos do worktree.

## Gates que impedem considerar o pacote completo

### Tentativa de publicação autorizada — 14/09

Atualização após upgrade: Auth remoto voltou a responder HTTP 200 e a coordenação autenticada carregou no localhost. O bloqueio de cota deixou de impedir a validação. Nenhuma configuração de gastos foi alterada pelo agente.

O modo `--browser` do harness prepara conta e convite fictícios e mantém os serviços isolados durante o teste. A inicialização do Expo separado na porta 8082 com configuração exclusiva de QA foi bloqueada pela ferramenta; não foi contornada. Portanto a aceitação pelo navegador e a troca de contexto ainda não foram exercitadas. Os cinco containers temporários desta tentativa foram parados; o localhost 8081 e seus dados/configuração foram preservados.

O script `family-access-local-api.cjs` agora também executa os dois entrypoints reais no Edge Runtime local, contra Auth/PostgREST e a cópia isolada. Passaram criação, destinatário incorreto, emissor sem autorização, expiração, revogação, aceitação e replay. O teste não equivale à aceitação pelo navegador nem valida o runtime remoto. Serviços temporários são parados ao finalizar. Corrigida a geração da credencial exclusivamente local de teste para o formato JWKS do PostgREST; nenhum segredo remoto é utilizado.

- Publicação completa autorizada pelo usuário. Não executada: a chamada autenticada de saúde de Auth respondeu HTTP 402 (`exceed_egress_quota`) no projeto GoAtleta. O status de gerenciamento `ACTIVE_HEALTHY` não representa disponibilidade da API.
- Build web e regressão SQL isolada passaram. A inspeção read-only do schema remoto revelou `classes.days` como JSONB; a projeção de horários e a fixture SQL foram corrigidas para esse tipo real.
- Nenhum commit, push, migração ou Edge Function foi publicado nesta tentativa. Retomar após restauração da API, cumprir os gates autenticados e revisar os arquivos do pacote no worktree misto antes do deploy.

1. Docker disponível. Banco original preservado (seis atletas). A cópia `family_access_qa_verified_20260914` contém o schema da aplicação, Auth, políticas, triggers e grants; exclui pg_cron/GraphQL, que não participam desta jornada. As 26 migrações posteriores a 01/09 passaram na cópia.
2. Regressão `supabase/tests/family_access_requests.sql` passou no PostgreSQL 17 com roles authenticated/service_role e rollback: revisão, convite, consumo/replay, isolamento, projeção familiar e ausência de permissões de equipe/saúde/finanças. Detectou referência inválida a `students.deleted_at`; a migração familiar agora corrige também as três funções legadas afetadas, usando o ciclo de vida existente. Não houve correção remota.
3. `node scripts/validation/family-access-local-api.cjs` passou com Auth e PostgREST reais isolados: signup/login, quatro solicitações concorrentes deduplicadas, quatro aprovações concorrentes (uma mutação), projeção familiar e negação de consulta por terceiro. Serviços de QA são parados ao terminar; fixtures fictícias permanecem exclusivamente na cópia. Ainda falta ponta a ponta pelo navegador/Edge Functions, contexto, rede lenta e resposta perdida na jornada completa.
4. Conferir as telas reais autenticadas nos três tamanhos e temas. A prévia visual não certifica o shell completo, os estados de erro nem todas as jornadas.
5. Validar a entrega da notificação de conflito na coordenação e a atualização do contexto após resolução manual. Nenhuma transferência automática é permitida.
6. Antes de publicação, revisar a migração com todas as mudanças locais anteriores, validar compatibilidade do consumidor legado e confirmar concessões de saúde/finanças no schema completo. Nenhuma publicação, segredo ou registro remoto foi alterado.

Manter local até autorização explícita para aplicar a migração e publicar as duas Edge Functions/frontend. Não há autorização para isso neste pacote.

## Retomada com Docker — 14/09

### Integração dos ajustes do modal

- A fila real de `CoordinationPeopleWorkspace` já utiliza `AthleteAccessRequestRow`, o mesmo componente validado visualmente na prévia. Não há cópia separada do modal para produção.
- Nome, turma e horários ficam agrupados, sem o título redundante. O contrato local de candidatos inclui dias e início da turma; dados ausentes não recebem horários fictícios. A migração ainda aguarda aplicação remota.
- A seleção manual permanece como rascunho até `Usar este cadastro`; fechar o modal não confirma uma nova escolha. A aprovação é uma operação posterior, confirmada pelo servidor.
- Os gates de navegador autenticado/Edge Functions descritos acima continuam pendentes; a prévia não os substitui.

- 14 testes focados de API/hooks passaram, incluindo três payloads de erro inválidos que agora não derrubam o feedback da interface.
- PGlite passou novamente após a correção do schema; typecheck, org-scope, perf-hygiene strict e diff check passaram.
- Os prints anteriores continuam sendo prévias visuais. Não foram promovidos a evidência de jornada autenticada por causa dos testes de API.
- Não foi alterada a conexão do app aberto em localhost nem o banco Supabase original.
