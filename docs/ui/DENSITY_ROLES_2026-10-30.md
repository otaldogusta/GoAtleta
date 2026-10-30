# Densidade por papel — rodada de 30/10/2026

**REGISTRO LOCAL — recortes conferidos.** Este registro reúne o escopo e as
observações recebidas da rodada principal. Não certifica toda a matriz do app,
publicação ou ativação remota. Registro preparado no checkout
de origem `031b`; o runtime de inspeção é `577e`.

**Continuidade:** o usuário rejeitou depois a composição visual desta rodada.
As inspeções abaixo são evidência histórica delimitada, não aceite do resultado.
O [novo refinamento de consistência](CONSISTENCIA_PLATAFORMA_2026-10-30.md)
registra a correção seguinte e sua validação separadamente.

## Ambientes e origem dos dados

| Superfície | Ambiente | O que esta evidência representa |
| --- | --- | --- |
| Aluno | `http://localhost:8081`, runtime `577e`, sessão atual do app | Inspeção autenticada pelo papel Aluno oferecido pela troca de perfil existente. Não foram criados vínculos ou alteradas permissões. |
| Plataforma — acessos | `http://localhost:8081`, preview/demo oferecido pelo app | Antes/depois do fluxo de acessos conferido em cinco larguras. Não comprova aprovação real nem substitui o renderer com a API local. |
| Família | `http://localhost:8082`, API local com dados fictícios | UI real sobre Auth/RPC reais do Supabase local, com comparação antes/depois em Home, Agenda, Pagamentos, Perfil e alternância entre dois atletas. Capacidades financeiras mantidas nos contextos permitido/restrito. |
| Plataforma — painel real | `http://localhost:8082`, renderer real com API local e dados fictícios | Antes/depois e interações de leitura conferidos. A conta sintética recebeu vínculo real de treinador apenas na organização de QA local; a limitação do administrador puro está separada abaixo. Não equivale ao backend de produção. |

Porta, sessão e natureza dos dados fazem parte do recorte. Não transferir um
resultado do preview/demo em `8081` para a Família ou o painel real em `8082`.
O frontend em `8082` usa o Supabase real em loopback `54321`, com Auth/RPC reais
locais. Os dados, a conta e a organização de QA são sintéticos. Essa evidência
não certifica autenticação, grants, RLS ou dados de produção.
Nenhum contrato de autenticação ou autorização foi editado para essa inspeção.

Ao encerrar a rodada, o frontend de QA em 8082 foi parado após conferir a
propriedade do processo; os dados sintéticos e o Supabase/Docker locais foram
preservados. A porta 8082 identifica o ambiente usado nos testes, sem indicação
de que permanece online. O localhost 8081 permaneceu em execução, com Professor
restaurado em /prof/home e viewport resetado. Evidência privada de limpeza em
`.tmp/role-density-20261030/cleanup-proof.json`.

## Delta de apresentação

