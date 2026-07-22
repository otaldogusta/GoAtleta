# Design QA — suavização do gráfico de periodização

## Fonte de verdade

- Tela autenticada: `http://localhost:8081/class/c_1775903848643/periodization?classId=c_1775903848643&unit=Rede%20Esportes%20Pinhais&backTo=%2Fclass%2Fc_1775903848643`
- Referência: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-99b46603-570c-4f47-88cd-ecdfc5f3e1ac.png` (1487 × 1058)
- Implementação desktop: `C:\Users\gusta\.codex\visualizations\2026\07\21\019f8582-ce1c-7b71-b5ce-bd68f9af073f\periodization-smooth-final.png`
- Comparação normalizada: `C:\Users\gusta\.codex\visualizations\2026\07\21\019f8582-ce1c-7b71-b5ce-bd68f9af073f\periodization-smooth-reference-comparison.png`
- Implementação tablet: `C:\Users\gusta\.codex\visualizations\2026\07\21\019f8582-ce1c-7b71-b5ce-bd68f9af073f\periodization-smooth-tablet.png`
- Implementação celular: `C:\Users\gusta\.codex\visualizations\2026\07\21\019f8582-ce1c-7b71-b5ce-bd68f9af073f\periodization-smooth-mobile.png`
- Seleção após correção do scroll: `C:\Users\gusta\.codex\visualizations\2026\07\21\019f8582-ce1c-7b71-b5ce-bd68f9af073f\periodization-smooth-scroll-after.png`

## Comparação visual

- A comparação focou o card do macrociclo e normalizou os dois recortes para 1200 px de largura. A referência usa outra turma e valores variáveis; a implementação usa a turma autenticada `Turma 07-09`, cuja carga atual é constante.
- A linha deixou de usar segmentos rígidos e passou a usar uma curva cúbica contínua com junções e extremidades arredondadas.
- O traço principal ficou mais fino e levemente translúcido; os pontos comuns ficaram menores e preenchidos, como na referência.
- O ponto selecionado preserva o halo verde e o tooltip. As guias Alta, Média e Baixa ficaram mais discretas sem perder alinhamento.
- Tipografia, espaçamento, cores e bordas permanecem no sistema visual existente. Não há ativos rasterizados novos; o gráfico continua vetorial.

## Responsividade e interação

- Desktop: 1360 × 914 CSS px, sem overflow horizontal global.
- Tablet solicitado: 834 × 1194; ambiente renderizou 1042 × 1492 CSS px, sem overflow horizontal global e com o inspetor empilhado.
- Celular solicitado: 390 × 844; ambiente renderizou 487 × 1055 CSS px, sem overflow horizontal global e com scroll interno no macrociclo.
- Um ponto diferente foi selecionado e o intervalo do inspetor mudou; `Hoje` restaurou `18 Jul`.
- O ponto `01/08/2026 - 07/08/2026` deslocou o macrociclo progressivamente de `418.125` para `526.25` px, com posições intermediárias em `481.25` e `525` px; não houve salto instantâneo.
- A seleção dispara uma única vez no clique. O manipulador duplicado de `onPressIn` foi removido.
- O scroll animado também foi confirmado no tablet (`397.5 → 495 → 559.375`) e no celular (`675 → 779.375 → 836.875`).
- Console verificado após recarga: nenhum erro.

## Histórico de refinamento

1. P2 — linha angular e visualmente pesada em relação à referência: substituída por caminho cúbico suavizado e traço mais leve.
2. P2 — marcadores vazados e grandes: reduzidos e preenchidos; o selecionado continua destacado.
3. P2 — guias competiam com a série: opacidade reduzida mantendo a correspondência exata com Alta, Média e Baixa.
4. P2 — a seleção reposicionava o macrociclo com `animated: false`, causando um salto lateral: o primeiro posicionamento continua imediato e as seleções do usuário agora usam scroll animado.
5. Estado real com carga constante produz uma linha reta; não foram inventadas oscilações para simular a referência.

## Resultado final

final result: passed
