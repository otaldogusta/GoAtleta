# Quadra 2D e 3D — uma mesma jogada

Implementação web de 16/10/2026. O seletor troca somente a representação
no `CourtEditorWorkspace`. O documento, a seleção, a etapa, o playhead, a
biblioteca, o histórico e o salvamento continuam no controlador existente.
Não há navegação para a porta 8098 nem um segundo rascunho de jogada.

## Contrato

- `visual-court-perspective.ts` projeta as coordenadas regulamentares existentes:
  `worldX = (x - 0.5) * 9`, `worldZ = (y - 0.5) * 18`. Orientação e câmera não
  modificam o documento. Cores, rótulos, visibilidade e bloqueios são preservados.
- Etapas autorais sem simulação continuam usando `pointAlong` e
  `drawingAtProgress`. Etapas com `CourtVisualStep.simulation` usam o mesmo
  `sampleCourtSimulation` no SVG 2D e na projeção 3D, inclusive posição da bola,
  poses, saltos, tempos de contato e rebotes. Trocar a vista mantém a etapa,
  a reprodução e a posição da linha do tempo; não ativa nem recria uma formação.
- A configuração versionada por etapa referencia sete IDs de atores, o sexteto próprio estável e uma bola
  canônica. O sexteto permanece o mesmo ao alternar modos, inclusive com outro central no banco. As bases vêm de `actorPositions`; não existe outro array persistido
  de posições. Modos, rodízio, presets, alturas, alvos e orientação das mãos são
  comandos do mesmo histórico, rascunho e contrato de salvamento/importação.
- `court-simulation/` reutiliza os oito módulos puros do mockup construído nesta
  tarefa, com alteração apenas das extensões de importação. O motor calcula
  recepção e ataque, movimentos e saltos, mãos de até três bloqueadores,
  contatos sucessivos, rede/fita e rebote no piso. A duração da etapa acompanha
  o voo resolvido; arrastar o ponto de ataque não arrasta o bloqueio.
- Jogadores próprios mantêm seus IDs, rótulos, cores e funções autorais.
  Bloqueadores/sacador usam atores adversários existentes ou atores auxiliares
  canônicos da equipe B, adicionados na mesma transação. Modos filtram os
  participantes da demonstração sem converter companheiros em adversários.
- O renderizador em `public/visual-court-3d/` reaproveita a composição de quadra,
  rede, silhuetas e rig do mockup aprovado. Ele guarda apenas câmera e prévia de
  gesto; não tem formação, preset, histórico, sessão ou armazenamento próprios.
- O iframe é servido pela mesma origem do app. Recebe somente dados de desenho,
  sem usuário, organização, aluno ou credenciais. Comandos exigem origem, iframe,
  versão, token e revisão atuais, IDs locais e limites explícitos.
- Arrastar confirma um comando ao soltar; cancelamento ou revisão obsoleta não
  alteram dados. O mesmo `moveSelection` e o mesmo Undo/Redo atendem as duas vistas.
- Arraste de uma trajetória existente parte da posição exibida no instante atual,
  incluindo a bola. Autosave também substitui um rascunho antigo quando Undo
  retorna ao estado limpo e conserva a etapa selecionada.
- Uma animação desenhada explicitamente para um participante da simulação passa
  a ser autoral: conserva a cena amostrada e desativa a simulação daquela etapa.
  Duplicar/continuar uma etapa remapeia o ID da bola; remover uma referência ativa
  desativa a configuração, respeitando objetos bloqueados.

## Ferramentas e composição

O cabeçalho flutuante compacto conserva Voltar, nome/turma, Quadra 2D/3D,
Biblioteca, Salvar e opções. Abaixo ficam Recepção e Ataque; o painel lateral
abre/recolhe pela alça e usa os componentes e cores do Go Atleta. O transporte
inferior reúne reproduzir/pausar, reinício, busca temporal, velocidade e etapas;
na recepção, o controle ‹ P1 › volta e avança o rodízio circularmente na
sequência P1, P6, P5, P4, P3, P2, usando o mesmo histórico.

Recepção oferece sistemas 5–1/6–2, seis rodízios, saque flutuante/com rotação e
alvo esquerdo/direito. Ataque oferece os nove presets do mockup, camadas de
ataque/passe/bloqueio, um a três bloqueadores e ajuste conjunto ou individual
das mãos. Câmera frontal/lateral/livre e visibilidade são controles de
apresentação. As alças 3D editam alvo do saque, passe, levantamento, contato de
ataque e direção do ataque por comandos validados do documento compartilhado.
Ctrl+Z e Ctrl+Shift+Z usam o mesmo histórico das ferramentas existentes.
Compartilhar originalmente abria a exportação. Em 27/10, o cliente web passou a
abrir o diálogo de link com prévia de leitura e revogação; migration ativada em
27/10 com autorização. Publicação do cliente segue o fechamento de release.
[Contrato e validação local](QUADRA_COMPARTILHAMENTO_2026-10-27.md).
Biblioteca usa o fluxo existente; Exportar permanece no menu do documento.

