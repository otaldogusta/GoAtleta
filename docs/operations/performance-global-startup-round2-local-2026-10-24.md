# Go Atleta — segunda rodada de consulta global e startup

Continuação local da [rodada anterior](performance-boot-soak-local-2026-10-24.md),
base `187043ec` com todas as alterações locais preservadas. Sem Android, commit,
push, deploy, banco remoto ou mudança de permissões. Mesmo Supabase isolado
`goatleta-perf-22d9` e massa fictícia de 100 turmas/5.000 atletas/60.000 presenças.

## Custos investigados

- A contagem global e o resumo mensal já estavam resolvidos. O leitor integral
  continua necessário aos sinais: o histórico anterior influencia faltas
  consecutivas e sua gravidade, por isso não se aplica corte arbitrário de dias.
- Gestão (`/coord/management`, título Coordenação) inicia sinais após o carregamento
  operacional; a primeira leitura pendente pode sobrepor outras leituras do
  diretório e novos pedidos de sinais. A tela inicial `/coord/dashboard` usa
  HomeAdmin/HomeProfessor e não executa `getSignals`; não atribuir essa carga ao
  seu startup. `/coordination` é uma entrada legada que redireciona para Gestão.
- O bundle inicial ainda alcança estúdio compartilhado de vídeo e bandeiras do
  perfil por imports estáticos, embora esses recursos não sejam usados no painel.

## Leitura integral: comparação Auth/PostgREST real

Seis chamadas sequenciais no cliente real, na ordem pareada 500/1.000,
1.000/500, 500/1.000, sem benchmark concorrente. A variante temporária muda apenas
o tamanho da página global sem intervalo; mantém cursor `(date,id)`, oito campos,
ordem, guardas, índice e RLS. Nenhuma gravação ou mudança de schema nessa medida.

| Página global | Mediana, três chamadas | GETs | Linhas |
| --- | --- | --- | --- |
| 500 | 8.529,8 ms | 121 | 60.000 |
| 1.000 | 5.220,8 ms | 61 | 60.000 |

Redução de 38,8% nessa série técnica aquecida. Todos os campos e a ordem
conferiram com o oráculo SQL nas seis respostas, SHA-256
`16d62034b9ec3cf6e55b513e72d82f6da696a53475624e87fa423f9b19fe4e8b`.
O payload continua próximo de 18,2 MB. Conta estrangeira recebeu vazio em uma
requisição; troca de identidade rejeitou a leitura inteira. Servidor com cap
inferior deve continuar até página vazia, preservando completude.

Evidência privada ignorada: `global-attendance-page-size-comparison.json` em
`.tmp/performance-20261024/`. São medidas do leitor completo com Auth/RLS, não
startup, latência de tela, p95 ou capacidade de usuários simultâneos.

## Leituras equivalentes e fronteiras de carregamento

`getStudents` compartilha somente tarefas base pendentes do mesmo contexto,
com dados financeiros sanitizados e cópias por consumidor. Hidratação financeira
é separada, exclusiva dos chamadores habilitados. A tarefa base é retirada ao
concluir; não se acrescenta TTL. Escritas canônicas invalidam a tarefa, com
retomada finita. Tokens diferentes não compartilham tarefas; alterações de
identidade/geração/workspace rejeitam resultados antigos.
O teste de diretório contém 5.000 atletas e cobre leitores mistos, falhas e corridas
de gravação/cache. As listas continuam usando o modelo completo necessário aos
filtros e à edição.

Sinais compartilham trabalho pendente por usuário/sessão/geração/organização e
instante explícito de análise. O cache existente de 60 segundos conserva esse
escopo, expira por relógio real e não armazena falhas. O diretório usado pelos
sinais dispensa hidratação financeira.

O estúdio compartilhado web passa a carregar após autorização, com descarte de
conclusões após perda de acesso e nova tentativa do chunk no estado de erro
existente. Bandeiras web são decorativas e carregam na montagem; falha não impede
país/DDI. No navegador, uma tentativa offline falhou e a remontagem online
carregou o mesmo chunk com status 200. O seletor final foi comparado visualmente
à referência. Nenhum campo pessoal foi salvo; renderer nativo preservado.

## Startup: redução de bytes e comparação no navegador

