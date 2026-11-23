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

## Refinamento das animações em 20/11/2026

Aproximação, plantada, armação, contato, acompanhamento e aterrissagem
compõem a cortada. Durante a aproximação, quando a pose atual e a anterior
são `approach`, o blend carrega o progresso das passadas para o rig 3D.
A projeção 2D segue usando a chave da pose. A manchete destaca a plataforma
dos antebraços. O levantamento distingue preparação, extensão e direção
de saída. No bloqueio, a preparação dos cotovelos e a extensão das mãos
preservam a posição das palmas usada pela simulação.

A animação usa as malhas e o relógio existentes. A passada é cinemática e
acompanha a trajetória do jogador. O apoio pode deslizar no piso porque o
rig não fixa o pé em coordenadas de mundo.

A [prévia com dados fictícios](http://localhost:8081/quadra-mobile-qa-local.html?defense)
usa os componentes da quadra. A comparação no
[Inventário Visual](http://127.0.0.1:8096/inventario.html) inclui seis instantes
no modo Ataque, a 390 × 844, em claro e escuro. Em Chromium com renderização
por software, ambos os temas mantiveram 324 chamadas de desenho, 25.968
triângulos e intervalo mediano de 33,3 ms entre quadros renderizados. O
tempo mediano de CPU do renderer foi de 3,0 → 2,3 ms no escuro e
2,5 → 2,8 ms no claro. As medidas não cobrem GPU ou toque em aparelho físico.

## Sincronia da cortada no Ataque

O sampler usa o ápice real da parábola do levantamento, inclusive com
altura editada, para ajustar a impulsão antes do contato. O ponto alto da
bola orienta a preparação. O ápice do salto do jogador fica próximo da
batida, e a mão usa o ponto de contato já fornecido pela simulação.
Levantamentos rápidos mantêm uma janela de impulsão compatível com
o tempo disponível.

As poses passam pela plantada com braços atrás, subida dos dois braços,
armação do cotovelo dominante com a mão guia alta, aceleração até a
extensão de contato, acompanhamento e aterrissagem. A sequência usa o
mesmo relógio do levantamento e preserva a trajetória da bola.
O atacante 3D usa a animação da cena editável **Go Atleta - Cortada com
cotovelo suave**. No quadro 132 o pé sai do chão. No 141 o braço está
armado e no 145 a palma dominante encontra a superfície da bola. O ajuste
gradual da posição do corpo durante o voo conserva o percurso da mão
antes e depois da batida. No Ataque, o quadro 159 marca a aterrissagem e
o 172 encerra a recuperação. Na Defesa, o quadro 145 permanece visível
enquanto a etapa exibe as opções de direção da cortada.
Referência de fases: [Reeser et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC3445065/).

A aproximação segue a direção do deslocamento. A plantada termina com
o pé oposto ao braço de ataque e o corpo gira de forma contínua para
a perpendicular à direção horizontal do levantamento, voltado para a
rede. A sequência adotada é esquerda–direita–esquerda para o destro e
direita–esquerda–direita para o canhoto, conforme o
[manual de minivôlei da FIVB](https://www.fivb.org/en/development/document/fivb_mini_volleyball_handbook.pdf).
O lápis do jogador oferece **Destro** e **Canhoto** em **Mão de ataque**.
Jogadores sem preferência usam a passada de destro em qualquer posição.
No Ataque 3D, o deslocamento do quadril, o salto e os apoios vêm da captura.
A quadra ajusta o percurso entre o ponto de partida e o contato com a bola.
O relógio do levantamento mantém o quadro 145 sincronizado com a cortada.

Na prévia fictícia do Ataque 4, o atacante estava a 0,284 m no quadro
do ápice e a 0,894 m perto do contato, com a palma a 0,120 m do centro
da bola. Ao elevar o levantamento pela alça, a impulsão voltou a anteceder
o pico da bola. Comparativos em claro e escuro no
[Inventário Visual](http://127.0.0.1:8096/inventario.html).

Para atualizar a captura após editar a cena, execute o comando do cabeçalho
de `scripts/export-court-attack-clip.py` com o arquivo Blender revisado.
O exportador grava as articulações em milímetros e identifica a cena pelo
SHA-256. O renderer interpola esses dados sobre as malhas existentes.
Na validação local de 21/11, a batida foi conferida ao reproduzir,
retroceder e alterar a altura do levantamento de 1,80 m para 2,16 m.

## Área tática da Defesa

O padrão atual é a faixa tática ajustada pelo professor no piso. Os cinco
vértices exportados são a referência da entrada 4. A saída de rede usa
o mesmo desenho espelhado. Cada cenário guarda a área como um polígono
com alças de edição no quadro final.

### Projeção geométrica anterior

A área laranja da revisão anterior representava o envelope das palmas no contato da cortada.
O contorno começa nas projeções em planta das palmas externas. Os raios que
passam do contato da bola pelas palmas até o piso determinam a abertura e a
profundidade. O polígono fica recortado à metade defendida.

No quadro de contato dessa revisão, duas guias 3D mostravam os raios saindo das palmas
até o piso ou a linha que recorta a área, o que vier primeiro.
As guias geométricas deixavam de aparecer se o polígono divergisse da projeção.

Em 20/11/2026, as guias foram conferidas na prévia local a 1034 × 857,
em claro e escuro e com rotação da câmera. O contorno em planta da
fixture já coincidia com a projeção. O arraste e desfazer/refazer
foram conferidos pelas alças. Os pares estão no
[Inventário Visual](http://127.0.0.1:8096/inventario.html).

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
## Calibração dos levantamentos do Ataque

O piso da cena, o pouso da bola e a altura dos jogadores partem de y=0.
A rede padrão usa a referência masculina adulta, com 2,43 m na face
superior da faixa, 1 m de altura total, faixa superior de 7 cm e
inferior de 5 cm. A malha e o aviso de trajetória usam as mesmas medidas.
A física da cortada usa uma aproximação arredondada para a faixa superior.
O rig do atacante usa a elevação da simulação; o ajuste de contato afina
a posição no ar para encostar a palma na superfície da bola. Os 3,00 m
de contato da cortada são uma referência do modelo.
[Regras da FIVB 2025–2028, seções 2.1–2.5](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf).

O ápice é a maior altura da bola medida desde o piso. O voo começa na
soltura do levantamento e termina na cortada. Na quadra padrão, a bola sai
a 2,28 m e o encontro com a mão ocorre a 3,00 m. O tempo é o mesmo com ou
sem passe e uma eventual extensão do replay também o preserva.

| Levantamento | Ápice | Voo | Como ler a trajetória |
|---|---:|---:|---|
| Bola alta na entrada | 4,46 m | 1,20 s | Arco alto e longo até a 4, com tempo para preparar a aproximação. |
| Chutada na entrada | 3,35 m | 0,78 s | Mesmo corredor da 4 com arco baixo e mais velocidade lateral. |
| Tempo cabeça | 3,02 m | 0,29 s | Trajeto curto à frente do levantador. Atacante já iniciou o salto quando a bola sai. |
| Chutada de meio | 3,13 m | 0,51 s | Mais aberta em direção à entrada do que a cabeça. Atacante antecipa a aproximação. |
| Meia bola no meio | 3,61 m | 0,76 s | Arco intermediário próximo ao levantador, com mais tempo para chegar. |
| Bola alta na saída | 4,56 m | 1,20 s | Arco alto para trás do levantador, até a 2. |
| Chutada na saída | 3,27 m | 0,68 s | Bola mais baixa e rápida até a 2. O corredor é mais curto a partir do levantador padrão. |
| Pipe | 3,66 m | 0,88 s | Bola para a 6, mais afastada da rede. A impulsão é atrás dos 3 m e o voo do atleta avança. |
| Pipe rápida | 3,20 m | 0,60 s | Mesmo corredor da 6, arco mais baixo e chegada mais cedo. |
| Tempo costas | 3,05 m | 0,31 s | Curta atrás do levantador para o central. |
| Metro (sete) | 3,16 m | 0,45 s | Rápida à frente, mais aberta que a Tempo cabeça. |
| China | 3,23 m | 0,54 s | Central corre para a saída, impulsiona com um pé e se desloca no ar. |
| Fundo 1 | 3,58 m | 0,83 s | Oposto recebe uma bola rápida pelo corredor da 1, com impulsão atrás dos 3 m e avanço no ar. |

Os números são referências da animação. O modelo usa um arco parabólico
editável e tempos de voo calibrados por jogada. Fontes de ensino e estudos
de jogo sustentam as diferenças de direção, trajetória e coordenação.
O estudo biomecânico a seguir mede o gesto do levantador, de modo que seus
tempos descrevem o movimento estudado, enquanto a tabela mede o voo da bola.
[Tempos de ataque e tipos de levantamento, R17](https://ricardinhovolei.com/toque-do-mentor/tempos-de-ataque-e-levantamento/),
[estudo da Superliga feminina](https://www.scielo.br/j/refuem/a/83CV5qBRBLhjLQNN7XzzWwB/) e
[protocolo biomecânico de levantamentos](https://www.mdpi.com/2409-9279/9/1/6).

## Refinamento dos apoios e da aterrissagem

- Na passada final da cortada, o quadril segue o avanço e a transferência
  lateral de peso capturados no Blender. O rig preserva a altura do quadril
  e ajusta o alcance dos pés à distância entre as alças. O quadro 104 marca o
  penúltimo apoio e o 117, o fechamento com o pé oposto à mão de ataque.
  Ao ajustar a passada, o joelho flexiona para a frente em relação à pelve.
  Nos trechos de perna quase estendida, a quadra corrige a direção da dobra
  ao redor do eixo quadril–tornozelo e mantém o pé no apoio da captura.
  Se a distância excede o alcance dessa passada, o atacante ganha passos de
  aproximação antes de entrar nela. Na China, a perna livre sobe. Na Pipe e
  no Fundo 1, o último apoio fica atrás da linha de 3 m.
- No Blender, a cortada toca com o antepé no quadro 159, baixa o calcanhar
  e absorve a queda com joelhos e quadril. A exportação local reduz 5.473
  amostras a 218 poses, com erro máximo de 2,997 mm e arquivo de 45,5 kB.
- O bloqueio duplo amortece o pouso depois de encerrar a janela de colisão das mãos.
- Nas corridas de recepção e nos ajustes de defesa sem salto, os passos
  alternam apoios no piso. A altura do pé em balanço usa o perfil normalizado
  dos quadros 37 a 89 da corrida CMU 16_35, medido na importação BVH do Blender.
  Os deslocamentos gerais usam nove amostras da curva de altura. No P1, a corrida
  do levantador usa o ciclo dos quadros 48 a 150, com braços, tronco e pernas.
  A quadra sincroniza o ciclo com os apoios e mantém o pé externo fixo no corte
  para a rede. [CMU Graphics Lab](https://mocap.cs.cmu.edu/) ·
  [Conversão BVH](https://github.com/una-dinosauria/cmu-mocap).