## Validação

Nesta ampliação passaram 182 testes Jest focados em sete suítes e dez testes Node do
renderizador. A conferência das fontes foi corrigida após detectar arquivos de
referência ausentes no checkout do servidor; os 33 testes finais do motor passaram, incluindo o vínculo estável de C2/P2 entre modos. Uma comparação adicional verificou 264 amostras
contra os módulos `.mjs` originais do mockup, com igualdade exata das posições
da bola. Typecheck do app, org-scope, arquitetura strict e build passaram.
Esses checks não constituem benchmark de fluidez ou validação do motor de um
serviço externo.

Smoke autenticado no localhost nesta ampliação: seis atores e bola no SVG 2D
coincidiram com as coordenadas X/Z do quadro compartilhado. No ataque com três
bloqueadores, foram observados salto de 0,85 m e extensão de mãos igual a 1;
no instante 80%, salto do atacante de aproximadamente 0,692 m. A edição da alça
do contato deslocou o ataque sem deslocar o bloqueio; Undo/Redo foram
conferidos. A sessão ficou com um rascunho demonstrativo de ataque, sem salvar
no backend; recarregamentos de desenvolvimento reiniciaram parte do histórico.
Não há declaração de restauração integral das alterações dessa sessão.

A nova composição foi inspecionada no navegador em 1063×704, 390×844 e
834×1194, no tema escuro. Painel e transporte não se sobrepõem; nessa versão,
a velocidade usava uma segunda linha no celular (substituída pelo número
clicável descrito abaixo). O zoom foi separado do transporte no tablet.
Foram exercitados o arraste do saque (40 px à direita e 20 px para cima), próxima
rotação P1→P6, reprodução contínua ao trocar para 2D, sistema 6–2, visibilidade
dos rótulos, bloqueio duplo com 13° apenas no segundo jogador e troca de preset.
O console não registrou erros na conferência final. Evidências:
`quadra-integrada-ferramentas.jpg`, `quadra-integrada-controles-mobile.jpg` e
`quadra-integrada-controles-tablet.jpg` na pasta de visualizações desta tarefa.

Na validação local, o servidor Expo em uso atende pelo checkout `9184`. Somente os arquivos desta
integração foram espelhados a partir de `25c1`; alterações concorrentes de
scouting e DateInput foram preservadas. Os registros abaixo descrevem os
checks locais de cada ampliação; a publicação é tratada separadamente.

## Limites atuais

O motor integrado é o da demonstração desenvolvida e aprovada visualmente
nesta tarefa. Tempos e coeficientes de contato foram ajustados por observação;
não são constantes recuperadas do SetOptics nem uma certificação de igualdade
com seu motor. Não há simulação física de rotação/aerodinâmica da bola ou
deformação da rede. Defesa e formato de nove jogadores permanecem indisponíveis.
Animações autorais livres continuam com caminhos no piso; o motor de
saque/ataque/bloqueio aplica alturas e contatos às etapas que o habilitam.

A vista 3D atual é web; o editor nativo mantém sua vista existente. Exportação
de imagem/GIF/PDF continua usando a representação 2D do mesmo documento. Os
recursos visuais de referência conservam a proveniência em
`public/visual-court-3d/reference/sources.json`; Three conserva sua licença MIT.

## Refino de densidade — 16/10/2026

Comparação direta com o mockup no mesmo viewport de 1329 × 880: no desktop,
cabeçalho de 390 × 55 px com raio de 40 px, modos de 296 × 44 px,
segmentos com botões de 26 px, ações de 34 px e transporte de
440 × 40 px. Painel conserva 360 px de largura e raio de 24 px; todas as
linhas de ataque cabem sem rolagem em 1063 × 704. Hovers locais seguem os
raios circulares/ovais, sem feedback duplicado da primitive. Áreas de toque
ampliadas continuam disponíveis no layout móvel. Conferidos por medidas DOM
e screenshot; hover inativo inspecionado ao vivo com raio de 999 px.

O cabeçalho usa ícones para manter as ações nessa largura; nome editável e
turma ficam no menu de opções. Salvar, Biblioteca e retorno continuam
disponíveis. Fontes, pesos, ícones e intervalos do painel foram
ajustados às medidas da referência, conservando a tipografia do app. O
controle de velocidade media 95 px antes da troca pelo número clicável; o transporte conserva o rodízio entre
duas setas. Edição do nome, menu e recolhimento conferidos no app, com nove
testes focados de controles e typecheck aprovados.

### Correção de proporção aparente e nitidez

