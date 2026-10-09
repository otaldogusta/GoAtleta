# Interface compartilhada e plataformas

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

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

- Antes de criar um estado visual, reutilizar o equivalente aprovado e comparar
  a renderização. Erros de autenticação seguem o balão da confirmação de senha;
  ver [paridade entre campos](../../ui/FORM_SETTINGS_PATTERNS.md#paridade-visual-entre-campos).
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
