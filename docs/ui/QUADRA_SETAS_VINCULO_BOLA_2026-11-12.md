# Início das setas ligado à bola — implementação local

Pedido de 12/11/2026: conectar os inícios das setas à bola para compor os raios
da sombra do bloqueio. A ligação acompanha a bola, mantendo os destinos.

## Contrato do ajuste

- Arrastar a alça inicial de uma seta reta/curva para perto de uma bola visível
  encaixa no centro; afastar essa alça solta o vínculo. Iniciar uma nova seta
  sobre a bola usa a mesma ligação. A prévia mostra o encaixe antes de confirmar.
- Depois de ligar, a corrente inicial fica fora do corpo da bola, com alvo de
  44 px e linha fina até o início real. Arrastar o corpo da bola leva todos os
  inícios ligados mesmo quando uma seta está selecionada; arrastar a corrente
  solta apenas essa seta, sem salto. Camadas alheias acima continuam prioritárias.
- Meio, ponta e atalho de endireitar preservam o vínculo. Mover a seta inteira
  sozinha solta; mover bola e seta juntas conserva a ligação sem deslocamento duplo.
- Uma ação concluída gera uma edição no histórico. Cancelar ou trocar de
  contexto descarta o gesto; leitura e bloqueios impedem edição direta.
- Uma bola bloqueada pode receber ligações sem ser alterada; bola oculta não é
  candidata ao encaixe. Uma seta bloqueada continua seguindo a bola por seu
  vínculo, mas não aceita edição direta.
- Excluir a bola solta as setas na posição visível. Duplicar só a seta mantém
  sua bola; duplicar ambas remapeia o vínculo. Cópia entre etapas sem a bola
  solta a referência, preservando a geometria; com a bola, remapeia para a cópia.

## Dados e renderização

`CourtDrawing.startBallId` é opcional, exclusivo de `arrow`/`curve` e referencia
um desenho `ball` da mesma etapa. A importação descarta referências inválidas.
Os pontos continuam sendo a geometria de referência; documentos antigos não
recebem vínculo por proximidade automaticamente.

`frameDrawings` mantém acesso ao documento. O resolver puro compartilhado
atualiza o início usando a bola; curvas `through-point` ajustam o meio por
um quarto do deslocamento inicial, preservando o controle da curva dentro dos
limites autorais; o ponto intermediário continua limitado como nas alças. A amostra
visual resolve a ligação após movimento/simulação, inclusive na projeção 3D.
No 3D, o início usa a altura real da bola; a ponta continua no piso. O contrato
vertical e a validação posterior estão em
[Altura autoral](QUADRA_ALTURA_3D_2026-11-12.md).

Sem nova tabela, migration, rota ou gravação paralela. O campo acompanha o
documento e seus comandos existentes de histórico e salvamento.

## Validação

Concluída localmente em 12/11/2026. Nível 3 pela extensão compatível do documento
e integração dos comandos, renderizadores e gestos. Implementação dividida entre
UI e core; Revisão independente por leitura sem achados finais. Durante a revisão,
a alça de uma seta ligada à bola oculta/animada foi alinhada ao desenho amostrado,
com regressão específica.

- 298 testes distintos em 12 suítes: 167 complementares executados por Testes,
  19 do core e 47 de alças + 65 de workspace/mobile reaproveitados com hashes
  finais conferidos. Cobrem referências, cópias, exclusão, movimento, animação,
  compartilhamento, histórico e concordância 2D/3D.
- `typecheck:app`, `check:org-scope`, `check:architecture:strict` e diff aprovados.
  Arquitetura: 1.385 módulos, 5.801 imports, nenhuma violação. Perf-hygiene não
  cobre estes arquivos: o helper filtra `app/` e `src/screens/`; não foi feita
  medição de desempenho ou alegação de ganho.
- IAB com componentes reais e cena fictícia em memória: dois inícios ligados
  à mesma bola, movimento mantendo as pontas, desfazer/refazer, excluir bola
  mantendo geometria, soltar ligação, ligar curva e endireitar preservando vínculo,
  nova seta iniciada na bola e representação 3D conferidos visualmente.
- Viewport móvel configurado em 390×844: prévia de encaixe, conclusão e movimento
  da bola conferidos. Alças medidas em aproximadamente 44×44 px. Override
  restaurado após o ensaio; quadra do usuário mantida aberta no Codex.

Evidências ignoradas pelo Git em `.tmp/work/quadra-mobile-20261111/`:
`setas-ligadas-bola-desktop.jpg`, `setas-ligadas-bola-3d.jpg`,
`setas-ligadas-bola-mobile.jpg` e `court-arrow-ball-qa-entry.tsx`.
A entrada temporária servida foi removida após a conferência. A jogada do usuário
não foi alterada para testar. Aparelho físico, persistência remota e publicação
não foram exercitados.

Fontes: [core e parser](../../src/core/visual-court-editor.ts),
[amostra 2D](../../src/core/court-simulation-display.ts),
[perspectiva](../../src/core/visual-court-perspective.ts),
[gestos](../../src/components/visual-court/CourtEditorCanvas.tsx),
[workspace](../../src/components/visual-court/CourtWorkspaceView.tsx) e
[testes do vínculo](../../src/core/__tests__/court-arrow-ball-anchor.test.ts).