A comparação anterior igualava pixels CSS, mas deixava os controles maiores
na janela real de 1063 × 704. Os overlays agora acompanham a composição de
1329 × 880, com escala desktop entre 0,8 e 1. Nessa janela, o cabeçalho mede
312 × 44 px, o painel 288 × 480 px e o transporte 352 × 32 px. Offsets e
âncoras acompanham a escala; menus portados usam suas coordenadas físicas.
O canvas e as coordenadas de edição não são escalados. Mobile e nativo
conservam as áreas de toque existentes.

O framebuffer estava em 1063 × 704 mesmo com DPR 2. O renderer agora sincroniza
a densidade em resize, mudança de tela/zoom e no próximo quadro, com limite
2× e sem realocar quando as medidas permanecem iguais. Conferido no iframe:
2126 × 1408 para CSS 1063 × 704. Dois testes de regressão cobrem mudança de
DPR sem resize CSS, estabilidade e tamanhos fracionários. Menu e alça do
painel foram exercitados na janela normal, sem override de viewport.

Biblioteca, propriedades, configurações, ferramentas e exportação usam agora
a mesma caixa lateral dos controles: base de 360 × 600 px, raio de 24 px e
escala herdada (288 × 480 px em 1063 × 704). A animação de abertura é mantida.
Busca, abas, ações e linhas da Biblioteca têm densidade desktop compacta;
mobile conserva as dimensões anteriores. Busca sem resultado e retorno à
lista foram conferidos no app, sem abrir ou gravar outra jogada.

Menus de documento, etapa, seleção, cores e Biblioteca recebem a mesma escala
via `AnchoredDropdown.visualScale`; linhas desktop de 34 px e título de 14 px
evitam rolagem artificial. Em 1063 × 704, o menu de opções mede 176 × 208 px;
o da Biblioteca mede 150,4 × 68,8 px. Âncora, clique fora e limites usam pixels
físicos. O padrão 1 da primitive e o nativo conservam as dimensões anteriores.
Tooltips e menu de velocidade também acompanham a escala do workspace.

Os cartões de nova quadra e saída usam largura desktop de 360 px, escala
herdada e cantos de 24 px; backdrop continua cobrindo a tela. Modal de nova
quadra medido em 288 × 177,6 px, aberto e cancelado sem criar outra jogada.
Menu de opções sem overflow e menu da Biblioteca junto à borda conferidos
localmente; nenhuma ação de excluir, copiar link ou salvar foi executada. Seis
testes focados de ancoragem e a checagem de tipos passaram.

O recolhimento do cabeçalho foi removido do botão desktop e do menu mobile.
Ele permanece visível, com largura base de 354 px, sem estado de ocultar/reabrir.

O painel de controles abre e recolhe com fade e deslocamento de 24 px em
200 ms; a alça acompanha o movimento com o mesmo progresso. Desktop desliza
na horizontal e mobile na vertical, preservando a caixa e a escala existentes.
Fechamento mantém o conteúdo até o fim da transição, mas bloqueia interação e
foco web com `inert`; novos acionamentos invertem o movimento. Movimento
reduzido aplica o estado final imediatamente. Abertura, fechamento e reversão
foram amostrados no navegador em 1063 × 704; 12 testes focados e tipos passaram.

O workspace agora reúne Ajustes, Etapas e Biblioteca no mesmo painel, com a
mesma caixa de 360 × 600 px e animação. Camadas fica na lista de categorias dos
ajustes; Restaurar e Exportar ficam ao final. Os atalhos Biblioteca e Mostrar
etapas selecionam a aba correspondente, sem abrir uma segunda superfície.
Etapas usa uma galeria vertical de duas colunas, com miniatura, nome, duração,
seleção e reordenação; inclusão e menu de edição conservam os comandos existentes.
A antiga faixa flutuante de etapas foi removida, mantendo uma barra de reprodução.
Abas inativas permanecem montadas, mas ocultas e sem interação, preservando busca
e rolagem. Trocar abas não grava nem altera o documento. No smoke local, a cena
2D e o estado de salvar permaneceram iguais; avançar/voltar etapa restaurou a
cena original. As duas vistas, atalhos, recolhimento e encaixe em 390 × 844 foram
conferidos. 57 testes focados e tipos passaram; sem gravação remota ou publicação.

A troca do preset de ataque agora alinha a base inicial do atacante ao lado e à
profundidade do contato escolhido, conservando a aproximação da referência 4.
Antes, a base permanecia em (-3, 3) para todas as jogadas e o reinício em zero
fazia o atacante parecer parado no 2D. A correção usa `actorPositions` e
`baselineActorPositions` compartilhados, no mesmo comando de preset; não cria
estado visual separado nem altera o motor de voo. Jogadores, bola e demais
etapas mantêm identidade. Ajustes de mãos não redefinem uma base arrastada.
Pares na mesma zona ainda se distinguem por altura/tempo, sem deslocamento
artificial no piso. Regressão verifica círculos realmente renderizados na mesma
Scene, presets 4/5/pipe, pausa/meio/contato/fim, orientações e camadas; coordenadas
coincidem com a projeção 3D. 83 testes focados e tipos passaram. Smoke local:
4 → 31 → 5 mudou a posição inicial no 2D; alternar 2D/3D conservou posições,
scrub avançou/retornou e Ctrl+Z/Ctrl+Shift+Z restaurou/refez preset e formação.
O preset de meio-fundo rápido foi reaplicado ao final. Sem gravação remota.