| Fonte | Antes identificado | Delta local e estado |
| --- | --- | --- |
| [StudentAthleteHome.tsx](../../src/screens/student/StudentAthleteHome.tsx) | Gaps de 24–32, dias de 68, ícone do treino 52/24, atalhos de 58–68 e espaço vazio de cerca de 100 px entre hero e atalhos em 390 px. O flex proporcional permanecia no fluxo em coluna. | Gaps 12/8; dias 52; ícone 32/16 em controles com alvo 44; atalhos 44–56. Flex 2/1 restrito ao split horizontal. Hero e boas-vindas compactados, preservando gesto, textos, dados e ações. Delta aplicado no runtime pelo agente principal; observações abaixo têm escopo limitado. |
| [student-badges.tsx](../../app/student-badges.tsx) | Seis quadrados de 128–160 e uma segunda lista repetindo os mesmos seis badges. | Seis cartões únicos com nome, critério e estado/meta; duas colunas no celular e três quando há capacidade de split. Mínimo de 80, com crescimento pelo conteúdo. Emoji 20, corpo 12/metadado 11 e KPI de 28 preservados, sem alterar pontuação ou limiares. |
| [student-scouting.tsx](../../app/student-scouting.tsx) | Padding de 14–16, gap de 16 e botões visuais de 32 sem ampliação explícita do alvo. | Padding 10/12, gaps 8/12; visual 32 com espaço reservado para alvo 44 e grupos que quebram quando falta largura. Contagens, limites, janela e gravação permanecem. Salvar não foi acionado. |
| [PlatformAccessDashboard.tsx](../../src/screens/platform/PlatformAccessDashboard.tsx) | No preview, nomes quebravam em quatro linhas dentro de um painel medido em aproximadamente 528 px. Referência coletada em 320/390/960/1200/1440. | Reflow conferido nas cinco larguras: nomes sem a quebra de quatro linhas em 960, detalhe ajustado em 1200, estatísticas compactas em três colunas no celular, com wrap em 320 e sem overflow horizontal da página nessa largura. Nenhuma solicitação foi aprovada ou negada. |
| [PlatformDashboard.tsx](../../src/screens/platform/PlatformDashboard.tsx) | Antes do mesmo renderer coletado em 390/1200/1440, separado do preview de acessos. | Reflow e interações conferidos contra a Supabase real local com dados fictícios em 8082. Cabeçalho USUÁRIOS ampliado de 48 para 64 para uma linha, com lint e recaptura 1440. Nenhuma mutação administrativa. |
| [FamilyUi.tsx](../../src/screens/family/FamilyUi.tsx) | Títulos dos cards em 16 e empty state com piso de 160, mesmo com conteúdo curto. | Títulos operacionais 12, line heights compartilhadas e empty state guiado pelo conteúdo. Depois conferido nas rotas familiares listadas, sem alteração de dados ou capacidades. |
| [FamilyHomeScreen.tsx](../../src/screens/family/FamilyHomeScreen.tsx) | Atalhos com mínimo de 64 e chevron 18. | Mínimo 56 e ícone secundário compartilhado. Seletor, KPI 20, valor da fatura 18 e campos 50 preservados; antes/depois conferidos em 390/1440. |
| [WebSidebar.tsx](../../src/ui/WebSidebar.tsx) | Na restauração do professor em 390, Alternar workspace começava em x 280 com largura 236, chegando a 516 e cortando opções fora do viewport. | Ancoragem corrigida: em 390, x 142/largura 236/direita 378; em 320, x 72/direita 308 e três opções inteiras. Clique em Professor retornou a /prof/home; a opção já ativa fecha o menu mantendo a rota. 12 testes/1 suíte e lint passaram. |

Perfil próprio e configurações já estavam compactos e ficaram fora desse delta
de três fontes do Aluno. Campos de 50, OTP e representações especializadas
conservam suas medidas. Não houve mudança de autenticação, roteamento, modelo de
dados, autorização, consultas, RPCs ou regras de negócio nesta rodada de refino.
A pendência adjacente do menu trata posicionamento visual; não autoriza alterar
papéis, workspaces disponíveis ou roteamento.

## Inspeções locais registradas

Os itens abaixo descrevem interações conferidas pelo agente principal em
localhost. Não são um aceite global do papel ou de todos os estados da rota.

