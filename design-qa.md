# Go Atleta — preparação no padrão da bancada, 06/11/2026

Placar por equipe, quadra compartilhada em leitura, saque direto e opções
recolhidas, com ação no rodapé. O vazio de vídeo usa superfície temática e uma
única ação. QA real em 1535×884, 1024×768 e 390×844: sem overflow horizontal;
opções rolam dentro do painel; quadra móvel expande e recolhe. Registrar/Revisar
conferidos. A cascata de fundo preto do vazio no Registrar móvel foi corrigida
e a superfície #162033 medida e inspecionada. Dados permaneceram 0–0, sem set.

64 testes focados, tipos, lint e revisão React aprovados. Start_set foi testado
somente com mock; não acionado na análise real. Capturas inspecionadas em
`.tmp/work/scouting-initial-bench/desktop.png`, `notebook.png`,
`mobile-register.png` e `mobile-review.png`. Apenas local; aceite visual pendente.

---

# Go Atleta — controles compactos e foco discreto, 06/11/2026

Pedido subsequente: removidos contornos verdes do capítulo/trilho após clique.
Teclado mantém sublinhado neutro no capítulo e indicação no cursor. Face do
play de 32 px e ícones de 16 px seguem compactUiMetrics; alvo continua 44 px.
QA real em 1535×884 e 390×844, tema escuro; clique/play/pausa/Tab conferidos.
60 testes existentes e lint passaram. Captura final inspecionada:
`.tmp/work/scouting-inline-transport/compact-final.png`. Apenas local.

---

# Go Atleta — transporte inline, 06/11/2026

Composição anterior reaberta pelo usuário: controles ainda estavam acima da
barra. Corrigido na bancada: play, relógio e eixo lado a lado; controles
secundários à direita ou na segunda linha conforme container. Legendas abaixo,
com agrupamento/arrasto existentes preservados. QA local em tema claro:
1346×884, 1024×768 e 390×844, sem overflow horizontal. No celular os três centros
coincidem em y352,25. Lista/Miniaturas manteve exatamente vídeo e galeria no
desktop. Play/pausa e seek por teclado conferidos no original existente.
73 testes/3 suítes, tipos e lint aprovados. Evidência inspecionada:
`.tmp/work/scouting-inline-transport/desktop.png`, `notebook.png`, `mobile.png`.
Sem gravação ou ponto oficial novo; sem publicação. Aceite visual pendente.

---

# Go Atleta — galeria compacta, 06/11/2026

Microajuste local: painel desktop de 238,67 para 200 px; cards de 174,84 para
128 px, legenda 13/18 e metadados 12/16 com truncamento. Linhas vazias não
reservam gaps. No container estreito, painel de 248 px acomoda os filtros em
segunda linha. Ícone de baixar de 19 para 14 px, sem caixa; alvo de 44×44 mantido.
Conferidos 1535×884 e 1024×768: um rally não cria rolagem vertical na grade.
Alternar Lista/Miniaturas manteve player 1005,42×419 em x496,58/y90 no desktop.
11 testes existentes passaram. Captura inspecionada (1024×768):
`.tmp/work/scouting-reference-timeline/compact-gallery.png`. Apenas local.

---

# Go Atleta — cursor circular e contatos, 06/11/2026

Microajuste visual local: cursor de 14 px circular em vez do traço vertical;
contatos de 12 px com miolo verde, separação na cor do painel e aro verde,
realce em hover/foco. Eixo, altura e alvos de 44 px preservados. Conferência
real em 1535×884 e arrasto de 6.587 para 6.794 s aprovados, sem editar registros.
50 testes existentes da timeline passaram. Captura inspecionada:
`.tmp/work/scouting-reference-timeline/round-cursor.png`. Sem publicação.

---

# Go Atleta — timeline fiel à referência, 06/11/2026

final result: correção local conferida; aceite visual do usuário pendente

- Referência: `docs/ui/mockups/scouting-bench-2026-11-05.png`. A faixa separada
  de marcadores descrita no relatório abaixo foi substituída por um único eixo.
- Círculos de 12 px sobre a barra de 4 px, cursor branco vertical independente,
  contexto do rally/placar à esquerda e uma linha de legendas abaixo. Legendas
  que não cabem são omitidas; detalhes continuam em hover, foco e clique.
- Grupos mantêm todos os IDs/tempos, com aro discreto e quantidade no balão.
  Removidos contadores pintados, caret legado e contatos repetidos sob o player.
- Arrastar a partir de um marcador usa o scrub existente; clique continua a
  selecionar, sem abrir edição por engano após soltar o arrasto.
