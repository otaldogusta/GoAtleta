# Ajuste das trajetórias autorais no 3D

Refino local de 12/11/2026. Setas e curvas autorais passam a ter seleção no
próprio traço tridimensional e controles de posição e altura, seguindo a interação das
alças da aba Ataque. O desenho permanece autoral: não cria outra simulação de
voo ou movimento automático da bola. O aviso de contato com a rede descrito
abaixo é uma conferência geométrica do traço, sem alterar a jogada.

## Contrato

- Seleção de `arrow`/`curve` acompanha o caminho em X/Y/Z, em vez do retângulo
  projetado no piso. Preserva cor, tracejado, profundidade e vínculo com a bola.
- Início, meio e fim têm alças com alvo de 44 px, altura em metros e teclado.
  O plano do gesto é vertical, orientado pela direção horizontal da câmera:
  arrastar para os lados move X/Z; para cima/baixo ajusta Y. Girar a vista
  permite acessar outra direção do piso. O ponto de pega deslocado mantém
  seu offset; gestos verticais não introduzem deslocamento lateral pela
  perspectiva. O gesto não gira a câmera. A alça inicial ligada fica
  fora do corpo da bola; todas evitam o menu contextual medido pelo host,
  conservando a área de toque inteira e ligando-se ao ponto real por um traço.
  Se não houver espaço físico para todos os alvos, o layout mantém posições
  válidas e prioriza a separação; não garante ausência de sobreposição em
  qualquer tamanho de viewport.
- O início ligado acompanha a bola. Ajustá-lo move a posição/altura dessa bola;
  bloqueio, ocultação e controle pela simulação impedem a edição do início.
  Meio e fim continuam sendo ajustes da própria trajetória.
- `CourtDrawing.trajectoryHeights` é opcional e contém `start`, `middle` e
  `end` em Y mundial, separados das coordenadas X/Z e de `curveMode`.
  A ausência preserva a projeção legada. O perfil interpola as três alturas
  por uma curva quadrática, limitada a 0–8,12 m. O centro da bola ligada fica
  entre 0,12 e 8,12 m, correspondendo à altura autoral da bola de 0–8 m.
- O vínculo substitui o início pela posição atual da bola; o perfil explícito
  conserva o meio e o fim. Desvincular materializa a forma atual. Cópia,
  exclusão, importação e histórico preservam o perfil e referências. A primeira
  edição ligada a uma bola simulada usa o Y amostrado no progresso atual.
- Cada soltura emite um comando atômico `trajectory-point` no envelope validado
  por origem, source, token e revisão. O host exige seleção única editável.
  Prévia, cancelamento e confirmação seguem o fluxo local de altura, sem
  esperar autosave. Teclado preserva `trajectory-height` para cima/baixo/Home;
  esquerda/direita deslocam na direção lateral da câmera. O 2D mostra o mesmo
  X/Z editado. Lateral puro conserva a ausência de perfil de altura legado;
  altura pura conserva kind/curveMode/XZ. Uma edição gera um passo de histórico.

## Arraste lateral — validação local

Rodada de 12/11/2026, nível 3 pelo comando integrado e reutilização da
geometria 2D. 224 testes distintos aprovados: core/bridge/2D 181, trajetória
15 e handlers 28; tipos, organização, arquitetura strict e diff aprovados.
O check arquitetural encontrou um ciclo de tipos na extração inicial; os
tipos foram isolados em `court-drawing-types.ts`, com reexports compatíveis.
Revisão corrigiu o no-op do meio sobre uma reta: gesto sem alteração não
gera revisão/histórico. Nenhum achado pendente no recorte final.

IAB em 1243 × 699 e 379 × 819: lateral do meio conserva altura/câmera; vertical
mantém o caminho SVG2D exatamente; desfazer/refazer restaura a curva em uma
edição. Início ligado desloca os três vínculos juntos. Em câmera oblíqua no
móvel, meio e ponta moveram lateralmente, com altura/câmera preservadas e
aviso da rede acompanhando. Após o HMR final, a cena fictícia foi recomposta
e o arraste lateral/teclado de altura conferidos novamente. Capturas
inspecionadas; console sem erros, override removido e abas preservadas.
Relatórios em `.tmp/work/quadra-trajectory-lateral-20261112/`.
Sem toque físico, gravação de teste em jogada real ou publicação.

