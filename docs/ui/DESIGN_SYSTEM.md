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
| Título de página | 18/24 | 20/26 | 20/26 |
| Título de seção | 16 | 16 | 16 |
| Título de card/linha | 12 | 12 | 12 |
| Corpo | 12 | 12 | 12 |
| Metadado | 11 | 11 | 11 |

A largura adicional libera colunas e conteúdo, sem ampliar automaticamente a
escala de leitura. Componentes com destaque próprio devem manter essa proporção.

Uma correção de densidade ajusta os elementos em conjunto: fonte, ícone,
padding, gaps e organização dos controles. Diminuir somente o container conserva
a desproporção interna. Usar a fonte do Go Atleta e os controles operacionais
aprovados como referência, incluindo a Quadra Visual quando solicitada, sem
copiar regras do seu domínio ou aplicar a escala do canvas ao restante da UI.

- Display: `Inter Tight`, reservado para superfícies editoriais ou institucionais.
- Monoespaçada somente para código, IDs e valores técnicos.

### Escala operacional compacta

A escala compacta é o padrão operacional. `responsiveLayout.density` resolve a
hierarquia por faixa; `compactUiMetrics`, definido no módulo puro
`src/theme/compact-ui-metrics.ts` e reexportado por `src/theme/tokens.ts`, reúne
as medidas de controles, leitura e navegação. Reutilizar essas duas fontes em
vez de criar uma escala própria por tela.

| Elemento | Medida |
| --- | ---: |
| Título compacto / entrelinha | 16 / 22 |
| Corpo compacto / entrelinha | 12 / 18 |
| Metadado compacto / entrelinha | 11 / 16 |
| Ícone principal / secundário | 16 / 14 |
| Controle visual / alvo de toque | 32 / 44 |
| Gap padrão / pequeno | 8 / 4 |
| Navegação inferior / ação central | 56 / 44 |
| Ícone / rótulo da navegação | 17 / 10 |

`OperationalText`, em `src/ui/OperationalText.tsx`, aplica corpo de 12 px quando
o texto operacional não tem tamanho explícito. O estilo do chamador prevalece;
textos operacionais aninhados conservam herança, refs, props nativas e ampliação de texto.
Importá-lo nas superfícies operacionais em vez de depender do tamanho implícito
de `Text` nativo. Não há override global de CSS nem alteração do renderer.

Controles visuais de 32 px mantêm área interativa de 44 px por composição, sem
sobrepor alvos vizinhos. A navegação compacta tem largura máxima de 440 px e
conserva a safe area. A escala não reduz os campos de 50 px, o bloco de auth de
440 px ou a geometria de canvas, gráficos, mídia e exportações. Entradas e
primitives especializadas preservam seus contratos e estilos explícitos.

A [rodada de 29/10](DENSITY_ROLLOUT_2026-10-29.md) registra cobertura de código,
exceções e validação local. A aplicação anterior na Agenda e na navegação é
histórica; o padrão atual abrange a UI operacional. Cobertura de código não
significa que cada rota tenha sido inspecionada visualmente.

## Espaçamento e superfícies

- Usar a escala `8, 12, 16, 20, 24, 32` de `src/theme/tokens.ts`.
- Usar `radius.internal`, `radius.card` e `radius.container`; não criar radius local.
- Preferir uma superfície principal com seções e separadores a cards aninhados.
- Cards operacionais partem de 10 px no mobile e 12 px no workspace, conforme
  `responsiveLayout.density.cardPadding`; conteúdo especializado pode exigir mais
  espaço para preservar campos, alvos e leitura.
- Sombras são último recurso; borda e contraste de superfície vêm primeiro.

## Ações

- Uma ação primária por região.
- Ação secundária usa contorno ou superfície neutra.
- Ação destrutiva é discreta até o momento de confirmação.
- Ações indisponíveis sem valor informativo devem ser ocultadas, não desabilitadas.
- Separar o tamanho visível do ícone e da superfície do alvo de toque; densidade
  compacta não dispensa toque, foco, teclado ou a ampliação de texto do usuário.

## Composição responsiva de produto

- Resolver dimensões pela viewport e pelo espaço real do container, usando as
  [capacidades compartilhadas](RESPONSIVE_RULES.md). Não escolher uma escala de
  componente diferente apenas por ele estar em outra tela ou plataforma.
- Fichas curtas acompanham o conteúdo, com altura máxima disponível e rolagem
  para conteúdo longo. Não preencher a janela com uma moldura vazia.
- Barras de navegação e ações flutuantes fazem parte da composição: sua reserva
  de espaço deve corresponder às dimensões reais e à safe area, sem encobrir a
  tarefa principal ou competir com outra ação fixa.
- Não corrigir proporções com `zoom` global, `transform: scale` na página,
  mudança de zoom do navegador ou desativação de escala de texto. Ajustar a
  geometria e o reflow dos elementos reais.
- Conferir página, ficha e navegação no mesmo viewport. A regra é transversal;
  uma rodada local registra somente as superfícies efetivamente verificadas.

## Estados

Loading, vazio e erro ocupam o mesmo espaço estrutural do conteúdo final. O texto
deve explicar situação e próximo passo sem termos internos, debug ou atribuição
redundante à IA.