Alças de contato e destino também podem ser arrastadas na quadra 2D com
Selecionar e mover. `court-simulation-handles.ts` projeta as mesmas alças da 3D
no piso e conserva seus limites, camadas e deslocamento físico da mão aplicado
uma única vez pelo comando canônico. O Canvas mantém somente a prévia do gesto;
ao soltar, envia um `updateCourtSimulationHandle` ao controlador compartilhado.
Contato, mira e bloqueio continuam independentes. O arraste preserva o ponto
onde a alça foi agarrada e usa o pixel final mesmo após o último preview.

Escape, perda de captura/foco, cancelamento nativo e mudança de documento,
etapa, ferramenta, disponibilidade ou geometria descartam a prévia. Setas do
teclado movem a alça focada; Shift amplia o passo. O fallback nativo converte
coordenadas no mesmo adaptador, sem alterar o contrato do renderer web.
116 testes focados passaram, incluindo gestos, zoom/pan, orientações, limites,
projeção, imutabilidade e comandos/guia compartilhados. Smoke em localhost:
ambas as alças arrastadas no 2D, desfazer/refazer de um gesto, ida à 3D, edição
do destino no 3D refletida no 2D, preview cancelado com Escape e ajuste por seta.
Os pontos anteriores ao smoke foram restaurados pelo histórico. Sem salvar
remotamente ou publicar; gesto físico em dispositivo nativo não exercitado.

Comparação ao vivo em 16/10 com o Visualizer do SetOptics identificou o controle
ausente após o contato: arrastar o ponto azul no meio da cortada eleva/abaixa
a curva sem mover suas extremidades. A altura do levantamento pertence a outra
fase. O editor agora apresenta a alça Curva do ataque no 3D e o mesmo ajuste
compacto em Ajustes, acessível também no 2D.

`attackSettings.attackArc` é opcional, em metros acima da corda no meio do voo,
limitado a 0,03–4 m. Ausente/null conserva exatamente o lançamento calibrado;
um valor explícito resolve a mesma mira por gravidade com
`T = sqrt(8 * attackArc / 9.81)`. Isso altera velocidade/duração do voo, sem mudar
contato, salto do atacante, destino ou posições/mãos do bloqueio. As colisões
com mãos/rede/fita continuam resolvidas pelo motor; elevar a curva pode mudar
o contato observado, não obriga a bola a atravessar um obstáculo.

O guia azul mostra a intenção completa até a mira mesmo se houver colisão.
Contatos e rebotes efetivos continuam separados. `attackGuide` tem 65 pontos,
com a alça exatamente no ponto 32. Importação, rascunho, desfazer/refazer e
alternância de vista usam o mesmo campo; escolher preset ou restaurar limpa
para null. O mockup histórico permanece preservado. A igualdade textual dos
cinco motores inalterados continua testada; as três extensões de ataque agora
têm comparação comportamental com o mockup em 540 amostras sem ajuste explícito.

Durante o arraste, o renderer deforma somente o guia de intenção recebido:
`4 * u * (1-u) * delta` em Y. Não integra física nem grava configuração; mantém
extremidades/XZ e oculta contatos/resultados antigos até o término. Soltar envia
um comando e recalcula o voo canônico; Escape/perda de captura descartam a prévia.

Validação local: 170 testes Jest focados, 35 testes Node e tipos aprovados.
No navegador, slider no 2D e alça/teclado no 3D alteraram a mesma curva; contato
e destino projetados permaneceram idênticos. A prévia acompanhou o arraste,
Escape restaurou o guia, um Ctrl+Z desfez o gesto e Ctrl+Shift+Z o refez. No
cenário corrente, elevar o arco mudou Rede → Chão para Chão, sem deslocar bases.
O valor original da curva foi restaurado ao final. O servidor local foi reiniciado
após queda e o rascunho da mesma turma foi recuperado. Sem gravação remota,
commit, push ou deploy; dispositivo nativo não exercitado.

Arrastar o fundo 3D agora conserva uma velocidade angular suavizada ao soltar,
com decaimento exponencial de 14/s, corte em 0,02 rad/s e duração máxima de
350 ms. Velocidades limitadas a 3 rad/s horizontal e 2 rad/s vertical evitam
impulsos excessivos. A inclinação permanece em 0,12–1,25 rad, sem rebote.
Soltar após uma pausa não reutiliza velocidade antiga. O mesmo RAF do renderer
atualiza câmera, silhuetas, rótulos e alças e deixa de se agendar ao parar.

