# Listas e memória — validação local de 25/10/2026

Continuação do [teste global de 24/10](performance-global-startup-round2-local-2026-10-24.md).
Tudo permanece local no worktree `22d9`: sem Android, commit, push, PR, deploy
ou migration remota. A revisão cobre dados sintéticos, não capacidade de usuários
simultâneos nem desempenho em produção.

## Ambiente e método

- Supabase exclusivo `goatleta-perf-22d9`, API `127.0.0.1:54421`, DB `54422`.
  Banco compartilhado `54321` e servidor `8081` de outro checkout preservados.
  Export estático servido somente em `localhost:8082`.
- Fixture: 100 turmas, 5.000 atletas com fotos/saúde fictícias, 60.000 presenças,
  15.701 planos, 100 ciclos/5.200 semanas, 1.200 relatos, 300 eventos e 1.000
  notificações. Autorização continua nas APIs/RPCs/RLS canônicas.
- Baseline imutável: build8, entry `6639ed87e72459c90aa106ad103a3985`, fingerprint
  `be4d47b2530efc606c218e06e1d8b689f1a07dc2c2e6d0597d786cb1191870cf`.
  A paginação de 1.000 do diretório, descartada na rodada anterior, não foi retomada.
- Build final: entry `d8f16dc26c61595ec692eea0f5f0d79a`, fingerprint
  `83facdea180d836a663618429e0361c347f58640b830ed5d9f51e34e6f3c5f92`.
  O fingerprint atual foi conferido após o teste e coincide com o export.
  Três scripts iniciais: 8.609.752 bytes, gzip 2.304.004; aproximadamente +0,1%
  frente ao build8. Nenhum Supabase hospedado ou arquivo de fixture no export.
- IAB autenticado, 1440×900, DPR1, cache HTTP desabilitado nas séries de navegação.
  Startup significa documento novo com sessão persistida; não processo frio do
  navegador. Sem build, testes ou benchmark HTTP concorrentes às medições.
- Cada amostra percorre Início → Atletas → página2/foto9 → RA05000 → perfil →
  editar/saúde/cancelar → voltar/limpar → Turmas no mesmo documento. O coletor
  verifica entry, timeOrigin e ausência de truncamento dos recursos.

## Diagnóstico e alterações

O diretório carregava a ficha completa de todos os 5.000 atletas, embora as linhas
e filtros não usem saúde/documentos/dados esportivos. A projeção medida de 16
colunas passou de 8.338.777 para 3.243.875 bytes de JSON decodificado (−61,10%).
A projeção de cinco colunas para avatares/turmas tem 1.714.982 bytes (−79,43%).
Essa comparação isolada de payload não mede latência ou heap do navegador.

- `StudentDirectoryRecord` e `ClassStudentRecord` têm tipos neutros no core,
  leitores/cache separados e paginação integral de 500. Busca por RA, telefone,
  responsável e turma continua global. Exportação e outros leitores FULL mantidos.
- **Decisão do usuário:** ficha completa ao abrir. Não montar formulário com DTO
  parcial. Ficha já sincronizada permanece offline; primeira abertura exige rede,
  salvo cache FULL legado. Cache por ID evita regravar todas as fichas visitadas;
  tombstones serializados bloqueiam somente a ficha alterada do legado. Finanças
  nunca são persistidas no cache geral. Falha de persistência não garante offline.
- Read caches web usam IndexedDB, já usado pelo estúdio, com commit de transação.
  Leitura legada AsyncStorage preservada sem migração na leitura; novas gravações
  não competem pela quota de localStorage. Auth, preferências, fila de escrita e
  implementação nativa permanecem separadas.
- Salvar relê a ficha completa canônica antes de fechar; falha após a escrita é
  explícita e exige nova leitura. Seleção, foco, sessão, geração e workspace
  descartam respostas antigas, inclusive callback de Turmas iniciado depois da troca.
