# Tooling

Este pacote prepara CLIs e scripts de engenharia sem tocar na logica pedagogica, na periodizacao ou na geracao de treinos do GoAtleta.

## Ferramentas instaladas

- `knip`: diagnostico de codigo morto, arquivos nao usados e exports redundantes
- `dependency-cruiser`: validacao de fronteiras arquiteturais
- `Playwright`: base para E2E web
- `Maestro`: template para E2E mobile, depende de instalacao externa
- `Sentry CLI`: informacoes de release e sourcemaps, sem secrets no repo
- `qrcode`: geracao local de QR para PDFs e links de demonstracao
- `FFmpeg`: pipeline futuro de video, tratado como ferramenta externa
- `GoAtleta Planner CLI`: placeholder de CLI interna
- `Higgsfield`: provider real com fallback para mock, sem secrets no repo

## Scripts de rotina

Estes comandos sao os mais seguros para uso continuo:

- `npm run check:architecture`
- `npm run tools:check`
- `npm run typecheck:core`
- `npm run typecheck:app`
- `npm run test:core`
- `npm run test:media-generation`
- `npm run test:media-generation:handoff`
- `npm run test:media-generation:queue`
- `npm run test:media-generation:registry`
- `npm run test:exercise-media:approval`
- `npm run check:encoding`

`tools:check` roda apenas a checagem de arquitetura. O `knip` fica separado porque ainda e diagnostico e nao bloqueante.

## Scripts de diagnostico

Estes comandos ajudam na manutencao, mas podem apontar ruido que ainda nao deve bloquear o fluxo:

- `npm run check:dead-code`
- `npm run check:architecture:graph`
- `npm run goatleta:plan -- plan:help`

### Como interpretar o Knip

O `knip` esta em modo diagnostico:

```bash
npm run check:dead-code
```

Leitura recomendada:

1. **Unused files/dependencies**
   - trate como suspeita inicial, nao como verdade absoluta
   - confirme se o arquivo nao e usado por runtime externo, Expo, Supabase Functions ou scripts manuais

2. **Unlisted dependencies**
   - isso normalmente precisa de correcao no `package.json`
   - neste pacote, `zod`, `expo-modules-core` e `@jest/globals` foram promovidos para dependencias explicitas

3. **Binaries externos**
   - `eas` e `maestro` sao ferramentas externas documentadas, nao dependencias npm do app

4. **Duplicate exports**
   - o `knip` ainda reporta dois casos validos no repo
   - eles nao foram alterados aqui porque este pacote nao mexe em core pedagogico nem em UI funcional

Ruido residual aceitavel hoje:

- duplicate exports em:
  - `src/screens/coordination/OrgMembersPanel.tsx`
  - `src/core/pedagogy/objective-language.ts`

## Scripts que dependem de ferramenta externa

Estes comandos exigem ferramenta instalada fora do npm local ou ambiente configurado:

- `npm run test:e2e:mobile`
  - requer Maestro no ambiente

- `npm run update:preview`
- `npm run update:production`
- `npm run update:promote`
  - requer EAS CLI autenticado

- `npm run sentry:info`
- `npm run sentry:releases`
  - requer variaveis de ambiente do Sentry

- `npm run media:prepare-video -- input.mp4 output.mp4`
  - requer `ffmpeg` no `PATH`

## Scripts utilitarios

- `npm run test:e2e:web`
- `npm run test:e2e:web:ui`
- `npm run qr:generate -- "<conteudo>" "exports/qr/demo.png"`

## O que cada ferramenta faz

### Knip

Usado para descobrir:

- arquivos potencialmente mortos
- exports redundantes
- dependencias nao declaradas
- dependencias declaradas sem uso

Nao deve ser usado como gate duro enquanto ainda existirem falsos positivos conhecidos.

### dependency-cruiser

Protege a arquitetura. Hoje ele verifica principalmente que `src/core` nao importa:

- `react-native`
- `expo` / `expo-*`
- `src/ui`
- `src/screens`
- `src/media`
- `src/media-generation`

Testes em `src/core/__tests__` ficaram fora dessa regra para nao confundir runtime com harness de teste.

### Playwright

Base para smoke web. Parte do principio de que o app web ja esta rodando localmente, por padrao em `http://localhost:8081`.

### Maestro

Template para fluxo mobile real. O YAML atual e apenas uma base de uso.

### Sentry CLI

Preparado para release e sourcemaps sem salvar token ou org/project no repo. Veja [sentry-cli.md](./sentry-cli.md).

