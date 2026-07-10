# Design QA — Regulamentos desktop

## Evidências

- Verdade visual: `C:\Users\gusta\AppData\Local\Temp\goatleta-web-foundation-audit\01-home-desktop.png`
- Comparação consolidada: `C:\Users\gusta\AppData\Local\Temp\goatleta-pr70-admin-qa\final-comparison.png`
- Desktop escuro: `C:\Users\gusta\AppData\Local\Temp\goatleta-pr70-admin-qa\admin-dark-1440x1024-final2.png`
- Desktop claro: `C:\Users\gusta\AppData\Local\Temp\goatleta-pr70-admin-qa\admin-light-1440x1024-final2.png`
- Tablet claro/escuro: `admin-light-834x1194.png` e `admin-dark-834x1194-final.png`
- Mobile claro/escuro: `admin-light-390x844.png` e `admin-dark-390x844-final.png`
- Modal mobile com foco: `admin-dark-modal-focus-390x844-final.png`
- Viewports solicitados: 1440×1024, 834×1194 e 390×844. O navegador interno aplicou sua escala mínima, e os limites foram conferidos pelo DOM no viewport efetivo.
- Estado: sessão administrativa real, Gustavo Workspace, fonte FIVB, uma versão e três cláusulas.

## Comparação visual

A Home e Regulamentos mantêm tipografia, superfícies, bordas, raios, contraste e densidade operacional da mesma família. A composição usa 8/4 e 6/6 no desktop e empilha antes de 1200 px. A comparação consolidada foi aberta como uma única imagem; os detalhes de foco e modal também foram inspecionados em captura dedicada.

## Histórico de iteração

1. P1 — overflow horizontal no mobile e bleed no cabeçalho.
   - Correção: `ResponsivePage` usa `border-box` e `minWidth: 0`; o cabeçalho compartilha largura/gutter do resolver.
   - Pós-correção: `scrollWidth <= innerWidth` nos três viewports e nos dois temas.
2. P2 — foco de teclado não era visível.
   - Correção: `Pressable` deixou de remover o outline web e os campos do modal ganharam borda primária de 2 px durante o foco.
   - Pós-correção: campo ativo medido com borda `rgb(61, 220, 132)` e captura mobile dedicada.
3. P2 — cláusulas eram apenas informativas e não podiam ser abertas.
   - Correção: cards viraram controles semânticos com modal de tipo, chave e valor base.
   - Pós-correção: abertura e fechamento da cláusula real foram exercitados no navegador.
4. P2 — URL longa dependia de largura implícita.
   - Correção: controle da URL ocupa a região disponível e mantém truncamento em uma linha.
   - Pós-correção: ausência de overflow confirmada nos três viewports.

## Superfícies obrigatórias

- Tipografia: família, pesos, hierarquia, wrapping e truncamento coerentes com a Home.
- Espaçamento: gutters oficiais, grids 8/4 e 6/6, empilhamento em tablet/mobile e ritmo de 16 px.
- Cores: tokens existentes verificados em claro e escuro; estados primário, sucesso e destrutivo preservados.
- Imagens/ativos: não aplicável; nenhum ativo visual foi substituído ou simulado.
- Copy: português brasileiro e rótulos operacionais.
- Acessibilidade: foco visível, controles semânticos para URL/cláusulas, modal utilizável e ações de permissão ocultadas.

## Interações e console

- Sincronização acionada com a fonte real.
- Edição aberta, campo focado, salvamento sem alteração e cancelamento exercitados.
- Remoção abriu confirmação e foi cancelada, preservando o dado real.
- Versão real selecionada; três cláusulas carregadas e uma aberta em detalhe.
- URL longa abriu a fonte oficial em nova aba.
- Comparação visual entre versões não apareceu porque o workspace possui somente uma versão; nenhum dado de produção foi fabricado. A condição de uma versão permaneceu estável.
- Console verificado sem erros.

## Findings

Nenhum P0, P1 ou P2 permanece. A única limitação ambiental é não haver uma segunda versão real para exibir a comparação; isso não bloqueia o layout ou os fluxos disponíveis.

## Follow-up polish

- P3 operacional: repetir apenas a comparação entre duas versões quando uma segunda versão real existir.

final result: passed