Novo pointerdown ou teclado, zoom, mudança/reset de vista, etapa/ferramenta,
troca de documento, desativação, blur/ocultação e movimento reduzido interrompem
o deslizamento. Intervalos de RAF acima de 100 ms descartam a inércia para
evitar um salto ao retornar de suspensão. Reset também cancela um giro ativo.
O estado permanece no renderer e não cria comandos, gravações ou histórico.
Arrastes de atletas, materiais e trajetórias mantêm seu comportamento anterior.

Validação local: 11 testes de inércia e oito regressões de geometria passaram,
além dos tipos do app. As frequências 30/60/120 Hz convergem à mesma orientação.
No localhost, amostragem por RAF confirmou deslocamentos decrescentes após
soltar e repouso após 350 ms; novo toque e movimento reduzido produziram 26
amostras de câmera estável cada. Posições, revisão e playhead permaneceram
idênticos durante o smoke. A emulação de movimento reduzido foi removida.
Sem gravação remota, commit, push ou deploy.

O modelo Recepção do editor agora nasce com seis etapas completas, P1/P6/P5/P4/
P3/P2, cada uma com a simulação compartilhada de 4,1 s. O documento aberto ainda
tinha os 12 pares manuais Organização/Após o saque, dos quais só dois haviam
recebido configuração nova. `court-simulation-sequence.ts` reconhece esses pares
por formação, fase, rotação e identidade, sem converter documentos livres pelo nome.
O comando Atualizar rotações, nas opções da etapa legada, substitui a sequência
em uma única transação; não há efeito automático que a reaplique após Undo.
O builder tático e o JSON autoral anteriores continuam preservados para seus
outros consumidores. Novas etapas usam apenas `simulation.rotation`, sem carregar
as antigas trajetórias e semântica de fases. Atores, cores, vínculos, metadados e
materiais não-bola dos pares permanecem; cada etapa possui uma bola canônica.
O sexteto visível vem da etapa que fornece a configuração escolhida; unir as
visibilidades dos dois quadros poderia sobrepor centrais diferentes. Uma regressão
cobre esse caso e o smoke conferiu sete atores ao todo em cada rotação.

Galeria, setas ao lado do play e rádios de rodízio agora selecionam a mesma etapa
pela rotação da configuração, inclusive após reordenar as seis etapas. Navegação
pausa e zera o playhead sem gravar nem consumir o histórico. Alterar o sistema
aplica a escolha às seis recepções em um comando. Documento autoral que não é
essa sequência mantém a edição individual de rotação já existente.
Um destino editado para Ataque ou outro sistema continua sendo selecionado como
na galeria, conservando sua configuração; não reconfigura a etapa de origem.

Validação funcional local, nível 2: 101 testes focados e tipos aprovados. Casos
novos cobrem seis rotações em sete instantes contra motor/2D/3D, importação,
preservação, seleção, Undo/Redo e recuperação do rascunho com a etapa escolhida.
No localhost, a substituição foi aplicada à jogada aberta após exportar cópia
editável local. As seis rotações foram percorridas circularmente pelo transporte;
galeria e rádios mantiveram a seleção no 2D e no 3D. Um Undo restaurou as 12 e
Redo retornou às seis. Uma recepção completa gerou 113 atualizações observadas,
com progresso até 1 e movimento de bola/jogadores; trocar durante play pausou e
reiniciou a próxima etapa. Sistema 6–2 foi conferido nas seis e restaurado a 5–1.
A alteração está no rascunho local, sem salvar remotamente ou publicar.

Ataque também usa a sequência completa P1/P6/P5/P4/P3/P2. Em um conjunto válido
de seis configurações e rotações únicas, selecionar Ataque/Recepção chama
`configureCourtRotationSequenceMode`: um comando altera somente os modos que
mudaram e os rótulos automáticos, mantendo IDs, seleção, configurações individuais,
metadados, materiais e vínculos dos seis companheiros. Rótulos autorais permanecem.
O modo já aplicado não reinicia bases nem cria histórico. Documentos avulsos
continuam com a troca individual existente.

Ataque apresenta rodízio no transporte e nos Ajustes apenas quando existe essa
sequência, usando o mesmo seletor de etapa da galeria. Setas/rádios não alteram
preset, curva, contato, destino, mãos ou posições. Trocar modo explicitamente
reaplica as formações do motor; não há um arquivo independente de posições por
modo, e posições manuais de bloqueadores não têm restauração automática ao voltar.
Undo restaura o estado anterior completo. As animações do ataque continuam no
motor aprovado, com duração de 4,4 s com passe e 2,8 s sem passe. O índice de
rotação identifica a etapa editável; o motor não deduz seis formações táticas de
ataque diferentes. As diferenças entre jogadas vêm dos presets e ajustes por etapa.

