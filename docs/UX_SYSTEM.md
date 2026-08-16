# UX SYSTEM 1

## Objetivo

O UX SYSTEM 1 cria uma camada de governanca de interface para o GoAtleta. Ele nao e um redesign total. O objetivo e tornar reuso, tokens, stories, acessibilidade e revisao visual parte do fluxo normal de PR.

## Estado deste PR

Esta branch implementa a primeira fatia: foundations.

- Inventario inicial dos componentes e telas criticas.
- Contrato de tokens `ref`, `sys` e `cmp`.
- Guard inicial contra novos valores visuais raw.
- Templates de PR/issue para mudancas de UI.
- Workflow de CI para o UX System.

Storybook e regressao visual completa ficam para o proximo PR da sequencia, porque o projeto ainda nao possui Storybook configurado e adicionar a stack inteira junto com retrofit aumentaria demais o risco.

## Principios

1. Reutilizar componente existente antes de criar novo.
2. Criar variant antes de criar componente paralelo.
3. Usar token antes de usar valor local.
4. Mudanca visual precisa de story ou plano de story.
5. Mudanca visual precisa de evidencia: screenshot, preview ou regressao visual.
6. Acessibilidade nao e decoracao: teclado, foco, contraste e nomes acessiveis entram no DoD.
7. Retrofit acontece por modulo, nao por varredura global.

## Camadas de tokens

### `ref`

Tokens primitivos. Representam a escala base do sistema.

- `ref.color.*`
- `ref.space.*`
- `ref.font.*`
- `ref.radius.*`
- `ref.elevation.*`
- `ref.motion.*`

### `sys`

Tokens semanticos. Representam papel de interface.

- `sys.color.surface`
- `sys.color.textPrimary`
- `sys.color.borderSubtle`
- `sys.color.statusSuccess`
- `sys.space.stackMd`
- `sys.radius.card`
- `sys.elevation.overlay`

### `cmp`

Aliases de componente. Representam decisoes por primitive de UI.

- `cmp.card.padding.md`
- `cmp.tabs.radius`
- `cmp.badge.minHeight`
- `cmp.button.minHeight`
- `cmp.modal.maxWidthLg`

Arquivo inicial: `src/ui/ux-tokens.ts`.

## Escalas aprovadas

### Spacing

Use apenas:

```txt
0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
```

### Tipografia

Use preferencialmente:

```txt
12/16
14/20
16/24
20/24
24/28
```

### Radius

```txt
4  -> detalhes pequenos
6  -> controles compactos
12 -> controles principais
14 -> cards
16 -> containers
20 -> modais
999 -> pills, chips, avatars
```

### Elevation

Use no maximo:

```txt
default
raised
overlay
overflow
```

Sombras locais novas devem ser evitadas.

## Componentes criticos

### Card

Componentes existentes:

- `src/ui/Card.tsx`
- `src/ui/section-styles.ts`
- usos locais em `app/consultation/index.tsx`, `app/student-consultation.tsx`, periodizacao, scouting e training.

Contrato alvo:

- `variant`: `surface`, `raised`, `outline`, `status`
- `density`: `compact`, `regular`, `spacious`
- `header`, `footer`, `media`
- `interactive`
- `tone`: `neutral`, `success`, `warning`, `danger`, `info`

### Tabs

Componente existente:

- `src/ui/AnimatedSegmentedTabs.tsx`

Contrato alvo:

- `items`
- `activeKey`
- `onChange`
- `variant`
- `fullWidth`
- `orientation`

Regra: tabs novas devem usar esse contrato ou justificar por que nao cabe nele.

### Badge

Componentes existentes:

- `src/ui/Badge.tsx`
- `src/ui/SyncStatusBadge.tsx`
- `src/ui/ClassGenderBadge.tsx`

Contrato alvo:

- `tone`
- `emphasis`
- `size`
- `icon`
- `label`

Badge nao pode ser o unico canal para comunicar status importante.

### Button

Componente existente:

- `src/ui/Button.tsx`

Contrato alvo:

- `variant`
- `size`
- `loading`
- `leadingIcon`
- `trailingIcon`
- `fullWidth`

Alvo minimo de toque: 44px para controles principais e nunca menor que 24px.

### Shell

Componentes existentes:

- `src/ui/AppShell.tsx`
- `src/components/ui/TabScreenShell.tsx`
- `src/ui/ScreenHeader.tsx`
- `src/components/ui/ScreenTopChrome.tsx`

Contrato alvo:

- `title`
- `subtitle`
- `actions`
- `maxWidth`
- `stickyHeader`
- `background`
- estados `loading`, `ready`, `empty`, `error`

### Modal

Componentes existentes:

- `src/ui/ModalSheet.tsx`
- `src/ui/ModalDialogFrame.tsx`
- `src/ui/ModalSectionCard.tsx`
- `src/ui/ConfirmCloseOverlay.tsx`

Contrato alvo:

- `size`
- `title`
- `description`
- `actions`
- `dismissible`
- `initialFocusRef`

Regras de acessibilidade:

- fecha com Escape no web quando aplicavel;
- foco visivel;
- retorno de foco ao invocador quando possivel;
- bloqueio de saida com alteracoes nao salvas quando existir formulario.

### Empty State