| Rota/estado | Ambiente e viewport | Observação delimitada |
| --- | --- | --- |
| `/student/home` | `8081`, 390/834/1440 | Alternância entre dia 30 sem treino e dia 31 com treino. Em 390, o depois foi inspecionado sem o espaço vazio entre hero e atalhos. Não se extrapola para todos os nomes, turmas ou tamanhos de texto. |
| Boas-vindas do Aluno | `8081`, 390 | Modal compacto conferido; sem completar ou salvar perfil. |
| `/student/achievements` | `8081`, 390/1440 | Seis cartões únicos com critério/status; sem a lista duplicada. Isso não valida a obtenção real das conquistas. |
| `/student-scouting` | `8081`, 390/320 | Controle visual 32 e alvo 44 com espaço reservado, sem sobreposição. Nenhuma contagem foi gravada. |
| `/student/profile` e `/student/profile/settings` | `8081`, 390 | Composição própria e configurações inspecionadas; nenhum perfil foi salvo. |
| `/student/agenda` → `/student-plan` | `8081`, 390 | Dia 31 selecionado; abertura do plano vinculado mostrou o estado sem plano. Não foi criado um plano para produzir um estado preenchido. |
| `/absence-report` | `8081`, 390/834 | Formulário aberto, sem envio de aviso de ausência. |
| Plataforma — acessos | `8081`, 320/390/960/1200/1440 | Antes/depois do preview conferido. Busca por Mariana e seleção atualizaram o detalhe. Sem aprovar, rejeitar ou conceder acesso. |
| `/family/home` | `8082`, 390/1440 | Antes/depois do início familiar conferido no app real com dados fictícios locais. |
| `/family/agenda` e `/family/profile` | `8082`, 390 | Antes/depois conferido; agenda e perfil do contexto selecionado mantidos. Sem editar ou criar dados. |
| `/family/payments` | `8082`, 390/1440 | Antes/depois no contexto com capacidade financeira: duas cobranças e valores mantidos. Nenhum pagamento ou operação financeira executado. |
| Seletor e capacidade financeira familiar | `8082`, 390 | Ida ao segundo atleta vinculado e volta ao primeiro mantiveram o financeiro permitido/restrito. Isso confere a UI contra as fixtures, sem certificar autorização remota. |
| Reentrada do perfil familiar | `8082`, 390 | Reload e novo login locais estabilizaram o perfil. O primeiro bootstrap teve 401/retry; não houve correção do Auth do app nem esse episódio foi apagado do registro. |
| Painel real da Plataforma | `8082`, antes/depois 390/1200/1440; também 834 inspecionado | Organização de QA local: busca, seleção, filtro Suspensa com estado vazio e retorno a Todas conferidos. Sem mutações administrativas. Captura 1440 atualizada após ajustar USUÁRIOS 64. |
| Alternar workspace na sessão do professor | `8081`, 390/320 | Antes/depois em 390 e inspeção em 320: menu dentro do viewport, três opções inteiras. Professor retornou a /prof/home; opção ativa fechou sem mudar a rota. Papel original restaurado e viewport resetado ao finalizar. |
| Acessos reais via painel | `8082`, 390 | /platform → organização de QA → Ver acessos abriu /platform/accesses com o recorte da instituição. Busca QA mostrou zero; limpar revelou duas linhas sintéticas locais preexistentes. Pendente → Todos funcionou; sem revisão, grant ou exclusão. |

Não há tela financeira própria do Aluno nessa composição: o perfil próprio não
fornece `financeContent`. A ficha institucional usa `StudentFinanceTab` apenas
com `canViewFinance`; pagamentos pertence ao fluxo da Família. Esta rodada não
cria outra aba nem amplia permissões para obter uma captura.

`/student-consultation` teve revisão de código, sem inspeção visual comunicada
neste recorte. Não está incluída entre as rotas conferidas em localhost acima.

## Evidência de antes/depois

Os originais e a galeria privada ficam em `.tmp/role-density-20261030/` no
checkout `031b`. As imagens não foram editadas, remontadas ou versionadas. O
gerador `generate-gallery.cjs` descobre os pares `*-before-<largura>` /
`*-after-<largura>` novamente a cada execução e registra os arquivos encontrados
em `before-after-manifest.json`.

- Home: pares de 390 e 1440; boas-vindas: par de 390.
- Conquistas: pares de 390 e 1440; scouting: par de 390.
- Perfil, Agenda e ausência: capturas de inspeção de 390, sem par de mudança
  nesta rodada; o termo `accepted` no nome histórico do arquivo não amplia o
  recorte registrado na tabela acima.
- Plataforma — acessos: cinco pares em 320/390/960/1200/1440, nomes
  `platform-access-before-<largura>.jpg` / `platform-access-after-<largura>.jpg`.
- Família: oito pares; Home e Pagamentos em 390/1440, Agenda, Perfil, seletor e
  contexto financeiro restrito em 390. Prefixos `family-*-before-*` / `family-*-after-*`.
- Painel real da Plataforma: três pares em 390/1200/1440, prefixo
  `platform-dashboard-*`; captura 1440 atualizada com o cabeçalho de 64.
