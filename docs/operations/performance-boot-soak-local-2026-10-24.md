# Go Atleta — consulta global, boot web e uso prolongado

Rodada local de 24/10/2026, continuação da [carga integrada](performance-stress-local-2026-10-24.md).
Base Git `187043ec`, com o pacote anterior preservado. Sem Android, commit,
push, deploy, migrations remotas ou alteração do stack compartilhado.

## Ambiente e método

- Frontend próprio em `localhost:8082`; `8081` pertence a outro worktree.
  Supabase isolado `goatleta-perf-22d9`, API `127.0.0.1:54421`, banco `54422`.
- Mesma organização fictícia com 100 turmas, 5.000 atletas/fotos/fichas de saúde,
  15.701 planos, 100 ciclos, 60.000 presenças, 1.200 relatos, eventos e inbox.
- Skills locais de fluxo, arquitetura, banco, segurança, testes e design system; nível 3 da
  [escada de validação](validation-ladder.md). Fixtures e evidências autenticadas
  permanecem ignoradas em `.tmp/performance-20261024/`.
- Medições no IAB, 1440×900, DPR 1, sem builds/testes/benchmarks concorrentes.
  Máquina compartilhada de 16 GB; não é laboratório controlado nem produção.

## Boot web: pacote e medida comparável

O único import de runtime do barrel `@expo/vector-icons` carregava famílias
adicionais. [icon-registry.tsx](../../src/ui/icon-registry.tsx) passou a importar
os entrypoints específicos de Ionicons e MaterialIcons. São os mesmos componentes,
fontes, glyphs, props e mapa semântico, sem nova dependência ou variante visual.
Quatro suítes/nove testes e lint passaram; os ícones foram comparados visualmente
no painel. Os mocks existentes acompanham os novos entrypoints.

| JavaScript inicial, incluindo runtime/common | Antes `web-complete` | Depois `web-startup` |
| --- | --- | --- |
| Bytes sem compressão | 9.523.441 | 9.140.776 |
| Gzip padrão, mesmo método | 2.551.685 | 2.438.436 |

Redução de 382.665 bytes sem compressão e 113.249 gzip. O analyzer auxiliar usa
gzip nível 9; seus números não são misturados com esta auditoria padrão.
O build usado na comparação de startup tem fontes de entrada/final idênticas:
`30c8f42fc8a11533cd392ca46b08e86a78c4aebe56f265e25e069619f32fa5f2`.
Quatro HTMLs e os três scripts iniciais de cada um foram auditados; API loopback,
nenhuma origem Supabase hospedada, nenhum dataset privado ou upload Sentry.

O protocolo recarrega o documento com HTTP sem cache, mantendo sessão e dados
persistidos. Isso cria um novo contexto JavaScript da página, mas **não** esfria
o processo do navegador, seu cache de compilação ou o sistema operacional.
A sonda observacional é injetada pelo servidor local antes dos scripts, com o
mesmo hash nas duas versões, sem ler estado interno, credenciais ou storage.

Prontidão: dois frames após o shell e após o painel conter o carrossel das
300 aulas e a primeira turma no DOM ativo. Não equivale a concluir toda consulta
opcional, carregar os 5.000 atletas no boot, INP ou processo frio do navegador.

A primeira sequência de três reloads por versão mostrou mediana de painel
1.870,4 → 1.031,9 ms. Como a transferência também variou bastante, foi feita
contraprova alternada no **mesmo processo de servidor**, sem alterar o banco.

| Contraprova alternada | Antes | Depois |
| --- | --- | --- |
| Painel 1 | 1.172,7 ms | 985,8 ms |
| Painel 2 | 1.309,6 ms | 906,2 ms |
| Painel 3 | 1.491,8 ms | 913,6 ms |
| Mediana do painel | **1.309,6 ms** | **913,6 ms** |
| Mediana do shell | 606,1 ms | 587,4 ms |

