# Diretrizes de layout web

## Largura

- Página operacional: conteúdo máximo de 1440 px.
- Dashboard denso: conteúdo máximo de 1600 px.
- O conteúdo é centralizado e sempre mantém gutters responsivos.
- Cabeçalho e corpo devem compartilhar o mesmo eixo inicial.

## Grid

O desktop usa 12 colunas conceituais:

- `8/4`: região principal com trilho lateral.
- `6/6`: duas regiões pares.
- `1`: fluxo único.

Regiões principais podem dividir a linha quando `supportsSplitView` estiver
ativo e a largura medida do container acomodar a composição. Caso contrário, a
ordem do DOM define a ordem vertical. Não usar scroll horizontal para resolver
layout.

## Densidade

- Priorizar listas agrupadas para objetos repetidos.
- Métricas compactas podem usar duas colunas no mobile e quatro a partir do tablet.
- URLs e nomes longos devem quebrar ou truncar sem empurrar ações para fora.
- A sidebar não altera o contrato interno da página; o conteúdo deve encolher sem overflow.
