# Quadra em perspectiva — mockup independente

Protótipo solicitado em 15/10/2026. Após duas rejeições de aproximações visuais,
o usuário pediu reproduzir o SetOptics primeiro e adaptar ao Go Atleta depois.
Referência inspecionada: https://app.setoptics.com/visualizer.

Entrada histórica local: `public/mockups/quadra-perspectiva.html`, com lógica e
estilos em `public/mockups/quadra-assets/`. O protótipo e suas evidências locais
não compõem o pacote publicado. A versão integrada está em
[Integração 3D](QUADRA_3D_INTEGRACAO_2026-10-16.md).

## Estado atual

- Fonte, logo, silhuetas por pose/ângulo e textura de bola obtidos dos recursos
  públicos observados no navegador. Proveniência dos 50 arquivos em
  `quadra-assets/reference/sources.json`. Esses arquivos são referência local,
  não ativos próprios do Go Atleta. Sem cópia de scripts, autenticação ou APIs do site.
- Composição em inglês, azul, navegação, abas Serve receive/Offense, Defense
  indisponível como na referência, painel recolhível, Setup/Court, sistema 5-1/6-2,
  rodízios, Float/Topspin, Left/Right, câmeras e rótulos.
- Cena WebGL com silhuetas em sprites, rede suspensa, sombras, faixas de recepção,
  bola texturizada, poses, trajetória e controles de reprodução.
- Arraste direto e duplo clique para pegar um jogador; clique seguinte solta.
  Miniquadra permite reposicionar jogadores, sacador e alvo de recepção.
- Offense oferece camadas Attack/Pass/Block, formato, preset, câmeras e guides.
- Saved persiste configurações exclusivamente em localStorage separado do app.
  Share copia URL local com configuração no fragmento; não publica nem chama servidor.
- Menu de perfil é demonstrativo e abre o tutorial. Library/Feedback apontam
  para as páginas da referência, sem reproduzir esses produtos externos.

Three.js 0.170.0 está vendorizado apenas no mockup, com licença MIT em
`quadra-assets/THREE-LICENSE.txt`; sem nova dependência no app real. Renderização
sob demanda quando parado e pixel ratio limitado a 1,5.

A lógica da simulação foi reconstruída para o protótipo: presets, trajetória,
formações, tempo das poses e comportamento do salvamento não são o motor original
nem regras pedagógicas validadas. Reprodução visual não certifica paridade de
cada estado do produto. A identidade Go Atleta será aplicada após revisão.

## Conferência local

Porta 8081 existente não respondeu na primeira rodada; protótipo servido em
127.0.0.1:8098. Comparados estados com painel aberto/fechado e silhuetas. Exercitados:
6-2, Topspin, Right, retorno aos padrões, miniquadra com deslocamento confirmado,
camadas Attack/Pass/Block, troca de preset, salvar/carregar/excluir fixture local,
duplo clique e deslocamento do líbero, play e poses. Corrigido conflito entre
seletores de botões e atributos de diagnóstico do canvas ao restaurar configuração.
Validações anteriores também cobriram seis rodízios, câmeras, timeline, velocidade,
pausa/reinício e tutorial. Escalas temporárias do navegador restauradas.

Sem integração com editor real, Supabase, publicação, commit ou deploy.
Checklist descreve protótipo e mantém aceite visual/integração pendentes.

Para reabrir: `python -m http.server 8098 --bind 127.0.0.1 --directory public/mockups`.

## Refinamento de animação

Comparados os estados de recepção em 55% e 80% da referência. Removido o
deslocamento senoidal igual para todos: levantador avança antes da recepção,
líbero ajusta a posição até o contato e demais jogadores fazem a transição
com a silhueta de corrida. Saque tem lançamento, contato e finalização; a bola
usa arcos separados e contínuos para saque e passe. Ataque tem preparação,
levantamento, aproximação, salto, contato e aterrissagem; bloqueadores saltam
na mesma janela. Amostragem determinística mantém pausa, rewind e scrub coerentes.
Tempos são aproximação visual reconstruída, não equivalência certificada do motor.

Conferência desta rodada: contato da recepção em 68%, ataque/bloqueio em 79%, reprodução até o fim e velocidade 2x no navegador sem erro de console. Checagem matemática dos arcos: continuidade nas junções, posições finitas e bola acima do piso em 1.001 amostras por combinação de modo/saque. Sintaxe JavaScript e diff check aprovados. Amostra local de reprodução: 53 fps, 1,34 ms de render (não é garantia para outros dispositivos).

## Segunda calibração após rejeição visual

A primeira revisão não atingiu a semelhança solicitada. Comparação frontal de
início/fim e amostras da referência em 20%, 40%, 60% e 65% revelou diferenças
de duração, enquadramento, escala corporal e destino dos atletas. A referência
avançou de 0,008 a 0,353 em 1,406 s (~4,1 s por sequência). A recepção local
agora usa 4,1 s, saque em 38% e contato da recepção em 62,5%; a janela de contato
é uma estimativa entre estados observados. A câmera frontal foi ajustada pelas
linhas da quadra/rede; escala das poses considera altura de braços, e as posições
finais foram recalibradas na projeção frontal. Removido balanço senoidal da corrida.
Guias de saque somem após contato e faixas de recepção somem no final.