O painel ficou 30,2% mais rápido nesse recorte alternado; o shell variou 3,1%.
São três amostras por versão e há variação de máquina/rede local; o ganho não é
uma garantia de campo nem deve ser atribuído integralmente aos bytes removidos.
Não houve erro global nas doze aberturas observadas. Evidências:
`startup-cold-comparison.json`, `web-startup-initial-js.json`,
`startup-build-result.json`, `startup-before-dashboard.png` e
`startup-after-dashboard.png`.

Uma série intermediária alternada com o pacote `web-soak-final5`, já com o histórico
corrigido, mediu painel antes 2.635,1/1.411,5/879,1 ms e depois
1.769,1/984,0/1.158,5 ms: medianas **1.411,5 → 1.158,5 ms** (17,9%). O shell
teve medianas 710,6 → 571,4 ms. As seis aberturas tiveram zero erros globais.
O protocolo e as limitações de cache/processo são os mesmos; não houve ganho em
todos os pares. Esta é uma série nova, não média combinada com a rodada anterior.
Evidência: `startup-final5-cold-comparison.json`.

A contraprova da **versão final exata**, `web-soak-final6`, após todos os fixes,
teve painel antes 1.340,7/931,8/1.042,0 ms e depois 1.056,9/994,8/934,3 ms.
Medianas **1.042,0 → 994,8 ms**, 4,5%; shell 625,5 → 609,8 ms. Zero erros nas
seis aberturas. A variação entre séries e entre pares impede prometer redução fixa
do startup; o ganho persistente comprovado é a redução do pacote, com prontidão
do painel em torno de um segundo nesse ambiente. Esta série final é a referência
de fechamento, sem combinar percentuais com as anteriores.
Evidência: `startup-final6-cold-comparison.json`.
O pacote final contém 9.150.781 bytes iniciais/2.438.879 gzip padrão, incluindo
os ajustes posteriores de navegação e leitores; `web-soak-final6-initial-js.json`.

## Consulta global e autorização

O diagnóstico reproduziu HTTP 500/57014 em cerca de oito segundos na contagem
exata do dono e na leitura/contagem estrangeira. O plano executava helpers de
autorização por linha nas 60.000 presenças. A primeira página autorizada retornava
500 linhas; anônimo recebia lista vazia e total zero. `COUNT exact` é uma sonda
diagnóstica de PostgREST, sem uso desse cabeçalho identificado no app.

A [migration de leitura](../../supabase/migrations/20261024183530_optimize_attendance_read_policy_scopes.sql)
prepara escopos por instrução em dois helpers privados, sem argumentos, `STABLE`,
`SECURITY DEFINER` e `search_path=''`. Eles delegam às funções canônicas de
administração/equipe/substituição. O ramo do próprio aluno mantém o RLS de
`students`; não há cache de permissão entre instruções. As duas políticas SELECT
conhecidas tornam-se uma expressão equivalente; política desconhecida ou alterada
faz a migration abortar antes de criar helpers ou trocar políticas.

As wrappers novas não desligam RLS. Escritas, grants de tabelas, helpers antigos,
índices e dados permanecem como antes. Helpers novos não permitem execução por
PUBLIC/anônimo e ficam em schema privado. A aplicação local exige transação
única e guardas de projeto, porta, hash da migration e catálogo esperado.

O [teste PostgreSQL isolado](../../scripts/validation/attendance-read-scopes-sql.mjs)
passou em 65 checks: 19 atores de leitura e 18 de escrita, incluindo dados órfãos,
OR legado entre turma/organização, substituições, ausências, revogação entre
instruções na mesma conexão e rejeição de política inesperada. Compara todos os
campos, contagem/ordem, erros/efeitos de escrita e contratos de grants/RLS/helpers.
O DDL foi aplicado em uma transação somente em `goatleta-perf-22d9`, com
verificação posterior de hashes de todos os campos das 60.000 presenças,
5.000 atletas e 100 turmas. Dados, contratos de escrita, grants de schema/tabelas,
índices, flags de RLS, roles e helpers existentes ficaram idênticos. Não foi
gravado histórico de migration nem aplicado DDL remoto.

