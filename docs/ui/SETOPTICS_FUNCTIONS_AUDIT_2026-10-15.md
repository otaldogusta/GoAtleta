# SetOptics — funções observadas e evolução da quadra

Auditoria de 15/10/2026 para orientar o mockup independente do Go Atleta.
Referências: [Visualizer](https://app.setoptics.com/visualizer) e Library,
acessada pela navegação do produto. Estado local anterior descrito no
[registro do mockup](QUADRA_PERSPECTIVA_MOCKUP_2026-10-15.md).

“Exercitado” significa que uma ação e seu resultado foram observados no navegador.
“UI observada” confirma a presença do controle ou informação, sem comprovar todo
o fluxo. A inspeção não revela o código, o modelo físico nem as regras internas
do SetOptics. Este documento não certifica paridade integral.

## Matriz funcional

| Área | Evidência na referência | Situação do mockup / oportunidade |
| --- | --- | --- |
| Ataque Indoor | UI observada: camadas Attack, Pass e Block; presets `4`, `go`, `31`, `1`, `2`, `5`, `red`, `pipe`, `bic`; 1, 2 ou 3 bloqueadores. | Controles e animação próprios já presentes. Comparações anteriores não comprovam todos os ângulos ou contatos. |
| Arco do levantamento | Exercitado: arrastar o marcador do ápice muda o arco do levantamento. | Implementado localmente: alças de altura do passe/levantamento, ponto de ataque e alvo da cortada. Arraste e edição por teclado exercitados, incluindo vista lateral/orbital. |
| Direção e contato com bloqueio | Exercitado: arrastar a alça de direção altera o guia azul livre para guia vermelho com X de contato. Em um ângulo a bola retorna à própria quadra; em outro, cruza para a quadra adversária. | Implementado localmente: alvo editável, ângulo global/individual das mãos e contatos sucessivos com retângulos finitos. Guia e bola usam a mesma trajetória resolvida, incluindo rebotes na rede e fita. Modelo próprio, sem equivalência garantida ao original. |
| Rede e contatos sucessivos | Inicialmente o arraste não produziu resultado verificável. Na revisão posterior, configurações exportadas por Share permitiram isolar e capturar mãos, malha e fita em 59 quadros amostrados, incluindo ataque livre. Isso não revela os parâmetros internos do original. | Malha finita, fita arredondada, bordas e contatos sucessivos implementados. Amortecimento refinado pela comparação; faixas das mãos acompanham a pose e há quique no piso. Os casos anteriores de ângulos são históricos: nova calibração pode mudar o resultado da mesma configuração. |
| Ataque 9-man | UI observada: até 6 bloqueadores; ciclo de presets `4`, `go`, `31`, `t-ball (2)`, `fast-hook`, `5`, `red`; indicação `Custom` após edição. | Pendente. O seletor local anterior apenas alargava a quadra; não comprova formações, presets, seis bloqueadores ou comportamento próprio do formato. |
| Câmera e guias | UI observada: Front, Side e Orbit; Guides Show/Hide. | Controles locais presentes. Incluir alças e indicações de contato na conferência visual das três vistas. |
| Reprodução | UI observada: play/pause, rewind, scrub e velocidade; duplo clique na velocidade restaura o padrão. | Controles locais presentes. Colisão e continuidade exercitadas em reprodução e scrub reverso; testes com/sem passe. |
| Desfazer / refazer | Não auditado na referência nesta etapa; solicitado diretamente para o protótipo. | Ctrl+Z / Ctrl+Shift+Z implementados para novas edições de quadra, um passo por gesto, câmera preservada e replay restaurado. Histórico em memória de até 80 passos, sem recuperar mudanças anteriores ou desfazer exclusão de listas salvas. |
| Saved / coleções | UI informa pastas locais ao navegador, por atacante. Campo `+ new` observado; criação não confirmada por ação resultante. | O mockup tem lista plana em localStorage, com salvar/carregar/excluir exercitados em rodada anterior. Pastas, nomes por atacante e equivalência de coleções pendentes. |
| Recepção e tutorial | Formações, sistemas, rodízios, saque, alvos e tutorial foram conferidos em rodadas anteriores da sessão. Não foram o foco desta nova auditoria de física do ataque. | Preservar testes e controles existentes. Não apresentar essas conferências anteriores como auditoria atual de colisão. |
| Library / envio de vídeo | UI observada: upload Indoor/9-man; MP4/MOV até 5 GB, H.264/H.265; aviso de e-mail quando pronto. Envio e processamento não executados. | Pendente; fora da implementação atual do mockup. Não inferir pipeline, precisão ou processamento a partir da tela de envio. |
| Library / consulta | UI observada: busca, ordenação Newest/Oldest/Name e jogo de exemplo com View Analysis. A tela pública de análise do exemplo foi inspecionada; processamento de um vídeo novo não validado. | Pendente. O mockup apenas mantém acesso externo à Library. |
| Análise / navegação de vídeo | UI observada no SampleGame: avanço/retorno de quadro por vírgula/ponto; busca de 5 s por setas; Play rallies only; 3 rallies detectados, anterior/próximo, adicionar/editar; renomear, compartilhar, tela cheia/lista e exportar edição de rallies com cota de 5/dia. Nenhuma edição, exportação ou publicação executada. | Comparar com o Estúdio de vídeo de scouting já existente no Go Atleta; integrar oportunidades ao seu fluxo e contrato, sem criar um editor paralelo. |
| Análise / marcações e filtros | UI observada: marcação no instante atual por teclas `1` Serve, `2` Reception/Pass, `3` Set, `4` Attack, `5` Block, `6` Freeball; favoritos por rally; filtros All/Favorites/Serve/Reception/Set/Attack/Block/Pass/Freeball. Nenhuma anotação ou favorito gravado. | Avaliar atalhos, favoritos e filtros no Estúdio existente, preservando contatos/pontos oficiais, rascunhos, identidade da mídia e autorização. A presença da UI não comprova precisão das detecções ou persistência. |

## Lacunas locais identificadas antes desta implementação

- A cortada tinha destino fixo em `x = ±2,6`, `z = -6,5`. As linhas e os
  marcadores eram visuais, sem seleção ou arraste de trajetória.
- A bola não consultava posição, mãos ou ângulo dos bloqueadores. Ativar Block
  alterava a animação dos personagens, sem resolver impacto ou desvio.
- Bloqueadores arrastados partiam da base editada e voltavam ao fechamento
  calculado pelo preset. A edição não definia uma parede final persistente.
- Trocar camadas recriava a formação e descartava posições arrastadas.
- O salvamento guardava bases e opções, mas não direção, altura do arco,
  contatos editados ou ângulo do bloqueio. `format` era serializado sem ser
  restaurado; o alvo personalizado de recepção também ficava ausente.

Essas lacunas descrevem o código anterior. Direção, alças, primeira colisão, bloqueador manual e preservação ao alternar camadas foram corrigidos nesta rodada. Coleções e alvo de recepção na serialização continuam pendentes.

## Prioridades para o Go Atleta

1. Alças e primeira colisão entregues no protótipo: levar a revisão visual do
   usuário antes de qualquer integração ao documento tático de produção.
2. Salvamento local versionado (`version:2`) restaura direção, alturas, ponto de
   ataque, ângulo e bloqueadores manuais; posições e configurações conferidas
   após salvar/reabrir. Troca de camadas conserva as edições.
3. Cobertura atual: 83 testes Node (trajetórias, contato, reflexão, bordas,
   dentro/fora, edição, serialização e regressão de recepção), arraste de alvo,
   ápice e bloqueador, edição por teclado e Front/Side/Orbit no navegador.
   Exemplos medidos: mesmo preset 4/bloqueador único, ângulo -20° retornou para
   dentro em [-1,84;5,56], -40° desviou para fora em [-5,39;5,17]. Não generalizar
   esses exemplos para todos os ângulos e regras do voleibol.
4. Auditar separadamente o formato 9-man, coleções e análise de vídeo antes de
   assumir equivalência ou integrar essas capacidades ao produto.
5. Para vídeo, usar o fluxo já mapeado em
   [Biblioteca, quadra e scouting](../context/modules/biblioteca-quadra.md).
   Conferir os controles contra o Estúdio atual e incorporar apenas lacunas
   concretas, sem duplicar persistência, substituir sua arquitetura ou converter
   detecções e anotações em estatísticas oficiais automaticamente.

O retorno observado da bola comprova comportamento visível em casos exercitados;
não permite inferir a fórmula original de colisão nem certificar todos os ângulos.
O mockup continua local e independente da Quadra Visual de produção, sem migração,
publicação, upload de vídeo ou alteração da autorização e persistência do app.

## Limites e validação desta entrega local

- A nova comparação capturou 59 quadros de ataque livre, mãos, malha e fita a
  partir de configurações exportadas por Share. Velocidade, amortecimento e
  impulso de saída foram refinados. Quatro pares de bloqueio tiveram RMS de
  3,86 px entre os centros das bolas, com viewports normalizados e limites
  descritos no registro do mockup; não é certificação de todos os casos.
- A simulação resolve contatos sucessivos após a cortada: mãos, malha e fita,
  com gravidade, raio da bola, orientação e bordas. Perda de energia e reflexão
  são parâmetros locais; não foram extraídos do SetOptics. As faixas das mãos
  acompanham salto, extensão e descida até 0,484 s, com alcance e orientação no
  espaço da quadra. Continuam superfícies simplificadas, não malhas anatômicas.
- O quique no piso preserva o resultado do primeiro chão. Impulsos ajustados
  não se repetem indefinidamente na mesma superfície. Guias seguem o trecho
  efetivamente reproduzido, inclusive a cauda do quique.
- Spin, deformação da rede/mãos, postes/antenas e colisões durante passe ou
  levantamento não estão modelados. O modelo não substitui avaliação técnica.
- Até 16 impactos por voo. Casos de superfícies sobrepostas ou contatos cada vez
  menores podem atingir o limite; o estado é explicitamente incompleto, sem X de
  queda nem resultado dentro/fora inventados. Não é paridade física integral.
- 9-man completo (incluindo seis bloqueadores), coleções e análise/envio de vídeo
  permanecem fora desta implementação. O seletor 9-man legado não comprova paridade.
- 135 testes focados e sintaxe passaram. `npm run typecheck:app` não iniciou porque
  `tsc` não está instalado neste checkout; os módulos do protótipo são JavaScript.
- Salvamento/reabertura verificado com conjunto temporário próprio, removido ao
  final. Nenhum conjunto pré-existente foi removido. Não houve upload/exportação
  nem gravação no vídeo de referência.

- No mockup, o destino do saque também pode ser arrastado diretamente na quadra
  principal, com alça de 44 px e teclado. Trajetória/receptor atualizam durante o
  gesto, em sincronia com a mini quadra. Rodízios preservam o alvo; Seam e Reset
  limpam o ajuste. Salvamento/reabertura local verificados. Campo opcional v2
  `landingOverride` incluído também na geração do link. A validação atual soma
  140 testes; isso não comprova paridade do motor de saque com o SetOptics.

- Conferido ao vivo: mudar o ponto de ataque mantém o bloqueio no lugar na
  referência. Mockup corrigido para desacoplar o fechamento automático do contato
  editado e preservar o instante físico ao arrastar, sem reiniciar o salto.
  Colisões são recalculadas contra o bloqueio preservado. 154 testes passaram,
  incluindo 1/2/3 bloqueadores automáticos, manuais e mistos. Esta conferência
  não certifica equivalência integral da animação.

- Revisão de mira/contato: o sampler local deixava a direção escolhida deslocar
  a origem em 26 cm e espelhar a silhueta. Mão, origem e destino padrão foram
  estabilizados pela jogada; destinos manuais continuam próprios. Todas as alças
  de ataque preservam o tempo de edição. Comparação no navegador verificou 0 px
  de deslocamento do contato após cruzar a mira, além de undo/redo exatos.
  181 testes aprovados. Poses e física continuam modelos locais; paridade total
  permanece pendente, e as medições históricas não foram refeitas nesta etapa.

- Em 16/10, corrigida a orientação do levantador na recepção: a origem do passe
  não vira mais o corpo para a saída. Flexão, subida e contato conferidos no
  navegador, com regressão nos seis rodízios de 5–1 e 6–2. Inspeção adicional
  identificou que o ataque ainda não seleciona a pose `backfollow` nas jogadas
  para trás; essa diferença exige comparação específica e permanece pendente.