O export imutável `web-soak-final7` foi gerado com fontes locais, sem upload e com
fingerprint das fontes idêntico antes e depois da compilação:
`886724b0fd8a8416c1ebd178b6f50cf35b9137f24099452cce07a4b43a556922`.
Incluindo entry/common/runtime, os scripts iniciais passaram de 9.150.781 para
8.600.589 bytes: menos 550.192 bytes (6,01%). Gzip padrão: 2.438.879 para
2.301.533 bytes, menos 137.346 (5,63%). Os módulos de bandeiras/estúdio foram
localizados nos chunks assíncronos e sua ausência no pacote inicial foi conferida.
Isso comprova redução de carga inicial, sem provar redução do tempo de startup.

Seis sequências contínuas alternadas, três por variante, abriram documento novo,
Atletas e Turmas no IAB, em 1440×900/DPR 1, com cache HTTP desabilitado e sessão
persistida. Entry e timeOrigin foram conferidos por documento. Nenhum build,
teste ou benchmark HTTP executou em paralelo; nenhuma observação desta série
foi removida por ser lenta.

| Mediana, três documentos por variante | final6 | final7 |
| --- | --- | --- |
| Primeiro painel visível | 1.099,2 ms | 1.387,6 ms |
| Primeira navegação para Atletas | 2.244,5 ms | 2.622,2 ms |
| Primeira navegação para Turmas | 2.389,6 ms | 2.313,4 ms |

Não houve ganho consistente de latência nesta série. Os extremos foram
807,6–1.999,5 ms para o painel antigo e 1.058,2–1.785,9 ms para o novo; diferenças
de requisições e ambiente não estabelecem causalidade de CPU. Cada sequência
teve 23 GETs de atletas, 50 financeiros e zero leituras globais de presença:
Gestão é um fluxo separado. Sem timeout ou erro nessa comparação.

Este é um documento frio com sessão persistida em processo de navegador já
existente; não mede processo/V8 frio, p95, INP oficial ou produção. As durações
do controlador incluem automação e não são latências do produto.

Evidência ignorada: `round2-browser-continuous-ab.json`, resumo independente
`round2-browser-comparison-summary.json` e `round2-initial-js-comparison.json`.
Uma tentativa anterior do coletor capturou bindings antigos e foi excluída
inteiramente, com motivo em `round2-browser-ab-excluded.json`. A série anterior
por etapas tem intervalos de automação não controlados e permanece exploratória,
incluindo observações lentas do candidato; não substitui as seis sequências contínuas.

## Projeção dos sinais e ambiente de Gestão

O leitor de sinais usa DTO explícito de cinco campos: ID, aluno, data, status e
criação. Não transfere turma, nota ou dor, que o algoritmo não usa; a turma vem do
cadastro do aluno. O mesmo pager privado preserva cursor, orçamento, contexto e
falha integral. `getAttendanceAll` mantém oito campos e suas opções; as projeções
de exportação permanecem inalteradas. Testes comparam sinais de entradas completas
e mínimas, inclusive histórico anterior a 42 dias e desempate por `createdAt` no
mesmo dia. Três suítes/70 testes, lint e revisão independente passaram.

Um par HTTP real dos leitores atuais, ambos com páginas de 1.000, confirmou os
60.000 registros e a ordem dos cinco campos contra SQL e contra a projeção do
leitor completo, SHA-256
`29970d9572db789af7f017926ea6bfa73e32308169fd5c79cf2b10c6d38ec1ef`.
Corpos JSON UTF-8 decodificados passaram de 18.224.882 para 11.684.882 bytes:
menos 6.540.000 bytes (35,89%), incluindo a página vazia final. Ambos fizeram
61 GETs. Não são bytes de rede comprimidos ou de cabeçalhos. Os tempos de um
único par em ordem fixa são descritivos, sem inferência causal de latência.
Conta estrangeira recebeu HTTP 200 com vazio; mudança de identidade rejeitou
a leitura sem publicar parte dos registros.

Gestão inicialmente encontrou 503 no serviço de convites: faltava Edge Runtime
no projeto isolado e o Kong não resolvia seu nome. A dependência foi restaurada
com fontes canônicas, configuração e chaves exclusivamente desse backend local,
sem reiniciar banco/Auth/Kong, mudar schema/RLS, CORS ou o código do app. Dono
recebeu 200, conta estrangeira 403 e anônimo 401; preflight de `localhost:8082`
passou. Nenhum segredo foi impresso. Recibos ignorados:
`own-edge-runtime-validation.json` e `signal-projection-1792893926399-62828.json`.

## Versão 8: comparação final após a projeção

