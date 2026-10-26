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
  `visualScale` é opt-in no web (padrão 1): preserva âncoras físicas e ajusta
  conteúdo, limites e altura visual do menu; o nativo mantém suas dimensões.
- Reutilizar `Pressable`; links secundários têm feedback textual sem caixa de
  hover (`suppressWebHoverFeedback`). Preservar foco, teclado, acessibilidade e
  saída com alterações não salvas.
- Respeitar variantes web/nativo e reduced motion. Alterações em representação
  visual não devem excluir dados do usuário; ver [quadra](biblioteca-quadra.md).
- Copy curta, sem repetir alertas ou atribuir cada resultado à IA.
- Perfil de funcionário admite aba Acesso e conteúdo administrativo na aba
  Turmas, com uma única `FloatingSaveBar` externa à rolagem. O rascunho pertence
  ao chamador e sobrevive à troca de abas. [Contrato local](../../operations/staff-access-profile.md).
- Em aluno, professor e coordenação, Configurações renderiza os formulários abaixo
  das abas do próprio perfil, preservando a identidade e o rascunho entre abas.
  Campos pessoais vazios não impedem salvar; valores preenchidos são validados.
  Nome vazio preserva a identidade existente. Data profissional opcional exige
  a migration `20261009230000_optional_professional_profile_birth_date.sql`
  (aplicada no Supabase em 09/10/2026; frontend local).
  Conteúdo de cards recolhidos é criado sob demanda; rascunhos ficam no perfil,
  sem depender da montagem do card. Na web, expansão direta evita frames de animação em JS.
  Entradas `/profile/settings` por papel abrem a mesma composição. A edição
  reutiliza os formulários e a proteção ao sair.
  No próprio perfil, o nome do workspace abre as organizações autorizadas da
  conta; trocar também respeita o rascunho pendente.
  Ver [padrão de configurações](../../ui/FORM_SETTINGS_PATTERNS.md).

## Decisões e fontes

- Agenda da coordenação: o menu web oferece `Agenda` após `Planejamento`, em
  `/coord/calendar`, reutilizando o calendário mensal e a boundary `calendar`.
  A rota mantém o shell de coordenação; `Eventos` continua como entrada de gestão.
  Em 26/10/2026, navegação e calendário carregado conferidos em localhost:8081;
  testes de menu/permissão, tipos e org-scope passaram. Ajuste local, sem publicação.

- Atalhos do painel de coordenação reutilizam `ShortcutCard` para as áreas
  principais do menu e Perfil, incluindo Agenda e Atletas. Eventos identifica
  criação e gestão; Agenda abre o calendário. Fonte: `HomeProfessorBelowFold.tsx`.
  Menu e cards priorizam Turmas, Atletas, Planejamento e Agenda após o início;
  ferramentas complementares vêm depois. Ordem conferida em localhost:8081.

- Professor: após Início, o menu prioriza Turmas, Alunos, Planejamento e Agenda.
  Os cards seguem a mesma ordem e mantêm as condições de permissão existentes.
  Fontes: `web-sidebar-navigation.ts` e `HomeProfessorBelowFold.tsx`.

- Atleta usa o mesmo `CalendarScreen` de professor/coordenação, com dados do
  vínculo fornecidos pelo adaptador de agenda e gestão desativada. Ver contrato
  e validação em [atletas e famílias](atletas-familias.md).

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

- Confirmação de celular no perfil usa ModalSheet central de até 440px, compartilhado
  entre papéis. Abrir após envio; fechar preserva número/código e reabrir não
  reenvia. Reenvio temporizado no modal; sucesso fecha, erro permanece no campo.

- OTP de celular usa seis casas no padrão de verify-email; completar ou colar
  seis dígitos dispara uma tentativa, sem repetição por renderização. Resposta
  ambígua do servidor mantém a mensagem inválido ou expirado.