Validação local, nível 2: 109 testes focados e tipos aprovados. Casos novos cobrem
as seis animações de ataque contra motor/projeções 2D/3D, tuning individual,
reordenação, nomes autorais, troca repetida de modo sem acumular adversários,
transação única, Undo/Redo e recuperação do rascunho/rotação selecionada.
No localhost, as seis etapas foram convertidas na jogada aberta e percorridas
circularmente; galeria, setas e rádios conservaram a seleção. Alternar 2D/3D em
0,76 preservou exatamente instante, posições e bola. Um ataque completo chegou
até 1 com 130 atualizações observadas e 41 estados de pose distintos. Undo/Redo
e retorno Recepção/Ataque das seis etapas foram exercitados. Layout conferido
na janela desktop e na janela compacta de 393 × 852 disponível durante o smoke,
sem alterar seu viewport. Recepção anterior exportada como cópia local.
Ataque ficou aplicado no rascunho; sem gravação remota, commit, push ou deploy.

### Transporte responsivo e velocidade por clique

Comparação ao vivo com o SetOptics em 393 × 852: sua barra mede 42 px de
altura; a versão anterior do app chegava a 101 px por dividir velocidade e
reprodução em duas linhas. O transporte agora mantém uma única linha de 42 px
no celular, com alvos de 40 px, preservando play, reinício, rodízio e etapas.
O número da velocidade substitui o slider em todas as larguras: cada clique
avança 0,25× entre 0,25× e 2×, retornando a 0,25× após 2×. O controle usa o
mesmo callback do host; não edita documento, seleção ou histórico.

Validação local proporcional: 18 testes focados aprovados, incluindo ciclo,
estado indisponível e presença de somente um slider em quatro larguras.
Medidas DOM em 320 e 393 px confirmaram uma linha, sem controles fora da barra;
clique do número exercitado em 2D e 3D. Configurações de curva/mãos conservam
suas dimensões. Sem publicação ou gravação remota.

### Alça central do painel móvel

Na primeira versão em telas de até 700 px, a seta flutuante cedeu lugar a uma
barra de 36 × 4 px com área de 80 × 40 px (compactada na revisão abaixo).
Aberta, fica dentro do painel, acima das abas;
fechada, permanece centralizada na posição recolhida. O botão fica fora do
ancestral `inert` para permitir reabrir inclusive durante o fade de 200 ms.
Altura do painel, conteúdo das abas e alça lateral desktop foram preservados.
Conferência direta de abertura/fechamento em 477 × 704 e quatro testes focados
aprovados. Ajuste local, sem alteração da jogada ou gravação remota.

### Densidade e encaixe do conjunto no celular

Comparação ao vivo com o SetOptics em 477 × 704: foram removidos o crescimento
dos controles web abaixo de 700 px e a reserva da antiga timeline de duas
linhas. Cabeçalho passa a 332 × 46 px, modos a 264 × 36 px e ferramentas a
40 × 328 px. Zoom usa quatro ações de 34 px em uma única barra de 148 × 40 px;
a antiga largura máxima forçava a quebra e deixava uma caixa vazia grande.
A alça fechada de 48 × 28 px fica a 8 px da timeline; a marca visual mede
28 × 4 px. Em larguras muito estreitas, zoom e alça ocupam alturas distintas
para conservar os controles. A abertura mantém a marca dentro, acima das abas.

Menus, Biblioteca e ajustes web reutilizam a variante compacta. O painel móvel
tem teto de 480 px e 62% da altura, com rolagem interna. Status da simulação fica
acima dos controles inferiores. Tamanhos nativos e dados da jogada preservados.

Foi corrigido também um desvio real da câmera: o fator fixo 1,6 ao cruzar 600 px
não correspondia ao perfil mobile 40. `renderer-camera-profile.mjs` centraliza
as bases e usa a proporção exata entre elas, mantendo órbita/zoom do usuário.
Conferência no navegador 393 → 1063 → 393 conservou alvo, ângulos e progresso,
com distância 40 → 21,024 → 40 no ataque frontal.

Validação local: 29 testes focados de controles/painel/geometria e 15 testes
Node de câmera/movimento aprovados; sintaxe do renderer aprovada. Conferência
visual em 477 e 393 px, nas vistas 2D/3D, com zoom em uma linha e sem colisão
entre zoom, alça e timeline. Tipos do app aprovados. Sem publicação ou gravação remota.

### Pacote de release

O pacote publica o renderizador integrado em `public/visual-court-3d/`, seus
recursos locais e a licença do Three.js. O protótipo independente, URLs locais
de turma e evidências de navegador ficam fora da publicação.
Os oito módulos originais necessários à comparação do motor são fixtures
em `src/core/__tests__/fixtures/court-reference/`; testes não dependem do
protótipo em `public/mockups/`. O gate `court-runtime` executa os testes Node
do motor e do renderizador junto aos demais checks de release e CI.


## Folga do saque sobre a rede — tentativas locais de 27/10/2026

