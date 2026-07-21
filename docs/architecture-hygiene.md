# Higiene arquitetural

Este é o contrato canônico de fronteiras do GoAtleta. Ele documenta a arquitetura
que existe hoje e orienta sua evolução incremental. Não é autorização para uma
reorganização em massa nem substitui autenticação, RLS, revisão humana ou os
checks de segurança existentes.

## Princípio central

> A interface apresenta e coordena a interação. Os serviços executam casos de
> uso. O domínio contém regras de negócio. A infraestrutura acessa banco e
> serviços externos. A IA recomenda e orquestra, mas não redefine nem contorna
> regras de negócio.

A direção preferida é:

`interface -> aplicação/casos de uso -> domínio`

Infraestrutura implementa o acesso a dados e integrações exigido pelos casos de
uso. Dependências concretas de React, Expo, Supabase e APIs externas ficam nas
bordas. Uma abstração só deve existir quando houver um contrato real a proteger;
não se criam interfaces vazias apenas para reproduzir um desenho teórico.

## Arquitetura observada

O diagnóstico de 20 de julho de 2026 analisou 674 módulos de runtime e 2.697
imports internos em `app`, `src` e `supabase/functions`. Testes, mocks e fixtures
foram excluídos do grafo de produção e são analisados isoladamente pelas próprias
fixtures do guardrail.

| Área | Responsabilidade observada | Direção de evolução |
| --- | --- | --- |
| `app/**` | Rotas Expo Router e grandes composições de tela | Manter navegação e estado visual; extrair regras, persistência e chamadas complexas |
| `src/ui/**` e `src/components/**` | Design system, componentes e comportamento visual | Permanecer independentes de banco, migrations e Edge Functions |
| `src/screens/**` | Componentes de feature, hooks e uma camada `application` emergente | Separar apresentação de casos de uso testáveis sem reescrita ampla |
| `src/hooks/**` | Hooks genéricos de interface | Não concentrar autorização, persistência e regra pedagógica no mesmo hook |
| `src/core/**` | Modelos, regras pedagógicas, planejamento, periodização e motores puros; contém quatro adapters/hooks legados | Tratar como núcleo independente, com dívida híbrida explicitada no baseline |
| `src/api/**` | REST, Edge Functions, storage e integrações Supabase remotas | Expor operações coesas; não importar telas, rotas ou componentes |
| `src/db/**` | Persistência local/remota, cache, filas e mapeamento de linhas | Preservar escopo organizacional e não depender do frontend |
| `src/copilot/**` | Contexto, sinais, recomendações, memória de interface e orquestração | Passar por serviços e casos de uso; não criar autorização ou mutação paralela |
| `src/observability/**` | Performance, breadcrumbs e Sentry | Observar sem conter regra de negócio ou alterar decisões |
| `supabase/functions/**` | Backend Edge, autenticação de requisições e integrações privilegiadas | Compartilhar somente por `_shared`; nunca importar frontend |
| `supabase/migrations/**` | Schema, funções SQL, RLS e evolução persistente | Fonte histórica imutável; o guardrail não interpreta RLS por regex |
| `scripts/**` e testes | Gates estáticos, verificações de segurança e regressão | Manter determinismo, mensagens acionáveis e independência de secrets |

### Pontos fortes observados

- Não há import de produção de `src/**` para `app/**`.
- Não há Edge Function importando rotas, componentes ou navegação do frontend.
- Não há componente em `src/ui/**` ou tela em `src/screens/**` acessando Supabase
  ou Edge Functions diretamente pelos padrões de baixo nível verificados.
- Não há ciclo de inicialização síncrona no grafo atual.
- `src/screens/**/application` já demonstra extrações incrementais de casos de
  uso, sem exigir uma nova árvore paralela.
- `check:org-scope`, `check:edge-jwt`, RLS e o contexto organizacional continuam
  sendo controles próprios e não são simulados pelo check arquitetural.

## Fronteiras obrigatórias

### `app/**`

Responsável por rotas, composição de telas, navegação, adaptação da interação e
estado estritamente visual.