| Sonda Auth/PostgREST real | Antes, uma observação | Depois, mediana de três |
| --- | --- | --- |
| Contagem exata do dono | timeout 500/57014, 8.237 ms | **109 ms**, total 60.000 |
| Contagem estrangeira | timeout 500/57014, 8.162 ms | **285 ms**, total zero |
| Primeira página estrangeira | timeout 500/57014, 8.085 ms | **237 ms**, lista vazia |
| Contagem anônima | 209 ms, zero | 45 ms, zero |
| Primeira página anônima | 38 ms, vazia | 16 ms, vazia |

A contagem autorizada com `limit=1` retorna **206**, a resposta parcial correta
com total 60.000. O primeiro harness esperava apenas 200 e foi corrigido; essa
tentativa foi preservada separadamente, sem tratar o 206 como falha do produto.
Nos 18 GETs da série final não houve timeout/5xx. A primeira página do dono teve
222/282/284 ms, sem ganho uniforme em relação à observação anterior de 222 ms.
EXPLAIN ANALYZE sob Auth/RLS confirmou os escopos calculados uma vez: contagem
do dono 26,4 ms, estrangeira 94,3 ms e primeira página estrangeira 104,1 ms.
Esses tempos SQL excluem HTTP/serialização. Anônimo não executou os helpers.

Uma chamada real da função de produção sem intervalo recuperou 60.000 registros
em 121 GETs, 18.224.762 bytes e 7.982 ms. Todos os campos e a ordem conferiram
com a projeção SQL; 52.500 presenças/7.500 faltas, sem parcial. A referência
anterior de 21.452 ms é histórica, **não** um par novo para calcular percentual.
O leitor estrangeiro retornou vazio em um GET de 238 ms; troca de geração
rejeitou a operação inteira. O payload integral continua tendo custo.

No relatório mensal, a comparação pelo mesmo `web-startup` mostrou grande
variação: antes 7.750,5/9.729,7/4.994,9 ms, depois
14.208,9/12.035,7/2.348,8 ms, sempre 114 GETs e 55.000 registros. Portanto
**não se declara ganho nessa tela a partir dessa série**. Duas tentativas
anteriores do coletor foram registradas separadamente ao detectar que o helper
da sessão REPL mantinha o array da rodada anterior; a série foi reiniciada.
As URLs lentas foram repetidas fora do browser: 16 GETs autorizados, incluindo
aquecimento e três rodadas alternadas por página, conservaram status/linhas/hash.
As duas páginas observadas em 2,17/1,66 s no browser tiveram medianas de
264/182 ms no cliente Node, com upstream de 5–30 ms. Um controle variou de 44
a 515 ms com upstream de 6–8 ms. O delta de `pg_stat_statements` atribuiu
56,73 ms de SQL às 16 chamadas, cerca de 3,55 ms por chamada, sem blocos lidos
ou temporários. Planos literais, custom e generic foram conferidos com limite
de oito segundos: 2,1–8,7 ms nas páginas lentas; um controle generic chegou a
37,4 ms e filtrou 4.500 linhas, sem explicar segundos de espera.
O ensaio de planos preparados não comprova o plano interno usado pelo PostgREST.
Esses dados não apontam regressão SQL; a variação ocorreu no transporte/cliente
ou ambiente compartilhado. Nenhuma alteração especulativa foi aplicada.
Evidência adicional: `attendance-page-variance.json`.

Evidências: `global-attendance-diagnostic.json`, `attendance-read-scopes-apply.json`,
`global-attendance-read-scopes-after-verified.json`,
`global-attendance-production-reader-after.json`,
`global-policy-browser-report-comparison.json` e
`global-policy-browser-slow-requests.json`.

## Relatório mensal: carregar resumos e exportar os detalhes no clique