As tentativas `net-clearance-v2/v3` elevaram a curva existente perto da rede;
a última impunha centro da bola a 3,10 m na faixa z ±0,15 m. O diagnóstico
`data-serve-net-crossing` leu y=3,139 m na geometria renderizada na 8081.
Foram registrados 61 testes Node e 72 Jest focados aprovados nessa versão.
Esses resultados descrevem a tentativa anterior, não validam o modelo abaixo.
Ela não resolveu a fidelidade visual relatada e foi substituída localmente;
o levantamento fixo de 3,10 m não é mais o contrato da trajetória.

## Saque animado — reconstrução local de 27/10/2026

A inspeção ao vivo do [SetOptics](https://app.setoptics.com/visualizer), com
busca por instantes do lançamento, contato e voo nas vistas frontal/lateral,
orientou uma implementação independente em `court-simulation/serve-flight.js`.
Duas parábolas unidas no ápice projetam a bola da mão até o alvo no piso;
a recepção intercepta a descida na altura nominal de 1,05 m antes desse alvo. Bola e guia usam
esse modelo; a guia mostra a projeção sem a oscilação do flutuante.

O contato parte de 2,28 m, com avanço de 0,38 m e deslocamento lateral de
0,03 m relativos ao alvo. O flutuante tem pequena oscilação e não gira;
o saque com rotação antecipa o ápice e gira a 14 rad/s. A folga é calculada
com rede de 2,43 m, meia fita de 0,0325 m, raio de bola de 0,12 m e margem
de 0,035 m, incluindo a oscilação. Alvos efetivos ficam ao menos 1 m após
a rede; entradas salvas e bases autorais não são regravadas.

O ciclo usa preparação de 1,5 s, voo com velocidades nominais de 14/17,5 m/s
e passe de 1,5 s. Instantes de contato variam com o voo; a coreografia dos
rodízios é remapeada a esses eventos. Somente o sacador usa escala de pose 1;
sua vista frontal/lateral e espelhamento acompanham direção e câmera.

Validação registrada nesta etapa: 72 testes Node, 52 Jest focados e tipos
aprovados. Na 8081 autenticada, editor e prévia exibiram a nova curva;
lançamento/contato conferidos de lado, reprodução a 0,25×/1×, curvas Float/Topspin
e busca reversa estável. Geometria renderizada cruzou z=0 em y=2,830/3,380 m.
Evidência privada: `.tmp/serve-preview-final.png` na worktree de origem.
Os 35 arquivos de agenda já alterados conservaram seus hashes. Observação funcional
da referência não estabelece equivalência exata de todos os movimentos.
Revisão local, sem publicação nem escrita remota.

## Câmera durante reprodução — correção local de 27/10/2026

O renderer cancelava o arraste da câmera em cada quadro com edição bloqueada.
O bloqueio agora cancela somente gestos de edição; giro e zoom continuam no
Play, inclusive na leitura. Revisão/ferramenta/superfície oculta ainda invalidam
o gesto. O botão Mover a vista em 3D preserva a reprodução; o 2D mantém seu
comportamento anterior. Bridge, seleção e alças de edição continuam bloqueados.

Nove testes Node, 79 Jest focados e tipos aprovados. Prévia autenticada na 8081 conferiu giro com
progresso avançando e zoom de 100% para 125% sem pausar; Mover a vista preservou
o Play. Evidência privada: `.tmp/playback-camera-final.png`.
Revisão local, sem publicação.

## Transporte de reprodução — revisão local de 27/10/2026

Após comparar a barra do SetOptics na sessão aberta, progresso ocupa a linha
superior, Play/reiniciar usam botões circulares e velocidade tem slider contínuo
de 0,1× a 2× (passo 0,05×), com valor ao lado e duplo clique web para 1×.
Verde do Go Atleta, rodízio, listagem de etapas, callbacks e bloqueios permanecem.
A composição usa os tokens/primitives existentes e não acrescenta dependência.

`courtPlaybackLayout` compartilha largura/altura com o cálculo de sobreposições;
espaço útil menor que 460 px lógicos coloca rodízio/etapas em outra linha.
Zoom conserva a base do transporte. Medida DOM em 319×704: transporte entre
x=46,4–272,6; zoom x=279–311, ambos com base y=690, sem interseção.
Conferência visual desktop na 8081, velocidade 0,65×, reset para 1× e teclado
1→1,05→1 validados. Editor e prévia usam a mesma barra. 45 Jest focados
e tipos após reparo do import aprovados. Evidência privada: `.tmp/transport-reference-final.png`.
Mudança local; agenda preservada e publicação separada.

## Saída do levantador no lançamento — ajuste local de 27/10/2026

A saída do levantador agora usa a soltura do lançamento (`tossStart`), aos
0,4 s do ciclo, em vez do início tardio da coreografia perto da batida.
O evento deriva do mesmo relógio da bola; bases autorais, destinos e chegada
permanecem. Na P1, a saída começa no corredor direito antes do corte para a rede.
Os dois renderizadores e a prévia amostram o mesmo motor, sem gravar posições.

Sete testes Node focados e 52 Jest aprovados. Os testes de saída cobrem
48 combinações de sistema, rotação, saque e origem/alvo; incluem continuidade,
busca reversa e checkpoints da bola antes/depois. Tipos aprovados.
Na prévia autenticada da 8081, antes da soltura Lv ficou em (3,6; 7,6).
Aos 0,671 s, com o sacador ainda na pose toss, Lv já estava em (3,6; 7,404)
e na pose approach. Play e busca por instante conferidos; evidência privada:
`.tmp/setter-toss-final.png`. Revisão local, sem publicação.

## Velocidade na cápsula compacta — ajuste local de 27/10/2026

Em web com transporte empilhado, o slider/valor da velocidade ficam dentro
da mesma cápsula do rodízio e das etapas. Botões de 28×32, ícones de 12,
valor de 11 e largura flexível preservam o espaço; Play/reiniciar seguem
acima. Desktop, nativo e callbacks permanecem com o comportamento anterior.

Conferido na prévia 8081 em 319×704: cápsula x=46,4–272,6, slider de
velocidade x=110,4–218,2 e zoom em coluna à direita, sem colisão.
Teste focado verifica que somente velocidade entra nessa cápsula; progresso
continua fora e os comandos preservam suas ligações. Evidência privada:
`.tmp/compact-speed-final.png`. Ajuste de layout local, sem publicação.

## Comandos compactos em uma linha — ajuste local de 27/10/2026

Refinamento da composição anterior: no web estreito, a cápsula de rodízio,
velocidade e etapas agora fica ao lado de Play/reiniciar, dentro de um único
bloco. O slider de velocidade é limitado a 80 px lógicos. A linha compacta
reduz sua escala somente quando necessário para caber; progresso fica acima.
A altura web usa 78 px lógicos, preservando os 116 px da composição nativa.

Prévia 8081 em 319×704: comandos x=46,4–272,6/y=654,8–690 e slider de
velocidade com 38,4 px físicos; zoom segue em coluna separado à direita.
Callbacks e duas barras preservados; teste de composição exige Play, restaurar,
rodízio e velocidade na mesma linha. Evidência privada:
`.tmp/single-row-controls-final.png`. Ajuste de apresentação local, sem publicação.

## Controles da vista 3D — ajuste local de 27/10/2026

Botão "Mover a vista" removido da 3D no editor e na prévia; giro por arraste,
zoom e ajuste à tela permanecem. Vista 2D mantém a ferramenta de mover.
Conferido na prévia 8081 em 319×704; teste focado cobre ausência do botão
e continuidade da reprodução ao ampliar. Ajuste local, sem publicação.

## Fechamento externo do painel — correção local de 27/10/2026

Ajustes/Etapas/Biblioteca recebe backdrop transparente enquanto aberto, acima
da quadra/iframe e abaixo do painel/alça. Tocar fora solicita fechamento
explícito; ações internas e Escape continuam disponíveis. Fundo sem hover
ou escala de pressão; removido imediatamente no fechamento.
Validação por teste focado, sem navegador a pedido do usuário. Alteração
sincronizada na 8081, sem publicação e sem mudança na agenda.

## Velocidade por toque — ajuste local de 27/10/2026

A barrinha de velocidade foi substituída pelo botão do valor atual. Ao tocar,
abre apenas a cápsula de 0,5×, 1×, 1,5× e 2× com a opção ativa destacada,
sem título, caixa externa ou padding adicional (208 × 34 no web). Teclado
foca a opção selecionada ao abrir e retorna ao botão ao escolher/usar Escape. Reutiliza
Segments e AnchoredDropdown: escolher fecha o seletor; fora/Escape também
fecham sem mudar a velocidade. O progresso continua independente e arrastável.
Botão web com fonte de 11 e altura de 32 px lógicos, integrado ao rodízio e
às etapas também no desktop, sem cápsula isolada. Callbacks e estado de
reprodução preservados. Teste focado
sem navegador; sincronizado na 8081, agenda preservada, sem publicação.

## Validação do pacote para publicação — 27/10/2026

Build verificado completo aprovado: 697 suítes/4761 testes Jest, runtime
3D, SQL isolado, lint sem erros/avisos, tipos, escopo, arquitetura e export web.
Execução final com um check por vez por limite de memória local. Smoke na
sessão real da 8081 validou prévia, velocidades, câmera durante Play, fechamento
externo e foco por teclado; sem gravação remota. Os 35 arquivos da agenda
permaneceram intactos. Entrega autorizada por push apenas para main; confirmação
em produção depende do CI/deploy desta revisão. Fluxo de release rápido
concorrente preservado fora deste pacote.