Validação: reprodução completa, início/fim visuais, console sem erros e teste de
continuidade/valores finitos dos arcos repetido. A reprodução local avançou de
0,007 a 0,247 em 0,981 s, coerente com os 4,1 s. Ainda são silhuetas discretas e
lógica reconstruída, com aceite visual pendente; não declarar cópia exata.

## Orientação das silhuetas

Corrigido o espelhamento comum das poses laterais apontado nas duas imagens
do usuário. A direção agora usa o destino do jogador ou o alvo da ação no
plano da quadra, projetado no eixo horizontal da câmera. Oposto e ponta direito
olham para dentro, levantador olha para a recepção e corrida acompanha seu
deslocamento. Conferidos visualmente o fim da recepção em Front e Orbit;
validação de sintaxe JavaScript e diff check.

## Correção dos seis rodízios

Removido `slots[(i+rotation)%6]`, que deslocava funções entre pontos da primeira
formação e produzia recepções incorretas. `formations.mjs` contém seis presets
5–1 em coordenadas lidas do SVG visível da miniquadra da referência. No 6–2,
a referência repete as três primeiras formações em 4–6 e mantém rótulos S/OP;
o mockup agora reproduz esse comportamento, sem renomear OP para S.
Evidência independente em `formation-reference.json`, coletada em 15/10/2026.
As duas posições OH mantêm identidades distintas durante a rotação.

A escolha do receptor usa a proximidade dos três passadores ao alvo; empate
numérico na costura preserva o líbero. O alvo padrão mantém z=6,65 em todos os
rodízios, como a referência. Destinos de transição distinguem ponteiro da rede,
ponteiro de fundo e oposto de fundo nos rodízios 4–6. Receptor ponteiro volta à
posição de ataque após o passe. Não há alteração de presets do editor real.

Validação: comparação das 12 formações renderizadas com a evidência da referência,
12 resultados iguais; `node public/mockups/quadra-assets/formations.test.mjs` cobre
coordenadas, receptores, destinos distintos e cópias editáveis. Conferência visual
lado a lado do rodízio 2 e reprodução do rodízio 4. A correspondência das posições
iniciais não certifica paridade de toda a animação nem legalidade regulamentar.

## Comparação de movimento por rodízio

Inspecionados os seis rodízios 5–1 na referência em 50%, 75% e 100%, com
checagens adicionais de contato em 60%, 62,5% e 65%. Conferidos também os seis
rodízios 6–2 nos mesmos três checkpoints: os pares 1/4, 2/5 e 3/6 apresentam
a mesma sequência visual. A comparação foi da miniquadra/renderização visível,
sem acesso ao motor original. Os tempos abaixo são reconstruções dos checkpoints.

`reception-motion.mjs` centraliza posições, poses e bola em uma amostragem pura:

- R1: levantador mantém a faixa direita antes de cortar para a rede, ainda em
  corrida aos 75%; nos demais rodízios já está em preparação nesse instante.
- Janelas de deslocamento do levantador: R1 35–80%, R2 35–59%, R3 32–62%,
  R4 36–70%, R5 32–42%, R6 32–46%. O contato inclui elevação de 25 cm.
- Recepção em aproximadamente 64%; apoio começa a transição após esse contato e
  chega ao fim da sequência. Ponteiro receptor mantém finalização até 69% antes
  de sair; líbero faz recuperação curta em postura de recepção.
- Bola usa ponto de contato dependente do receptor e arco de passe mais alto.
  Guias e seleção automática desaparecem após o contato. Pequenos ajustes
  posicionais não usam pose de corrida.
- Corrigido resize que substituía a distância da câmera frontal pela orbital,
  alterando o enquadramento durante comparação/zoom da janela.

Validação: `formations.test.mjs` e `reception-motion.test.mjs` aprovados. Incluem
12 sequências, continuidade de jogadores e bola, chegada por função, percurso
R1, tempos de preparação, scrub reverso e pares do 6–2. Reprodução completa
no navegador dos 12 rodízios em 2x, todos em 100% e sem erro de console; uma
reprodução R1 em 1x também chegou ao fim. Evidência de posições renderizadas em
`motion-browser-checks.json`. A animação foi comparada visualmente em checkpoints,
não certificada como equivalência quadro a quadro ao SetOptics.

## Ataque — sincronização de passe, levantamento e cortada

Comparado preset 4 Indoor frontal no SetOptics, com Attack/Pass/Block ligados,
e também sem passe. Checkpoints em 0/25/50/75/90/100%; sem passe em 50/70%.
Duração observada aproximadamente 2,8 s sem passe e 4,4 s com passe.

`attack-motion.mjs` concentra a sequência: aproximação pela esquerda, preparação,
salto, contato, finalização e aterrissagem. O passe desloca toda a sequência de
levantamento/ataque; bola e poses compartilham os mesmos contatos. Bloqueador
vermelho do outro lado da rede salta junto à cortada; câmera frontal de ataque
separada da câmera de recepção. Barra de tempo é determinística e reversível.