O export `web-soak-final8` manteve o fingerprint das fontes antes/depois:
`be4d47b2530efc606c218e06e1d8b689f1a07dc2c2e6d0597d786cb1191870cf`.
Entry `entry-6639ed87e72459c90aa106ad103a3985.js`. Scripts iniciais completos:
8.601.026 bytes, menos 549.755 (6,01%) que final6; gzip padrão 2.301.678 bytes,
menos 137.201 (5,63%). Quatro HTMLs e todos os hashes conferiram; bandeiras/estúdio
continuam em chunks separados, sem origem Supabase hospedada no JavaScript exportado.

Nova série alternada e contínua, três documentos por variante, com o mesmo
protocolo e sem carga concorrente ou exclusão de observações lentas:

| Mediana, três documentos por variante | final6 | final8 |
| --- | --- | --- |
| Primeiro painel | 998,3 ms | 936,0 ms |
| Primeira navegação para Atletas | 2.290,8 ms | 2.700,5 ms |
| Primeira navegação para Turmas | 3.373,5 ms | 2.369,2 ms |

O painel melhorou 6,24% nessa série e Turmas 29,77%; Atletas piorou 17,88%.
Os intervalos e a evidência contrária da etapa final7 permanecem registrados:
não há demonstração de ganho uniforme nem promessa de startup fixo. Fetch do
entry: 345,3 → 321,8 ms; long tasks no startup: mediana de uma nas duas versões,
90 → 92 ms. Todos os documentos registraram 23 recursos de atletas, 50 financeiros
e zero presenças globais. Sem erros/timeouts. Fonte e auditoria independente:
`round2-final8-browser-continuous-ab.json`, `round2-final8-browser-summary.json`,
`round2-final8-initial-js-comparison.json`.

## Teste prolongado da versão 8

Observação encerrada após 28,265 minutos no mesmo documento, incluindo aquecimento.
Cinco circuitos passaram por diretório completo, paginação/foto, RA do atleta
05000, edição/saúde fictícia e cancelamento, turma/quadra/rascunho local, estúdio,
revisão das 52 semanas e plano completo, agenda mensal/dia/unidade/aula, evento e
inbox. Nenhuma ação de salvar perfil, evento, plano, ciclo ou análise foi acionada.
O vídeo sintético de 5,055 s foi reproduzido 33 vezes; o documento de scouting
contém 16 rallies, 1.000 contatos e 45.000 posições. Não comprova FPS do app,
detecção de voleibol ou desempenho de um vídeo longo.

Gestão concluiu 61 páginas de cinco campos no aquecimento e em cada circuito:
seis leituras integrais, todas as respostas observadas 200. Um polling de 14 s
retornou ainda pendente no primeiro circuito, foi preservado e depois confirmado
completo; não é timeout do produto. O ponto antes dessa confirmação fica
separado dos cinco pontos pós-circuito com leitura integral confirmada.

Os cinco pontos pós-circuito mantiveram 2.972 elementos, as mesmas duas telas
retidas (turma e planejamento), nenhum vídeo conectado e nenhum bloqueio de foco.
A âncora anterior de aquecimento tinha 2.836 elementos; não se afirma contagem
idêntica desde a primeira abertura. A janela dos cinco pontos comparáveis durou
16,804 minutos. Heap direto de `Runtime.getHeapUsage` passou de 66.620.784 para
129.044.172 bytes (+93,70%), com quedas intermediárias. A aproximação de
`performance.memory` é separada: 82.784.227 → 150.129.301 bytes. Não há prova de
ausência de vazamento nem diagnóstico de retenção que confirme um vazamento.
Não chamar memória de estável. Uma observação posterior, fora do soak, encontrou
79.746.268 bytes antes da tentativa de coleta diagnóstica; o navegador recusou
`HeapProfiler.collectGarbage` como método não suportado, portanto nenhum GC
forçado foi executado. Não se substituem os snapshots do teste por esse dado.
Zero erros globais de execução. Um erro de automação
no aquecimento usou nome de inbox sem o sufixo de não lidas; também foi registrada
uma espera por heading incorreto ao abrir gerenciamento da periodização. Ambos
foram inspecionados/corrigidos e permanecem no recibo, sem atribuição ao app.

As passagens lentas foram mantidas: Atletas chegou a 13,2 s e Turmas a 13,7 s.
Resource Timing mostrou páginas seriais de 500 cadastros com respostas de
aproximadamente 0,65–1,1 s nessa fase. Isso motivou um experimento posterior
separado; não foi executado em paralelo ao soak.
Recibo: `round2-final8-browser-soak.json`; auditoria independente
`round2-final8-soak-summary.json`; diagnóstico separado
`round2-final8-post-soak-gc-diagnostic.json`.

## Experimento de paginação descartado

