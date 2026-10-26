# Carga pesada e desempenho local — 24/10/2026

Continuação da [primeira rodada](performance-local-2026-10-23.md) do Go Atleta,
base Git `187043ec`. Alterações locais, sem commit, push, deploy ou aplicação de
migration remota. Android excluído por decisão do usuário. Dados inteiramente
fictícios; nenhum disparo de mensagem, IA paga ou integração externa.

A [continuação de consulta global, startup e uso prolongado](performance-boot-soak-local-2026-10-24.md)
registra a correção posterior dos timeouts de leitura global, a comparação de boot
e o acúmulo de telas encontrado no circuito prolongado. As medições abaixo
permanecem como evidência desta etapa, sem substituir as séries posteriores.

## Ambiente e comparação

- Frontend de produção exportado localmente; primeira coleta no Chrome e nova
  coleta A/B no navegador integrado, após falha da conexão da extensão Chrome.
  Viewport 1440 × 900 e DPR 1, Supabase/Auth/PostgREST/Storage reais locais.
  As séries dos dois navegadores não são misturadas para calcular ganhos.
- `localhost:8081` pertence a outro worktree e foi preservado. O servidor desta
  tarefa usa `localhost:8082`; API isolada `127.0.0.1:54421`, projeto Docker
  `goatleta-perf-22d9`. O stack compartilhado e seus dados foram preservados.
- O **antes desta rodada** é o export imutável `web-slim` das oito correções
  anteriores: 9.506.896 bytes de JS inicial, 2.547.517 gzip. Os hashes dos três
  scripts conferiram em quatro HTMLs. Não representa o HEAD anterior a todo o
  trabalho. Uma tentativa de reconstruir o HEAD em staging foi cancelada e
  excluída das medições; o staging foi retirado do repositório para não afetar Jest.
- A primeira correção completa, `web-after`, revelou custo de paginação antes
  oculto pelo truncamento. A coleta cronometrada final usa `web-final`, hash de
  entrada `540e1467a47ac344ba44c2643985a3da10f0cd5d5cd8a8007f5224d6f12924c8`.
  Os índices de atletas e planos e a RPC otimizada entraram entre essas fases;
  portanto o ganho do navegador é do pacote local, sem atribuição isolada ao JS.
  Os ensaios de índice e de leitores abaixo isolam seus próprios cenários.
- O smoke funcional posterior usa `web-navigation`, hash de entrada
  `6d3deb220c9ac87b0c1c5796e9cd24a837665e6fdccc12cd4a8d805cce2f7951`.
  A diferença de 37 bytes no JS inicial decorre da guarda de carregamento das
  permissões, depois do A/B; não foi atribuída a ela a medição de `web-final`.
- O fechamento usa `web-complete`, hash de entrada/final idêntico
  `0fb0c22520972f9cd1dd31bd71b848321d56dc57f4c7069212b049603b2f2d23`.
  Inclui faixas mensais e persistência IndexedDB; o A/B do relatório foi repetido
  nesse artefato, sem atribuir a ele os tempos antigos de atletas/turmas.
- Máquina de 16 GB compartilhada com outros processos. Builds ficaram fora das
  amostras cronometradas. As conferências de relatórios feitas durante build
  valem somente como validação funcional. Não é hardware controlado ou produção.

## Massa integrada

Nova organização sintética com 100 turmas, 10 unidades e a conta de teste local.
Fixtures anteriores preservadas. Todas as turmas receberam dados relacionados:

| Entidade | Quantidade e verificação |
| --- | --- |
| Atletas | 5.000, 50 por turma; leitura autenticada paginada e relações sem órfãos. |
| Fotos de atleta | 5.000 objetos PNG sintéticos distintos em bucket privado; assinatura e imagem reais. Acesso estrangeiro e público anônimo negados. |
| Saúde | 5.000 fichas sintéticas; 714 flags de saúde e 384 de medicação. |
| Periodização | 100 ciclos e 5.200 semanas vinculadas. |
| Planos remotos | 15.700 snapshots de aula estruturalmente validados no A/B; 15.701 após o smoke de aplicação, sem apagar os originais. |
| Aulas e relatórios | 1.200 sessões completas e 1.200 relatos longos com três referências de foto sintética cada. |
| Presenças | 60.000 chamadas e 60.000 vínculos de presença da sessão; 55.000 chamadas em outubro. |
| Agenda e notificações | 300 eventos com vínculos e 1.000 notificações. A inbox conserva seus limites de listagem; não foram renderizadas mil notificações simultaneamente. |

Participantes dos relatos conferem com as chamadas. A grafia das ausências de
7.500 fixtures foi corrigida para `faltou`, o contrato canônico; IDs, ordem e
contagens não mudaram. Negativos autenticados por UUID cobriram onze tabelas.

O adaptador web de blueprints/planos diários mantém parte dos dados em memória.
Foram preparados 1.200 blueprints e 15.700 planos diários para as 100 turmas;
o parser canônico validou o conjunto e a API web recuperou uma amostra real.
**Isso não prova que os 16.900 objetos estavam carregados na memória do browser.**
Os planos remotos, ciclos, semanas e chamadas acima estavam no backend real.