Validação: testes de continuidade, altura de contato, salto do bloqueio, chegada,
configurações com/sem passe e regressões de recepção aprovados; sintaxe JS aprovada.
Comparação visual local em contato e aterrissagem. Limites: reconstrução por
checkpoints, sem equivalência quadro a quadro; bloqueador usa pose de levantador,
não há seleção de 2/3 bloqueadores; demais presets e 9-man não calibrados contra
a referência. Integração no editor de produção e aceite visual continuam pendentes.

## Nove presets Indoor e bloqueio múltiplo

Inspecionados na referência: 4, go, 31, 1, 2, 5, red, pipe, bic. O ciclo é
circular; não são nove posições igualmente espaçadas. Presets conservam as
posições iniciais editadas. Destino, altura do arco e contato são individuais;
pipe/bic chegam mais afastados da rede. A referência mantém o bloqueio na
posição inicial mesmo quando o ataque muda de lado. Duplo e triplo usam
espaçamento lateral de aproximadamente 0,93 m e saltam juntos.

Mockup atualizado com os nove nomes, configurações individuais e seletor 1/2/3.
Camadas e quantidade passam a ser serializadas no salvamento/link local.
Validação funcional localizada: 23 testes aprovados, incluindo os nove presets
com/sem passe, continuidade, contato, salto e recuperação dos três bloqueadores,
e regressões de recepção. Ciclo dos nove presets exercitado no navegador;
comparação visual do bloqueio triplo e ataque pela direita. Não é equivalência
exata: tempos estimados por checkpoints; silhueta do bloqueio ainda reaproveita
poses do levantador e 9-man não foi calibrado nesta etapa.

## Correção de direção e bloqueio articulado

Correção após reprovação: a bola terminava em x=9 (fora da quadra) e a direção
visual sempre apontava para x+4. Agora o atacante orienta-se ao destino real,
em x=±2,6 e z=-6,5. O contato acompanha a mão; a bola continua visível no chão.
Bloqueadores fecham diante do atacante, respeitam laterais e espaçamento de
0,93 m. Esta decisão atende à correção explícita do usuário e substitui a
conservação das posições à esquerda observada na sessão anterior da referência.

`blocker-rig.mjs` substitui as poses emprestadas do levantador: braços, antebraços,
palmas e dedos separados, preparação flexionada, extensão em V e descida.
Checkpoints adicionais da referência: 68/72/74/78/82/86%. Salto do atacante,
extensão do bloqueio e recuperação têm janelas separadas; duração física do
salto preservada com ou sem passe. É uma implementação própria baseada em
observação, não acesso ao motor original nem certificação quadro a quadro.

50 testes aprovados: inclui 27 combinações de preset e número de bloqueadores,
destino dentro da quadra, orientação, cobertura do atacante, mãos altas no
contato e regressão dos rodízios. Comparação local do ataque pela direita e
bloqueio triplo. Checklist atualizado; nenhuma alteração em produção.

## Refinamento após comparação contínua da animação

Comparação adicional do preset 4, passe e bloqueio duplo, frontal: checkpoints
36/40/42/44/46/48/50% para o levantador e 45/55/65/70/80/90% para o atacante.
Corrigida seleção da silhueta: atacante frontal na câmera frontal, com espelhamento
conforme o lado da cortada; lateral somente quando a câmera pede. Preparação do
levantador prolongada, corrida começa mais tarde, plantio precede impulsão, e
retorno à espera ocorre após finalização. Trocas usam uma transição de cerca de
40 ms, determinística ao avançar/retroceder a barra.

Bloqueio agora reaproveita a silhueta humana de tronco/cabeça/pernas, com máscara
no material de renderização para remover os braços originais e braços articulados
separados. PNGs da referência não foram alterados. Corrigidos proporção do corpo
e alinhamento nas pontas. Passe tem arco assimétrico; guia do levantamento ganhou
espessura consistente com a referência. Cortada dentro da quadra preservada.

52 testes aprovados, incluindo fases visuais e scrub reverso; sintaxe JS e diff
verificados. Conferência local em 55/70/76/90% e reprodução em 1x. Continua sendo
uma reconstrução própria: esses checkpoints não comprovam equivalência integral
ao motor original. Aceite visual do usuário permanece pendente.

### Correção localizada: braços desconectados

Corpo era um sprite orientado à câmera, enquanto braços seguiam apenas o azimute.
A inclinação da câmera separava visualmente ombros e braços. Agora o conjunto
articulado copia a orientação completa da câmera; início dos braços sobrepõe o
tronco e juntas arredondadas fecham ombros/cotovelos. Verificado no navegador em
Front e Orbit, espera e extensão, sem erros de console. Sintaxe JS e diff aprovados.

### Proporções dos personagens

Comparação em 40,7% com preset 4, passe e um bloqueador: antebraços em espera
mais baixos, mãos/dedos menores, braços afunilados e ombros menos arredondados.
Máscara do corpo preserva largura das coxas; escala de levantador e receptor
ajustada somente no modo Ataque. Posição do receptor recuada 35 cm. Cores dos
personagens aproximadas à referência. Testes focados de ataque e sintaxe aprovados;
inspeção visual na mesma fase, sem alegação de identidade integral.

