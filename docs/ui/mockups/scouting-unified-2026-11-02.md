# Scouting e estúdio unificado — proposta visual

Artefato isolado: [HTML autônomo](scouting-unified-2026-11-02.html). Sem recursos
remotos, APIs, câmera real ou gravação. A barra permanente identifica todos os
números e imagens como ilustrativos. Nenhum arquivo de aplicação foi alterado.

## Estados para revisão

- `?view=overview`: rendimento e histórico; uma entrada **Estúdio**.
- `?view=studio&mode=video`: jogo escolhido, vídeo e ponto do scouting juntos.
- `?view=studio&mode=registrar`: placar, desfazer e coleta no painel contextual.
- `?view=studio&mode=camera`: conexão do celular; QR explícito de demonstração.

Os modos, seletor de jogo, pontos, camisas, resultados, trajetória e simulação
da câmera respondem a cliques. Registrar/desfazer altera somente a memória do
mockup. Voltar retorna ao resumo. A largura real muda a composição; no celular,
ações de ponto ficam fixas com reserva de espaço e a navegação geral sai do
estúdio. Configurações permanecem recolhidas, sem empilhar modais.

## Contrato sugerido para uma implementação futura

| Região | Props/estado compartilhados |
| --- | --- |
| Resumo | `scope`, `context`, `period`, `metrics`, `history`, `selectedSessionId`, `onOpenStudio` |
| Cabeçalho do estúdio | `session`, `activeMode`, `onModeChange`, `onSelectSession`, `saveStatus` |
| Mídia e timeline | `videoSource`, `recording`, `playback`, `selectedPointId`, `onSeek` |
| Painel contextual | `mode`, `point`, `contacts`, `roster`, `reviewState`, `cameraStatus`, callbacks autorizados |

Trocar de modo não deve remontar captura, processamento ou rascunho. A mudança
real de jogo continua com a guarda de rascunho existente. Cada modo mostra as
ações pertinentes ao mesmo contexto, sem duplicar navegação Rallies/Contatos/
Scouting/Informações em painéis paralelos.

## Tokens e primitives

Usados como referência: `semanticColors.dark`, `brandPalette`, `spacing`,
`radius` e `compactUiMetrics`. Navy `#0E1729`, fundo profundo `#0A1322`, superfície
`#162033`, elevado `#1B263A`, verde `#3DDC84`, âmbar `#F2A03D`; bordas de 12%.
Título 20, seção 16, corpo 12, metadado 11, ícones 16; escala 8/12/16/20/24/32.
Raio interno 12, card 14, container 16. Sem fonte remota, zoom global ou sombra
como estrutura principal.

Reutilizar `ResponsivePage`, `useResponsiveLayout`, capacidade de container,
`StudioAction`, seletores e componentes de campo já aprovados. Preservar alvos
de 44 px e escala de texto na implementação; as medidas do HTML são uma proposta
visual, não certificação das primitives finais.

Validação realizada: sintaxe do JavaScript inline e ausência de URLs remotas.
Root fará a inspeção visual/interativa desktop e mobile antes de apresentar.