A variação acima motivou reduzir a carga necessária à tela. O relatório precisa
de totais por turma/dia para seus indicadores; nomes, notas e registros individuais
continuam necessários ao XLSX. A nova
[RPC mensal](../../supabase/migrations/20261024210000_monthly_attendance_summary.sql)
é `STABLE`, `SECURITY INVOKER`, `search_path=''`, recebe organização e um mês civil
completo e agrega somente linhas visíveis pelo RLS existente. Não faz JOIN que
elimine órfãos autorizados. O status replica o leitor atual: qualquer valor
diferente de `faltou` é normalizado como presença. Um objeto JSON evita truncar
o resultado no limite de mil linhas do PostgREST. PUBLIC/anônimo não podem
executar a função; não há novo gate de administrador, cache de permissão ou
alteração das políticas de leitura/escrita.

O [leitor](../../src/db/attendance-summary.ts) valida estrutura, contagens,
duplicatas e escopo/identidade/geração antes e depois do HTTP. Os seletores
ponderam as contagens e preservam as semanas 1–7/8–14/15–21/22–28/29–31.
Trocar mês/organização mascara os resumos e relatos antigos enquanto os novos
chegam, incluindo PSE. Falha da RPC gera erro explícito; não há resultado parcial
nem fallback silencioso para a carga integral.

| Carga de presenças para os indicadores de outubro | Antes | Depois |
| --- | --- | --- |
| Requisições | 114 GETs | **1 GET** |
| Corpo transferido sem compressão | 16.706.038 bytes | **106.710 bytes** |
| Registros/grupos recebidos | 55.000 registros | **1.100 grupos turma/dia** |

Redução de 99,36% nos bytes dessa carga. A projeção completa dos grupos, os
totais globais/por turma e as semanas conferiram com o oráculo SQL: 55.000 registros,
48.125 presenças, 6.875 faltas. Três chamadas reais do leitor retornaram o mesmo
hash; os tempos técnicos foram 1.015/275/79 ms. O export local podia estar em
execução nessa janela, portanto esses tempos **não** são comparação de UI nem
benchmark isolado. Outra conta autenticada recebeu vazio; anônimo recebeu
401/42501, mês inválido 400/22023 e avanço de geração rejeitou a resposta inteira.

Foram aprovados 47 testes em seis suítes Jest e 134 verificações PostgreSQL
(65 de escopo RLS e 69 do resumo, com 15 atores e mais de cinco mil grupos).
Incluem revogação, organização estrangeira, colisão da função, status legado,
turma vazia e chaves especiais, respostas antigas após trocar mês/organização,
erro sem parcial e bloqueio do download após import assíncrono. A aplicação
da função foi atômica somente no banco isolado, com guardas de hash/portas/projeto
e comparação de todos os campos das fixtures, políticas, grants, índices,
helpers públicos/privados e flags RLS antes/depois. Sem alteração desses contratos
ou histórico de migrations. Evidências: `monthly-attendance-summary-apply.json`
e `monthly-attendance-summary-real.json`.

O [XLSX sob demanda](../../src/screens/reports/application/export-trainer-attendance.ts)
usa o leitor completo existente, com ordem/notas/cabeçalhos e nomes preservados.
Limites de `DATE` são civis também na exportação, evitando omitir o último dia
em fusos positivos. O botão impede exportações duplicadas; mês, organização,
usuário e geração são conferidos até o download, inclusive após carregar o módulo
XLSX. As novas migrations permanecem pré-requisito de uma futura publicação;
nenhuma delas foi ativada remotamente nesta tarefa.

A primeira comparação no IAB, alternando três pares no mesmo servidor, mediu
**os totais visíveis** em dois frames: antes 15.447/5.763,1/2.731,3 ms, depois
408,7/182,8/238,5 ms; medianas 5.763,1 → 238,5 ms. Cada abertura anterior fez
114 GETs de presença; a nova fez uma RPC e nenhum GET de registros individuais.
Zero erros globais capturados. Essa prontidão não aguardava o PSE opcional.
Evidência: `monthly-summary-browser-comparison.json`. Uma tentativa anterior
teve buffer CDP truncado e foi excluída integralmente; o coletor foi trocado por
um `PerformanceObserver` por ação, sem depender desse buffer.