### Guias de passe, levantamento e ataque

`attack-guides.mjs`: levantamento contínuo com ápice e contatos marcados; passe e
cortada tracejados com setas, destino da cortada em X e aproximação no chão.
Traçados são amostrados do mesmo movimento da bola, respeitam camadas e presets,
e são reconstruídos após arraste ou alteração por teclado. Show/Hide controla o
conjunto. Geometrias e materiais descartados ao reconstruir para evitar acúmulo.
Sintaxe e inspeção local de exibição/ocultação aprovadas, sem erros de console.

### Origem da linha do passe

Removida origem aérea deslocada do receptor. Bola e guia agora partem do ponto
central de passe (95 cm de altura, 35 cm à frente) e usam o mesmo arco contínuo
até o levantador. Seta reposicionada na descida para indicar o destino. Teste de
origem/chegada e continuidade após reposicionar os dois jogadores aprovado;
51 testes focados aprovados e conferência visual local realizada.

### Recepção animada dentro do modo Ataque

A revisão anterior ainda deixava o receptor em `ready` e começava a bola no
ponto de passe. Isso omitia a chegada da bola e a manchete mostradas pelo usuário.
Comparados checkpoints da referência em 4/8/9,5/11/12/12,5/14/16/17,5/20%.
Agora há voo descendente até 11,8%, preparação lateral a partir de 2,5%, contato
em 10,3–12,4%, finalização até 19,2% e retorno à espera. O centro da bola encontra
a plataforma dos antebraços, com âncora calibrada na imagem renderizada (75 cm,
48 cm à esquerda e 28 cm à frente da base). A mudança de velocidade vertical
no contato produz a saída para o levantador. As poses usam os PNGs já existentes.

Guia do passe começa no contato, sem incluir o voo de chegada. Transição entre
vista frontal e lateral preserva a vista da pose anterior; sombra difusa acompanha
a posição da bola no piso. Passe desligado conserva a sequência de 2,8 s.
Posições arrastadas continuam determinando contato e destino, sem mutação das bases.

Validação: 58 testes aprovados, incluindo novos testes de chegada/contato/saída,
fases do receptor, continuidade nos dois contatos, scrub reverso, edição de
posições, passe desligado e limites do guia. Inspeção local em 8/11,8/15,5/21%,
levantamento em 48,5%, cortada em 75,8% e reprodução completa em 1x. Isso corrige
as omissões observadas, sem certificar equivalência integral ao motor SetOptics.

## Interação tática: mira, mãos e primeira colisão

Auditoria completa das superfícies acessíveis e limites no
[mapa funcional](SETOPTICS_FUNCTIONS_AUDIT_2026-10-15.md). A referência permitiu
alterar a direção e observar guia livre/contato e rebote, e alterar altura do
levantamento pelo ápice. Vídeo demonstrativo foi inspecionado sem gravar anotações,
enviar vídeo ou exportar. 9-man/coleções/estúdio completo seguem pendentes.

No mockup, quatro alças operam por arraste e teclado: altura do passe, altura do
levantamento, ponto de ataque e alvo da cortada. O controle Mãos gira o plano do
bloqueio. Arrastar bloqueadores define posição manual e altera o contato; alternar
camadas preserva posições. Guia e bola compartilham `attack-physics.mjs`, com
trajetória balística, raio da bola, retângulos finitos das mãos, reflexão, perda
de energia e aterrissagem dentro/fora. Só o primeiro contato é resolvido; rede,
segundo contato e spin não foram implementados. Não reproduz fórmula proprietária.

Configuração local versionada em 2 e normalizada por `attack-settings.mjs` inclui
alvos, alturas, ângulo e bloqueadores manuais. Reabrir um conjunto temporário
restaurou valores e posições sem diferença. Conjunto de teste removido ao final.
Formato salvo também passou a ser restaurado. Coleções continuam lista plana.

Validação: 83 testes Node aprovados (incluem 11 de física e 9 de configuração),
sintaxe dos módulos, arraste do alvo/ápice/bloqueador, teclado, vistas frontal,
lateral/orbital, dentro a -20° e fora a -40°, salvamento/reabertura e reprodução
com rebote. `npm run typecheck:app` não iniciou: tsc não instalado neste checkout.
Nenhum arquivo TypeScript do app foi alterado; checks do protótipo usam Node/browser.

## Rede, fita e contatos sucessivos após a cortada

Revisão funcional local, independente do editor de produção. Substitui o limite
de primeiro contato descrito na etapa anterior. `attack-physics.mjs` agora resolve
o próximo evento a partir da velocidade de cada rebote, até o chão: planos finitos
das mãos, malha de 10,5 m entre 1,43/2,43 m e fita superior arredondada. Inclui
faces, bordas e cantos, com interseções contínuas; a bola não depende de um passo
de renderização para detectar um impacto. Segmentos unem-se no mesmo ponto, sem
deslocar a bola artificialmente. Cada superfície dissipa energia.

