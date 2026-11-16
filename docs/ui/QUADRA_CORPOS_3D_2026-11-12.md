# Corpos articulados da quadra 3D

Refinamento local de 12/11/2026. O corpo volumétrico aprovado no bloqueador
passa aos demais jogadores, preservando documento, posições, ações e relógio.

## Contrato visual

- `actor-anatomy.mjs` concentra a anatomia local, com tronco, cabeça, pernas,
  braços, mãos e cinco dedos. Geometrias são reaproveitadas dentro da instância
  e descartadas com ela. Não há novo asset, dependência ou carregamento remoto.
- `actor-rig.mjs` interpreta as poses já fornecidas por Recepção, Ataque,
  Defesa e ações autorais: preparar, defender, bloquear, atacar, levantar e
  sacar. `previousPose` e `poseBlend` interpolam juntas, sem outro relógio.
- `facing` orienta o corpo na quadra, independentemente da câmera; `mirror`
  preserva o lado dominante. A elevação autoral pertence ao grupo externo,
  enquanto `jump` é aplicado uma única vez ao corpo. O bloqueador conserva
  sua escala, extensão, flexão e altura canônica das palmas.
- Nos contatos, a bola canônica pode orientar as mãos dentro do alcance
  permitido. Esse alvo é transitório no renderer: não muda jogador, bola,
  simulação, histórico ou dados salvos. Fora de alcance, vale a pose existente.
- Seleção e hover usam os meshes do corpo em todos os papéis. Sombras de
  contato e seleção ficam fora do picking. Câmera, gestos, alças de altura,
  ocultação, bloqueio e renderização por invalidação continuam no mesmo fluxo.

## Área tática da Defesa

A área laranja era uma anotação manual na jogada aberta. Sua cópia foi
preservada pela exportação antes de corrigir apenas os vértices. O novo
envelope parte da linha dos extremos externos das palmas dos dois bloqueadores,
segue os raios em planta a partir da bola e é recortado à metade defendida.
ID, cor, tracejado e demais objetos/etapas são preservados.

É uma referência tática do conjunto, sem afirmar que o vão entre os jogadores
esteja fisicamente fechado. A área continua manual: mover bola ou bloqueadores
não recalcula seus pontos. Não foi acrescentado campo persistido ou substituído
o preset original. Cópia e conferência ficam nos artefatos locais de QA.

## Validação

Nível 2 da escada. 130 testes distintos passaram: 18 de anatomia/poses,
16 de seleção/hover, 13 de altura, 10 de geometria, 5 de Recepção, 27 de
paridade de Ataque e 41 de Defesa/projeção. Tipos e diff aprovados. Revisão
independente por leitura sem achados pendentes no produto.

No IAB desktop 1124 × 857 foram conferidos corpos completos, giro de câmera,
contato do azul, reprodução da Defesa/Ataque/Recepção e seleção/arraste do
atacante elevado. Desfazer devolveu exatamente as posições e a câmera ficou
estável durante o arraste. A área corrigida foi importada pela UI e exportada
novamente: somente seus pontos e defaults de parser (`text`, `locked`) mudaram.
A cópia local da fixture foi atualizada com esse documento preservado.

O navegador interno ficou indisponível antes da rodada móvel. Nova tentativa
de reabertura também ficou indisponível; viewport móvel, toque físico e GPU
permanecem pendentes nesta rodada. Não houve publicação ou escrita em turma real.

Medida sintética comparável dos 12 atores (atualização e matrizes, sem GPU):
mediana 0,080 → 0,158 ms, com 8.240 → 49.080 triângulos visíveis. O custo de CPU
aumentou; esse recorte não mede FPS nem certifica fluidez móvel. Relatório,
fontes congeladas e hashes em `actors-validation.md` no diretório privado
`.tmp/work/quadra-defense-zone4-20261112/`.