Scripts, SQLs de fixtures, contas, tokens, imagens e receipts estão ignorados em
`.tmp/performance-20261024/`. Não compõem a entrega versionável nem devem ser
copiados para produção. O manifesto privado identifica os recursos navegáveis.

## Achados e correções priorizadas

### Fotos e cadastro

O navegador confirmou `1–8 de 1000` enquanto o banco tinha 5.000 atletas. O
diretório também iniciou trabalho para fotos de toda a lista, apesar de mostrar
oito linhas. A coleta registrou 1.008 recursos com caminho de foto privada,
incluindo assinatura e download de imagem; não são 1.008 assinaturas distintas.
O último terminou aproximadamente 10,46 s após o clique.

- [Atletas e aniversários](../../src/db/students.ts) leem páginas de 500 até uma
  página vazia, inclusive sob cap menor do servidor. O cursor `(name,id)` usa a
  ordenação/collation do servidor, com limite inferior simples de nome e condição
  de desempate escapada; não compara nomes em JavaScript. `name NOT NULL` foi
  confirmado no schema canônico e local. Repetição, dado inválido ou falha não
  publica um cache parcial como diretório completo.
- Organização explícita autorizada do aluno/família continua possível quando
  difere do workspace profissional. A operação fixa usuário, geração e workspace
  **inicial** contra mudanças, preservando o filtro solicitado e o RLS.
- [Lista de atletas](../../src/screens/students/StudentsListTab.tsx) informa apenas
  a página visível ao [hook de fotos](../../src/hooks/use-student-photo-access.ts).
  Perfil/editor aberto pode pedir sua própria foto. Turmas usam os itens visíveis
  da `FlatList`, sem trocar o virtualizador existente.
- O [transporte de foto](../../src/api/student-photo-storage.ts) compartilha
  pendentes e limita a seis solicitações, com isolamento de contexto e timeout.
  TTL de URL existente preservado. Cancelar um consumidor não cancela outro.

Os testes dos componentes reais confirmaram 5.000 atletas → 8–20 candidatos da
página e 100 turmas → candidatos dos cards visíveis. No IAB, a página de oito
atletas passou de **1.000 fetches de assinatura + 8 imagens para 8 + 8**, com as
oito fotos carregadas. No final, o último desses recursos terminou em 3.341 ms
após o clique; a tela completa ficou pronta antes. Isso não mede FPS.

O [índice de atletas](../../supabase/migrations/20261024100325_students_org_name_id_read_index.sql)
é B-tree não único `(organization_id,name,id)`, aplicado somente no banco local
descartável: 565.248 bytes e construção de 1.147 ms. Noventa GETs de controle
mantiveram os corpos e o catálogo RLS/grants. O índice sozinho não eliminou o
custo do `OFFSET` profundo; por isso a correção incluiu o cursor.

O leitor real foi comparado em três rodadas alternadas, com os mesmos três
índices finais e cache em memória novo por operação. A lógica foi extraída por
AST das fontes OFFSET e cursor e executou sobre `db/client.ts`, Auth e PostgREST
reais; sessão/armazenamento local e telemetria foram adaptados no harness.

| Operação completa, 5.000 atletas | Mediana OFFSET | Cursor | Requisições / bytes por operação |
| --- | --- | --- | --- |
| `getStudents` | 6.049,1 ms | 3.815,9 ms (−36,9%) | 61 GETs / 8.708.677 bytes, iguais |
| `getStudentBirthdayCandidates` | 4.959,4 ms | 1.886,1 ms (−62,0%) | 11 GETs / 504.982 bytes, iguais |

Os 61 GETs incluem 11 páginas de atletas e 50 leituras financeiras existentes.
Todas as 12 operações retornaram 5.000 IDs únicos; hashes da projeção ordenada
conferiram com SQL e os corpos finais foram iguais entre as variantes. A conta
estrangeira recebeu lista vazia e o anônimo foi rejeitado antes do HTTP. São
três repetições quentes locais, sem custo de SQLite/React ou percentil de produção.

### Relatórios e chamadas

- [Relatórios por intervalo](../../src/db/session.ts) passam a paginar resumos
  sem fotos. Fixture de 1.200 registros retorna 1.200 IDs únicos, em vez do cap de
  1.000. Erro intermediário rejeita a leitura; não apresenta total parcial.
- [Chamadas](../../src/db/students.ts) usam cursor `(date,id)` e limite de 500,
  com limite inferior de data avançando junto do cursor. Isso evita reautorizar
  todas as linhas descartadas pelo `OFFSET`. A saída mantém a ordem mais recente
  primeiro e preserva notas, dor e status.