`collisions[]` mantém tipo, bloqueador, normal, velocidades e tempo absoluto desde
a cortada. `collision` continua como primeiro evento para compatibilidade. Guias
mostram todos os trechos/marcadores e pulsam no instante do toque. A indicação na
tela mostra a cadeia e o resultado da queda. Mãos podem ter ângulos individuais,
persistidos em `blockAngles`, mantendo o ângulo global e configurações antigas.
O seletor Todos aplica o mesmo valor aos bloqueadores ativos. Os planos das mãos
aceitam contato até 0,48 s após a cortada, acompanhando a janela de recuperação.

O voo usa segundos após o contato. Rebotes mais longos estendem a duração total
sem atrasar preparação, salto ou contato; voos curtos chegam ao piso enquanto os
jogadores terminam a recuperação. Scrub reverso amostra a mesma sequência.

Validação: 108 testes Node aprovados, incluindo 29 de física, 11 de configuração,
interação com malha/fita, contatos mão→mão/mão→rede/rede→mão, bordas e continuidade,
janelas de mãos ativas, ordem de entrada, perda de energia e casos sobrepostos.
Navegador: preset 4, dois bloqueadores, segunda mão em 30° produziu mão 2→mão 1→
mão 2→fita; replay completo em 1x, scrub 79→93→79% idêntico, configuração salva e
reaberta. Conjunto temporário próprio removido. Malha e fita isoladas também
conferidas, com alvo alterado por teclado; console sem erros. Renderização média
observada de 1,38 ms no cenário composto, sem garantia para outros equipamentos.
Sintaxe JavaScript conferida; tsc continua ausente neste checkout.

Limites: teto de 16 impactos, estado `truncated`/`contact-limit` explícito quando
há aprisionamento ou superfícies sobrepostas, sem inventar chegada ao piso. Mãos
são planos de contato durante a janela do salto; não há malha anatômica móvel,
spin, deformação, postes/antenas ou colisão de passe/levantamento. A referência
não expõe seu motor: esta implementação não certifica fórmula, tempos ou todos
os casos idênticos ao SetOptics. 9-man e integração continuam pendentes.

## Comparação temporal dos contatos e amortecimento

Nova conferência na referência: 59 quadros amostrados em quatro cenários
reproduzíveis, a partir do link gerado por Share. Os valores exportados de alvo,
ponto de ataque e bloqueadores permitiram isolar mãos, malha, fita e ataque livre
sem ler estado interno do aplicativo. As tentativas anteriores de arraste da
direção não constituíam evidência desse comportamento. Capturas e JSONs desta
conferência ficam em `.tmp/quadra-comparison/`, ignorado pelo Git; comparação
interativa local em `http://127.0.0.1:8099/index.html` enquanto o servidor existir.

| Medida na referência | Resultado e limite |
| --- | --- |
| Relógio, 10 leituras em 0,534 s | Ciclo estimado de 4,464 s, compatível com o ciclo local de 4,4 s; não é medição de alta precisão. |
| Cortada livre | Contato próximo de 75,8%; velocidade estimada em torno de 30 m/s, condicionada à câmera e escala. |
| Mãos | Contato entre 75,5–76,5%; pequeno impulso para cima, ápice aparente perto de 78,3%, seguido de queda. |
| Malha | Contato entre 76,5–77,5%; saída vertical quase nula e forte amortecimento. |
| Piso | A bola quica depois da primeira queda; restituição vertical aparente de 0,59 no cenário da malha, faixa aproximada de 0,5–0,65. |

`attack-calibration.mjs` separa os parâmetros locais da geometria. Velocidade da
cortada passa de 16 para 30 m/s; alvo padrão ajustado ao exemplo exportado. Saída
das mãos e malha perde muito mais velocidade; a fita conserva deslizamento para
não aprisionar artificialmente a bola. O impulso vertical ajustado aplica-se só
ao primeiro toque de cada mão/superfície, evitando reaceleração em contatos
repetidos. As retenções e impulsos são parâmetros de ajuste do nosso modelo;
não são coeficientes identificados ou extraídos do motor original.

`blocker-motion.mjs` compartilha o relógio de salto/extensão com os atores. A faixa
de contato de 30 cm acompanha palmas/dedos e alcance sobre a rede, com 22 trechos
de translação contínua e erro de corda inferior a 1 cm em relação à pose local.
O solver faz interseção analítica relativa ao movimento de cada trecho. Braços
passam a orientar-se no espaço da quadra; o corpo Sprite mantém seu billboard.
Não sobra um retângulo de mãos levantadas enquanto o jogador aterrissa.

Há um quique no piso. `landing` e `landingTime` registram a primeira queda e seu
resultado; `endPoint` registra o final do voo após o quique. O relógio pode terminar
durante essa cauda, como na referência; guias/marcadores limitam-se ao intervalo
reproduzido. Um voo longo antes do primeiro chão ainda estende a reprodução.