- Comparação em 1568×1003: círculos/barra no eixo y642, legendas em y670;
  referência no eixo aproximado y645. Captura final real em 1535×884: barra e
  círculos exatamente no eixo y540,328. Um rally/placar 1×0 preservados.
- Fixture isolada com 240 rallies/2.880 contatos em 1280×720; grupo de 12
  contatos acessível com seus 12 itens. Lista/Miniaturas manteve o player em
  828,56×224, x426,44/y93. No estúdio real: 1005,42×380,33, x496,58/y90,
  idêntico nas duas apresentações. Conferidos também 1024×768 e 390×844,
  sem overflow horizontal e alvos de 44×44. Rota temporária removida.
- Evidência inspecionada: `.tmp/work/scouting-reference-timeline/`, com
  `desktop.png`, `final-studio.png`, `dense-240.png`, `dense-contacts.png`,
  `dense-notebook.png` e `dense-mobile.png`.

84 testes/4 suítes, tipos e lint aprovados. Teste de volume é de apresentação;
não certifica mídia longa, captura física ou exportação. Sem publicação.

---

# Go Atleta — densidade de rallies, 06/11/2026

final result: teste isolado verificado; correções locais aplicadas

- Fixture em memória: 80/240 rallies e 960/2.880 contatos oficiais, além de
  regressões unitárias com contatos manuais e mistos. Componentes e estilos
  reais; sem mídia pessoal ou gravações oficiais. A rota temporária foi removida.
- Antes: oficiais individuais colidiam (0 px no macro e 0,375 px no micro em
  teste de 900 px). Depois: fluxo visual conjunto manual/oficial/ponto, distância
  de 44 px, alvos de 44×44 e lista com todos os IDs/tempos originais.
- Cursor e marcadores usam faixas separadas de altura constante. Conferidos
  clique, lista de 48 eventos, seek para 01:38.220, Enter/Esc e retorno do foco.
- O teste encontrou também prévia de oficial indisponível com ação habilitada.
  A prévia isolada e grupos agora preservam o bloqueio da janela disponível.
- Em 1346×884, 2.880 eventos ficaram em 18 grupos, sem colisão; contadores com
  respiro mínimo de 16,53 px. Em 390×844, sete grupos e respiro de 14,63 px.
- Oito trocas de visualização mantiveram dimensões/posição do player e galeria;
  confirmação final em 877,41×347,33, x443,59/y93, inclusive ao abrir o rally 240.
- Notebook 1024×768, clique real: player 566×216 em x423/y93 nas duas views.
  Detectado scrollIntoView da ferramenta centralizando o alvo e rolando 10 px;
  separado desse efeito, o clique de mouse manteve scrollTop=0 e o mesmo retângulo.
- Evidência inspecionada em `.tmp/work/scouting-density-qa/`: `240-rallies-final.png`,
  `240-rallies-notebook.png`, `240-rallies-mobile.png`, `measurements.json` e
  `original-preserved.png`. A análise real continua com um rally/1×0/original.

109 testes/3 suítes, tipos e lint aprovados. Diff check sem erro. Limites: teste
de volume visual com dados simulados, sem decodificação, thumbnails reais ou
exportação de uma partida longa. Harness arquivado no diretório privado, rota
removida; sem publicação nem alterações oficiais.

---

# Go Atleta — cabeçalho, timeline e galeria, 06/11/2026

final result: verificado localmente; aceite visual do usuário pendente

- Fonte: rótulos de câmera/encerramento herdavam Inter do HTML e uma regra
  genérica de 16 px, enquanto o coletor usava a família de `OperationalText`.
  Agora usam a mesma família e 14/20; Salvo usa 12/18. Cor temática conferida.
- Timeline: trilho contínuo de 4 px, cursor circular e marcadores CSS, com
  foco/labels/prévias e callbacks preservados. Conferidos seek pelo contato e
  avanço pelo teclado; teste de arrasto cobre progresso sem commit prematuro.
- A galeria tinha altura intrínseca: no caso reportado, alternar para Lista
  ampliava o estágio de 345,73 para 416 px. Reserva responsiva da galeria agora
  mantém exatamente o mesmo retângulo do estágio, painel e cabeçalho.
- Em 1346×884, estágio x443,59/y90, 877,41×334,33 e galeria 238,67 px de altura
  nas duas apresentações. Em 1024×768, estágio x423/y90, 576×193 e galeria
  264 px nas duas. Dados em `measurements.json` abaixo.
- Mobile 390×844: cabeçalho dentro da largura, família/tamanho conferidos;
  workspace e corpo sem overflow horizontal após isolar o alcance do slider.
- Evidência: `.tmp/work/scouting-controls-timeline-2026-11-06/desktop.png`,
  `notebook.png`, `mobile.png` e `measurements.json`. Capturas inspecionadas.
  Override de viewport removido; estúdio permanece aberto.