## Aviso de trajetória na rede

Setas e curvas visíveis recebem um aviso compacto `Trajetória na rede` junto
ao primeiro contato do traço XYZ com a malha ou as fitas. A conferência usa o
mesmo caminho desenhado, incluindo o perfil de altura e a prévia dos gestos;
ajustar a seta ou a bola ligada atualiza o resultado. Passagens livres por cima,
por baixo da malha ou fora da largura não recebem aviso. Não é arbitragem de
infração nem cálculo do volume ou da colisão física de uma bola.

O aviso acompanha a projeção da câmera, desaparece quando a trajetória deixa
de tocar a rede e respeita a ocultação da rede/desenho. É uma indicação
temporária do renderer: não muda seleção, documento, histórico ou comandos.
Não captura toque ou ponteiro nem adiciona renderização contínua em repouso.
Um ponto âmbar marca o contato; uma linha fina o liga ao rótulo. O layout
prioriza espaço acima, livre das alças/menu/outros avisos, com alternativa
apenas quando não há candidato livre acima.

Validação deste incremento: nível 2, 55 testes distintos (rede 8, trajetória
10, elevação 13, integração 24), tipos e revisão independente aprovados.
IAB em 1124 × 857 e 379 × 819: meio a 1,8 m gera aviso; a 2,8 m libera a
passagem. Ocultar/mostrar a camada remove/restaura o aviso. Arraste móvel
de 1,8 para 3,2 m liberou a trajetória sem alterar a câmera; desfazer
restaurou o contato. A conferência móvel corrigiu prioridade abaixo quando
havia espaço acima. Capturas finais inspecionadas, console sem erros,
override removido e abas preservadas. Registros locais em
`.tmp/work/quadra-net-warning-20261112/`. Sem toque físico ou publicação.

## Validação

Nível 3 pela extensão compatível do documento e integração de core, bridge e
renderer. 229 testes distintos aprovados: core/bridge 175, trajetória 10,
elevação 13, enquadramento 9 e integração dos handlers 22. Typecheck final,
org-scope, arquitetura e diff aprovados. A primeira tentativa de tipos atingiu
o limite de heap de 1024 MB; a execução serial com 2048 MB passou, sem alterar
configuração do sistema. Comandos, hashes e reaproveitamento no relatório local.
Revisão independente por leitura concluída sem achados acionáveis pendentes,
incluindo o delta final da área do menu, medição nula e prevenção de loops.

IAB no localhost, workspace real com cena fictícia em memória: seleção no
traço; meio elevado a aproximadamente 3,5 m por teclado e arraste; início
ligado elevado a cerca de 2,3 m; movimento da bola com os três vínculos;
ponta de 0,0 para 0,5 m, desfazer/refazer confirmados pelos rótulos. A câmera
permaneceu fixa no arraste da altura, e um giro separado permitiu observar o
arco em relação à rede. Nenhuma alteração de teste foi gravada na jogada real.

Desktop efetivo 1124 × 857 e móvel solicitado 390 × 844, efetivo 379 × 819.
No móvel, o QA encontrou a alça do meio sob as ações e motivou a publicação de
`selectionActionsBounds`. Depois do ajuste, os três alvos de aproximadamente
44 × 44 px ficaram livres do menu, conferidos visualmente e pelo hit-test DOM.
Sem erros de console; override removido e quadra/Habblaud mantidos disponíveis.
As abas usadas pelo usuário foram preservadas. O ensaio de mouse/teclado em
viewport móvel não comprova toque físico, fluidez de GPU nem persistência remota.

O compartilhamento TypeScript passa pelo parser do editor. A projeção SQL
local preserva o objeto `drawings` completo; este campo não requer migration
nova. Isso não certifica a versão ativa no ambiente remoto.

Fontes: `src/core/visual-court-editor.ts`, `visual-court-perspective.ts`,
`src/components/visual-court/court-perspective-bridge.ts`, `CourtWorkspaceView.tsx`
e `public/visual-court-3d/renderer.mjs`. Capturas e logs locais ficam em
`.tmp/work/quadra-arrow-trajectory-20261112/`. Sem publicação nesta rodada.