A contraprova posterior aguarda **totais e PSE**: três pares alternados entre
`web-startup` e `web-soak-final4`, no mesmo processo de servidor, HTTP sem cache,
backend aquecido. Outubro completo levou antes 4.697,1/4.950,3/6.103,9 ms e depois
2.528,2/1.915,8/1.209,9 ms. Medianas **4.950,3 → 1.915,8 ms**, redução de 61,3%
nesse recorte, com 114 GETs versus uma RPC e zero erros globais. São três amostras
por versão em máquina compartilhada, sem garantia de campo. O par intermediário
que coincidiu com Jest foi excluído inteiro e substituído; nenhuma de suas
latências participa da mediana. A pré-condição inicial esperava setembro vazio;
foi corrigida para as 5.000 linhas/4.375 presenças/PSE 4,5 reais da fixture, antes
de iniciar a primeira amostra. Evidência: `monthly-summary-full-indicators-browser.json`.

O próprio teste revelou outro custo na primeira abertura: o antigo carregamento
de 5.000 atletas disparava 50 consultas financeiras. A aba mensal passou a
carregar apenas turmas e resumos; Destaques lê nomes/IDs da turma escolhida,
com a ordenação por nome/ID e os inativos do fluxo anterior. O XLSX lê todos os
nomes somente no clique, pela projeção mínima já existente, sob a mesma guarda
de identidade/organização/geração. O roster conserva sua ordem por ID e paginação
anteriores. Trocar unidade seleciona a primeira turma correspondente na mesma
ação; escolher a unidade atual preserva a turma selecionada. O teste autenticado
confirmou Unidade Stress 02, Turma Stress 002 e os nomes a partir do atleta 00051,
sem conservar os nomes da Turma Stress 001.

No navegador, a abertura nova não fez consultas financeiras nem carregou o
diretório completo; a leitura de atleta restante pertence à resolução da conta.
O XLSX realmente baixado contém 55.000 registros, 100 turmas, 5.000 atletas e
os mesmos totais. **Todos os bytes são idênticos** ao arquivo anterior de
15.336.087 bytes, incluindo nomes, notas e ordem; SHA-256
`2272234522d6945518a95184b78e2dbde3f8748ca468d761dac969ca4bc01732`.
Evidências: `report-lazy-xlsx-browser.json`, `browser-lazy-xlsx-validation.json`
e `browser-lazy-xlsx-equality.json`.

## Navegação e superfícies retidas

O navegador revelou uma discrepância que os primeiros testes planos não cobriam:
o SDK 57 envolve a árvore real num navigator `__root`. O pacote usa a árvore
pública correta, obtida no momento da ação; os testes de regressão carregam a
configuração real de arquivos e o reducer/linking do SDK instalado. Os helpers
usam `push`, `navigate` e `replace` públicos; o SDK cria as entradas e os IDs do
navegador. As abas de professor, coordenação, aluno e familiar usam
`backBehavior="fullHistory"` somente no web, mantendo o padrão nativo.

Na raiz web, [withWebStackHistory](../../src/navigation/web-stack-history.ts)
compõe `UNSTABLE_router` depois do override Expo. O campo público `history`
registra visitas com snapshots imutáveis de rota, parâmetros e subestado de
navegação; não armazena modelo, mídia ou rascunho dos editores. Visitas repetidas
podem compartilhar a mesma chave e instância de tela. O snapshot ativo incorpora
as alterações das abas antes do próximo `PUSH`. `POP` de outra rota conserva a
remoção feita pelo SDK; mudanças de nomes/chaves invalidam as visitas
correspondentes, e `RESET` parcial segue a hidratação do SDK. A troca de workspace
aguarda a guarda antes de alterar papel/prévia e substitui a última visita.
Detalhes só são reutilizados com contexto integral idêntico.

O [patch versionado de expo-router@57.0.17](../../patches/expo-router+57.0.17.patch)
tem dois ajustes: sincronizar o índice em memória antes de processar um POP do
navegador e compor o `UNSTABLE_router` do chamador com o override Expo, usando
`useMemo`. Sem override do chamador, permanece a função Expo original. A versão e
os dois hashes são conferidos por
[check-expo-router-history-patch.cjs](../../scripts/check-expo-router-history-patch.cjs)
depois do `patch-package` existente no `postinstall`; atualizar o SDK exige rever
esses contratos.

