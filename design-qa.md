# Design QA — Painel SaaS de Acessos

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-03567fed-7f2b-464e-9962-3547d68e3868.png`
- Implementation URL: `http://localhost:8081/platform/accesses`
- Local-only QA state: `?designPreview=accesses` guarded by `__DEV__`
- Desktop evidence: `artifacts/design-qa/platform-access-shell-1440x1024.png`
- Tablet evidence: `artifacts/design-qa/platform-access-shell-834x1194.png`
- Mobile evidence: `artifacts/design-qa/platform-access-shell-390x844.png`
- Final mock-matched evidence: `artifacts/design-qa/platform-access-final-1904x1280.png`
- Sidebar/pill correction: `artifacts/design-qa/platform-access-sidebar-standard-1360x914.png`
- SaaS navigation correction: `artifacts/design-qa/platform-saas-sidebar-1360x914.png`

## Full-view comparison evidence

The selected source and the 1440 × 1024 implementation capture were inspected
together. The implementation preserves the source hierarchy — title, three
status summaries, request queue, selected row, and decision rail — while using
the actual GoAtleta shell, sidebar behavior, theme tokens, typography, buttons,
inputs, radii and responsive primitives instead of a parallel dashboard shell.

## Focused region comparison evidence

- Queue and selected row: hierarchy, active-row emphasis and status tones match
  the source intent and stay consistent with current GoAtleta list surfaces.
- Decision rail: remains visible beside the queue at 1440 px and moves below it
  at tablet/mobile widths without overlap or horizontal overflow.
- Compact layouts: metrics stack at 390 px; filters wrap; rows intentionally hide
  secondary organization/product/date columns while preserving identity/status.

## Findings and resolution

- [P1] Parallel, hand-built navigation shell — resolved by using `AppShell` and
  the existing `WebSidebar`; the platform-only item is injected only while the
  protected platform route is active.
- [P1] No browser comparison state — resolved with a `__DEV__`-only design
  preview using the same demo data and production component tree.
- [P2] Fixed desktop composition — resolved with `ResponsivePage` and
  `ResponsiveGrid` using the project's existing dashboard breakpoints.
- [P2] Source mock had a permanently expanded sidebar — accepted adaptation:
  GoAtleta controls compact/expanded state through its existing shell, so the
  new screen does not override the user's sidebar preference.

## Comparison history

- Initial implementation: duplicated brand/sidebar and could not be captured in
  an unauthenticated automation context.
- Refined implementation: shared GoAtleta shell and responsive primitives;
  desktop, tablet and mobile screenshots inspected with no P0/P1/P2 issue open.
- Final fidelity pass: docked expanded sidebar, complete coordination navigation,
  header controls, 12-row table with column labels/pagination, source-matched
  metrics and expanded account detail rail were compared directly with the
  selected mock at 1904 × 1280.
- Annotation correction: restored the shared compact-to-overlay animated sidebar
  instead of forcing a docked variant; shortened pending status copy to
  `Pendente`, returning the amber pill to the same natural sizing as `Ativo`.
- SaaS scope correction: the expanded overlay now contains only `Painel` and
  `Acessos`, with `Administração SaaS` branding and no coordination operations.

## Final result

final result: passed

---

# Design QA — Perfil do aluno mobile

- Fonte aprovada: mockup mobile escolhido pelo usuário em 11/09/2026.
- Implementação: `http://localhost:8081/student/profile`.
- Viewport verificado: 387 × 846 no navegador local.

## Comparação visual e funcional

- O mobile mantém o cabeçalho `Configurações`, identidade centralizada, avatar
  com ação de câmera e hierarquia compacta do mockup aprovado.
- `Dados pessoais` inicia expandido como na referência; perfil esportivo,
  notificações, aparência, Google, instituição e segurança ficam agrupados em
  um único painel e iniciam recolhidos. Cada seção revela todo o conteúdo
  disponível quando aberta.
- O bloco pessoal usa os dados reais disponíveis no perfil: nome, nascimento e
  celular. Ausências aparecem como `Não informada`/`Não informado`, sem inventar
  valores da imagem de referência.
- A revisão de fidelidade reduziu avatar, tipografia, alturas e espaços, manteve
  a biometria visível no web mobile e reproduziu o painel inferior contínuo com
  divisores internos.
- Os campos de nome, nascimento e celular agora são entradas reais. O botão de
  salvar só é habilitado com nome, data e telefone válidos e persiste no perfil
  do atleta antes de atualizar o contexto autenticado.
- `Sair` e `Zona sensível` ficam abaixo do painel; a exclusão aparece somente ao
  expandir a zona sensível. O ícone de segurança foi corrigido.
- A navegação inferior do aluno mantém o FAB exatamente no centro, com `Início`
  e `Agenda` à esquerda e `Conquistas` e `Perfil` à direita.
- Notificações e aparência usam o mesmo switch on/off das demais telas. A opção
  redundante de biometria foi removida do perfil mobile.
- Google agora expõe conectar ou desvincular dentro da própria seção; quando não
  há instituição, a seção mostra uma ação `+` que leva ao fluxo opcional de
  vínculo.