### QR

Gera arquivo PNG local a partir de texto/URL. Bom para PDF de aula, demonstracao e links de apoio.

### FFmpeg

Prepara videos para uso real no app depois que a geracao de midia existir. Veja [ffmpeg.md](./ffmpeg.md).

### Higgsfield

Reservado para imagem, video, avatar e marketing. Nao decide aula, periodizacao ou conteudo pedagogico.

Arquivos principais:

- `src/media-generation/providers/higgsfield/higgsfield-provider.mock.ts`
- `src/media-generation/providers/higgsfield/higgsfield-mcp-provider.ts`
- `src/media-generation/providers/higgsfield/higgsfield-mcp-bridge.ts`
- `src/media-generation/providers/higgsfield/higgsfield-mcp-config.ts`
- `src/media-generation/providers/higgsfield/higgsfield-provider.real.ts`
- `src/media-generation/providers/higgsfield/higgsfield-provider-factory.ts`
- `src/media-generation/providers/higgsfield/higgsfield-client.ts`
- `src/media-generation/providers/higgsfield/higgsfield-config.ts`

Configuracao:

- `HIGGSFIELD_MCP_ENABLED=true`
- `HIGGSFIELD_MCP_SERVER_URL=https://mcp.higgsfield.ai`

Opcional e experimental:

- `HIGGSFIELD_API_KEY`
- ou `EXPO_PUBLIC_HIGGSFIELD_API_KEY`

Regras:

- Higgsfield para agents deve ser tratado como integracao MCP/CLI
- a URL documentada do MCP e `https://mcp.higgsfield.ai`
- autenticacao acontece no agent/CLI ou conta Higgsfield, nao dentro do GoAtleta
- com MCP configurado, a factory prioriza `HiggsfieldMcpProvider`
- sem MCP, mas com credencial REST explicita, pode usar `HiggsfieldRealProvider` em modo experimental
- sem MCP e sem REST, a factory cai para `HiggsfieldMockProvider`
- toda midia gerada entra como `draft`
- aprovacao continua acontecendo em `/prof/exercises`
- nada vira `approved` automaticamente
- o app nao armazena credenciais Higgsfield

Quando o MCP estiver configurado, mas a bridge local ainda nao existir:

- `Gerar rascunho` cria um pedido para o agente em vez de falhar
- esse pedido aparece em `Pedidos para o agente`
- o professor pode copiar prompt e payload
- o fluxo final continua `generated => draft => review => approved`

O mock continua disponivel para desenvolvimento e teste sem dependencias externas.

### MCP handoff jobs

Agora existe uma camada especifica para pedidos de geracao que dependem do agent/CLI:

- `src/media-generation/handoff/media-generation-handoff.types.ts`
- `src/media-generation/handoff/media-generation-handoff-store.ts`
- `src/media-generation/handoff/bootstrap-media-generation-handoff-store.ts`
- `src/media-generation/handoff/media-generation-handoff-service.ts`
- `supabase/migrations/2026050802_create_media_generation_handoff_jobs.sql`

Fluxo:

1. o professor clica em `Gerar rascunho`
2. se o provider atual for MCP sem bridge local, o app cria um job `pending_agent`
3. o pedido aparece em `/prof/exercises` na secao `Pedidos para o agente`
4. o agente/Codex pode copiar prompt ou payload e executar no Higgsfield MCP
5. o retorno real ainda deve virar `draft`, nunca `approved`

Regras:

- os pedidos ficam persistidos no Supabase quando houver auth/config
- sem Supabase ou sem auth, existe fallback em memoria
- isso nao autentica o Higgsfield dentro do app
- isso nao substitui a aprovacao manual

### Media generation queue

Agora existe uma fila local em memoria em `src/media-generation/queue/`.

Ela serve para simular a orquestracao real:

- recebe um request
- cria um job `queued`
- processa com provider mockado
- retorna `result` no job
- nunca aprova midia automaticamente

Regras:

- nao persiste nada
- nao usa banco
- nao usa AsyncStorage
- nao usa Supabase
- nao registra asset como `approved`
- serve apenas para fluxo local e testes

Fluxo atual:

1. `enqueueMediaGenerationJob(...)`
2. `processMediaGenerationJob(...)` ou `processNextMediaGenerationJob(...)`
3. job termina em `completed` ou `failed`
4. qualquer asset retornado continua `draft`

### Draft registration from generated jobs

