# Interface compartilhada e plataformas

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

`ModalSheet` oferece `avoidKeyboard` opt-in para acompanhar o visual viewport web
e evitar o teclado nativo. O convite da gestão usa essa opção; os demais modais
mantêm o comportamento anterior. [Evidência e limites](../../operations/trainer-invite-refinement.md).

Expo Router compõe rotas; telas de feature usam primitives em `src/ui` e
componentes compartilhados. Existem adaptações `.web` e nativas. O contrato de
camadas está em [higiene arquitetural](../../architecture-hygiene.md); estas
primitives não devem conhecer banco, RLS ou integrações privilegiadas.

| Entrada | Responsabilidade |
| --- | --- |
| [app/_layout.tsx](../../../app/_layout.tsx), [AppShell.tsx](../../../src/ui/AppShell.tsx) | Composição raiz e shell |
| [RootWebShell.tsx](../../../src/ui/RootWebShell.tsx), [NativeSidebar.tsx](../../../src/ui/NativeSidebar.tsx) | Navegação/layout por plataforma |
| [tokens.ts](../../../src/theme/tokens.ts), [app-theme.tsx](../../../src/ui/app-theme.tsx) | Tokens e tema |
| [Pressable.tsx](../../../src/ui/Pressable.tsx), [Button.tsx](../../../src/ui/Button.tsx), [ScreenHeader.tsx](../../../src/ui/ScreenHeader.tsx) | Interação e hierarquia comuns |
| [AnchoredDropdown.tsx](../../../src/ui/AnchoredDropdown.tsx), [overlay-layers.ts](../../../src/ui/overlay-layers.ts) | Portal, ancoragem e sobreposição |
| [auth-layout.ts](../../../src/ui/auth-layout.ts), [form-validation-feedback.tsx](../../../src/ui/form-validation-feedback.tsx) | Métricas e feedback de formulário |
| [responsive-layout.ts](../../../src/ui/responsive-layout.ts), [ModalSheet.tsx](../../../src/ui/ModalSheet.tsx) | Reflow e modais |
| [lazy-screen.tsx](../../../src/ui/lazy-screen.tsx), [perf.ts](../../../src/observability/perf.ts) | Carregamento e medição |

## Contratos a preservar

- Marca pública **Go Atleta**, tema e primitives existentes. Selecionar tokens
  antes de criar medidas/cores independentes ou trocar bibliotecas.
- Autenticação: bloco central de até 440 px; campo com altura 50, raio 12 e
  padding horizontal 14 no container. Regras completas estão no `AGENTS.md`.
- `AnchoredDropdown` usa portal no web por padrão; camada `floatingList` fica
  acima do modal. Aumentar só `zIndex` dentro de pai recortado não resolve o portal.
- Reutilizar `Pressable`; links secundários têm feedback textual sem caixa de
  hover (`suppressWebHoverFeedback`). Preservar foco, teclado, acessibilidade e
  saída com alterações não salvas.
- Respeitar variantes web/nativo e reduced motion. Alterações em representação
  visual não devem excluir dados do usuário; ver [quadra](biblioteca-quadra.md).
- Copy curta, sem repetir alertas ou atribuir cada resultado à IA.
- Em aluno, professor e coordenação, Configurações renderiza os formulários abaixo
  das abas do próprio perfil, preservando a identidade e o rascunho entre abas.
  Entradas `/profile/settings` por papel abrem a mesma composição. A edição
  reutiliza os formulários e a proteção ao sair.
  No próprio perfil, o nome do workspace abre as organizações autorizadas da
  conta; trocar também respeita o rascunho pendente.
  Ver [padrão de configurações](../../ui/FORM_SETTINGS_PATTERNS.md).

## Decisões e fontes

- Android usa `RefreshControl` nativo para gesto e indicador, mesmo com provider
  global, sem captura manual ou overlay duplicado; mantém a guarda de alterações.

- `ModalSheet` com `avoidKeyboard` fecha primeiro o teclado no Voltar nativo;
  uma nova tentativa segue a guarda de alterações. Perfil usa barra de salvar
  com margem nativa de 12px, sem somar novamente a altura das abas.
- Mensagens de perfil/convite seguem o mínimo necessário: sem toast de sucesso
  rotineiro ou explicações repetidas; erros acionáveis e permissões sensíveis
  permanecem. Ver [padrão de formulários](../../ui/FORM_SETTINGS_PATTERNS.md).

[Índice UI](../../ui/README.md) é a fonte visual existente: abra somente o guia
de tokens, componentes, formulário ou responsividade afetado. Home do professor
é referência de densidade. [Auditoria de densidade](../../ui/DENSITY_AUDIT.md) e
revisões datadas descrevem estados e recomendações daquele momento; mockups em
`public/mockups` são referências visuais, não funcionalidades certificadas.

## Validação relevante

Testes existentes, não executados nesta rodada:
[overlay-layers](../../../src/ui/__tests__/overlay-layers.test.ts),
[anchored-dropdown-viewport](../../../src/ui/__tests__/anchored-dropdown-viewport.test.ts),
[responsive-layout](../../../src/ui/__tests__/responsive-layout.test.ts),
[form-validation-feedback](../../../src/ui/__tests__/form-validation-feedback.test.ts).
Microcopy/estilo: diff e uma interação/viewport no `localhost:8081`, sem build
amplo. Mudança de foco, estado ou primitive: testes focados, tipos e smoke do
comportamento. Medir performance antes/depois quando esse for o objetivo.

- `AppRefreshControl` publica o estado de busca no `RefreshFeedbackProvider`.
  O provider anima a opacidade do conteúdo existente (120ms entrada/220ms saída),
  com driver nativo e reduced motion, sem overlay nem segunda composição da tela.
- Durante o puxar, o indicador nativo usa `colors.card` e `tintColor`/`colors.text`.
  O indicador circular pertence apenas ao controle nativo; o provider exibe
  somente transição de opacidade, sem shimmer sobreposto ou segundo spinner.
- `useScreenRefresh` controla concorrência, erro e término da busca nas telas sem
  estado próprio. Rascunhos não são descartados; Planejamento bloqueia o gesto
  quando há alterações pendentes. Nunca reiniciar o bundle para atualizar dados.

- Revisão posterior: feedback visual global desativado após relato de duplicação
  persistente. Provider não insere View, overlay nem opacidade sobre a navegação;
  feedback fica no RefreshControl nativo. Causa visual ainda sem reprodução estável.

- Feedback atual: barra de atividade de 3px no topo, sem bloquear interação
  nem mudar opacidade/layout do conteúdo. Aparece durante busca e esmaece em
  420ms ao terminar, sem atrasar dados. Respeita reduced motion.
