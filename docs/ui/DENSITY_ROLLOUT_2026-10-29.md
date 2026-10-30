# Densidade operacional — rodada de 29/10/2026

Implementação local do padrão compacto nas superfícies operacionais do Go Atleta.
A referência é a proporção aprovada da Quadra Visual e da Agenda, preservando a
fonte do produto. Rodada iniciada em 29/10, com QA final em 30/10/2026. Não inclui publicação nem migração de dados.

## Contrato atual

- `responsiveLayout.density`: página 18/24 no mobile e 20/26 no workspace,
  seção 16, corpo/card 12, metadado 11; gaps 12/8 e padding de card 10/12.
- [compact-ui-metrics.ts](../../src/theme/compact-ui-metrics.ts) é puro e continua
  reexportado por `tokens.ts`: ícones 16/14, controle visual 32, alvo 44,
  navegação 56, ação central 44 e largura máxima 440.
- [OperationalText.tsx](../../src/ui/OperationalText.tsx) fornece fonte implícita
  de 12 na UI operacional. Estilo explícito prevalece; texto operacional aninhado
  conserva herança. Refs, props nativas, acessibilidade e ampliação de texto permanecem.
- Primitives e componentes locais ajustam fonte, ícone, padding, gaps e reflow
  juntos. A largura adicional libera regiões; não amplia os controles.
- Auth conserva bloco de 440 e campos de 50. Campos editáveis e controles
  especializados conservam seus contratos. Sem `zoom`, escala global ou
  desativação da ampliação de texto.