Após o ajuste, quatro pares de capturas de bloqueio tiveram distância entre os
centros das bolas de 5,47/3,86/2,36/3,00 px nas fases 77,5/80,5/86,5/94,5%, com
viewports normalizados. RMS 3,86 px. A primeira imagem tem oclusão nas mãos e maior
incerteza. Esta medida cobre apenas esses quatro quadros desse cenário, antes do
quique; não certifica todos os ângulos, a fita ou a fase posterior ao primeiro piso.

Validação atual: 135 testes Node aprovados, sintaxe JavaScript, replay completo em
1x, scrub reverso com posição idêntica e inspeção Front/Side/Orbit. Inclui sequência
mão→outra mão→fita→chão sem reaceleração infinita. O typecheck do app continua
indisponível por ausência de tsc no checkout. Não houve publicação ou integração
no editor de produção. Restam diferenças de poses, câmera e casos não medidos;
paridade integral continua não certificada.

Replay final chegou a 100%, sem erro de console; tempo médio de renderização
observado de 1,37 ms nesse navegador/cenário. Não é garantia para outros dispositivos.


## Destino do saque por arraste na quadra principal

No modo Serve receive, o X tem uma alça projetada sobre a quadra, com área de
44 px, foco e ajuste pelas setas. Arrastar mantém a câmera e as posições-base;
a trajetória e o recebedor são recalculados durante o gesto. A edição pausa e
reinicia a reprodução. A mini quadra usa a mesma normalização de destino.

O alvo fica limitado à metade receptora (x entre -4,5 e 4,5 m; z entre 0 e 9 m).
Ele representa a queda prevista; o contato de recepção ocorre antes do X, como
no modelo existente. Destinos curtos agora mantêm o receptor e o contato da bola
do próprio lado da rede. Não adiciona colisões de rede ao modelo de saque.

Rodízio, sistema e tipo de saque preservam o destino personalizado. Seam e Reset
restauram o padrão. O campo opcional `landingOverride` integra a configuração v2,
o salvamento local e a geração do link; configurações antigas usam o padrão.

Validação: 140 testes Node aprovados e sintaxe JavaScript. No navegador foram
conferidos arraste em câmera inclinada, teclado, mudança de recebedor, contato,
edição durante replay, preservação em rodízio/sistema/saque, mini quadra,
salvar/reabrir, Seam e Reset. O conjunto temporário de teste foi removido.
O typecheck do app permanece indisponível por ausência de tsc no checkout.
Continua um protótipo independente, sem integração ou publicação.


## Interface em português brasileiro

Todos os textos do protótipo passam a pt-BR: navegação, controles, tutorial,
mensagens, acessibilidade, siglas de posições e nomes apresentados das jogadas.
Identificadores internos e configurações salvas permanecem compatíveis. Nomes
padrão antigos `Set N` aparecem como `Jogada N`, sem regravar o conteúdo autoral.

As ações do painel receberam espaçamento menor e quebra de linha em tela estreita
para acomodar as traduções. Conferidos no navegador os painéis de ataque/recepção,
a apresentação dinâmica de jogada, o tutorial e ausência de transbordamento em
390 px de largura CSS; janela restaurada. Sintaxe JavaScript e diff aprovados.
É um ajuste de texto/apresentação: não altera os modelos de animação ou colisão.


## Painel lateral ampliado

O painel de ajustes passa para a lateral direita em telas acima de 700 px,
com 360 px de largura e até 600 px de altura, limitado pela janela. As ações
ocupam uma segunda linha; ajustes e miniquadra aproveitam a altura disponível.
Em telas estreitas, o painel permanece centralizado acima da reprodução,
com altura maior e sem cobrir os modos no topo. A reprodução segue embaixo.

Conferidos no navegador: recepção, ataque com todos os controles de bloqueio,
aba Quadra e adaptação em 390×844 px, sem transbordamento horizontal. No desktop
1329×880, os ajustes cabem sem rolagem. Alteração apenas de composição CSS;
modelos, configurações e gestos da quadra não foram alterados. Diff aprovado.


## Rótulos e recolhimento lateral

Os seis seletores passam a mostrar P1, P6, P5, P4, P3 e P2, nessa ordem,
também nos nomes acessíveis e no status. Apenas os rótulos mudaram: índices,
formações e configurações salvas mantêm a correspondência existente.

O botão de controles fica junto à borda esquerda do painel aberto e na borda
direita da janela quando recolhido. As setas acompanham a direção; abertura e
fechamento deslizam lateralmente em 180 ms, respeitando movimento reduzido.
Em tela estreita, o botão acompanha a borda superior do painel inferior.

Conferidos no navegador os rótulos, seleção de P6, fechamento, reabertura com
seleção preservada e posição em 390 px; viewport e P1 restaurados ao final.
Sem erros de console. Sintaxe JavaScript e diff aprovados.


## Ponto de ataque independente do bloqueio

Nova inspeção ao vivo do SetOptics: arrastar o ponto de ataque manteve os três
bloqueadores no lugar, tanto no cenário compartilhado quanto em um cenário
padrão sem posições na URL. No compartilhado, o instante de 94,5% foi preservado.
Capturas antes/depois do cenário padrão registradas na pasta de visualizações.

