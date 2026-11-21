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