Agora existe um adapter explicito em `src/media-generation/register-generated-media-assets.ts`.

Regras:

- `processMediaGenerationJob(...)` sozinho nao registra nada
- `processAndRegisterGeneratedMediaJob(...)` processa e depois registra no registry
- qualquer asset gerado entra como `draft`
- nada vira `approved` automaticamente
- `resolveExerciseMedia(...)` continua ignorando `draft`

Isso prepara a proxima etapa, que sera aprovacao manual/admin.

### Supabase Exercise Media Store

Agora existe uma store Supabase real para `ExerciseMediaAsset`.

Arquivos principais:

- `src/exercise-media/stores/supabase-exercise-media-store.ts`
- `src/exercise-media/stores/supabase-exercise-media-mappers.ts`
- `src/exercise-media/bootstrap-exercise-media-store.ts`
- `supabase/migrations/2026050801_create_exercise_media_assets.sql`

Regras:

- a tabela persistente e `exercise_media_assets`
- `approved` continua sendo a unica midia consumida por treino e PDF
- o app faz fallback para memoria quando Supabase nao estiver configurado ou sem auth valida
- assets fake de desenvolvimento nao devem poluir Supabase real
- o provider real do Higgsfield agora existe, mas continua desacoplado da UI de geracao

Estratégia atual:

- leitura continua sincronizada pelo cache em memoria da store ativa
- bootstrap hidrata a store Supabase no startup quando houver config + auth
- mutacoes relevantes persistem na store real quando ela estiver ativa

### GoAtleta Planner CLI

Placeholder para rodar o motor do app fora da interface. Ainda sem acesso a banco ou mutacao real.

### Exercise Media Registry

Camada local para registrar e resolver assets de exercicios em memoria.

Arquivos principais:

- `src/exercise-media/exercise-media.types.ts`
- `src/exercise-media/exercise-media-store.types.ts`
- `src/exercise-media/exercise-media-store.ts`
- `src/exercise-media/stores/in-memory-exercise-media-store.ts`
- `src/exercise-media/exercise-media-normalization.ts`
- `src/exercise-media/exercise-media-registry.ts`
- `src/exercise-media/resolve-exercise-media.ts`

O registry atual:

- nao gera midia
- nao persiste dados
- nao depende de Expo, React Native ou banco
- nao altera planejamento nem decisao pedagogica

Ele so prepara o caminho para:

- thumbnail opcional por atividade
- botao `Ver demonstracao`
- QR opcional no PDF
- provider futuro do Higgsfield

Agora tambem existe uma camada de store/repository:

- o registry continua com a mesma API publica
- por baixo, ele usa um `ExerciseMediaStore`
- a implementacao atual ainda e `in-memory`
- isso permite trocar depois para SQLite ou Supabase sem reescrever a UI

Regra mantida:

- `approved` nao pode ser rebaixado automaticamente para `draft` por `upsert`
- so `approved` continua elegivel para treino e PDF

### Exercise media approval

Agora existe um servico de aprovacao manual em memoria em `src/exercise-media/exercise-media-approval.ts`.

Regras:

- `draft` pode virar `approved` apenas por chamada explicita
- `approved` continua idempotente
- `archived` nao volta para `approved`
- `reject` hoje e alias de `archive`
- `resolveExerciseMedia(...)` continua retornando apenas assets `approved`

Isso prepara o proximo pacote, que vai reaproveitar a rota existente:

- `app/prof/exercises.tsx`
- `app/exercises/index.tsx`

Nao foi criada nenhuma tela nova neste pacote. A ideia e usar `/prof/exercises` como central futura de biblioteca + revisao de midia.

### Biblioteca de exercicios e midias

A rota existente `/prof/exercises` agora foi remodelada para concentrar duas coisas na mesma tela:

- biblioteca manual de links e videos salvos
- revisao de midias geradas para demonstracao

Estrutura atual da tela:

- `Links salvos`
- `Midias pendentes`
- `Midias aprovadas`

Regras:

- `Exercise` continua sendo o cadastro manual de links
- `ExerciseMediaAsset` continua sendo a midia gerada/revisada
- `draft` pode ser aprovado ou arquivado na tela
- so `approved` aparece em treino e PDF
- a revisao ainda e em memoria, sem persistencia
- o provider real do Higgsfield ainda nao esta conectado

Agora a mesma tela tambem pode solicitar geracao de rascunhos:

- card `Gerar demonstracao`
- cria job pela queue local
- escolhe provider pela factory do Higgsfield
- com `HIGGSFIELD_API_KEY`, usa provider real
- sem config, usa mock provider
- todo resultado entra como `draft`
- aprovacao continua manual em `/prof/exercises`

E a tela agora tambem mostra o historico local dessas geracoes:

- `Na fila`
- `Gerando...`
- `Concluído como rascunho`
- `Falhou`
- `Cancelado`

Observacoes:

- esse historico de jobs ainda e local/em memoria
- os assets gerados continuam persistindo como `draft`
- o historico em si ainda nao foi persistido no Supabase

### Preview embutido de midia

Os cards de midia em `/prof/exercises` agora mostram preview visual embutido.

Regras:

- `mock://` nao abre aba externa
- midia mock mostra placeholder de `Demonstração simulada`
- imagem real (`http/https`) tenta renderizar no card
- video real usa `thumbnailUri` quando existir
- video ainda nao toca embutido; o card mostra thumbnail + play visual

Observacoes:

- `mock://` e apenas simulacao do provider mockado
- para video/imagem reproduzivel, o provider real precisa devolver URL `http/https`
- player interno de video pode entrar em pacote posterior

### Dev Seed Assets

O registry agora tem um pacote opcional de assets fake para desenvolvimento:

- `src/exercise-media/dev-exercise-media-assets.ts`
- `src/exercise-media/bootstrap-dev-exercise-media.ts`

Esses assets:

- sao apenas de desenvolvimento/teste
- nao sao midia real do produto
- nao devem ser usados em producao
- aparecem automaticamente apenas em desenvolvimento

Ativacao manual:

```ts
import { bootstrapDevExerciseMedia } from "src/exercise-media/bootstrap-dev-exercise-media";

bootstrapDevExerciseMedia({ enabled: true });
```

Ativacao de runtime:

- `src/exercise-media/bootstrap-exercise-media-runtime.ts`
- chamada no `app/_layout.tsx`
- roda apenas quando `__DEV__ === true`
- em producao, nao registra nada

Uso recomendado:

- ambiente local
- testes visuais do botao `Ver demonstracao`
- validacao do `SessionResistanceBlock`

Observacao:

- os links sao fake e servem apenas para validar a UX
- clique no botao para verificar abertura de link/comportamento de fallback

Nao usar como seed de producao. O provider real do Higgsfield entra depois.

### Integracao atual na UI

O primeiro uso do registry esta na sessao resistida:

- `SessionResistanceBlock` tenta resolver midia aprovada por exercicio
- se existir um asset aprovado, aparece o botao `Ver demonstracao`
- se nao existir midia aprovada, nada aparece
- a ficha principal continua igual

Importante:

- a UI nao gera midia
- o Higgsfield ainda nao esta conectado
- a midia nao decide treino, carga ou periodizacao

### QR opcional no PDF

O PDF de plano de aula agora pode incluir QR de demonstracao quando houver midia `approved`.

Regras:

- o QR e opcional
- sem midia aprovada, o PDF segue normal
- o QR aponta para `asset.uri`
- em desenvolvimento, os links fake dos dev assets servem apenas para validar UX
- o Higgsfield ainda nao esta conectado

Fluxo:

- export da sessao chama `enrichSessionPlanWithMedia(...)`
- o adapter tenta resolver midia por atividade/exercicio
- se encontrar `asset.uri`, gera `demoQrDataUri`
- o template do PDF renderiza `Demonstração` + QR pequeno

Regra de arquitetura:

- `src/core/**` nao pode importar `src/exercise-media/**`
- o app deve continuar funcionando normalmente quando nenhuma midia for encontrada

## Limites deste pacote

Este pacote **nao deve**:

- decidir periodizacao
- alterar carga
- escolher quadra vs academia
- gerar plano tecnico ou pedagogico
- substituir o core do app por ferramenta externa

O core pedagogico do GoAtleta continua sendo a fonte de verdade.

## Pipeline futuro

Sequencia recomendada:

1. estabilizar tooling
2. criar `Exercise Media Registry`
3. adicionar `Ver demonstracao` como placeholder
4. adicionar QR opcional ao PDF
5. integrar Higgsfield + FFmpeg somente depois de haver assets aprovados

## Evidence Matrix

A camada `src/core/evidence/` registra regras importantes do GoAtleta com tipo,
confianca, racional, limites e fontes.

Regras importantes:

