# Regras responsivas

## Princípio

O celular tem uma experiência específica. Tablet e computador compartilham o
mesmo workspace, que libera navegação, painéis e densidade conforme a largura
real disponível. `tablet` é apenas o nome de uma faixa de largura; não significa
"mobile ampliado".

A orientação não define diretamente o layout. Ao girar o dispositivo, a largura
disponível muda e o sistema responsivo recalcula automaticamente suas
capacidades.

Não detectar layout por sistema operacional, user agent, nome do aparelho ou
orientação isolada quando a largura resolve o problema. `Platform.OS` pode
selecionar uma implementação compatível com a plataforma, mas não decide se a
interface é mobile ou workspace.

## Tiers e capacidades globais

| Faixa | Largura | Gutter | Comportamento inicial |
| --- | ---: | ---: | --- |
| `mobile` | `< 768` | 16 | Uma coluna e navegação inferior |
| `tablet` | `768–1099` | 24 | Workspace com sidebar compacta |
| `desktop` | `1100–1439` | 24 | Workspace com expansão da sidebar disponível |
| `wide` | `1440–1599` | 32 | Workspace com grid denso disponível |
| `ultrawide` | `≥ 1600` | 32 | Workspace amplo, limitado pela largura máxima da página |

Os breakpoints globais ficam em `src/ui/responsive-layout.ts`:

| Capacidade | Limite | Uso |
| --- | ---: | --- |
| `isMobile` | `< 768` | Experiência mobile dedicada |
| `usesWorkspaceShell` | `≥ 768` | Sidebar e ausência de navegação inferior |
| `supportsSplitView` | `≥ 960` | Autoriza painéis lado a lado se o container também couber |
| `canExpandSidebar` | `≥ 1100` | Autoriza sidebar expandida |
| `supportsDenseGrid` | `≥ 1440` | Autoriza maior densidade de colunas |

Telas devem preferir essas capacidades a comparações de tier ou variáveis como
`isDesktop` e `isTablet`.

## Viewport e container

A viewport define as capacidades do shell. A largura interna do container define
se um componente realmente comporta colunas, tabela ou painel permanente.

- `useResponsiveLayout` resolve as capacidades da viewport.
- No web, a largura responsiva vem da viewport de layout do documento. Isso
  preserva o mobile normal e permite que “site para computador” no navegador
  móvel ative o workspace, mesmo quando o navegador reduz a escala visual.
- `useContainerResponsiveLayout` mede o container com `onLayout` e,
  quando disponível na web, `ResizeObserver`.
- `ResponsiveGrid` só divide regiões quando a viewport autoriza split view e o
  container possui pelo menos a largura mínima centralizada para o grid.
- Uma sidebar expandida pode reduzir o conteúdo; por isso largura de viewport
  sozinha não autoriza a divisão de um grid.

Breakpoints locais de container são permitidos quando representam a capacidade
intrínseca do conteúdo. Exemplo: a lista de turmas mantém `1040 px` para acomodar
painel de unidades e tabela sem comprimir colunas. Esses limites devem ter nomes
de capacidade, como `UNIT_PANE_MIN_CONTENT_WIDTH` e
`TABLE_LAYOUT_MIN_WIDTH`, nunca nomes de dispositivo.

## Shell e navegação

- Abaixo de `768 px`, a sidebar não é renderizada e a navegação inferior fica
  disponível, respeitando as exceções de rota existentes.
- A partir de `768 px`, web, Android e iPadOS usam o workspace lateral e a
  navegação inferior desaparece.
- De `768` a `1099 px`, a sidebar permanece compacta, entre 72 e 88 px.
- A partir de `1100 px`, a pessoa pode expandir a sidebar; ao reduzir a janela,
  ela recolhe automaticamente.
- A implementação web preserva tooltip, hover, foco e persistência local. A
  implementação native usa labels de acessibilidade e mantém expansão apenas na
  sessão.
- Sidebar e navegação inferior nunca aparecem ao mesmo tempo.

## Páginas, grids e painéis

- `ResponsivePage` controla gutter, largura máxima e centralização.
- `ResponsiveGrid` organiza composições `1`, `8/4` e `6/6`, mas só abre colunas
  quando viewport e container têm capacidade.
- Em workspace compacto, painéis secundários devem recolher, empilhar ou abrir
  sobre o conteúdo. Não reduzir destrutivamente a região principal.
- Em workspace amplo, usar painéis lado a lado e respeitar `maxContentWidth`.
- Tabelas podem ter rolagem interna controlada; a página inteira não deve criar
  rolagem horizontal.

## Mobile

No mobile, preservar uma coluna, gutter de 16 px, alvos de toque, ações
principais e todas as informações. Quando algo não couber: empilhar, recolher,
abrir em modal ou sheet, aplicar rolagem interna, ou levar para uma tela de
detalhe. Não esconder uma operação apenas por falta de espaço.

## Antes de criar um breakpoint local

1. Verificar se uma capacidade global já representa a decisão.
2. Confirmar se a decisão depende da viewport ou da largura do container.
3. Medir o container com o hook compartilhado quando a largura interna for a
   restrição real.
4. Definir o limite pelo conteúdo mínimo que precisa caber, não pelo nome de um
   aparelho.
5. Dar ao token um nome semântico e documentar a justificativa aqui.
6. Cobrir o limite exato, um valor abaixo e um acima em teste.

## Contratos de validação

- `resolveResponsiveTier` e `resolveResponsiveLayout` são puros e não acessam
  React, `window` ou `Platform`.
- Validar pelo menos mobile, tablet vertical, tablet horizontal, janela compacta
  de computador e desktop amplo.
- Conferir temas claro/escuro, foco, teclado, toque, URLs longas, modais, tabelas
  e ausência de overflow horizontal global.
- Não introduzir breakpoint local sem passar pelo processo acima.