99 testes/3 suítes, tipos e lint passaram; diff check sem erro. Aviso de handle
de Jest da instrumentação já registrado anteriormente, saída 0. Esta correção
é local; não houve nova captura física, ponto oficial ou publicação. O cenário
real contém um rally; muitos rallies permanecem limite de validação visual.

---

# Go Atleta — correção de fidelidade, 06/11/2026

final result: verificado localmente; novo aceite visual do usuário pendente

A aprovação técnica de 05/11 abaixo não representou fidelidade suficiente ao
mockup aprovado: o usuário rejeitou a quadra estreita e a hierarquia tipográfica.
Essa conclusão visual foi reaberta, sem apagar o registro histórico.

- Referência: `docs/ui/mockups/scouting-bench-2026-11-05.png`, 1568×1003.
- Captura atual: `.tmp/work/scouting-bench-fidelity-2026-11-06/desktop.png`, nas
  mesmas dimensões. Fonte, captura anterior e nova captura foram inspecionadas.
- A quadra passou de um desenho quadrado de 194 px em região de 344 px para
  344,16×212,56 px, com perspectiva, rede e linha de ataque. Os seis alvos usam
  as mesmas seleções reais; a geometria decorativa não atribui atletas ou camisas.
- Hierarquia bench: título da tela 20 px; seções 16/22 e peso 700; controles e
  ações principais 14/20; placar 24/30; metadados 12/18. Tempo e legenda da
  timeline 13 px. A escala não foi aplicada globalmente a outros coletores.
- Notebook 1024×768: quadra 260×160,58 px; seis alvos 76,27×57,02 px, em 3×2;
  sem overflow horizontal. Cabeçalho compacto não repete a indicação de saque
  em uma coluna que a truncava. Input permanece acessível na rolagem interna.
- Celular 390×844: faixa de atletas recolhida e quadra expandida conferidas;
  rolagem alcançou integralmente os dois botões de ponto. Evidência em
  `mobile-expanded-actions.png`, na mesma pasta. Override de viewport removido.
- Dois pares de olhos conferiram a nova composição. Permanece a mídia real de
  teste, um rally e placar 1×0; não foram criados pontos nem formação para a foto.

Validação proporcional desta correção de apresentação: 41 testes nas suítes de
coletor e bancada; `typecheck:app`, ESLint dos seis arquivos de UI e diff check.
Sem build, publicação, mudança de captura, persistência, RPC ou autorização.
Tema claro, gravação física e muitos rallies não foram revalidados nesta rodada.

---

# Go Atleta — bancada de scouting, 05/11/2026 (histórico)

final result: passed

Escopo: aplicação local do mockup aprovado, composição responsiva e smoke com
o vídeo real de teste já salvo. Este resultado não altera a revisão histórica
de Acessos pendentes preservada abaixo, nem certifica uma nova captura física.

## Referência e evidência

- Fonte visual: `docs/ui/mockups/scouting-bench-2026-11-05.png`, 1568×1003 px.
- Implementação: Estúdio de uma turma de teste em `http://localhost:8081`.
- Captura: `.tmp/work/scouting-bench-implementation/desktop.jpg`, viewport/CSS
  1568×1003, imagem 1568×1003; sem zoom, escala ou redimensionamento da página.
- Fonte e captura foram abertas juntas no mesmo input de comparação.
- Detalhes inspecionados: `detail-collector.jpg` e `detail-timeline.jpg` na
  mesma pasta privada. Outras capturas: `notebook.jpg` (1024×768), `tablet.jpg`
  (834×1194), `mobile-registrar.jpg` e `mobile-revisar.jpg` (390×844).
- Dados: o mockup usa equipes, atletas e cinco rallies ilustrativos. O app usa a
  análise real de teste, um rally/placar 1×0, original de 43,39 s e nenhuma câmera
  conectada. Não foram fabricados vídeos, camisas, contatos ou formação para
  imitar esses dados. Captura ativa/PIP foram verificados por contratos automatizados.

## Comparação e correções

- Tipografia: família e escala operacionais canônicas; títulos, corpo e metadados
  mantêm hierarquia compacta, nomes têm limite visual e nome completo acessível.
- Espaçamento/layout: coluna de coleta ajustada à proporção do mockup, vídeo
  dominante, controles e rallies na mesma bancada. Grade por altura disponível
  evita que focar a miniatura role o badge REPLAY para fora da tela.
- Cores: navy, superfícies sólidas e verde funcional dos tokens; gravação e
  estados pendentes usam sinais semânticos distintos. Sem novas texturas ou sombras.