O experimento isolado da base de atletas comparou páginas 500/1.000 em três pares
alternados, conferindo todos os campos/ordem dos 5.000 registros com SQL.
GETs: 11 → 6; corpo JSON permanece em aproximadamente 8,34 MB. Medianas:
5.403,3 → 5.183,6 ms, com grande dispersão e um par desfavorável a 1.000.
Não demonstra ganho consistente de latência percebida. Cap 137, página vazia,
identidade/organização/geração e conta estrangeira passaram. Evidência:
`student-directory-page-size-1792895899676-52472.json`.
Um candidato de três linhas (`web-soak-final9`) pediu 1.000 somente na base de
`getStudents`, preservando aniversários/exportações em 500 e financeiro em lotes
de 100. Passou em 61 testes e revisão independente. Em seguida, seis cenários
contínuos alternados abriram Atletas, foto/página 2, RA 05000, ficha/saúde,
editor/cancelar/voltar/limpar filtros e Turmas. Mesmo protocolo de documento novo,
cache HTTP desabilitado, sessão persistida, entry/timeOrigin conferidos e nenhuma
carga concorrente. Nenhuma observação lenta foi excluída.

| Mediana, três documentos por variante | final8 | candidato9 |
| --- | --- | --- |
| Atletas | 9.996,6 ms | 5.442,7 ms |
| Turmas após ficha/cancelamento | 4.322,6 ms | 10.193,8 ms |
| Soma das duas navegações por documento | 14.516,4 ms | 15.825,8 ms |

Essa última linha é a mediana das somas de cada documento, não a soma das
medianas nem o tempo total de automação. Recursos de atletas caíram de 23 para
13; permaneceram 50 financeiros e uma leitura de presença ligada à ficha.
As séries anteriores sem ficha tinham zero presenças. Sem erros/timeouts ou
ações de salvar nos seis cenários. Medianas locais com dispersão alta não
estabelecem causalidade, mas a piora de Turmas e da soma motivou descartar o
candidato. Preservados `round2-directory-browser-ab.json` e sua auditoria
`round2-directory-browser-summary.json`.

Somente as três linhas e os deltas de fixtures desse candidato foram revertidos.
Os 61 testes, lint e diff check passaram novamente. O diretório final mantém
páginas de 500; coalescência, DTO de sinais e demais melhorias permanecem.
`round2-final-source-integrity.json` confirmou que todo o fingerprint das fontes,
configuração e patch/arquivos do SDK voltou exatamente ao build8:
`be4d47b2530efc606c218e06e1d8b689f1a07dc2c2e6d0597d786cb1191870cf`.
Hashes dos três scripts também conferiram. Assim, o soak de 28 minutos corresponde
à implementação final, sem recompilar nem transferir métricas do candidato descartado.

## Validação e limites finais

Nível 3 local: testes focados de dados, contexto, importação e repetição de chunks;
tipos do app, org-scope, arquitetura estrita (1.255 módulos/4.854 imports/zero
violações), performance estrita de 21 telas, guard do patch do SDK, build local,
comparações autenticadas e teste prolongado. Typecheck/org-scope passaram também
na montagem do candidato; após a reversão, os 61 testes e lint passaram novamente.
O fingerprint final permite reutilizar os gates do mesmo código8. Não foi
executado gate de publicação nem `build:verified`.

Os ganhos mais fortes desta rodada são a redução de viagens da consulta global
e de seu payload, a coalescência escopada e os bytes adiados do startup. As listas
com 5.000 cadastros ainda transferem cerca de 8,34 MB na base e 50 leituras
financeiras no cenário completo; continuam variáveis e chegaram a 13,7 s no soak.
Memória exige investigação de retenção adicional antes de qualquer afirmação
de estabilidade de longo prazo. Não há teste de múltiplos usuários, limite máximo
de capacidade, processo frio do browser, Android ou confirmação de produção.
Tudo permanece local, sem commit, push, deploy, alteração de banco remoto ou
permissões. HEAD continua `187043ec`; nenhum arquivo foi staged.

A prévia final foi restaurada em `http://localhost:8082/reports/trainer`, com
cache, rede e viewport normais, sem probes injetados. O entry carregado corresponde
ao build8; o relatório autenticado de outubro exibiu 48.125 presenças, 6.875 faltas,
55.000 registros e 100 turmas. Captura local `round2-final8-local-proof.png`.
Checklist regenerado: 29 módulos, 374 itens e 121 rotas; 441 links locais válidos,
IDs/títulos/status, alinhamento e contratos de revisão/importação/exportação preservados.
