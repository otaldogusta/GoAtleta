# Design System web

## Referência

A Home do professor define a linguagem: navy como estrutura, superfícies sólidas,
bordas discretas, verde apenas para ação principal ou sucesso e densidade de
produto operacional.

Para formulários e configurações, o perfil do atleta complementa essa referência
com os padrões de interação de [FORM_SETTINGS_PATTERNS.md](FORM_SETTINGS_PATTERNS.md).
Aplicar os comportamentos pertinentes, sem copiar regras de domínio ou estilos
locais indiscriminadamente.

## Tipografia

A escala base é resolvida por `responsiveLayout.density`; componentes
compartilhados não devem escolher tamanho por `Platform.OS`.

| Uso | Mobile | Tablet/desktop | Wide/ultrawide |
| --- | ---: | ---: | ---: |
| Título de página | 20/26 | 22/28 | 22/28 |
| Título de seção | 16 | 16 | 16 |
| Título de card/linha | 14 | 14 | 14 |
| Corpo | 14 | 14 | 14 |
| Metadado | 12 | 12 | 12 |

A largura adicional libera colunas e conteúdo, sem ampliar automaticamente a
escala de leitura. Componentes com destaque próprio devem manter essa proporção.

- Display: `Inter Tight`, reservado para superfícies editoriais ou institucionais.
- Monoespaçada somente para código, IDs e valores técnicos.

## Espaçamento e superfícies

- Usar a escala `8, 12, 16, 20, 24, 32` de `src/theme/tokens.ts`.
- Usar `radius.internal`, `radius.card` e `radius.container`; não criar radius local.
- Preferir uma superfície principal com seções e separadores a cards aninhados.
- Cards operacionais usam 10–12 px no mobile e 12–14 px no workspace, conforme
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
