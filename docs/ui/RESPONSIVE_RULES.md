# Regras responsivas

| Tier | Largura | Comportamento |
| --- | --- | --- |
| `mobile` | `< 768` | Uma coluna, gutter 16 |
| `tablet` | `768–1199` | Uma coluna principal, gutter 24 |
| `desktop` | `1200–1439` | Grid desktop, gutter 24 |
| `wide` | `1440–1599` | Grid desktop, gutter 32 |
| `ultrawide` | `≥ 1600` | Grid desktop, gutter 32 |

## Contratos

- `resolveResponsiveTier` é puro e não acessa React, `window` ou `Platform`.
- O hook de viewport apenas conecta `useWindowDimensions` ao resolver puro.
- Regiões `8/4` e `6/6` empilham até 1199 px.
- Modal deve caber em 390×844 sem cortar ação principal.
- Não esconder informação ou operação apenas para fazer o mobile caber.
- Não introduzir breakpoint local em tela sem antes atualizar este documento e os tokens.