- Consulta financeira sai de 50 GETs concorrentes para RPC escalar com até 5.000
  IDs por lote. `SECURITY INVOKER`, execução autenticada e RLS/grants de tabela
  preservados; só ausência exata da assinatura permite transporte legado. Troca
  de identidade não é convertida em sucesso parcial. Migration aditiva aplicada
  apenas no banco isolado, SHA `d48e4b231ec6813ec812487fc7f545d6b4a82c99a31dd3453d180e80e94cb5a3`.
  Nos três pares HTTP reais, GETs 704,911/132,111/109,100 ms e
  RPC 308,029/233,634/208,501 ms: mediana 132,111→233,634 ms (+76,85%).
  Reduz concorrência 50→1, mas não demonstrou ganho isolado de latência.
  Resposta 369.900→375.000 B; corpo de entrada RPC 185.069 B. Não alegar redução
  de bytes de rede dessa troca. As seis respostas têm 5.000 estados e SHA igual.
- Os planos SQL já usavam índices existentes: página500 de atletas ~75–77ms e
  lote financeiro100 ~3,7ms no diagnóstico. Nenhum índice/política novo foi criado
  para este gargalo; payload, transporte e trabalho do cliente eram os alvos.
- `getSignals` usa a projeção mínima dos atletas, preservando regras/severidades.
  URLs de fotos têm limpeza de expirados e LRU512, sem estender TTL50min por hit.
- Estúdio oculto suspende bootstrap/retry/autosave, preserva rascunho/histórico e
  confirma recibos de POST já enviado. Posições normalizadas idênticas passam a
  compartilhar array/pontos congelados no Undo, sem alias mutável.
- Serializer de vídeo deixa de serializar o histórico inteiro repetidamente
  enquanto remove passos. Preserva documento, sync, formato, maior sufixo contíguo,
  limite de 20 passos e orçamento de 1.500.000 caracteres UTF16; documento atual nunca é truncado.

## Provas de vídeo isoladas

Dez anotações com tracking inalterado antes mantinham 11 arrays/495.000 objetos
de posição para 45.000 pontos. Agora há um array/45.000 objetos compartilhados,
imutáveis, com Undo/Redo e documentos alterados preservados. É prova de identidade
alcançável, não medição de heap, GC ou FPS. O soak anterior sem edições não exercitou
essa amplificação; não foi atribuída a ela toda a oscilação anterior.

No serializer compilado real, três pares alternados de 45.000 posições/dez edições:
antes 4.541,9/5.311,4/5.216,2 ms; depois 42,34/48,41/47,86 ms. Mediana
5.216,24→47,86 ms. O JSON de 2.151.546 caracteres é idêntico nos seis resultados,
com relógio fixo e mesmo SHA. Ganho restrito à operação CPU isolada; não promete
latência de edição do app ou redução equivalente da memória.

## Série de navegação e teste prolongado

Primeira série sequencial: três documentos antes, depois três documentos novos
do build final. Nenhuma amostra lenta foi excluída. Startup vai do início da
navegação do documento ao primeiro painel. Nas listas, o tempo em ms vai do clique
real até dois frames com o marcador DOM visível; espera da automação antes do
clique fica fora da métrica. Esses marcadores não são INP nem carregamento de
toda a tela em segundo plano.

| Medida | Amostras antes | Amostras depois | Medianas antes → depois |
| --- | --- | --- | ---: |
| Início/documento | 3.259,3 / 924,8 / 1.199,9 | 3.794,7 / 3.302,6 / 1.277,2 | 1.199,9 → 3.302,6 |
| Atletas | 4.309,1 / 3.270,5 / 2.613,5 | 4.956,3 / 3.966,1 / 2.718,9 | 3.270,5 → 3.966,1 |
| Turmas | 3.780,3 / 2.219,7 / 2.319,8 | 3.991,9 / 3.124,6 / 2.590,6 | 2.319,8 → 3.124,6 |

Mediana da soma Atletas+Turmas por documento: 5.490,2→7.090,7 ms (+29,15%).
É a mediana das somas, não a soma de duas medianas. A série não demonstrou ganho.
Recursos concluídos até o marcador final: antes 34 students/50 GETs financeiros,
depois 24 students/zero GET financeiro/duas RPCs financeiras, incluindo perfil;
uma attendance em cada documento e buffers completos. Não são oráculos de bytes.

Série adicional alternada, cronológica e não randomizada, para aferir a variação:

| Par | Atletas antes → depois | Turmas antes → depois | Soma antes → depois |
| --- | ---: | ---: | ---: |
| 1 | 3.070,7 → 3.118,0 | 2.750,2 → 2.880,6 | 5.820,9 → 5.998,6 |
| 2 | 3.414,4 → 2.651,7 | 3.213,2 → 2.450,2 | 6.627,6 → 5.101,9 |
| 3 | 2.716,4 → 2.448,3 | 1.936,0 → 2.483,8 | 4.652,4 → 4.932,1 |
| Mediana | 3.070,7 → 2.651,7 | 2.750,2 → 2.483,8 | 5.820,9 → 5.101,9 |

Medianas de Atletas −13,65%, Turmas −9,69%, soma −12,35%; porém a soma piorou
em dois dos três pares. Início: antes 1.250,2/2.116,7/1.212,9 ms, depois
3.034,5/1.387,7/1.185,3 ms; medianas 1.250,2→1.387,7 ms (+11%). Recursos
students 23→24 nessa série, finanças 50 GETs→duas RPCs, attendance uma em ambos.
Não fundir suas contagens com as da primeira série. Entry, timeOrigins, buffers
e zero erros conferidos em todas as amostras válidas. Uma tentativa abriu o
atleta 00014 por índice AX obsoleto na paginação: preservada integralmente como
inválida/incompleta, sem latência final. Os seis documentos válidos usam o mesmo
localizador semântico de página2 nas duas versões.

**Conclusão de navegação:** a projeção menor e o menor número de requisições
estão comprovados; o ganho de latência das telas não é uniforme. Startup continua
variável. As listas ainda levam segundos nessa carga; não alegar fluidez instantânea.

O teste prolongado final durou **29,98 minutos no mesmo documento**, com seis
circuitos completos e 39 reproduções (três no aquecimento, seis por circuito).
Aquecimento incluiu marcação real no vídeo, Undo→Redo→Undo, retorno a 16 rallies/
1.000 contatos/45.000 posições e sincronização local. Cada circuito percorreu
fotos/página2, RA05000, perfil/saúde/cancelar, quadra/reprodução/saída com rascunho,
estúdio/anexo/replays/saída limpa, periodização/revisão/plano completo, calendário
mês seguinte/anterior/dia27/unidade02/turma/retorno, evento com campos carregados,
notificações e gestão global. Antes de cada âncora final foram observadas todas
as 61 páginas da projeção de presenças dos sinais e o retorno estável ao início.

Seis âncoras pós-circuito têm janela comparável de **18,058 minutos**, continuamente
visível, com 30 replays entre a primeira e a última. As três reproduções do
aquecimento e as seis do primeiro circuito ficam fora dessa janela menor.

| Ciclo | Heap Runtime (MB decimais) | performance.memory aproximado (MB) | Listeners |
| --- | ---: | ---: | ---: |
| 1 | 99,6 | 126,0 | 1.766 |
| 2 | 95,1 | 112,8 | 1.909 |
| 3 | 101,9 | 128,6 | 2.235 |
| 4 | 99,6 | 122,8 | 2.429 |
| 5 | 97,8 | 117,7 | 2.519 |
| 6 | 102,4 | 127,4 | 2.926 |

DOM total 1.746 e ariaHiddenRoots 272 em todos os seis pontos; zero vídeo conectado.
Documents/Frames 4/4 e isolate fixos. Performance Nodes variaram de 2.817 a 3.252,
embora o DOM do documento fosse igual. Zero erros globais e de controlador.
Vídeo: máximo cumulativo observado de um quadro descartado somente no player do
ciclo2; valores repetidos não foram somados. Há descartes em janela de replay e
observações entre seek/gaps; não é medição de FPS de jogo real ou total do sistema.

Heap Runtime final +2,8% frente ao primeiro ponto pós-circuito, com quedas no meio;
não reproduziu a alta de 93,7% registrada na rodada anterior. Isso não é A/B
controlado de RAM: o dia, documento, contadores e janela de navegação diferem.
O aquecimento de 56,95 MB não deve ser misturado à série pós-circuito de 95–102 MB.
**Pendência:** listeners cresceram 1.766→2.926 (+65,7%). A revisão estática de
menus, modais, calendário, perfil, classe, fotos e Studio encontrou cleanups
correspondentes, sem registro órfão comprovado. Contadores por fase também caíram
após reprodução/saída do plano, revelando alocações transitórias; não atribuir
todo crescimento a cache ou a um listener específico sem prova de retenção.

