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

As três setas representam alternativas de ataque. A animação organiza os
jogadores até o contato em 2,6 s, sem executar três ataques nem inventar defesa
bem-sucedida, colisão ou resultado. O atacante usa sua altura autoral uma única
vez. Os bloqueadores reutilizam salto e extensão de mãos do relógio canônico:
preparam no piso, flexionam e atingem 0,85 m no contato do azul (progresso 0,94),
mantendo as duas mãos acima da fita até o quadro final.

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

- `ensureCourtDefenseStep` acrescenta a etapa uma vez e retorna à existente nas
  próximas visitas. Preserva as etapas anteriores e seus atores/metadados.
  Conflitos de equipe, ocultação ou bloqueio recebem atores exclusivos da Defesa,
  com referências remapeadas. Novos atores não passam a aparecer implicitamente
  nas etapas anteriores; seis verdes pertencem à equipe A e o azul à B.
- `simulation.mode: "defense"` guarda bases iniciais em
  `defenseSettings.startPositions`. Destinos continuam em `actorPositions` e
  alturas em `actorElevations`. O sampler compartilhado alimenta 2D e 3D;
  guias físicos de levantamento/saque não são usados nesta etapa.
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