O SDK instalado passou em **11 testes reativos**: oito da raiz e três de abas,
com `onStateChange` também após `resetRoot`/dispatch de Voltar e Avançar. O caso
de sete etapas verifica tela/URL, chaves de raiz/abas/perfil, IDs únicos e índices
do histórico em memória e do navegador. O controle sem sincronização perde a
identidade do perfil; o padrão `firstRoute` isolado não cria a entrada da aba
vizinha. Oito testes adicionais dos quatro layouts mantêm `fullHistory` no web e
o padrão no Android/iOS. São provas do SDK com fronteiras de navegador e eventos
de navegação simuladas, não validação do DOM autenticado.

O mecanismo real `patch-package@8.0.1` também passou numa fixture nova e isolada:
dois arquivos originais reconstruídos pelos textos/hashes revisados, somente
este patch, duas aplicações APPLY sem nome de pacote, exit 0 e segunda aplicação
idempotente. Os bytes resultantes coincidiram com os dois arquivos instalados;
o guard de execução registrou zero tentativas de rede ou subprocessos. A instalação
do worktree permaneceu intacta. Evidência privada:
`patch-package-fixture-validation.json`; isso não equivale a um `npm ci` completo.
A conferência autenticada de Voltar/Avançar passou no pacote `final4`, incluindo
foto/perfil/calendário e o estúdio retido. O pacote final também percorreu repetidamente
turma, quadra, scouting, agenda e evento no teste prolongado abaixo.
A sequência foto → calendário → Voltar → fechar opções → Avançar foi repetida
no `final6` após o soak, com tela/URL corretas e rolagem liberada fora da foto.
O relatório final confirmou os totais/PSE em 28 recursos, sem consulta financeira.
Evidência: `browser-final6-gates.json`; captura `final6-report.png`.

A quadra volta à turma imediatamente anterior do mesmo ID. O teste real confirmou
URL original sem query, plano aplicado e uma única turma. O retorno da turma ao
calendário compara a chave pública da tela de origem e seu caminho: a data pode
existir inicialmente somente no estado local. O contêiner web troca de pai entre
abas e detalhes e pode remontar o calendário com a mesma chave. Por isso, unidade
e data civil são preservadas nos parâmetros antes de abrir a agenda; uma nova
data recebida também restaura seleção e mês. O teste autenticado confirmou dia 27,
Unidade Stress 02 e um único calendário após retornar da Turma Stress 002.
Entradas diretas/legadas, outro pai e nativo mantêm o
fallback explícito. A chave de origem identifica navegação, sem conceder acesso.

As verificações também reproduziram portais indevidos após perder o foco:
detalhes de evento sobre o painel, foto sobre o calendário e estúdio sobre a
turma após Voltar. O `ModalSheet` web passa a respeitar o foco da rota e liberar
portal, rolagem e Escape imediatamente, sem chamar `onClose`, descartar ou salvar
dados. Contextos globais fora de telas permanecem visíveis; o nativo conserva a
apresentação anterior. Evento com edição pendente pede descarte/continuação,
revalidando contexto e baseline após a confirmação, sem salvamento automático.

O estúdio mantém seu modelo/editor enquanto a rota está retida. No blur, remove
a superfície e libera mídia, RAFs, listeners, observers, URLs próprias e o bloqueio
do app; o arquivo original e a edição em RAM permanecem. Ao retornar, a reprodução
fica pausada. A saída explícita mantém o diálogo existente. Isso evita perder uma
edição ainda anterior ao autosave de 800 ms. Não se declara liberação de toda RAM
enquanto o modelo estiver intencionalmente retido. Evidência funcional anterior
a esses ajustes: `browser-navigation-regression-final2.json`.

## Teste prolongado