- Valores do cursor são delimitados e escapados conforme a
  [gramática oficial do PostgREST](https://docs.postgrest.org/en/stable/references/api/url_grammar.html#reserved-characters).
  A sintaxe com aspas foi exercitada nas leituras reais completas.
- A [migration aditiva](../../supabase/migrations/20261024041756_attendance_logs_org_date_id_read_index.sql)
  cria B-tree não único `(organization_id,date,id)`. Foi executada apenas no banco
  descartável desta tarefa, sem mudar RLS, grants, limites ou timeouts.
  Aplicação em outro ambiente exige autorização e avaliação de bloqueio de escrita.

| HTTP autenticado, página de 500 | Antes | Depois |
| --- | --- | --- |
| Meio do mês, OFFSET vs cursor com limite de data | 6.784 ms | 1.115 ms |
| Final do mês, OFFSET vs cursor com limite de data | HTTP 500 / timeout em 8.034 ms | HTTP 200 / 155 ms |

São leituras pontuais quentes, não percentis. O A/B separado do índice usou três
amostras por posição e fase, os mesmos dados e o mesmo cursor:

| Posição no conjunto | Mediana sem índice novo | Com índice novo |
| --- | --- | --- |
| 0 | 898 ms | 132 ms |
| 30.000 | 1.004 ms | 161 ms |
| 54.500 | 175 ms | 113 ms |

Os 18 GETs retornaram HTTP 200 e 500 registros com digests iguais entre fases.
O plano eliminou `Incremental Sort` nas duas primeiras posições. Construção
local: 809 ms e 5.758.976 bytes. Catálogo de políticas/grants inalterado e negativos
por UUID/anon preservados. Três amostras não sustentam p95 nem promessa de SLA.

O leitor **real** `getAttendanceAll` na versão serial anterior, extraído por AST sem reescrever sua lógica,
executou sobre `db/client.ts`/`supabaseGet`/retry reais, Auth e PostgREST locais.
Apenas sessão, AsyncStorage e descarte da telemetria foram adaptados em memória:

| Recorte | IDs únicos / GETs | Tempo / corpo HTTP |
| --- | --- | --- |
| Outubro | 55.000 / 111 | 14.387 ms / 16.706.032 bytes |
| Histórico inteiro | 60.000 / 121 | 21.452 ms / 18.224.762 bytes |

IDs, datas e status conferiram com SQL: outubro 48.125 presentes/6.875 faltas;
histórico 52.500/7.500. Três anotações TS posteriores geram JavaScript idêntico
ao executado, verificado sem repetir a carga.

#### Leitura mensal em até quatro faixas

Um protótipo **sem alteração de fonte** executou o leitor serial real uma vez no
mês inteiro e, depois, quatro chamadas do mesmo leitor em faixas contíguas:
01–09, 09–17, 17–25 e 25–01/11, com início inclusivo/fim exclusivo. Preservou os
ISO com horário do hook nas bordas externas e usou DATE nas fronteiras internas.
Auth/PostgREST/`db/client.ts` e os índices foram os mesmos, sem latência artificial.

| Protótipo, um par em processo aquecido | Serial | Quatro chamadas |
| --- | --- | --- |
| 55.000 chamadas completas | 14.515 ms / 111 GETs | 4.491 ms / 114 GETs |
| Corpo HTTP | 16.706.032 bytes | 16.706.038 bytes |
| Pico de requisições aguardando headers | 1 | 4 |

A diferença observada foi de aproximadamente 69%, em **um par**, sem percentil
ou prova de UI. Os seis bytes extras correspondem às três páginas vazias finais
adicionais. Todos os campos **e a ordem** tiveram SHA256 idêntico
`fb2f16062e9e33dd6c01c43c711386dec4b1025ef17c21b844c0d4d5e19ee582`;
IDs, status e datas conferiram com SQL. Um controle separado de mudança de
geração rejeitou as quatro chamadas sem publicar parcial.

Após essa prova, a implementação interna de `getAttendanceAll` passou a usar
até quatro faixas somente em intervalos canônicos limitados de 8–31 dias.
Intervalos curtos, longos, inválidos ou sem as duas bordas seguem seriais. Cada
faixa percorre seu cursor `(date,id)` até vazio; o resultado concatena as faixas
na ordem SQL e reverte uma única vez, sem ordenar IDs em JavaScript. Os workers
compartilham identidade/organização inicial, deduplicação, limite total de mil
requisições e a primeira falha. Uma falha impede novas páginas dos demais;
requisições já em voo podem terminar, mas seus resultados são descartados.
Não houve mudança da API pública, transporte, hook, SQL ou RLS.

Trinta e um testes focados passaram, incluindo cap 137/500, respostas fora de
ordem, faixa vazia, ISO externo com horário, falha intermediária, duplicata entre
faixas, orçamento global, limites de 8/9 dias e troca de conta/workspace/geração.
Uma falha enquanto outro worker aguardava a organização também impediu sua
retomada. Revisão estática independente não encontrou outro defeito concreto.

A revalidação HTTP da **função final** fez uma chamada pública, com quatro faixas
internas: 55.000 IDs únicos, 114 GETs HTTP 200, 16.706.038 bytes, pico quatro e o
mesmo SHA256 de todos os campos/ordem do serial e do protótipo. O controle real
de geração rejeitou a chamada inteira sem parcial. Fontes permaneceram idênticas
durante a execução. Os 5.915 ms desta amostra são uma observação funcional n=1,
sem novo par serial comparável ou extrapolação para UI.

O A/B posterior **na tela** comparou `web-navigation` serial com `web-complete`
em três retornos de setembro para outubro por versão, mesma conta/organização,
IAB 1440×900, cache HTTP desativado e backend aquecido. Builds/testes ficaram
fora das amostras. O relógio começa no clique confiável e termina dois frames
depois de o DOM exibir outubro, 48.125 presenças, 6.875 faltas e 55.000 registros.

| Retorno a outubro | Antes serial | Depois em faixas |
| --- | --- | --- |
| 1 | 14.600,9 ms | 5.240,6 ms |
| 2 | 15.747,3 ms | 5.412,3 ms |
| 3 | 15.457,9 ms | 5.331,2 ms |
| Mediana | **15.457,9 ms** | **5.331,2 ms** |

Redução de **65,5%** nessa interação, com 111/114 GETs de chamadas por retorno.
Todas as repetições mostraram os mesmos totais e 100 turmas. Uma tentativa
incompleta após reload não registrou clique e expirou em torno de um comentário
do usuário no browser; foi excluída e a série final recomeçou. São séries antes e
depois em máquina compartilhada, sem aleatorização, não INP ou garantia de campo.
Evidência: `browser-report-month-comparison.json` e `browser-final-reports.png`.

A primeira tentativa dessa revalidação recebeu 401 antes de retornar linhas e
foi preservada como falha, excluída dos resultados positivos. A checagem separada
de Auth/horário e GET mínimo passou; com nova autenticação, todos os 114 GETs
passaram e seus headers corresponderam à sessão/configuração local. Não se
demonstrou a causa do 401 inicial, nem foi alterada a autenticação para evitá-lo.
Receipts distintos: protótipo `attendance-partitions-comparison.json`, falha
`attendance-partitions-current-validation.json`, metadados
`attendance-auth-metadata.json` e código final aprovado
`attendance-partitions-current-validation-rerun.json`.

**Limite remanescente:** relatório global com dezenas de milhares de chamadas
continua tendo custo significativo. `COUNT exact` global atingiu timeout em
8.343 ms. A leitura global por conta estrangeira também terminou em 500/57014,
sem revelar registros, mas sem comprovar retorno vazio. Não foi marcada como
negativo aprovado. Isso difere dos negativos indexados por UUID já aprovados.
Não houve relaxamento de autorização para tornar o benchmark mais rápido.

### Planejamento e calendário

- A [biblioteca](../../app/training/index.tsx) usa `TrainingPlanSummary` explícito,
  sem corpo/pedagogia, para listar e contar todos os planos. Não cria um
  `TrainingPlan` incompleto que pudesse ser salvo por engano.
- [Leitores](../../src/db/training.ts) paginam e usam caches separados para
  resumos, detalhes e aplicações do calendário. Visualizar/editar/aplicar busca
  o corpo completo por ID antes de trocar ou apagar o rascunho. Falhas, respostas
  atrasadas e cancelamento conservam o conteúdo autoral.
- O [calendário](../../app/calendar.tsx) busca uma projeção mínima de aplicações
  do grid de 42 dias, incluindo recorrência legada. Turmas, eventos e planos
  carregam independentemente, com estado associado à sessão/workspace/intervalo.
- O seletor carrega **resumos** dos planos das turmas da mesma unidade/faixa
  etária, não só da turma selecionada. O corpo completo vem por ID ao aplicar,
  sob trava/nonce e guardas de sessão/workspace/cancelamento. Erro de carregamento
  é explícito; não aplica um DTO com campos vazios. A biblioteca conserva a
  pedagogia do documento hidratado. A fábrica de aplicação do calendário manteve
  seu contrato anterior de pedagogia, sem ampliá-lo nesta otimização.
- O [índice de planos](../../supabase/migrations/20261024101523_training_plans_org_createdat_id_read_index.sql)
  acrescenta B-tree `(organization_id,createdat,id)` apenas no banco local.
  Como os 15.700 planos sintéticos compartilham o timestamp, o cursor padrão
  drena primeiro `(createdat igual,id menor)` e só após resposta vazia busca um
  timestamp anterior. Mantém a precisão recebida do backend e percorre até vazio,
  sem assumir que página curta encerra o conjunto. O modo `version_desc` conserva
  sua paginação por OFFSET; não foi ampliado sem medição.

Fixture controlada de 15.700 resumos confirmou 157 por turma. O teste do route
real cobriu as quatro entradas remotas, rascunhos locais e conflitos de seleção.
No HTTP local real, a posição 7.500 passou da mediana de 1.910 ms com OR composto
para 170 ms no cursor por timestamp (três amostras, 500 linhas e hash igual).
Na posição 15.000, a mediana final foi 81 ms, com uma amostra de 722 ms. Isso é
uma comparação pontual de query, não do carregamento inteiro do calendário.

### Sugestão de revisão da aula e acesso

A [RPC original](../../supabase/migrations/20261024102000_activity_review_context_read.sql)
reduziu a transferência de chamadas a dias por turma. A
[otimização aditiva](../../supabase/migrations/20261024102703_activity_review_context_indexed_exists.sql)
mantém `SECURITY INVOKER`, exige administração da organização e usa o índice por
turma/data com `LATERAL LIMIT 1` e matrícula materializada uma vez. A projeção de
chamadas cobre somente turmas com matrícula. Sem mudança de RLS/grants das tabelas.

O HTTP real retornou o mesmo JSON de 79.353 bytes e o mesmo hash do SQL:
55.000 chamadas → 1.100 dias/turma, em 100 turmas. A execução original levou
7.404 ms; as três execuções finais levaram 1.052/1.001/988 ms. O estrangeiro
recebeu 403 em 28 ms e o anônimo 401 em 10 ms. Esses negativos são desta RPC;
não substituem o caso global de chamadas que ainda atingiu timeout. Quatorze
checks PGlite cobriram o contrato SQL. O painel limpa o estado ao mudar
usuário/workspace/data, e o fallback legado pagina revisões sem aceitar parcial.

A [fronteira de permissão](../../src/auth/MemberPermissionBoundary.tsx) agora
aguarda o carregamento da organização **e** de suas permissões antes de redirecionar
um deep link. Quinze testes cobrem a regressão e a guarda de acesso; essa espera
não concede permissão adicional.

## Navegador: séries, correções e conferência funcional

Na coleta histórica do Chrome, cinco amostras aquecidas por fluxo. A sonda
captura o clique confiável e dois frames até um marcador de conteúdo ativo;
o tempo das ferramentas fica fora. Inclui navegação/transição/render, não é INP.
As telas mantidas na pilha e seus caches fazem parte desse cenário aquecido.

| Fluxo | Mediana | Mínimo–máximo |
| --- | --- | --- |
| Volta ao painel da coordenação | 112,4 ms | 90,0–156,5 ms |
| Volta ao diretório de atletas | 104,1 ms | 93,2–113,8 ms |
| Volta ao início do professor | 162,6 ms | 146,2–192,7 ms |
| Volta ao calendário mensal | 167,9 ms | 149,9–208,9 ms |

Entradas iniciais isoladas: diretório 2.024 ms e lista de turmas 1.909 ms até o
marcador de linhas; o diretório ainda estava truncado e as fotos terminavam depois.
Esses dois casos não equivalem a carregar os 5.000 atletas completos.
Uma calibração inicial do painel foi excluída por sobreposição com preparação.

Foram conferidos login local, troca real de organização, turmas, diretório,
início nos dois workspaces, calendário com aulas/eventos e a turma com plano,
chamada e relatórios reais da fixture. O acesso genérico de Periodização sem
turma apresentou a orientação existente para selecionar pelo fluxo de turmas;
não certifica a navegação dos 100 ciclos individualmente.

Naquela coleta, o PDF da lista foi solicitado pela UI. A espera automática expirou;
a consulta inicial à pasta Downloads não confirmou seu destino. A verificação
da janela nativa disparou uma interrupção de segurança do Computer Use: não foi
possível confirmar com confiança a URL do Chrome. Nenhum outro navegador ou
tecnologia foi usado para contornar esse bloqueio.

Posteriormente, o usuário forneceu o arquivo salvo na Área de Trabalho. O binário
de 28.326 bytes (SHA256 `da34054992357da395918746e29f31900f5583fff33c069228548855b9907bfb`)
foi lido e rasterizado: duas páginas A4 em paisagem, Helvetica/Helvetica-Bold,
50 atletas únicos de `00001` a `00050`, turma e mês corretos, datas e marcações
de presença/falta. As duas páginas foram inspecionadas visualmente, legíveis e
com continuação até a linha 50 e total 50. Evidência privada em
`.tmp/validation/stress-roster-browser/`. **A exportação desta lista no browser
da versão anterior está confirmada**, sem transformar o timeout do listener
em evidência de falha do produto. Isso não testa as fontes Calibri de outros PDFs.

### IAB: carga completa e navegação aquecida

A retomada no navegador integrado foi uma nova rodada autorizada; não contornou
a interrupção anterior. As coletas `browser-iab-before.json`,
`browser-iab-after-initial.json` e `browser-iab-final.json` distinguem três fases:

| Entrada sem cache da tela, n=1 por fase | `web-slim`, truncado | Primeiro AFTER completo | `web-final` completo |
| --- | --- | --- | --- |
| Diretório | 1.391,1 ms / 1.000 atletas | 9.546,8 ms / 5.000 atletas | 2.955,0 ms / 5.000 atletas |
| Turmas | 1.064,1 ms | 11.530,1 ms | 3.010,5 ms |

O primeiro AFTER revelou três leituras paginadas concorrentes de atletas,
aniversários e contagens. O trabalho anteriormente truncado passou a ocorrer
por inteiro, com autorização real. Cursor, índices e a RPC de contexto reduziram
o custo na fase final. Não se compara 1.000 linhas com 5.000 como se fosse a
mesma entrega, nem se generaliza uma entrada isolada para p95 ou startup frio.

| Volta aquecida no IAB, n=5 | Antes, parcial | Primeiro AFTER | Final |
| --- | --- | --- | --- |
| Painel | 69,3 ms | 64,2 ms | 92,4 ms |
| Diretório | 52,9 ms | 51,7 ms | 65,5 ms |

São medianas clique → marcador de conteúdo e dois frames, sem tempo de ferramenta.
O cache e as telas mantidas na pilha integram o cenário. **Não houve ganho uniforme
na navegação aquecida**: as medianas finais acima são maiores, e a entrega final
é completa. No final, a volta ao início do professor teve mediana de 104,5 ms e
ao calendário de 82,7 ms, também cinco amostras; não há par anterior equivalente
de carga completa para atribuir um ganho.

O marcador inicial do calendário apareceu em 287,3 ms, mas isso não significa
que todos os planos já estavam carregados. A coleta acompanhou 34 GETs de
planejamentos, cujo último terminou 6.961,2 ms após o clique. O tempo de observação
da ferramenta não foi tratado como latência do app. Ainda não é prova de fluidez
completa do calendário sob carga, retenção de memória ou interação contínua.

### Fluxos e arquivos reais após as correções

- Diretório com 5.000 atletas, busca/página final e fotos foi conferido. A ficha
  do atleta `00091` mostrou os campos brutos de saúde e medicação esperados; o
  editor foi cancelado, sem gravar alteração clínica.
- Periodizações das turmas `001`, `050` e `100` exibiram o ciclo ativo de 2026,
  janeiro a dezembro, semanas 1–52 e o recorte de outubro. São três amostras
  navegáveis do conjunto real, não auditoria visual individual dos cem ciclos.
- A biblioteca mostrou 100 turmas × 157 planos. Abrir a prévia realizou um único
  `getById` de 59 ms e recuperou o corpo completo. O aviso de plano já aplicado
  não disparou POST. Essa duração é uma observação funcional, não benchmark.
- O calendário abriu 1.570 resumos compatíveis com unidade/faixa, sem carregar
  os corpos completos antes da escolha. Em smoke posterior ao A/B, aplicar um
  plano à turma `001` em 24/10 realizou GET do corpo, GET da versão mais recente
  e POST 201 com `return=minimal` (corpo de resposta vazio esperado). A reabertura
  mostrou título, turma, estado aplicado e blocos 1/2/1 com tempos 10/40/10,
  versão 2 e dias vazios. Os 15.700 originais foram preservados; agora há 15.701.
  Essa mutação sintética ocorreu **depois** das medições e não alterou seu baseline.
- Relatórios mostraram 55.000 chamadas, 48.125 presenças e 6.875 faltas em 100
  turmas, com 111 GETs. O recorte mensal de relatos mostrou 1.100 sessões em
  quatro GETs, incluindo a confirmação vazia final. Foi conferência funcional
  durante build, sem usar seus tempos como medição de desempenho.

O download real do plano gerou 55.602 bytes, uma página, com Calibri regular,
bold e italic. O relato gerou 12.369 bytes, uma página e três imagens sintéticas.
Os textos extraídos e as páginas rasterizadas foram conferidos; a inspeção visual
do root aprovou legibilidade/tabela/fotos. Receipt em
`.tmp/validation/browser-heavy-pdfs/receipt.json`; não é apenas render do SDK
fora do browser.

Uma nova exportação da chamada pelo IAB em `web-navigation` confirmou o destino
real em Downloads: 28.326 bytes, SHA256
`17479deb802831b56d9698785ebc511c4a1ec14fbdde68621d5e6b73fbab44f3`, duas
páginas A4 em paisagem, 50 atletas `00001`–`00050`, mês/turma/datas/status e total
50. As duas páginas foram rasterizadas e aprovadas visualmente pelo root. A pasta
`.tmp/validation/stress-roster-browser-after/` é independente da evidência antiga;
o arquivo fornecido anteriormente pelo usuário não foi sobrescrito.

O XLSX realmente baixado, `relatorio_2026-10.xlsx`, tem 15.336.087 bytes e SHA256
`2272234522d6945518a95184b78e2dbde3f8748ca468d761dac969ca4bc01732`.
O `openpyxl 3.1.5` do runtime oficial leu o arquivo em modo somente leitura:
uma aba `Relatorio`, cabeçalhos `Data/Turma/Aluno/Status/Observacao`, 55.000 linhas,
100 turmas, 5.000 atletas únicos, 48.125 `presente` e 6.875 `faltou`. Não houve
linha vazia nem duplicata de data/turma/atleta; CRC do ZIP válido e SHA256 idêntico
antes/depois. O receipt `browser-xlsx-validation.json` inclui checksum canônico
das linhas. Não foi salvo ou modificado pelo verificador.

A quadra 2D abriu o template 5×1 de recepção com sete atores. O arraste de P1
foi confirmado visualmente; Undo restaurou a posição e Redo reaplicou o movimento.
A reprodução avançou até o final; um novo replay foi pausado e o scrub chegou a
50%. A saída usou “Sair com rascunho local”, sem salvar jogada remotamente.
Evidência: `browser-court-witness.json` e screenshots antes/depois do arraste.
Isso comprova esses controles, sem medir FPS, retenção ou a representação 3D.

A caixa interna do professor foi percorrida até o fim das 13 páginas elegíveis:
Todos 250 e Não lidos 200, sem marcar leitura, arquivar ou excluir avisos.
O total de 1.000 notificações da fixture tem escopos diferentes. A virtualização
mantinha 48 cartões no snapshot final, sem renderizar 1.000 itens simultâneos.
Evidência: `browser-inbox-witness.json`; não valida entrega push.

Continuam fora desta comprovação: startup frio repetido e comparável, retenção
de memória/mídia, interação sustentada de agenda e capacidade de produção.
Android permanece fora desta rodada por decisão do usuário.

## Estúdio de vídeo: carga sintética e armazenamento web

No Supabase isolado foram aplicadas somente as migrations canônicas aditivas
`20261007112922_scouting_rallies` e `20261017004249_scouting_video_documents`,
necessárias para o fluxo existente. A overview passou de função ausente para
HTTP 200 autenticado; os negativos estrangeiro/anônimo retornaram 403/401.
Não houve reset, alteração de política ou ativação de compartilhamento/YouTube.

Uma nova sessão fictícia “SMOKE desempenho local 24/10” recebeu um clipe público
de plantas do MDN, de 5,055 s e 960×540, pelo seletor de arquivos da UI. O arquivo
físico permanece local. A análise inicial sincronizou; sua exportação real foi
usada para gerar uma fixture canônica de 16 rallies, 1.000 contatos e 45.000
posições (2.479.013 bytes), sem vínculos de atletas ou resultados atribuídos.
Essas posições são carga sintética; não são frames detectados ou análise esportiva.

A importação abriu integralmente no IAB. Reprodução até o final, pausa ativa em
1,473 s, avanço aproximado de um quadro para 1,506 s, busca em 2,5 s e painel de
contatos foram conferidos. Uma exportação integral adicional foi preservada.
O salvamento falhou antes da RPC: instrumentação temporária, sem leitura dos
valores armazenados, confirmou `QuotaExceededError` no `localStorage.setItem`,
com 2.477.732 caracteres. A instrumentação foi removida. O serializer já retira
histórico até caber no orçamento e conserva uma única cópia das 45.000 posições;
o problema é a cota do armazenamento compartilhado com outros dados da origem.
Correção durável: IndexedDB no navegador, preservando rascunhos legados e
AsyncStorage nativo. O adapter usa o banco `goatleta-scouting-video-drafts-v1`
e store `drafts`, com a chave canônica completa e a fila por chave existente.
Leitura no IndexedDB é autoritativa; somente chave ausente consulta o legado.
Presença inválida, erro, abort, blocked ou timeout não ressuscitam cópia antiga.
Escrita e leitura resolvem após `transaction.oncomplete`; falha impede a RPC.
O primeiro erro de persistência passa a interromper o ciclo de autosave de 800 ms,
preservando dirty e a tentativa manual, que retoma a sincronização após commit.
Nenhum cache, rascunho antigo ou autenticação foi removido. São 25 testes do
adapter/integração e 54 regressões de draft/storage/cloud, com lint e revisão
independente aprovados. O smoke acima não mede FPS ou retenção de memória.

No `web-complete`, a mesma importação passou a “Sincronizado”, com Salvar rascunho
desabilitado e sem o aviso de quota. A resposta real da RPC foi HTTP 200,
revisão 2, com 16 rallies, 1.000 contatos, 45.000 posições e o fingerprint original.
A saída ocorreu limpa, sem diálogo de alterações pendentes. Uma tentativa de
entrada sem rede foi bloqueada na validação de acesso à sessão, antes do hook;
a rede foi restaurada e essa fronteira não foi alterada. Portanto essa tentativa
não comprova entrada offline ou recuperação completa offline do estúdio.

A reabertura autenticada recuperou os 16 rallies e o estado “Sincronizado”. A
exportação real após reabrir manteve mídia, rallies, contatos, análise/posições e
correções idênticos à fixture e à cópia exportada antes da correção: SHA256
canônico `41c738a1115b339ce4954287b0a206c21bf2bdeb0c39cce20daaa003d2ce3a12`.
O JSON recuperado tem 2.479.012 bytes; a diferença de um byte na fixture é de
formatação do envelope. Receipts `browser-studio-heavy-witness.json`,
`browser-studio-heavy-after.json` e `browser-studio-heavy-roundtrip.json`.

## Concorrência controlada no backend

61 GETs somente leitura, uma onda por nível, mesma conta de teste e a mesma
primeira página de 500 chamadas. Todos HTTP 200, fingerprints iguais, sem
timeout/5xx; 9.264.314 bytes no total.

| Solicitações simultâneas | Mediana por solicitação | Máximo | Duração da onda |
| --- | --- | --- | --- |
| 1 | 450 ms | 450 ms | 452 ms |
| 4 | 208 ms | 216 ms | 221 ms |
| 8 | 214 ms | 245 ms | 253 ms |
| 16 | 220 ms | 300 ms | 311 ms |
| 32 | 343 ms | 542 ms | 560 ms |

A primeira chamada inclui aquecimento. Isso mostra o comportamento dessas
requisições locais; **não equivale a 32 usuários, 5.000 usuários simultâneos ou
capacidade máxima do produto**. Não se alcançou um ponto de falha nesse recorte.

## Validação e reprodução

- Atletas/aniversários/financeiro, cursor de chamadas e organização de inbox:
  cinco suítes/62 testes aprovados; export queries e identidade/offline:
  duas suítes/17 testes aprovados na primeira fase. O cursor por nome/ID teve
  três suítes/49 testes e releitura focada de 31 casos de aniversários; incluem
  cap menor, empate/aspas/acentos, erro intermediário e mudança de contexto.
- Fotos: cinco suítes/32 testes inicialmente aprovados; revisão final acrescenta
  cancelamento das conexões antigas ao trocar de contexto. Duas suítes afetadas
  de API/hook, com 26 testes, foram revalidadas após esse ajuste.
- Relatórios: duas suítes/23 testes inicialmente aprovados; os dois casos
  alterados de organização explícita/await foram revalidados depois.
- Biblioteca: três suítes/23 testes. Banco de planos/calendário: três suítes/23
  testes na primeira fase; a rodada posterior de resumo/seleção e guardas teve
  29 casos focados. O helper de timestamp teve 19 testes de banco, incluindo
  15.700 registros, empate, cap 137 e transição de microssegundos. São recortes
  sobrepostos; não somar como total único.
- Autorização de deep link: 15 testes da fronteira de permissão. Índices e RPC:
  selftests PGlite e Auth/HTTP/RLS locais descritos acima, incluindo os 14 checks
  da RPC otimizada. O negativo global de chamadas permanece falho por timeout.
- `npm run typecheck:app`, lint dos recortes, `check:org-scope`, perf-hygiene
  strict (21 telas no fechamento), arquitetura strict (1.252 módulos/4.833 imports, zero
  violações), marca, encoding e `git diff --check` aprovados. O checklist manteve
  29 módulos/374 itens/121 rotas, IDs/títulos/status, alinhamento Engineer e os
  scripts/contratos de revisão pessoal; onze Markdowns têm 358 links locais válidos
  no fechamento.
- Os exports `web-final`, `web-navigation` e `web-complete` terminaram com sucesso e fontes de
  entrada/final idênticas em cada build, quatro HTMLs auditados e três scripts
  iniciais válidos por HTML. API loopback incorporada, zero origem Supabase
  hospedada, uploads Sentry desativados e nenhum dataset privado na saída.
  O mais recente, `web-complete`, tem 9.523.441 bytes de JS inicial /
  2.551.685 gzip. O `web-navigation` tem 9.519.498 / 2.554.388,
  37 bytes de JS a mais que o artefato cronometrado `web-final`.
  Esses tamanhos não são métricas de navegação. O `web-after` anterior, com
  9.516.210 / 2.549.360 gzip, fica registrado como fase intermediária.
- O build ficou pausado junto da máquina/conexão por horas; seus timestamps não
  são métrica de desempenho. A prévia `localhost:8082` serviu os exports locais
  nas fases identificadas. Houve smoke autenticado de navegação/exportação e
  aplicação descrito acima, com pendências explícitas de mídia/produção.
  Sem `build:verified`, release ou publicação nesta rodada.

Evidências privadas principais: `browser-before.json`,
`heavy-fixture-manifest.json`, `heavy-attendance-pages.json`,
`heavy-attendance-keyset.json`, `heavy-attendance-index-comparison.json`,
`heavy-attendance-reader.json`, `heavy-attendance-reader-annotation-erasure.json`
e `heavy-attendance-concurrency.json`, sob `.tmp/performance-20261024/`.
As fases novas usam `browser-iab-before.json`, `browser-iab-after-initial.json`,
`browser-iab-final.json`, `student-name-readers-comparison.json`,
`students-index-before.json`, `students-index-after.json`,
`training-sort-keyset-after.json`, `training-bucket-cursor.json`,
`activity-review-context-optimized-real.json`, `browser-cycles-witness.json`,
`browser-library-witness.json`, `browser-reports-witness.json`,
`browser-calendar-apply-witness.json`, `browser-xlsx-validation.json`,
`browser-report-month-comparison.json`, `browser-court-witness.json`,
`browser-inbox-witness.json` e os receipts de estúdio descritos acima.
O A/B final usa `final-build-result.json` / `web-final-initial-js.json`; o smoke
da fase seguinte usa `navigation-build-result.json` / `web-navigation-initial-js.json`.
O fechamento de relatório/estúdio usa `complete-build-result.json` /
`web-complete-initial-js.json`, com a mesma fonte do build auditado.
`after-build-result.json` / `web-after-initial-js.json` são a fase intermediária.
O receipt do leitor é explicitamente parcial: positivos recuperados da saída
sanitizada da execução real e caso global estrangeiro falho. Não é gate de release.

Os testes versionáveis ficam em `src/db/__tests__`, `src/api/__tests__`,
`src/hooks/__tests__`, `src/screens/students/__tests__` e
`src/screens/training/__tests__` e `src/auth/__tests__`. O verificador XLSX usa o
Python/openpyxl fornecido pelo runtime oficial, sem instalação adicional ou
gravação no download. Fixtures, snapshots autenticados, screenshots e segredos
permanecem ignorados. A tarefa não certifica produção nem fluidez global.