- nao inventar referencia bibliografica
- fonte pendente usa `type: "pending_reference"` e `reviewRequired: true`
- a matriz ainda nao altera UI, scouting, periodizacao ou Aula do Dia
- a matriz prepara `evidenceRuleIds` e `EvidenceTrace` para snapshots futuros

Veja tambem: `docs/science/evidence-matrix.md`.

## Contexto competitivo

Agora existe uma camada de dominio em `src/core/team-context/` para representar sinais reais do ciclo da turma sem acoplar banco ou UI cedo demais.

Arquivos principais:

- `src/core/team-context/types.ts`
- `src/core/team-context/team-planning-context.ts`
- `src/core/team-context/index.ts`

Tipos principais:

- `TeamEvent`
- `CoachIntervention`
- `ScoutingImpact`

Funcoes principais:

- `getUpcomingTeamEvents(...)`
- `getRecentCoachInterventions(...)`
- `getRecentScoutingImpacts(...)`
- `resolveTeamPlanningContext(...)`

Objetivo:

- combinar amistosos, jogos, avaliacoes e recuperacao
- absorver intervencoes recentes do professor
- reutilizar fraquezas e focos vindos do scouting
- devolver um contexto unico para orientar periodizacao e Aula do Dia

Sinais que o resolver retorna:

- `planningMode`
  - `normal`
  - `pre_match`
  - `post_match`
  - `recovery`
  - `evaluation`
- `recommendedLoadBias`
  - `reduce`
  - `maintain`
  - `increase`
- `focusHints`
- `avoidHints`
- `reason`

Regra atual:

- amistoso ou jogo oficial muito proximo puxa `pre_match`
- jogo recente pode puxar `post_match`
- evento de recuperacao puxa `recovery`
- evento de avaliacao puxa `evaluation`
- intervencoes recentes do professor entram nos `focusHints`
- scouting recente com fraquezas e recomendacoes entra nos `focusHints`

Exemplo pratico:

- se ha amistoso amanha:
  - foco em ajuste tatico, organizacao coletiva e comunicacao
  - evitar fadiga excessiva, carga alta e volume desnecessario
  - a carga recomendada tende a `reduce` ou `maintain`

Importante:

- sem eventos, intervencoes ou scouting recente, o app continua funcionando normalmente
- este pacote ainda nao adiciona tela nem persistencia para esse dominio
- a intencao e plugar isso depois em periodizacao, Aula do Dia e calendario esportivo

### UI inicial de contexto da turma

Agora existe uma rota simples para registrar sinais reais da turma:

- `/prof/class-context?classId=...`

Arquivos principais:

- `app/prof/class-context.tsx`
- `src/screens/team-context/team-context-store.ts`
- `src/screens/team-context/team-context-actions.ts`
- `src/screens/team-context/components/TeamEventsPanel.tsx`
- `src/screens/team-context/components/CoachInterventionsPanel.tsx`
- `src/screens/team-context/components/TeamPlanningContextSummary.tsx`

O que essa primeira versao permite:

- registrar evento da turma
  - treino
  - amistoso
  - jogo oficial
  - avaliacao
  - festival
  - reuniao
  - recuperacao
- registrar intervencao do professor
  - tecnica
  - tatica
  - fisica
  - comportamental
  - emocional
- visualizar um resumo do contexto resolvido para a data atual

Regras desta etapa:

- a persistencia ainda e local/cache
- nenhum evento e obrigatorio
- o motor de periodizacao ainda nao foi alterado por esta UI
- o objetivo agora e colocar o contexto real na mao do professor

### Aula do Dia e contexto competitivo

Agora a Aula do Dia ja consegue ler `TeamPlanningContext` durante a geracao automatica da sessao.

Arquivos principais:

- `src/screens/session/application/adapt-generation-context-with-team-planning.ts`
- `src/screens/session/application/build-auto-plan-for-cycle-day.ts`
- `app/class/[id]/session.tsx`

Comportamento atual:

- se houver `pre_match`:
  - a carga tende a `baixo`
  - o foco muda para transferencia de jogo e organizacao coletiva
  - entram restricoes de comunicacao, ajuste tatico e evitacao de fadiga
- se houver `post_match`:
  - a sessao tende a priorizar ajuste tecnico e recuperacao ativa
- a tela da Aula do Dia mostra um resumo simples de:
  - modo atual
  - carga sugerida
  - focos
  - evitar

Importante:

- esta etapa modula a geracao automatica e o resumo visivel da sessao
- ela ainda nao reescreve automaticamente planos ja salvos ou overrides manuais
- a decisao final continua do professor