O primeiro segmento durou **23,13 minutos reais no mesmo documento SPA**, com
consulta/paginação de atletas, perfil, turma, quadra, scouting/vídeo, troca de
workspace, calendário mensal e evento. Foram observados 3.073 recursos e zero
erros globais capturados. Uma chamada longa do controlador excedeu seu orçamento
e reiniciou a sessão de automação; a página permaneceu aberta no mesmo documento.
Esse incidente está registrado separadamente e não é tempo de navegação do app.

O teste encontrou acúmulo concreto: após a exploração inicial, os retornos ao
painel tiveram **4.479 → 4.958 → 6.804 nós** e heap usado informado pelo CDP de
71.945.492 → 82.094.940 → 112.817.420 bytes. O primeiro checkpoint de 681 nós
antecedia a exploração e não serve como base comparável de retenção. A inspeção
identificou três calendários anteriores ocultos, de 1.371 nós cada, e cópias da
mesma turma. Não houve vídeo conectado nos retornos ao painel. Heap sem GC
forçado não prova vazamento sozinho; as telas duplicadas no DOM são a evidência
que motivou a correção de navegação.

Evidências anteriores à correção: `browser-soak-before-navigation-fix.json`,
`soak-retained-screens.json` e `browser-soak-recovered.json`.

### Dois bloqueios encontrados no aquecimento final

A lista de turmas ainda hidratava financeiro de todos os atletas sem usar esse
estado. `getStudents({ includeFinancial: false })` permite pular essa etapa apenas
nesse consumidor; o padrão dos outros fluxos permanece habilitado. Campos, ordem,
cache sanitizado e guardas de sessão/organização/geração permanecem iguais. Três
suítes/46 testes passaram, incluindo 5.000 atletas, defaults, cancelamento e cache.
Cada leitura do diretório evita 50 consultas financeiras. Na abertura real houve
duas leituras: **100 → zero consultas financeiras**, mantendo 23 GETs de atletas
(duas paginações completas e resolução da conta). É uma comparação de contagem,
uma abertura por versão, sem alegação de ganho percentual de latência.
Um coletor inicial truncou o buffer de recursos e foi excluído; a contraprova
usa a mesma sonda ampliada nas duas versões e conserva todas as entradas.
Evidência: `classes-financial-actual-browser.json`.

Novembro também mostrou erro na leitura composta dos eventos: `events` respondeu
200, mas o filtro único de `event_classes` colocou centenas de UUIDs numa URL
excessiva e o browser registrou falha de transporte. O
[leitor de eventos](../../src/api/events.ts) passou a usar lotes de 50 IDs e
paginação ordenada até página vazia, com orçamento global, rejeição de duplicatas
e guardas de contexto em cada etapa. Eventos acima do cap também são paginados.
Erro intermediário rejeita a lista inteira; organização explícita autorizada pode
diferir do workspace inicial. Sem alteração de RLS, schema ou contratos de escrita.
Os 12 testes da API cobrem 337 IDs, mais de mil vínculos, cap reduzido, falha após
dados parciais e trocas de contexto. O navegador final confirmou **1.200 aulas e
115 eventos de novembro**, sem o erro. O aquecimento que encontrou esses dois
problemas foi preservado em `browser-warmup-final5-excluded.json` e não participa
do soak válido.

### Repetição válida no pacote final

O `web-soak-final6` tem fingerprint de fontes/dependências
`bf5c3ab8e0dafc23e6f56616b8077585cd4c15bbbc50adb82997747eb1613612`.
Build com entradas idênticas, API isolada, quatro HTMLs e três scripts iniciais
auditados; sem origem Supabase hospedada nem dataset privado no export.

No mesmo documento SPA foram concluídos **cinco ciclos completos e 33 replays**
(três no aquecimento e seis por ciclo; clipe local de 5,055 s, 960×540), sem build, teste automatizado ou benchmark
HTTP concorrente. Incluem paginação/foto/busca do último atleta, perfil/edição sem
salvar, turma/quadra/rascunho, scouting com 1.000 contatos e 45.000 posições,
troca de workspace, dois meses, unidade/data, turma e evento. Os cinco pontos
completos comparáveis abrangem **15,018 minutos entre âncoras**. O documento foi
observado por 23,099 minutos; os 48 segundos entre a última âncora e a coleta final
são registrados separadamente, sem ampliar a janela entre âncoras.