- E-mail alternativo e alteração de senha ficam totalmente inline em `Conta e
  segurança`, sem depender do modal. O atalho `Mais dados` abre essa seção.
- O texto redundante `Alterar foto` foi removido; a câmera sobre o avatar mantém
  a ação. O cabeçalho voltou a usar o botão de retorno padrão do aplicativo.
- A ação de exclusão usa borda, ícone, texto e fundo de perigo para comunicar seu
  caráter destrutivo.
- O acordeão mantém somente uma seção aberta por vez e usa transição curta de
  layout, sem introduzir dependência ou animação pesada.
- A troca de `Dados pessoais` para `Perfil esportivo` e o recolhimento das
  seções foram percorridos no navegador local.
- Tablet, desktop e os perfis de professor, coordenação e família continuam no
  layout já existente.

## Resultado

Nenhum P0, P1 ou P2 visual permanece aberto no estado mobile validado.

final result: passed

---

# Design QA — Solicitação de plano em 3 etapas

- Fontes aprovadas: mockups das etapas `Vencimento`, `Matrícula` e `Revisão`
  gerados e aprovados na conversa em 10/09/2026.
- Implementação: `http://localhost:8081/pending`
- Estado verificado: conta externa autenticada, instituição `Rede Esportes
  Pinhais` e plano `Plano mensal · 1x por semana`.

## Comparação visual e funcional

- O fluxo permanece dentro da tela de pendência, sem criar rota paralela.
- Cabeçalho, progresso em três segmentos, conteúdo rolável e ação inferior fixa
  seguem a composição aprovada e respeitam o bloco compacto do produto.
- A etapa de vencimento apresenta dias 5, 10 e 15, primeiro vencimento e as três
  mensalidades seguintes, deixando explícito que não há débito automático.
- A etapa de matrícula identifica o atleta e registra somente a preferência de
  cobrança, informando que as instruções virão da instituição.
- A revisão resume plano, modalidade, atleta, vencimento, valores e preferência;
  a solicitação permanece desabilitada até o aceite dos termos.
- O modal apresenta os termos completos com rolagem própria e fechamento
  explícito, sem deslocar ou recortar o fluxo principal.
- Lista de planos e as três etapas foram inspecionadas na implementação local;
  não houve overflow horizontal, quebra de conteúdo ou ação primária ambígua.
- Refinamento por anotação: Pix agora usa o pictograma próprio disponível no
  pacote Material Icons; `R$` preserva capitalização nos termos; entrada no
  fluxo usa slide horizontal de 190 ms. Avanço e retorno agora fazem saída e
  entrada direcionais em 240 ms no total, com driver nativo; o retorno da etapa
  inicial para a lista usa a mesma saída para a direita.
- Navegação da conta externa: `/pending` ganhou retorno explícito para a Home e
  a Home exibe um atalho compacto para `Encontre sua instituição`. Os dois
  sentidos foram percorridos no navegador local sem ciclo de redirecionamento.

## Resultado

Nenhum P0, P1 ou P2 visual permanece aberto no fluxo local. A conferência final
em aparelho Android fica para o ciclo iterativo por ADB combinado com o usuário.

final result: passed

---

# Design QA — Painel SaaS de Instituições (opção 3)

- Fonte aprovada: `artifacts/design-qa/platform-dashboard-option-3-source.png`
- Implementação: `http://localhost:8081/platform`
- Estado local de QA: `?designPreview=dashboard`, disponível somente em `__DEV__`
- Desktop 1440 × 1024: `artifacts/design-qa/platform-dashboard-implementation-1440x1024.png`
- Tablet 834 × 1194: `artifacts/design-qa/platform-dashboard-834x1194.png`
- Mobile 390 × 844: `artifacts/design-qa/platform-dashboard-390x844.png`
- Conexão e métricas dinâmicas: `artifacts/design-qa/platform-dashboard-connected-1440x1024.png`
- Acessos filtrados pela instituição: `artifacts/design-qa/platform-access-institution-filter-1440x1024.png`

## Comparação visual

A fonte aprovada e a captura desktop foram inspecionadas juntas. A composição
mantém os quatro indicadores, lista de instituições, seleção destacada e painel
lateral com responsável, produto, ciclo comercial, nota, atividade e ações. A
adaptação usa o `AppShell`, a barra lateral animada e os tokens já existentes do
GoAtleta; não cria uma segunda navegação nem um design system paralelo.

## Comportamento verificado

- As abas filtram instituições por avaliação, ativa e pausada.
- A busca filtra nome, responsável e produto.
- Selecionar uma linha atualiza o painel lateral.
- `Ver acessos` navega para a fila já existente.
- O parâmetro `institution` preenche a busca e restringe a fila à instituição escolhida.
- `Gerenciar instituição` abre a edição de produto, ciclo, atenção comercial e nota;
  em ambiente conectado, salvar usa uma RPC idempotente e auditável.
- Em tablet e mobile o painel lateral desce abaixo da lista, sem sobreposição.
- Aprovar um acesso não altera automaticamente seu estado financeiro.

## Resultado

Nenhum P0, P1 ou P2 visual permanece aberto na comparação final.

final result: passed