Evitar regras reutilizáveis, consultas Supabase complexas, autorização duplicada,
prompts acadêmicos centrais e mutações que deveriam passar por serviços. O
baseline registra duas chamadas diretas legadas (`assistant` e recuperação de
senha); uma terceira ocorrência nova falha no check.

### `src/ui/**` e `src/components/**`

Responsáveis por componentes visuais reutilizáveis, acessibilidade, layout,
feedback e design system. Não devem conhecer migrations, RLS, regras pedagógicas,
autorização organizacional, clientes Supabase ou endpoints de Edge Functions.

### `src/screens/**` e hooks de feature

Podem coordenar estado de uma tela e chamar casos de uso. Transformações puras,
regras pedagógicas, autorização e persistência reutilizáveis devem migrar para
`application`, `core`, `api` ou `db`, conforme sua responsabilidade. Um hook não
deve acumular apresentação, autorização, persistência e decisão pedagógica.

### `src/core/**`

É a área classificada como núcleo independente: regras, tipos centrais,
validações, motores e transformações testáveis sem interface. Não deve depender
de React, React Native, Expo, Expo Router, componentes, navegação, navegador ou
cliente Supabase concreto.

Quatro arquivos híbridos anteriores a este contrato permanecem no baseline:
`effective-profile.ts`, `smart-sync.ts`, `use-locations.ts` e
`use-smart-sync.ts`. Isso não redefine todo o core como híbrido nem permite novos
casos equivalentes.

### `src/api/**` e `src/db/**`

Responsáveis por comunicação remota, RPCs, Edge Functions, persistência, cache e
tradução entre linhas/DTOs e modelos. Não podem importar telas, rotas, componentes
ou hooks visuais. O contexto de organização/workspace deve ser explícito nos
caminhos sensíveis e `check:org-scope` permanece bloqueador.

### `src/copilot/**` e IA

Responsável por obter contexto, preparar solicitações, apresentar recomendações,
orquestrar casos de uso e manter sinais/memória contextual.

A IA não pode duplicar regras de negócio, escolher organização por fallback,
publicar conteúdo acadêmico sem curadoria, transformar texto em ação definitiva
sem validação ou criar mutações silenciosas. Uma superfície de IA com mutação de
dados e sem sinal explícito de `organizationId`/`workspaceId` é falha crítica e
não pode entrar no baseline.

A memória global do usuário e a memória institucional continuam separadas.
Documentos privados do Google Drive não são promovidos, expostos ou tornados
globais automaticamente; somente uma projeção curada e aprovada pode cruzar essa
fronteira.

### `supabase/functions/**`

É backend Edge. Pode compartilhar código neutro por
`supabase/functions/_shared/**`, mas não importar `app`, `src/ui`, `src/screens`,
`src/components` ou navegação. O check arquitetural não substitui validação JWT,
RLS, autorização do usuário nem validação do workspace ativo.

## Diagnóstico e dívida atual

### Ciclos

Não há ciclo síncrono de runtime. Há dois componentes estruturais, ambos
visíveis no relatório e congelados no baseline:

1. Planejamento pedagógico: o menor caminho demonstrável é
   `session-decision-trace.ts -> models.ts -> session-decision-trace.ts`; o
   componente completo alcança 23 módulos por imports de tipos.
2. Fila NFC: `nfc-sync.ts -> session.ts -> nfc-sync.ts`; o retorno usa import
   dinâmico depois da inicialização e o componente alcança também `students.ts`.

O ciclo tipado anterior entre `active-role.ts` e `role.tsx` foi removido pela
extração de `role-types.ts`, sem mudança funcional.

### Acoplamento e complexidade informativa

Os limites são derivados da distribuição atual, não usados como bloqueios
arbitrários:

| Métrica | Mediana | p90 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: |
| Linhas por módulo | 141 | 684 | 1.157 | 4.640 |
| Imports internos de saída | 2 | 8 | 13 | 65 |
| Módulos importadores | 1 | 7 | 12 | 227 |

