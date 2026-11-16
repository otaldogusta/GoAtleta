# Altura autoral na quadra 3D

Pedido de 12/11/2026: elevar bola, materiais e jogadores, mantendo separado o
movimento pelo piso. Implementação local, sem publicação.

## Comportamento e documento

- Selecionar um item autoral no 3D mostra a alça `Altura`, com alvo de 44 px e
  valor em metros. Arrastar ajusta a vertical; arrastar o corpo mantém o movimento
  no piso. Setas do teclado ajustam 0,1 m, Shift ajusta 0,5 m e Home retorna a zero.
- O deslocamento vertical vai de 0 a 8 m acima da base visual existente. Zero
  preserva a representação anterior; não altera as coordenadas normalizadas da
  quadra. `CourtPoint.y` continua sendo profundidade, equivalente ao Z do 3D.
- `CourtDrawing.elevation` é opcional para bola, cone, alvo e escada.
  `CourtVisualStep.actorElevations` guarda a altura dos jogadores por etapa.
  Importação, cópia, duplicação, compartilhamento e histórico preservam esses
  campos. Excluir jogadores remove suas entradas; dados antigos continuam válidos.
- Uma conclusão de arraste gera uma edição. Escape, cancelamento de ponteiro,
  perda de foco e troca de contexto descartam a prévia. Leitura, reprodução,
  ocultação, bloqueios e seleção incompatível impedem mudanças.
- Jogadores e bola controlados pela simulação mantêm a altura do motor; a alça
  autoral não disputa esse movimento. O valor autoral armazenado é preservado.
- Setas ligadas à bola acompanham o início em X/Y/Z durante a prévia e após
  confirmar; as pontas permanecem fixas. Sem perfil autoral, a média vertical
  dos extremos determina o ponto intermediário das curvas ajustáveis.
  O refino de [trajetória autoral](QUADRA_TRAJETORIA_AUTORAL_3D_2026-11-12.md)
  acrescenta início/meio/fim em altura e materializa o Y ao soltar o vínculo,
  substituindo o comportamento anterior que devolvia a seta isolada ao piso.
- A sombra do jogador permanece no piso. Seleção, rótulos e picking acompanham
  o objeto elevado. O 2D conserva sua posição e ordem de camadas.
- A alça respeita cabeçalho, rodapé e ferramentas; se o objeto sai da tela,
  continua disponível na borda com ligação discreta. Ajustar à tela considera
  materiais e jogadores autorais elevados, inclusive junto de uma simulação.

O comando do iframe é `{ type: "elevation", id, value }`, no envelope existente
com origem, source, token e revisão conferidos. O host exige uma seleção atual,
única e editável na ferramenta de seleção; não recebe documentos do iframe.
Não há nova tabela, migration, rota nem gravação paralela.

## Validação local

Concluída localmente em 12/11/2026, nível 3 pela extensão compatível do documento
e integração de gestos, renderização e histórico. Revisão independente por leitura
encerrada sem achados pendentes. A revisão/conferência corrigiu a prévia da seta
desconectada, o enquadramento a 8 m, colisões da alça com controles e o plano de
arraste horizontal dos objetos elevados.

- 409 testes distintos: 374 Jest em 12 suítes e 35 Node em três arquivos.
  Testes executou 195 e reaproveitou 214 com hashes finais conferidos; não se
  somam os reruns nem os 298 da rodada anterior de vínculos.
- Tipos, organização, arquitetura strict e diff aprovados. Arquitetura: 1.387
  módulos, 5.813 imports, zero violações. O check de performance disponível filtra
  telas; não cobre estes componentes e não houve medição de ganho de desempenho.
- IAB em localhost, componentes reais com cena fictícia em memória: bola move
  todos os inícios mesmo com seta selecionada; altura por arraste em bola,
  jogador e cone; teclado, Home, desfazer/refazer; conservação de X/Z em 2D;
  bola a 8 m com alça acessível e reenquadramento; arraste horizontal da bola
  a 2 m acompanhando o ponteiro e mantendo as três ligações.
- Viewports configurados em 1307×857 e 390×844; no móvel o DOM mediu
  378,64×819,42 e a alça aproximadamente 44×44 px. Seleção pela lista de camadas,
  fechamento do painel e arraste da bola de 0 a 2,4 m conferidos sem sobreposição.
  O override foi restaurado. Isso não atesta toque em aparelho físico.

Evidências locais ignoradas pelo Git em `.tmp/work/quadra-mobile-20261111/`:
`height-validation-summary.md`, `height-validation-inputs-final.json`,
`altura-3d-desktop.png`, `altura-3d-mobile.png`, `altura-vinculo-2d.png` e
`court-height-qa-entry.tsx`. A entrada temporária servida foi removida; servidor
local preservado. Sem editar a jogada real para testes, build completo,
publicação ou exercício de persistência remota.

Conferência posterior na jogada indicada pelo usuário: a aba antiga mantinha a
alça oculta/desabilitada para uma bola autoral extra, apesar da seleção única.
O Metro encerrou por `JavaScript heap out of memory`; foi reiniciado localmente
com limite de 8 GiB para o processo, sem alterar configuração de produção.
Na aba reaberta, selecionar a mesma bola exibiu `Altura · 0,0 m` junto da
simulação de recepção. Evidência: `altura-3d-jogada-real-atualizada.png` no mesmo
diretório privado. A confirmação nesta rodada foi de seleção/visibilidade do
controle, sem elevar nem salvar alteração na jogada real. Não houve novo patch
de produto nem repetição dos testes anteriores.

Fontes: [comandos e parser](../../src/core/visual-court-editor.ts),
[projeção](../../src/core/visual-court-perspective.ts),
[bridge](../../src/components/visual-court/court-perspective-bridge.ts),
[workspace](../../src/components/visual-court/CourtWorkspaceView.tsx),
[renderer](../../public/visual-court-3d/renderer.mjs),
[prévia e guardas](../../public/visual-court-3d/renderer-elevation.mjs) e
[regressões do documento](../../src/core/__tests__/court-elevation.test.ts).
