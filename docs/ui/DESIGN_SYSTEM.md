# Design System web

## Referência

A Home do professor define a linguagem: navy como estrutura, superfícies sólidas,
bordas discretas, verde apenas para ação principal ou sucesso e densidade de
produto operacional.

## Tipografia

A escala base é resolvida por `responsiveLayout.density`; componentes
compartilhados não devem escolher tamanho por `Platform.OS`.

| Uso | Mobile | Tablet/desktop | Wide/ultrawide |
| --- | ---: | ---: | ---: |
| Título de página | 22/28 | 24–26/30–32 | 26–28/32–34 |
| Título de seção | 16 | 17–18 | 18–20 |
| Título de card/linha | 14 | 15 | 16 |
| Corpo | 14 | 14–15 | 15–16 |
| Metadado | 12 | 12 | 13 |

- Display: `Inter Tight`, reservado para superfícies editoriais ou institucionais.
- Monoespaçada somente para código, IDs e valores técnicos.

## Espaçamento e superfícies

- Usar a escala `8, 12, 16, 20, 24, 32` de `src/theme/tokens.ts`.
- Usar `radius.internal`, `radius.card` e `radius.container`; não criar radius local.
- Preferir uma superfície principal com seções e separadores a cards aninhados.
- Cards operacionais usam 10–12 px no mobile e 16–20 px no workspace, conforme
  a complexidade e os alvos de toque internos.
- Sombras são último recurso; borda e contraste de superfície vêm primeiro.

## Ações

- Uma ação primária por região.
- Ação secundária usa contorno ou superfície neutra.
- Ação destrutiva é discreta até o momento de confirmação.
- Ações indisponíveis sem valor informativo devem ser ocultadas, não desabilitadas.

## Estados

Loading, vazio e erro ocupam o mesmo espaço estrutural do conteúdo final. O texto
deve explicar situação e próximo passo sem termos internos, debug ou atribuição
redundante à IA.