No mockup havia duas causas: o X do contato editado também era usado para fechar
o bloqueio automático; além disso, pegar/editar a alça zerava o replay. O bloqueio
automático agora se ancora na jogada escolhida. Ajustes manuais e orientação das
mãos continuam próprios. Trocar a jogada ainda reposiciona os automáticos.
Editar o contato preserva os segundos decorridos, mesmo que o novo voo altere
a duração total; só limita ao fim caso o novo replay termine antes desse instante.

No navegador, um arraste do contato de x=-3,791 para x=-1,945 manteve as posições
dos bloqueadores, a câmera e o instante de 3,2736 s durante o salto. O cenário
atual tinha dois bloqueadores, com posições manuais parciais. Configuração atual
foi preservada ao carregar a correção; não foi sobrescrita pelo hash antigo.

154 testes Node aprovados. Incluem 14 novas regressões para 1/2/3 bloqueadores,
colocação automática/manual/mista, poses e mãos em segundos equivalentes,
colisão recalculada contra paredes fixas e compatibilidade de troca de jogada.
Sintaxe e diff aprovados. Verificação limitada à independência do gesto; não
certifica paridade integral das animações ou da física com a referência.


## Mira, contato e histórico de edição

Nova inspeção do ataque no SetOptics separou alterações do contato, do arco e da
direção. Editar o contato e o ápice preservou o instante 75,8% na referência.
No mockup, outras alças ainda reiniciavam o replay; agora todas as alças de
ataque preservam os segundos decorridos, limitados ao fim do novo voo.

Corrigidas duas descontinuidades adicionais: a mira determinava o lado da mão,
movendo o contato em 26 cm e espelhando o atacante ao cruzar seu eixo X; e mover
o contato através do centro trocava automaticamente o destino padrão. O lado do
golpe e o destino padrão agora se ancoram na jogada, preservando destinos editados.
A mira altera a direção do voo e a colisão; não altera a origem nem o bloqueio.
A conversão inversa da alça usa o mesmo lado de mão do sampler. Nomes acessíveis
passam a Contato do ataque e Destino do ataque; selecionar o atacante identifica
o início da aproximação. As poses continuam baseadas em silhuetas, não em rig 3D
anatômico; esta revisão não certifica equivalência visual ou física integral.

Histórico local em memória, limitado a 80 passos: Ctrl+Z desfaz e Ctrl+Shift+Z
refaz novas edições. Cada arraste, pegar/mover/soltar, slider de mãos ou controle
discreto forma um passo; inclui jogadores, alças, mini quadra e carregar uma
jogada. Nova edição invalida refazer; gestos sem mudança não criam passo.
Esc cancela o gesto. Desfazer durante arraste restaura seu início e não produz
um passo extra ao soltar. Câmera e reprodução não entram no histórico; o estado
restaurado mantém a câmera e recupera o instante da configuração, pausado.
Campos de texto preservam o desfazer nativo. Histórico não persiste ao recarregar
nem recupera edições anteriores à implementação; salvar/excluir listas locais
não é uma edição de quadra desfeita por esses atalhos.

Validação atual: 181 testes Node, incluindo continuidade de origem/guia ao mudar
a mira, nove jogadas com destino estável e oito testes do histórico. No navegador,
mira x=-3,779→-5,850 resultou em deslocamento de 0 px da alça de contato, mantendo
3,3352 s; Ctrl+Z e Ctrl+Shift+Z restauraram os estados exatos. Arco editado também
manteve 3,3352 s. Conferidos ainda rodízio, mãos, jogador/bloqueador, miniquadra,
pegar/soltar, undo durante arraste e cancelamento por Esc. Pointercancel compartilha
a rotina de cancelamento, mas cancelamento nativo de toque não foi validado.

Replay completo chegou a 100%, sem erro de console e sem gerar histórico.
Renderização observada de 1,33 ms nesse cenário, sem garantia para outros aparelhos.
Sintaxe e diff aprovados; typecheck do app continua indisponível por ausência de
node_modules/typescript/bin/tsc, conferida novamente. Sem integração ou publicação.

## Orientação do levantador na recepção — 16/10/2026

O corpo usava a posição do passador como direção de preparação. Um passe vindo
da direita do levantador invertia a silhueta para a saída, embora o contato da
bola permanecesse à esquerda da cabeça. Após chegar ao destino, o levantador
agora prepara o toque voltado para a entrada, alinhado à rede, nas poses de
flexão, subida e contato. O deslocamento até o destino continua seguindo sua
rota; posições, tempos e trajetória da bola não foram alterados.

Quatro testes focados de recepção passaram, incluindo a regressão com quatro
origens de passe, seis rodízios e sistemas 5–1/6–2. Conferência no navegador em
90%, 94% e 100%, no cenário de passe à direita do usuário, confirmou a orientação;
posições e alvo editado foram preservados após atualizar a página. Sintaxe e
diff conferidos. O typecheck do app continua indisponível por falta de tsc no
checkout; esta alteração é restrita ao mockup. A equivalência integral com a
referência continua pendente.

## Próxima rotação na reprodução — 16/10/2026

