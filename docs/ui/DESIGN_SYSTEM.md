# Design System web

## Referência

A Home do professor define a linguagem: navy como estrutura, superfícies sólidas,
bordas discretas, verde apenas para ação principal ou sucesso e densidade de
produto operacional.

## Tipografia

- Display: `Inter Tight`, 28–32, peso 700.
- Título de página: 26–28, peso 700.
- Título de seção: 18–20, peso 700.
- Título de card/linha: 15–16, peso 700.
- Corpo: 14–16; metadado: 12–13.
- Monoespaçada somente para código, IDs e valores técnicos.

## Espaçamento e superfícies

- Usar a escala `8, 12, 16, 20, 24, 32` de `src/theme/tokens.ts`.
- Usar `radius.internal`, `radius.card` e `radius.container`; não criar radius local.
- Preferir uma superfície principal com seções e separadores a cards aninhados.
- Cards operacionais usam 16 px no mobile e 20 px no desktop.
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