Ainda nao existe componente canonico dedicado. A proxima fatia deve criar `AppEmptyState`.

Contrato alvo:

- `title`
- `description`
- `primaryAction`
- `secondaryAction`
- `icon`
- `tone`

## Inventario inicial de telas

### Consultoria professor

Arquivos:

- `app/consultation/index.tsx`

Dívidas principais:

- muitos estilos inline locais;
- cards locais repetidos com `padding`, `borderRadius`, `borderWidth` e cores semelhantes;
- tabs internas ja melhoraram o fluxo, mas ainda devem migrar para API canonica de tabs;
- modal de prescricao e ficha de treino devem virar referencia de story.

Prioridade: muito alta.

### Consultoria aluna

Arquivos:

- `app/student-consultation.tsx`

Dívidas principais:

- estados de treino, feedback e midia devem virar stories;
- botao `Ver demonstracao` deve entrar na matriz de botao/link externo;
- estados vazio/concluido/historico inicial devem migrar para `AppEmptyState`.

Prioridade: muito alta.

### Scouting

Arquivos:

- `app/class/[id]/scouting/[scoutingSessionId].tsx`
- `src/screens/scouting/**`

Dívidas principais:

- chips e badges operacionais com muitas variacoes locais;
- blocos de leitura do jogo, acoes recentes e contexto devem mapear para card/status surfaces.

Prioridade: alta.

### Feedback e evolucao

Arquivos:

- `app/consultation/index.tsx`
- `app/student-consultation.tsx`
- `src/core/consultation/**`

Dívidas principais:

- indicadores de PSE/dor/adesao precisam de tokens de status consistentes;
- evolucao ainda e placeholder visual, bom candidato para story antes do retrofit.

Prioridade: alta.

### Periodizacao

Arquivos:

- `app/periodization/index.tsx`
- `src/screens/periodization/**`

Dívidas principais:

- tela densa com muitos cards/modais;
- QA/dev-only precisa continuar claramente separado da UI final;
- agenda competitiva e semana devem migrar para surfaces de apoio.

Prioridade: media/alta.

### Professor/home/alunos/training

Arquivos:

- `app/prof/home.tsx`
- `src/screens/home/**`
- `app/students/index.tsx`
- `app/training/index.tsx`
- `app/training/import.tsx`

Dívidas principais:

- ainda ha `borderRadius`, sombras e cores locais;
- listas longas devem padronizar row/card/density;
- botoes flutuantes e modais antigos precisam de stories antes de retrofit.

Prioridade: media.

## Guardrails

### Script

Comando:

```bash
npm run check:ux-system
```

O script avalia apenas linhas adicionadas no diff e bloqueia novos:

- hex colors;
- `rgb`/`rgba`;
- shadows inline;
- `borderRadius`, `fontSize` e spacing fora da escala.

Arquivos de tokens e PDF ficam fora do bloqueio inicial. Bypass permitido somente com justificativa na propria linha:

```txt
ux-system: allow-raw-design-value
```

### Workflow

Arquivo:

- `.github/workflows/ux-system-guard.yml`

Regras:

- valida template de PR quando ha mudanca em UI;
- roda `npm run check:ux-system`;
- roda `npm run typecheck:core`;
- roda `npm run test:core`;
- nao roda Storybook ainda se nao houver script.

## Storybook

Status atual:

- Storybook nao esta configurado no projeto.
- Nao ha `*.stories.tsx` encontrados na auditoria inicial.

Plano incremental:

1. PR 2: adicionar Storybook minimo para React Native Web/Expo Web.
2. PR 2: criar stories de `Button`, `Card`, `Badge`, `AnimatedSegmentedTabs`, `ModalDialogFrame`.
3. PR 3: adicionar story de tela para consultoria professor e aluna.
4. PR 3: adicionar Chromatic condicional por secret.

## Checklist obrigatorio de PR UI

- Reuso: qual componente/tokens existentes foram usados?
- Stories: quais stories foram criadas/alteradas?
- Screenshots: onde esta o before/after ou preview visual?
- Acessibilidade: teclado, foco, labels e contraste revisados?
- Regressao visual: Chromatic/Percy/manual justificado?
- Tokens: sem valores raw novos fora da allowlist?

## Rollout

1. `codex/ux-system-1-foundations`: docs, tokens aliases, guardrails.
2. `codex/ux-system-1-core-components`: API dos componentes criticos.
3. `codex/ux-system-1-storybook-ci`: Storybook, stories, a11y addon, visual regression condicional.
4. `codex/ux-system-1-consultoria-retrofit`: retrofit consultoria professor/aluna.
5. PRs seguintes: scouting, feedback/evolucao, periodizacao.

## Riscos

- Refactor amplo demais: mitigar com PRs pequenos.
- Storybook virar custo sem retorno: exigir apenas para componentes criticos primeiro.
- Guard muito agressivo: neste PR ele valida somente linhas novas.
- Token explosion: novos tokens exigem justificativa no PR.
- Acessibilidade falsa: automacao nao substitui revisao manual de teclado/foco.

## Comandos deste pacote

Executar antes do PR:

```bash
npm run check:ux-system
npm run typecheck:core
npm run test:core
npm run check:encoding
npm run tools:check
```