O [Design System](DESIGN_SYSTEM.md#tipografia) e as
[regras responsivas](RESPONSIVE_RULES.md#proporção-dos-elementos) são as fontes
canônicas. A implementação anterior restrita à Agenda e à navegação permanece
como histórico em [referência da Agenda](AGENDA_SAMSUNG_REFERENCIA_2026-10-29.md).
O padrão operacional atual substitui a descrição anterior de adesão opcional.

## Cobertura de código

O inventário inicial inspecionou 686 fontes nas pastas `app`, `src/screens`,
`src/ui` e `src/components`. Destas, 132 são arquivos em `app`, incluindo
wrappers, layouts e helpers. O gerador do checklist reconhece 123 rotas; esses
números não representam telas distintas nem comprovação de inspeção visual.

Os seis conjuntos abaixo ajustaram explicitamente 124 fontes de apresentação
(105 dos três primeiros e 19 dos complementos), sem sobreposição entre os
manifests. Separadamente, 249 imports operacionais de `Text` foram migrados em
cada checkout para `OperationalText`,
além das primitives compartilhadas. As contagens são de fontes/imports, não de
features, telas ou rotas concluídas.

| Pacote | Fontes | Superfícies efetivamente tratadas |
| --- | ---: | --- |
| Home e perfis | 23 | Home professor/coordenação, aula atual, agenda do dia, atalhos; perfil pessoal/funcionário/aluno; home, agenda, pagamentos, perfil e convite familiar. |
| Turmas e pessoas | 29 | Cards/tabela de turmas, edição, workspace, chamada, histórico/exportação, lista e modais de alunos, vínculo familiar e plano do atleta. |
| Outros workspaces | 53 | Planejamento/treino, biblioteca, periodização, financeiro, notificações/comunicados, NFC, relatórios, gestão, regulamentos, WhatsApp e detalhe compatível de evento. |
| Complemento | 12 | Scouting, plataforma, evidências, consulta, conquistas, onboarding, acesso pendente, convite de equipe e navegação de data da sessão. |
| Sessão e histórico | 2 | Cabeçalho do relatório da sessão e estado de fallback do histórico. O título de edição da turma já pertence ao pacote Turmas e não é contado novamente. |
| Assistente | 5 | Página, saudação, composer e seletores de modelo/turma. |

Wrappers de papéis reutilizam seus renderers reais; aliases e redirects não
recebem cópias de layout. Cards, cabeçalhos, abas, dropdowns, settings e modais
compartilhados adotam a mesma escala operacional. O rollout do corpo implícito
alcança os imports operacionais de `Text`; estilos especializados prevalecem.

Manifests privados no checkout de origem `031b`: `.tmp/app-density-home-profiles-20261029/coverage.json`,
`.tmp/app-density-classes-people-20261029/coverage.md` e
`.tmp/other-workspace-density-20261029/COVERAGE.md`; complemento em
`.tmp/density-final-gaps-20261029/files.json` e
`.tmp/assistant-density-20261030/files.json`. O inventário e a validação integrada
ficam em `.tmp/app-density-rollout-20261029/`; artefatos privados de QA
não são publicados como parte da documentação.

## Limites preservados

- Canvas da Quadra Visual, coordenadas, diagramas, gráficos, eixos, mídia e
  proporções de preview não recebem redução genérica. Fontes de exportações
  PDF/ICS e outros documentos mantêm a escala própria.
- Contratos de autenticação, autorização, organização, persistência, navegação
  e mutações permanecem. O fetch existente para abrir anexos web foi extraído
  do chamador de aplicação para o [adaptador de API](../../src/api/event-attachment-file.web.ts),
  atendendo ao guardrail de camadas sem mudar o comportamento. O
  [chamador](../../src/screens/calendar/application/open-event-attachment.web.ts)
  conserva a abertura do arquivo; esta extração não cria uma operação remota nova.
- Campos de formulário conservam altura mínima, foco, seleção e edição. O
  perfil mantém seu rascunho, ações e proteção ao sair; OTP conserva casas e
  números especializados.
- O renderer legado nomeado de planejamento mensal, cujo export padrão hoje
  redireciona à periodização, não foi tratado como uma tela ativa separada.
- Menus/fichas curtos seguem o conteúdo; conteúdo longo rola dentro do limite
  útil. Navegação e ações flutuantes reservam suas medidas e safe areas reais.

## Validação registrada

| Escopo | Resultado local |
| --- | --- |
| Home/perfis | 10 suítes, 55 testes; ESLint das 23 fontes e diff check passaram. |
| Turmas/pessoas | Grupo principal: 6 suítes, 90 testes; grupo complementar: 5 suítes, 49 testes. Existem sobreposições; não somar os grupos. ESLint e diff check passaram. |
| Outros workspaces | 7 suítes, 31 testes; ESLint das 53 fontes e diff check passaram. |
| UI integrada | 35 suítes, 283 testes únicos, incluindo 8 testes em 3 suítes do Assistente. Os 3 testes de OperationalText aparecem nos grupos de telas e primitives e foram descontados do total. Não somar com os grupos dos pacotes acima. |
| Anexos | 2 suítes, 22 testes, registrados separadamente da UI integrada. |
| Tipos e guardrails | `typecheck:app` passou na origem e no runtime, com nova aprovação na origem após o delta final; arquitetura strict, org-scope e performance hygiene strict passaram; ESLint de 259 fontes e dos deltas finais de Assistente/cabeçalhos sem avisos. São checks locais, não medição de performance de produção. |

Localhost real inspecionado no checkout `577e`, em `http://localhost:8081`:

| Fluxo | Viewports e interações conferidos |
| --- | --- |
| Home | Professor em 633/390 px e dashboard de coordenação em 1440 px. |
| Turmas | 390 e 1440 px; busca, edição/cancelamento, retorno pelo breadcrumb e detalhe em 390 px. |
| Alunos e perfil | Diretório em 1440/390 px, perfil de atleta em 390 px, perfil próprio em 1440 px e suas configurações em 390 px. |
| Planejamento e biblioteca | 390/834 px, incluindo abertura do drawer da biblioteca. |
| Exercícios | Tablet de 834 px e catálogo em 390 px. |
| NFC | 390 px. |
| Gestão | 1440 e 390 px, com dados reais. |
| Financeiro | 1440 e 390 px; resumo, abas e reflow, sem operações financeiras. |
| Notificações | 1440 px. |
| Regulamentos | 1440 px após carregamento e reflow em 390 px, com métricas em duas colunas e sem overflow. |
| Assistente | 390/1440 px. Título de 20/26 px em uma linha no mobile; composer com fonte de 16 px e altura de 44 px, largura de 266/1016 px. Texto digitado preservado no resize e limpo sem enviar. |
| Agenda e ficha de aula | Lista/semanal/barra rápida em 1440 px. Ficha em 390 px: título de 16 px, dados de 12 px, cinco ações compactas; abertura e fechamento sem alterações. |
| Periodização | Gate sem turma em 834 px; não certifica um ciclo preenchido. |

No recorte inicial, fluxos de família, sessão do aluno e plataforma não foram
inspecionados no browser por falta do papel autorizado naquela sessão. Esta rodada confere
proporções e interações citadas; não revalida animações nem scroll lento/rápido
da Agenda. As rodadas anteriores de motion mantêm seu registro próprio.

A [continuação por papel de 30/10](DENSITY_ROLES_2026-10-30.md) registra os
recortes posteriores do Aluno na sessão atual de 8081, de Acessos em preview e da
Família/painel real em 8082 com Supabase local real e dados fictícios. Evidências e testes ficam
separados deste total histórico. Não amplia o aceite para todas as rotas nem
certifica a conta exclusivamente administradora da Plataforma.

Os patches incrementais dos três pacotes iniciais passaram por `git apply --check` no
checkout do runtime antes da integração, preservando diferenças locais. Testes
de renderização e cobertura estática não comprovam aceitação visual de todas as
rotas. A inspeção física da matriz completa não é presumida destes resultados.
As capturas inspecionadas são artefatos privados em
`.tmp/app-density-rollout-20261029/`. Não há certificação de build nativo,
performance de produção ou deploy.
