# Setas com três pontos de ajuste — implementação local

Pedido de 11/11/2026: ajustar início, meio e ponta de setas desenhadas na quadra.
A edição usa as alças na seleção 2D, com prévia durante o gesto e uma edição
ao soltar. O resultado também deve aparecer no 3D e nos exportadores existentes.

## Contrato

- Uma seta autoral editável selecionada mostra início, meio e ponta; o ponto
  do meio fica sobre o traço. Arrastar o meio controla a curva e alinhá-lo à
  reta entre as extremidades restaura uma seta reta.
- Duplo clique ou dois toques no meio endireitam a seta mantendo as extremidades
  atuais. Enter na alça central faz o mesmo. Uma ação gera uma edição desfeita
  em um passo; repetir sobre uma seta já reta não cria histórico.
- Alvos de 44 px, independentes do tamanho do marcador. As extremidades são
  ajustadas separadamente, preservando a outra e o controle da curva.
- Concluir um desenho de seta ou curva retorna à seleção também no desktop.
- Bloqueados, ocultos, reprodução e leitura não permitem editar as alças;
  seleção múltipla mantém o fluxo de movimento em grupo.
- Prévia não grava: um arraste concluído gera uma edição, cancelamento ou troca
  de contexto descarta o gesto. Zoom/pan e orientação usam a projeção da quadra.

## Compatibilidade

Curvas legadas usam um controle implícito e ignoram pontos intermediários no
traço. Não reinterpretar esses pontos como controles, pois mudaria documentos
existentes. O campo opcional `CourtDrawing.curveMode: "through-point"` identifica
exclusivamente uma curva de três pontos: início, meio visível e fim.

Com a flag, o controle quadrático é `C = 2M − (A + B)/2`. Sem ela, preservar
o fallback existente. Na conversão para reta, retirar a flag e manter início/fim.
Parser, compartilhamento, renderização 2D, picking e 3D precisam concordar.
Movimento, duplicação e cópia usam os três pontos do desenho normalmente.

O campo fica no JSON existente, sem migration ou nova entidade. A mudança foi
ampliada do gesto localizado para uma extensão compatível do documento; validar
parser/transformações/renderers além dos gestos. Não muda autenticação, navegação
ou isolamento por organização, e não autoriza operação remota.

## Evidências

Conclusão local em 12/11/2026. Implementação dividida entre UI e contrato/3D,
Revisão independente por leitura sem achados acionáveis e Testes com recibos
e hashes conferidos, reaproveitando checks válidos:

- 145 casos Jest aprovados: 29 contrato/perspectiva/compartilhamento,
  52 gestos/cena/área/simulação e 64 workspace/mobile.
- 12 testes Node da geometria do renderer 3D aprovados.
- `npm run typecheck:app` e diff sem erros no delta final.
- IAB em localhost: reta → curva → reta, extremidades independentes,
  teclado, desfazer/refazer em um passo, duplicar/excluir cópia e curva em 3D.
  Na largura móvel 390×844 solicitada, alvos medidos em aproximadamente 44×44 px,
  arraste do meio e desenho de nova seta retornando às três alças conferidos.
- Curva legada de três pontos manteve exatamente o mesmo atributo SVG `d`
  antes/depois; comparação visual também realizada. Alças observadas na quadra
  autenticada aberta, sem modificar setas reais para o teste.

Arquivos: [geometria das alças](../../src/components/visual-court/court-arrow-geometry.ts),
[Canvas](../../src/components/visual-court/CourtEditorCanvas.tsx),
[Scene](../../src/components/visual-court/CourtEditorScene.tsx),
[Workspace](../../src/components/visual-court/CourtWorkspaceView.tsx),
[documento/parser](../../src/core/visual-court-editor.ts),
[perspectiva](../../src/core/visual-court-perspective.ts) e
[geometria 3D](../../public/visual-court-3d/renderer-geometry.mjs).

Imagens e fixture ignoradas pelo Git em `.tmp/work/quadra-mobile-20261111/`:
`setas-legado-antes.jpg`, `seta-tres-pontos-desktop.jpg`,
`seta-tres-pontos-mobile.jpg`, `seta-curva-3d.jpg` e
`court-arrow-handles-qa-entry.tsx`. Entrada temporária removida da superfície
servida após o ensaio. Viewport restaurada; app e Habblaud mantidos no Codex.

Limites: Jest usa hosts/eventos mockados; Node cobre geometria isolada. Não foram
exercitados aparelho físico, persistência remota ou novas alças dentro do 3D.
As alças ficam no overlay 2D e não integram a imagem exportada. Sem commit,
publicação, migration ou operação remota.

## Refinamento visual da seleção — 12/11

Contorno dos desenhos lineares reduzido de 14/10 para 9/7 unidades SVG
(borda escura/branca), com escuro a 40% de opacidade e traço autoral preservado.
Marcadores das setas de 16 para 14 px, borda de 1,5 px e sombra mais leve;
alvos permanecem em 44 px. Nível 1: 26 testes existentes de Scene/alças e diff
aprovados, revisão compacta sem achados. IAB conferiu traço contínuo, tracejado
e branco, comparados à referência anterior; imagem `selecao-seta-refinada.jpg`.

## Endireitar pelo ponto do meio — 12/11

Nível 2: gesto localizado no Canvas e helper de geometria. Dois cliques/toques
curtos em até 350 ms e 22 px acionam a conversão; arraste, cancelamento e troca
de contexto limpam a sequência. O `dblclick` posterior é absorvido para não
duplicar a edição nem abrir um texto sob o ponto anterior. As pontas não usam
esse atalho; Enter exige foco na alça central editável.

Implementação e Revisão independente por leitura concluídas, sem achados finais.
49 testes focados aprovados (35 de alças e 14 de área), `typecheck:app` e diff sem
erros. No IAB, curva → duplo clique → reta preservou os extremos; desfazer/refazer,
repetição sem histórico extra, duplo clique na ponta sem efeito e Enter conferidos
em fixture fictícia com componentes reais. Imagem `seta-duplo-clique.jpg` na pasta
de evidências local já indicada. Toque nativo coberto por eventos simulados;
aparelho físico não exercitado. Entrada temporária removida após o ensaio.
