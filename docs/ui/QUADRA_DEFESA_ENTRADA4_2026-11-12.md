# Defesa contra ataque da entrada 4

Implementação local de 12/11/2026, a partir da formação montada pelo usuário.
A aba **Defesa** apresenta a organização dos seis verdes contra o atacante azul
da entrada de rede 4. Reutiliza o transporte e a amostragem canônica da quadra.

## Formação preservada

O [preset](../../src/core/presets/defense-zone4.goatleta.json) conserva os sete
destinos em coordenadas regulamentares completas, a altura autoral do atacante,
a bola e as três trajetórias ligadas a ela. A fonte foi a exportação editável da
quadra, capturada antes das alterações; não uma estimativa feita pela imagem.

Os bloqueadores são os dois verdes próximos à rede, diante do azul. Os demais
ocupam cobertura curta, diagonal curta, paralela e diagonal profunda conforme
os destinos autorais. As bases iniciais são uma preparação didática proposta;
não certificam rodízio, função permanente ou sistema regulamentar.

As três setas representam alternativas de ataque e partem do contato final.
Durante a reprodução, as alternativas ligadas à bola crescem do contato
da cortada até as pontas, em 2D e 3D. O traço acompanha o controle de
reprodução nos dois sentidos. No quadro final, a geometria autoral é
exibida integralmente com as alças de edição.
Em Play a 1×, a janela após o contato é de pelo menos 400 ms. O relógio
do passe e do levantamento até o contato continua igual. A duração
autoral da etapa e as posições do controle de reprodução são preservadas.
Os comparativos locais em claro e escuro registram o traço parcial e o
quadro final para os dois cenários em 2D e 3D no
[Inventário Visual](http://127.0.0.1:8096/inventario.html).
Ao reproduzir, a bola parte da posição 6 adversária em direção ao levantador
na 3. A saída do levantamento para a entrada 4 sinaliza o ajuste do bloqueio
e da defesa. Os dois apoios são gerados na amostragem da simulação, enquanto
o documento mantém os sete atletas autorais. A sequência termina no contato
azul, com o atacante na altura autoral e as mãos do bloqueio acima da fita.

A sombra laranja inicial da entrada é o desenho de cinco vértices ajustado
pelo professor. Na saída de rede (posição 2), o cenário e a área são
espelhados na largura da quadra. Entrada e saída são etapas independentes.
As alças continuam disponíveis no quadro de contato para ajuste manual.
Durante a reprodução em 2D e 3D, a sombra começa a aparecer na impulsão.
Conforme as mãos sobem, a borda avança da rede para o fundo e revela o
contorno completo no contato. Voltar na linha do tempo recua a sombra.
O seletor Entrada de rede / Saída de rede abre cada cenário no seu quadro
final e mantém as edições independentes. A prévia fictícia foi conferida
em 2D e 3D nos tamanhos 1034 × 857 e 390 × 844, em claro e escuro. No
desktop, os ajustes de cada lado sobreviveram à troca de cenário e à recarga.

## Sistemas de cobertura

Em **Defesa → Ajustes da jogada**, selecione **Entrada**, **Meio** ou
**Saída** na linha **Ataque**. Em **Cobertura**, selecione o sistema.
O topo da quadra reúne os modos Recepção, Ataque e Defesa.
Escolher um cartão em Etapas conserva o ponto de rolagem da lista e abre
o quadro final da Defesa diretamente.
Na bola rápida pelo meio, o central salta sozinho diante do ponto de ataque.
O jogador da direita recua para defender a bola curta. A sombra parte das mãos
do central. O quadro de contato usa as marcas ajustadas pelo professor.
As setas verde e amarela terminam perto das laterais esquerda e direita de
quem defende. A rosa chega mais fundo, à esquerda. Cada seta tem sua própria altura.
Em **Pela rede**, o jogador da rede que fica fora do bloqueio cobre a
largada. Em **Pelo líbero**, o líbero avança para a largada e o jogador
da rede recua para a diagonal. No 5×1, o ponteiro do fundo defende a
paragonal em ambas. No 6×0, a opção **Pelo fundo** atribui a largada ao
defensor que começa na posição 5 contra a Entrada ou o Meio, e ao defensor
da posição 1 contra a Saída. Na Saída, a 5 cobre a paralela e a 6 cobre a
paragonal.
O deslocamento começa na saída do levantamento.

Cada combinação tem uma etapa própria, com posições, sombra e trajetórias
editáveis no quadro final. A etapa criada em um sistema fica disponível
na lista de etapas. Documentos anteriores preservam a etapa original e
seus desenhos. Em leitura, é possível abrir os cenários já incluídos no
documento.

Em 20/11/2026, a [prévia local com dados fictícios](http://localhost:8081/quadra-mobile-qa-local.html?defense)
foi conferida em 2D e 3D a 1034 × 857. Play e Reiniciar partem do passe.
As capturas do início e do ajuste estão no
[Inventário Visual](http://127.0.0.1:8096/inventario.html).

Refinamento visual de 12/11: o rig compartilhado com Ataque mantém cotovelos e
mãos próximos à linha dos ombros ao estender, removendo a abertura exagerada em
Y. Naquela correção, altura, avanço das mãos, salto e relógio foram preservados. O envelope físico
de contato legado de 0,86 m continua aproximado; não foi recalibrado neste ajuste.
20 testes focados de Defesa passaram. Reprodução e destinos preservados foram
conferidos no IAB desktop; não houve nova validação em aparelho físico.

Refinamento seguinte: o bloqueador passou a ter corpo inteiro volumétrico no
Three, substituindo a combinação de tronco em PNG voltado à câmera e braços
em coordenadas da quadra. Tronco, cabeça, pernas, braços e cinco dedos por mão
compartilham a orientação do corpo; orbitar a câmera não altera suas juntas.
A preparação flexiona quadris e joelhos com os pés no piso, sem achatar o tronco.
Na Defesa, as mãos apontam para a rede a partir de qualquer metade da quadra.
Altura canônica das palmas, salto, relógio e destinos permanecem preservados.

## Contrato

- `ensureCourtDefenseStep` acrescenta cada cenário uma vez e retorna ao existente
  nas próximas visitas. Preserva as etapas anteriores e seus atores/metadados.
  Conflitos de equipe, ocultação ou bloqueio recebem atores exclusivos da Defesa,
  com referências remapeadas. Novos atores não passam a aparecer implicitamente
  nas etapas anteriores; seis verdes pertencem à equipe A e o azul à B.
- `simulation.mode: "defense"` guarda bases iniciais em
  `defenseSettings.startPositions`. Destinos continuam em `actorPositions` e
  alturas em `actorElevations`. O sampler compartilhado fornece a bola e os
  apoios da preparação às vistas 2D e 3D. Passe e levantamento são guias de
  reprodução, e as três alternativas continuam ligadas ao ponto final.
- A normalização mantém a precisão completa das coordenadas de Defesa.
  Importação, exportação e serialização preservam a formação e os vínculos.
- Defesa abre no quadro de contato, inclusive após carregar um rascunho.
  Play reinicia a organização. Scrub, pausa, velocidade e câmera continuam
  disponíveis; edição espacial fica disponível no quadro final, evitando
  alterar um destino enquanto se vê uma posição intermediária.
- Entrada em documento/etapa acompanha carregamento e abertura. A atribuição
  do ID pelo primeiro autosave não reinicia a reprodução nem o progresso.
- No quadro final, altura, arraste e vínculos autorais permanecem editáveis.
  O bridge mantém origem/token/revisão, seleção, bloqueios e limites existentes,
  e rejeita handles de saque/ataque que não pertencem ao modo Defesa.
- O salto é derivado da ação `block`, separado da elevação autoral e dos destinos
  X/Z. Não grava altura adicional no documento nem afeta outras ações. O volume
  de seleção acompanha o corpo elevado, sem selecionar o espaço vazio sob os pés;
  sombras continuam no piso e a alça edita apenas a altura autoral.
- O bloqueador usa os próprios meshes para seleção/hover, incluindo mãos e
  tronco. O espaço entre os braços e abaixo dos pés não vira área selecionável.
  Geometrias são reaproveitadas dentro de cada rig, preservando seu descarte.
- Em leitura, a aba abre somente uma Defesa que já pertence ao documento.
  Não acrescenta o preset ou habilita propriedades autorais.

## Ação do jogador

`CourtVisualStep.actorActions` é um mapa opcional de ações por ID de jogador:
`ready`, `defend`, `block`, `attack`, `set` e `serve`. A ação é independente de
`actor.role` (função esportiva), posição, cor e equipe. **Automática** remove a
escolha explícita. Propriedades oferece as ações com controles de 44 px.

Jogadores autorais e participantes da Defesa aceitam essas escolhas. Jogadores
controlados pelas simulações de Recepção/Ataque continuam com a ação definida
pelo motor. Bloqueio/ocultação, desfazer e cópias preservam suas guardas.

O parser valida o enum e as referências. Compartilhamento passa pelo mesmo
parser e sua projeção existente preserva a timeline; não foi criada migration
para estes campos. Esta revisão não certifica ativação ou gravação remota.

## Evidência e limites

Conferência local no navegador integrado do Codex: desktop 1124 × 857 e viewport
móvel 379 × 819. Reprodução completa chegou aos sete destinos, com bola e câmera
estáveis. Troca de ação e desfazer conferidos; controles móveis mediram cerca de
44 px. A formação original e o ensaio ficam em artefatos locais privados.

Exportação pela UI confirmou igualdade exata dos sete destinos/alturas, da bola
e das três trajetórias com o original. Reabrir o ensaio local preservou a formação
e abriu Defesa no contato. A persistência dessa fixture usa apenas a sessão do
navegador; a cópia editável também foi exportada para arquivo.

Na entrega inicial, 373 testes distintos em 11 suítes focadas, tipos, escopo organizacional,
arquitetura strict e diff passaram. O filtro de perf-hygiene não inclui os
componentes/core afetados; não representa benchmark. Revisão independente
encerrou sem achados pendentes.

Rodada do salto sincronizado: 54 testes distintos (22 de Defesa, 18 da projeção,
14 do picking), tipos e diff aprovados; revisão por leitura sem achados pendentes.
IAB confirmou preparação no piso, subida antes do contato, ápice dos dois
bloqueadores junto ao ataque, seleção junto às mãos e destinos preservados.
Reprodução conferida no desktop e viewport móvel; não é teste de toque físico.

Rodada do corpo volumétrico: 85 testes distintos (6 de rig, 15 de seleção,
13 de elevação, 10 de geometria, 23 de Defesa e 18 de projeção), tipos e diff
aprovados; revisão independente por leitura sem achados pendentes. IAB desktop
1124 × 857 conferiu frente, lateral, costas e ângulos oblíquos/altos, flexão
de preparação e clique nas mãos. Em viewport 379 × 819, Play voltou ao contato
com ambos em salto de 0,85 m, extensão completa e mãos orientadas para a rede.
Não foi realizado benchmark GPU ou teste em aparelho físico nesta rodada.

O [código público do SetOptics](https://github.com/dawsonpar/SetOptics/tree/2f07288d389750d9d4cf97a30c8f5a0c2e46e6a7/visualizer)
foi consultado: não fornece um rig de jogador no visualizador. A consulta ao
catálogo do Higgsfield não retornou animação de voleibol; nenhuma geração ou
upload foi executado. O novo bloqueador é geometria local, sem novo asset externo.

A rota autenticada indicada exibiu somente “Voltar”; não foi possível validar
salvamento na turma real. Não houve escrita de teste em dados reais, build ou
publicação. Viewport móvel não substitui teste em aparelho físico.

## Implementação

- [Preset e entrada idempotente](../../src/core/court-defense-preset.ts)
- [Amostragem da organização](../../src/core/court-defense-motion.ts)
- [Corpo volumétrico do bloqueador](../../public/visual-court-3d/blocker-rig.mjs)
- [Testes da anatomia e orientação](../../public/visual-court-3d/blocker-rig.test.mjs)
- [Ações e normalização](../../src/core/court-actor-actions.ts)
- [Propriedades de ação](../../src/components/visual-court/CourtActorActionPicker.tsx)
- [Testes do contrato](../../src/core/__tests__/court-defense.test.ts)