| Painel completo e estabilizado | Base | Retornos seguintes |
| --- | --- | --- |
| Elementos no DOM | **2.349** | **2.349 / 2.349 / 2.349 / 2.349** |
| Calendários ocultos duplicados | zero | zero |
| Turma retida intencionalmente | uma, 167 nós | uma, 167 nós |
| Vídeos conectados | zero | zero |
| Heap usado, CDP | 54.556.732 bytes | final 57.345.480 bytes |

O heap oscilou, inclusive caindo a 44.530.692 bytes, sem GC forçado. Isso não
certifica ausência de vazamento em qualquer uso; o acúmulo de telas reproduzido
antes deixou de ocorrer nesse ensaio. Houve **zero erros globais e zero erros do
controlador** no segmento final. Os 33 replays chegaram ao fim, sem quadros
descartados observados nos contadores do player; não é certificação de FPS/INP.
Decodificação de vídeos longos ou 4K fica fora dessa medida.

As âncoras aguardam o painel, o rodapé das 100 aulas e estabilidade do número de
nós por 500 ms. Capturas anteriores durante a montagem progressiva da lista
(1.429 e 1.879 nós) foram preservadas e excluídas. A base usada é o primeiro painel
completo de 2.349 nós, após todos os fluxos visitados. Prontidão do carrossel e do
shell continua sendo uma métrica separada de prontidão de todos os dados.

O antes/depois de retenção é descritivo: antes 4.479 → 4.958 → 6.804 nós, depois
cinco vezes 2.349. As janelas entre as âncoras antigas e novas não têm a mesma
duração; não se calcula percentual de redução de memória nem capacidade de
usuários simultâneos a partir disso. Evidências:
`browser-soak-after-navigation-fix.json` e `browser-soak-comparison-final6-verified.json`.
Uma auditoria offline independente (`soak-final6-independent-audit.json`)
conferiu os fatos e exclusões: 209 fases concluídas, 25 ações após a base e zero
divergências. O heap direto do CDP e o heap aproximado de `performance.memory`
ficam separados; não se misturam seus valores absolutos.

As quatro amostras por fluxo após a base tiveram estas medianas de prontidão
visível, sempre em dois frames após o clique confiável:

| Sinal da tela | Mediana | Faixa observada |
| --- | --- | --- |
| Primeira página de atletas com foto acionável | 3.558,0 ms | 3.369,5–4.582,0 ms |
| Lista com primeira turma acionável | 3.307,3 ms | 2.935,3–3.836,8 ms |
| Perfil com botão Editar perfil | 42,3 ms | 38,0–58,2 ms |
| Cabeçalho do detalhe da turma | 429,6 ms | 369,6–543,1 ms |

São critérios diferentes, não um ranking de conclusão de todas as consultas.
O custo das listas permanece; não houve ganho uniforme em toda navegação quente.

### Limites e fechamento local

As listas ainda recuperam o cadastro completo de 5.000 atletas, e o bootstrap
observado fez duas leituras. Essa etapa permanece custosa e não foi apresentada
como navegação instantânea; perfis, detalhes e meses aquecidos têm sinais de
prontidão diferentes. Atletas preserva a hidratação financeira porque seus filtros
autorizados usam esse estado; a opção de pular consultas ficou restrita a Turmas.
Uma futura projeção mínima/pré-agregação deve ser medida
separadamente e preservar campos, contagens e autorização, sem resultado parcial.

Tipos, org-scope, arquitetura estrita (1.255 módulos/4.852 imports/zero violações),
perf-hygiene das 21 telas, lint focado, regressões relevantes e build local passaram.
Checklist preserva IDs, títulos, estados e os contratos de revisão pessoal.
Android, concorrência real de usuários e produção permanecem sem validação nesta
rodada. Sem commit, push, deploy ou aplicação de migration remota.