- Menu de workspace: par `workspace-menu-before-390.jpg` /
  `workspace-menu-after-390.jpg`, com a sessão do professor em 8081.
- Acessos reais: `platform-access-api-accepted-390.jpg` é uma captura de inspeção,
  sem par de mudança nesta rodada; não entra na contagem dos pares.

A galeria deste recorte seleciona somente os 23 pares completos: seis do Aluno,
oito da Família, cinco de Acessos, três do painel real e um do menu de workspace.
A existência dos arquivos e da
galeria não gera aceite automático; as observações humanas delimitadas acima
são a evidência de inspeção.

## Verificações locais

| Conjunto | Resultado comunicado | Limite |
| --- | --- | --- |
| Delta Aluno | 11 testes em 4 suítes passaram; ESLint dos quatro arquivos sem avisos; parser TypeScript sem diagnósticos; diff e patch incremental verificados. | O teste novo confere unicidade de nome/critério e estados/metas. Parser não substitui typecheck completo. Recibos em `.tmp/role-density-student-20261030/`. |
| Delta Plataforma | 20 testes em 4 suítes passaram, informados pela rodada responsável; manifesto e patch em `.tmp/platform-reflow-20261030/`. | Testes não certificam reflow no navegador nem ações administrativas reais. |
| Delta Família | 17 testes em 3 suítes passaram; lint sem avisos, diff e patch incremental verificados. Recibos em `.tmp/family-density-20261030/`. | Corridas de contexto, ações de acesso e projeções de API cobertas com dependências simuladas. Não equivale a Auth/RLS hospedados ou operação financeira real. |
| Menu de workspace | 12 testes em 1 suíte (`src/ui/__tests__/web-sidebar-profile-menu.test.ts`) e lint passaram; recibo em `.tmp/workspace-menu-viewport-20261030/validation.json`. | Ancoragem web e UI em 390/320 conferidas; nenhuma alteração de papéis ou opções autorizadas. |
| Gates integrados da rodada | `typecheck:app` completo, `check:org-scope`, performance hygiene strict das três telas verificadas e diff passaram, comunicados pelo agente principal. | Checks locais; não certificam FPS, build nativo, produção ou a matriz de todas as telas. |

Os quatro conjuntos são registrados separadamente, sem somá-los à validação de
29/10 ou repetir contagens de suítes compartilhadas. A auditoria anterior do
Aluno, com 46 testes em 8 suítes, é outro recorte e não é acrescida a estes 11.

## Limites que permanecem

- A conta exclusivamente administradora da Plataforma encontra uma limitação
  anterior do bootstrap no gate `pending`. Para exercitar o renderer real, foi
  criado vínculo real de treinador somente para a conta sintética na própria
  organização aleatória de QA do Supabase loopback `54321`. Foi uma alteração
  nos dados locais de QA, sem grant remoto/produção ou mudança de Auth no app.
  O comportamento de administrador puro não está corrigido nem certificado.
- O primeiro deep link frio para /platform/accesses em 8082 retornou a /prof/home.
  A entrada pelo painel /platform e pelo botão existente Ver acessos funcionou.
  Essa limitação de entrada não foi corrigida nem atribuída a uma causa nova
  nesta rodada de apresentação.
- Família, painel e acessos reais usaram Auth/RPC reais do Supabase local em
  `54321`, com dados fictícios. Não são teste de integração hospedado de
  Auth/PostgREST/RLS ou operação financeira de produção.
- Consulta do Aluno, plano preenchido, todas as variantes de texto/idioma,
  movimento lento/rápido e builds nativos não receberam aceite nesta rodada.
- O checklist preserva seus 376 IDs e revisões pessoais. Sua atualização registra
  este recorte local e não transforma paridade global em concluída.

Durante as inspeções da UI não houve pagamento, revisão/concessão de acesso ou
gravação de perfil/chamada/scouting. A preparação dos dados sintéticos e o
vínculo local de QA estão descritos acima. Não houve commit, push, deploy ou
alteração de produção por este registro. O fechamento é local e limitado aos
recortes e às interações descritos.