`Runtime.getHeapUsage` mede o isolate V8 inteiro, não só o contexto do app
([protocolo oficial](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/js_protocol.pdl)).
Heap direto e `performance.memory` aproximado são séries distintas. GC forçado e
retentores não estão disponíveis nesta superfície. Não inferir vazamento ou sua
ausência apenas de uma tendência de heap.

Controle de observação separado: 20 leituras AX sem ações do app em 25,097 s,
heap direto 53.255.996→49.840.336 B, Documents3/Frames3/Nodes5209/Listeners1626
inalterados. Não mostrou crescimento devido a essas leituras naquele controle;
não substitui o teste de navegação e não explica sozinho o heap anterior.

## Validação e artefatos

Nível3 da [escada](validation-ladder.md). Uma rodada consolidada de 13 suítes/150
testes cobre DTOs, cache por ID/tombstones/commit pendente, legado offline,
identidade, finanças, aniversário/export/matrícula, sinais, seleção, callback
antigo de Turmas e salvar. Quatro suítes/88 testes da etapa final de vídeo cobrem
serializer/limites/Unicode/Undo, IndexedDB e hooks real/legado. Há sobreposição
entre rodadas; as contagens não são somadas como total único do pacote.

Transporte financeiro: 37 testes Jest e 41 checks SQL isolados com sete atores
passaram. SQL real local após aplicação: 10 casos, owner/organização estrangeira/
sem sessão/anon/IDs mistos/duplicados/vazios e 5.000 estados equivalentes. A fixture
real contém somente dois membros administradores; staff/família/vínculo/inatividade
foram cobertos apenas no harness isolado, não alegados como smoke real.

`typecheck:app`, `check:org-scope`, arquitetura strict e perf-hygiene strict
(21 telas) aprovados. Lint focado, export e diff check aprovados. Auditoria do
soak: 18/18 invariantes atendidas, com as limitações acima. Fixture de saúde foi
alterada, salva, reaberta e restaurada pela UI antes do soak. Ficha sincronizada
05000 abriu completa offline com finanças indisponíveis; ficha ainda não baixada
04999 mostrou conexão necessária, sem editor parcial, e recuperou via retry online.
Viewport compacto de 390×844 teve scrollWidth390 no estado de erro; nenhum layout
novo foi criado. Instrumentação removida, rede/cache e viewport restaurados.
Encoding e marca pública aprovados. Geração do checklist preservou 29 módulos,
374 itens, 121 rotas, IDs/títulos/status e contratos de revisão pessoal; 448 links
locais conferidos. HEAD continua `187043ec`; índice Git vazio, sem publicação.

Artefatos privados ignorados em `.tmp/performance-20261025/`: baseline
`before-browser.json`, diagnóstico `student-financial-diagnostic-summary.json`,
SQL real `student-financial-rpc-real-sql-1792941356000.json`, provas de identidade
`video-history-identities-shared-frozen-45000.json` e comparação
`video-draft-serializer-comparison.json`. Credenciais/valores de saúde fictícia
não são publicados no relatório. Projeção isolada anterior permanece em
`.tmp/performance-20261024/student-directory-projections-1792938118470-69032.json`.
Comparação financeira real e controles:
`student-financial-rpc-real-http-n3-1792943721398.json`. Range0–999 conserva os
5.000 estados no JSON escalar; owner200, organização estrangeira200[], anon401;
três descartes de contexto foram exercitados no módulo real com fronteira RAM
adaptada após a RPC, não como troca de workspace no navegador.

Séries completas: `before-browser.json`, `after-browser.json`, `paired-browser.json`.
Auditorias finais: `directory-browser-audit-1792944556084-32016.json` (sequencial)
e `directory-browser-audit-1792944623967-71324.json` (alternada). Recibo final
`browser-heavy-soak.json` e auditoria `browser-heavy-soak-audit.json`, sem alteração
do recibo durante a auditoria. `development-navigation.json` guarda o smoke de
ficha/salvamento/offline, não é série de desempenho. `final-source-proof.json`
confirma o código/artefato; `probe-cleanup.json` registra a remoção das sondas.
Captura final carregada sem tooltip: `final-lista-validada.png`; capturas anteriores
de loading e lista pronta foram preservadas. Checklist e guias atualizados com as mesmas
distinções entre implementação local, evidência, pendência e ativação remota.