- Imagens/ícones: mídia e miniaturas reais preservadas; quadra interativa canônica
  em vista superior substitui a ilustração em perspectiva do mock. Logo e ícones
  existentes reutilizados. Nenhuma imagem gerada foi usada como vídeo do usuário.
- Texto: Registrar ao vivo, replay e encerramento têm papéis distintos. Fontes,
  ajuda, configurações e ferramentas aparecem sob demanda; códigos usam a rubrica
  atual e não confirmam placar automaticamente.

Iterações P1/P2 encerradas:

1. Miniaturas inicialmente caíam abaixo da dobra e focar um rally ocultava o badge.
   Corrigido com grade de altura disponível e regiões de transporte/galeria próprias;
   captura final mantém os três elementos visíveis.
2. No celular, prévia e mapa consumiam a coleta. Cabeçalho passou a duas linhas,
   prévia foi para baixo e mapa tornou-se faixa expansível com seis alvos. Ações
   e rascunho foram conferidos no navegador.
3. Mapa de notebook inicialmente quebrou em duas colunas ao reduzir altura/largura.
   Separadas as dimensões: 150×120, seis alvos em 3×2, medidos em 44,67×52 px;
   input e ações cabem sem cortar posições.
4. Marcadores da timeline ainda tinham caixas/flags. Em bench, agora usam círculos
   canônicos com foco/labels/popovers preservados; detalhe final inspecionado.
5. Troca de fonte a partir de Ferramentas podia esconder um diálogo ainda modal.
   Sheet agora fecha antes de delegar a troca. Smoke fez Outros vídeos → retorno
   à câmera, com zero diálogos abertos e contexto preservado.
6. Player coberto pela prévia ao vivo agora recebe `inert`/`aria-hidden`; galeria
   continua operável. Teste verifica retorno dos controles ao selecionar replay.

## Validação e limites

259 testes/15 suítes na rodada integrada; 112 testes/4 suítes repetidos após
polimento e correções de vídeo/workspace; tipos e guardrails aplicáveis passaram.
Jest teve aviso de timer do SDK de telemetria, saída 0; não equivale a uma falha
de mídia do navegador. A suíte de câmera passou isolada da telemetria, sem aviso.
Smoke autenticado conferiu código inválido, rascunho entre tarefas, expansão de
quadra, seleção local salva/reaberta/restaurada, filtros, replay, exportação real,
troca de fontes e foco de retorno da câmera. Nenhum novo ponto oficial foi criado.
Após reload limpo, original/rally/placar continuaram disponíveis e nenhum novo
erro de console foi observado. Erro transitório de componente no HMR anterior
foi resolvido, sem apagar logs históricos.

Sem P0/P1/P2 visuais abertos no escopo conferido. Não houve novo teste físico do
celular, tema claro, leitor de tela ou publicação. P3: calibrar a densidade com
uma partida longa e muitos rallies reais; a captura atual contém apenas um.

---

# Acessos pendentes — revisão local

final result: blocked

## Referências

- Mock aprovado na revisão local, guardado entre as evidências privadas.
- Implementação: http://localhost:8081/coord/management
- Captura: observação inline do navegador em 786 × 914; arquivo não exportado.
- Estado: tema escuro, acessos abertos, pedido antigo de equipe e convite pendente.

## Resultado parcial

Ações não são mais recolhíveis; removido Fechar. Recusar usa dangerSolidBg.
Linha de atleta mantém ações visíveis e aprovação bloqueada até conferir o cadastro.
Carregamento identifica consultar, aprovar ou recusar; proteção contra repetição preservada.

## Bloqueios

- P1: o pedido real ainda é staff, diferente do mock de atleta/responsável. Não converter sem identificar o vínculo correto.
- P1: responsável é um exemplo conceitual do mock, não um tipo suportado neste fluxo de solicitações. Precisa de definição e integração com autorização do vínculo familiar.
- Comparação normalizada lado a lado não concluída: estados diferentes. Não certificar fidelidade.
- Tipografia, cores e espaçamento: observação parcial; tokens existentes preservados. Assets/avatares do mock ainda não reproduzidos. Conteúdo difere pela classificação persistida.
- Mobile 390, tablet 834, desktop 1440 e tema claro ainda pendentes.

## Próximo passo

Confirmar o significado do pedido legado, ajustar a entrada pública e o vínculo familiar com regras explícitas, depois concluir comparação visual nos estados equivalentes. Nenhuma solicitação real aprovada ou recusada durante a revisão.

## Scouting — revisão local de 06/11/2026

Revisão de conexão, gravação, cópia, bancada e responsividade com screenshots
autenticados privados; contratos e pendências físicas no
[relatório](docs/ui/SCOUTING_REVISAO_UI_UX_2026-11-06.md).