As maiores concentrações estão em `app/periodization/index.tsx`,
`app/training/index.tsx`, `app/class/[id]/session.tsx`, `app/class/[id].tsx`,
`app/class/[id]/students.tsx` e `app/students/index.tsx`. Elas combinam domínio,
dados e interface; tamanho isolado não prova erro, mas o número de camadas e os
motivos de mudança tornam essas rotas candidatas prioritárias a extrações
incrementais.

`src/core/models.ts` é o maior ponto de convergência, importado por 227 módulos.
Alterações nele têm raio de impacto alto e devem preferir novos tipos coesos em
módulos menores quando houver fronteira de domínio real.

### Violações por severidade

- **Crítica:** nenhuma violação atual aceita ou no baseline. Ciclo síncrono,
  import reverso, backend dependente do frontend, acesso direto em `src/ui` ou
  `src/screens` e mutação de IA sem escopo falham imediatamente.
- **Alta:** dois componentes circulares estruturais; quatro dependências de
  framework dentro de `src/core`; duas rotas em `app` e um hook do Copilot com
  acesso de dados de baixo nível. Todos são preexistentes e não podem crescer.
- **Média:** dois deep imports em `document-intelligence/types.ts` contornam a
  fachada pública já existente.
- **Baixa/informativa:** módulos acima do p95 e mistura de três ou mais camadas
  aparecem no relatório, sem bloquear somente por tamanho.

## Guardrail automático

O núcleo testável está em `scripts/architecture-hygiene/analyzer.js`; a CLI fica
em `scripts/check-architecture-hygiene.js`. A configuração declara raízes,
exclusões, áreas de core puro, fachadas públicas e exceções. O analisador usa a
TypeScript Compiler API já instalada e entende imports relativos, `@/*`, exports,
`require` e imports dinâmicos em caminhos Windows e Unix.

Regras bloqueadas:

- ciclos síncronos e novos ciclos estruturais, com caminho completo;
- `src -> app` e infraestrutura/backend -> frontend;
- framework de interface dentro do core classificado como puro;
- Edge Function importando frontend;
- deep import que contorna fachada configurada;
- acesso de baixo nível a Supabase/Edge em interface e novos caminhos em
  `app`/Copilot;
- mutação em superfície de IA sem sinal explícito de organização/workspace.

O relatório também mostra arquivos grandes, fan-in, fan-out, mistura de camadas
e concentração de domínio/dados em telas e hooks.

## Baseline e não regressão

`scripts/architecture-hygiene-baseline.json` contém somente dívida preexistente
de risco não crítico. Cada entrada tem fingerprint, regra, caminho e justificativa.

- Falhas de segurança, escopo organizacional, vazamento, ciclo síncrono e
  dependências reversas críticas não podem entrar no baseline.
- Violação nova não possui fingerprint aceita e falha.
- Entrada cujo problema foi removido fica obsoleta e também falha até ser
  apagada; assim, a dívida removida não fica autorizada a retornar.
- No modo strict, editar um arquivo que mantém uma dívida não circular do
  baseline exige remover a violação ou registrar uma exceção explícita.
- Exceções ficam na configuração, exigem regra, origem, justificativa e escopo
  pequeno. Não podem ser usadas para esconder falha de segurança.

## Comandos e CI

```bash
npm run test:architecture
npm run check:architecture
npm run check:architecture:strict
npm run check:architecture:report
```

`check:architecture` aplica invariantes e a catraca do baseline.
`check:architecture:strict` endurece arquivos de dívida tocados no diff.
`check:architecture:report` imprime todas as métricas e continua falhando em
violação crítica, nova ou baseline obsoleto.

O workflow `Architecture Hygiene` roda em pull requests e pushes para a branch
principal quando código relevante muda. Ele instala dependências, testa o
analisador, executa os modos normal e strict e preserva `check:org-scope` como
gate separado. Não usa secrets, não escreve arquivos e não realiza deploy.

## Evolução incremental

Priorize extrações pequenas em arquivos que simultaneamente estão acima do p95,
importam várias camadas e mudam por razões diferentes. Cada extração deve manter
comportamento, possuir teste focado e reduzir uma entrada concreta do relatório
ou baseline. Não reorganize módulos em massa para melhorar uma métrica.
