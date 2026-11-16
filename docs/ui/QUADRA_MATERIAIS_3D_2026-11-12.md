# Materiais e sombras da quadra 3D

Implementação local de 12/11/2026. Referência de apresentação: materiais
iluminados e contato com o piso do [SetOptics](https://github.com/dawsonpar/SetOptics).
O renderer existente foi adaptado, sem importar React Three Fiber, substituir
a física ou acrescentar assets externos. A textura de bola e as silhuetas já
locais mantêm a proveniência em `public/visual-court-3d/reference/sources.json`.

## Contrato de apresentação

- `renderer-appearance.mjs` fornece materiais Standard para bola, cone, alvo,
  escada, fita, postes e antenas. A bola conserva o albedo e a rotação existentes,
  com acabamento fosco e iluminação; não foi adicionado mapa de relevo.
- Piso, desenhos e seleção conservam sua paleta e materiais sem luz. As
  silhuetas desta rodada foram posteriormente substituídas por
  [corpos 3D iluminados](QUADRA_CORPOS_3D_2026-11-12.md); a medição abaixo
  corresponde à versão anterior, não certifica o custo dos novos corpos.
- Sombras de contato usam uma textura radial compartilhada de 64 × 64 px.
  Permanecem no piso, alargam e enfraquecem com a altura, incluindo o salto dos
  jogadores. A sombra alongada acompanha a rotação da escada.
- Uma sombra por objeto, inclusive bola simulada; sem shadow maps ou passes
  extras. A textura é compartilhada, e os materiais/geometrias descartados por
  objeto. Sombras não participam de seleção ou hover.
- Câmera, resolução/DPR, suspensão, renderização por invalidação, altura,
  camadas, vínculos de setas e protocolo do documento são preservados.

## Validação local

Nível 2 da escada: 46 testes Node focados cobrem aparência, hover/picking,
altura, geometria, resolução e suspensão. `typecheck:app`, sintaxe e diff check
aprovados. Revisão independente encontrou e corrigiu o sentido da sombra da
escada; teste compara seus eixos mundiais em seis ângulos. Perf-hygiene não
analisa este renderer MJS; não foi usado como prova de desempenho WebGL.

IAB no localhost:8081, com o workspace real e fixture fictícia sem persistência:
comparação visual antes/depois, volume de bola/cone/escada, hover do cone e do
alvo, seleção do centro do alvo, altura do alvo e da bola, movimento da bola
com três setas vinculadas. No viewport móvel foram conferidos zoom, seleção,
arraste da altura do cone, ocultação e bloqueio pelas camadas; alça de altura
medida em aproximadamente 44 × 44 px.
Na jogada existente, a reprodução chegou ao fim, reinício e giro/enquadramento
foram conferidos, sem erro de console e sem editar seu documento.

Viewport móvel solicitado: 390 × 844; área CSS efetiva do IAB: 379 × 819, DPR
1,03. Desktop: 1243 × 699 CSS. O zoom do navegador não foi alterado. A verificação
responsiva no computador não substitui teste de toque/GPU em aparelho físico.
O renderer alterado é o web; o componente nativo conserva seu canvas existente.

## Medida comparável

Uma única iframe por vez, mesma cena sintética com 12 jogadores, bola móvel,
cone, alvo e escada. Cada rodada: 60 quadros de aquecimento, 180 amostras e
500 ms de repouso. Medida de CPU inclui atualização/submissão ao WebGL; a
cadência inclui confirmação do protocolo. Não é tempo de GPU nem FPS máximo.

| Área CSS | Versão | CPU mediana / p95 | Cadência observada | Renders em repouso |
| --- | --- | --- | --- | --- |
| 379 × 819 | Base | 3,0 / 4,1 ms | 59,99 Hz | 0 |
| 379 × 819 | Refinada | 3,1 / 4,4 ms | 59,95 Hz | 0 |
| 1243 × 699 | Base | 1,8 / 2,6 ms | 60,01 Hz | 0 |
| 1243 × 699 | Refinada | 2,7 / 3,8 ms | 59,97 Hz | 0 |

Na cena medida: 135 → 139 draw calls, 3344 → 3088 triângulos e 5 → 6 texturas.
A nova textura tem 16 KiB de dados RGBA. Houve custo adicional de CPU, sem queda
observada da cadência nessa amostra. Não há conclusão sobre celulares físicos,
DPR 2, consumo de bateria ou cenas maiores.

Fontes congeladas: renderer base `d74f992e`, renderer refinado `d86c8a06`, helper
`f0e32903` (prefixos SHA-256). Logs, hashes completos, gerador do benchmark,
métricas e capturas ficam no diretório local ignorado
`.tmp/work/quadra-appearance-20261112/`. Fixtures públicas temporárias são
removidas após a coleta. Sem publicação nesta rodada.