Botão ao lado de voltar ao início mostra o rodízio atual e avança na sequência
P1 → P6 → P5 → P4 → P3 → P2 → P1. Usa a mesma ação do seletor lateral, pausa
e reinicia a jogada, preserva alvo do saque e câmera. Disponível em Recepção.
Cada avanço corresponde a um passo no histórico; desfazer/refazer e carregar
configuração sincronizam o rótulo, a dica da próxima rotação e o seletor.

Conferidos no navegador: ciclo completo, retorno P2 → P1, um passo por clique,
Ctrl+Z/Ctrl+Shift+Z, alvo preservado e ocultação no Ataque. Barra inspecionada
no viewport desktop atual; sintaxe e diff conferidos. Testes de interação foram
feitos em aba temporária, fechada ao final. Sem integração ou publicação.

## Braços do bloqueio na câmera alta — 16/10/2026

O tronco era um Sprite que acompanhava a inclinação da câmera, enquanto braços
e mãos permaneciam em coordenadas 3D. Na vista superior, o ombro desenhado se
afastava do início do braço. O tronco agora usa um plano vertical que acompanha
somente o azimute da câmera; as raízes dos braços ficam nos ombros desse plano.
A perspectiva encurta naturalmente o corpo na vista alta. A rotação das mãos é
aplicada ao grupo antes de converter o eixo do tronco para coordenadas locais.

Palmas, dedos, cotovelos, salto, extensão e superfícies de colisão mantêm suas
coordenadas e relógio. O corpo continua uma silhueta plana, sem volume anatômico
3D; esta correção trata a ligação entre tronco e braços e não certifica paridade
integral com a referência.

Nove testes focados passaram: dois novos de geometria do rig e sete do movimento
compartilhado. Conferidos 240 conjuntos de câmera/pose para união dos ombros,
mais invariância das palmas em relação à câmera e às coordenadas físicas
anteriores. Navegador: dois bloqueadores pela frente e por cima, salto, três
bloqueadores pela lateral e câmera alta oblíqua com mãos a 35°, sem erro de
console. Sintaxe e diff conferidos. Sem integração ou publicação.

## Cabeçalho e acesso à quadra 2D — 16/10/2026

Biblioteca passou a Quadra 2D; Visualizador passou a Quadra 3D. O nome/logo
da referência foi substituído por um botão de voltar. O usuário escolheu o
editor existente de ElCartel Feminino e retorno à tela anterior.

O link 2D abre na mesma aba a rota local autenticada
`http://localhost:8081/class/c_1773110914770/visual-tech`, verificada pela lista
de turmas e pela abertura do editor. Antes de navegar, a configuração 3D atual
é gravada no fragmento da entrada existente do histórico, sem criar um novo
passo de edição. Voltar usa o histórico do navegador; sem entrada anterior,
abre a página dessa turma no aplicativo local. Quadra 3D mantém a ação de
câmera livre existente. O atalho é específico deste protótipo/turma, sem
transferência de documentos entre os editores nem alteração no app 2D.

Conferidos em aba temporária: abrir o editor 2D real, voltar ao mockup e usar
o novo botão para retornar à página anterior da turma. Nenhuma jogada foi
salva ou alterada no editor 2D. Sintaxe e diff conferidos.

## Alternância a partir do editor 2D — 16/10/2026

O cabeçalho do editor real agora tem Quadra 2D selecionada e Quadra 3D em
desenvolvimento web local. Antes de sair, `leaveWithDraft` aguarda o snapshot
mais recente no armazenamento já escopado por usuário/organização/turma, com
documento e etapa. Falha de gravação ou alteração concorrente cancela a saída.
Documento intacto continua limpo; troca de vista não salva na turma.

A URL local transmite somente o destino de retorno e a configuração independente
da cena 3D; não transmite o documento tático. O retorno descarta `visual` obsoleto
para recuperar o rascunho ativo. O helper aceita apenas a rota local da turma e
retoma apenas o fragmento do protótipo permitido, sem encadear URLs recursivas.

O servidor Expo em uso foi identificado no checkout `9184`; os cinco arquivos
de implementação/testes desta alteração foram espelhados nele após confirmar
que os destinos estavam limpos. Alterações concorrentes do scouting e DateInput
foram preservadas. O protótipo segue servido a partir de `25c1`.

Validação desta alteração: 52 testes Jest (URLs e controlador/rascunhos),
`typecheck:app`, `check:org-scope`, sintaxe do mockup e diff aprovados.
No navegador autenticado: ida/volta pelos botões, mesma turma/documento e
retomada do rodízio P6 na cena 3D; cabeçalho conferido em desktop e 390 px.
Falhas de armazenamento/concorrência foram exercitadas nos testes. Nenhuma
jogada real foi alterada ou salva na turma durante o smoke.

## Representacao no documento existente - 16/10/2026

O acesso entre paginas foi substituido pela [vista 3D no mesmo workspace](QUADRA_3D_INTEGRACAO_2026-10-16.md).
O prototipo deste documento permanece como demonstracao independente e referencia
de geometria/rig. A integracao usa as trajetorias autorais existentes; nao aplica
as formacoes, contatos e colisoes da demonstracao sobre uma jogada do professor.
