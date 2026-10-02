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

## Cabeçalho operacional

- Usar `PageBreadcrumbHeader`: voltar circular de 38 px e caminho inline, como Início › Turmas › Hipopótamos. Níveis anteriores são links com hover apenas no texto; a página atual permanece um heading sem ação. Destinos usam o escopo atual e a proteção de alterações pendentes; telas com proteção própria repassam `onBreadcrumbNavigate`. Altura de 38 px, fonte de 12 px, linha de 18 px e seta de 18 px em todas as larguras; valores vêm de `pageHeaderMetrics`.
- A linha de título e ações em `ScreenPageHeader` ocupa pelo menos 40 px e começa após 8 px do topo, com inset horizontal de 16 px. Subtítulos ficam abaixo dessa linha. Contêineres externos não acrescentam padding superior ao cabeçalho; quando já têm padding horizontal, compensar no cabeçalho para manter a mesma posição de Turmas e Atletas.
- Usar `SectionLoadingState` para carregamento de seções: spinner discreto e mensagem curta, sem shimmer e sem repetir indicadores no mesmo bloco.
- `BackTitleHeader` e `ScreenPageHeader` adotam esse padrão. O contexto vem da seção atual ou de `context`/`eyebrow` explícitos; não altera destinos de navegação.
- Manter acessórios e ações independentes do botão voltar, com truncamento de nomes longos no celular, preservando o nome completo na acessibilidade.
- Subtítulos úteis ficam abaixo do caminho, com 12 px. Formulários de autenticação mantêm o cabeçalho próprio.
