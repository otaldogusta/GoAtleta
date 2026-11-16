# Câmera e arraste da quadra 3D

Refino local de 12/11/2026, nível 2 da escada de validação. Mantém o renderer
web existente, documento canônico, materiais, sombras, seleção, camadas,
altura e vínculos das setas. Não altera o canvas nativo nem persistência.

## Gestos

- Um dedo sobre jogador/material move o objeto; no fundo, gira a câmera,
  inclusive onde o raio não encontra o piso. O giro conserva a seleção;
  um toque no fundo sem deslocamento limpa a seleção.
- O arraste usa um plano horizontal na altura do ponto realmente tocado.
  Preserva o deslocamento entre o ponto de pega e a origem do objeto, sem
  saltar para o centro ou para o chão. Limita o destino, não o ponto de pega.
- A tolerância de toque de 22 px CSS complementa o picking exato de jogadores,
  bola, cone, alvo e escada. O acerto exato e sua profundidade têm prioridade.
  Anotações, sombras e elementos ocultos não ganham caixas de seleção extras.
  Bloqueados continuam selecionáveis, mas não se tornam editáveis.
- Dois dedos assumem zoom e deslocamento da vista, com o ponto sob o meio dos
  dedos preservado. Interrompem a edição pendente; o dedo restante não retoma
  o arraste nem dispara um clique residual. Cancelamento, perda de captura,
  perda de foco e mudança de contexto descartam o gesto.
- O limiar separa toque de arraste: 8 px no toque e 5 px em mouse/caneta.
  Sensibilidade orbital de toque considera as dimensões da tela. A inércia
  curta existente e a preferência de movimento reduzido são preservadas.
- A última coordenada de soltura é processada antes de emitir o comando.
  As prévias de posição e altura permanecem até chegar o quadro local confirmado pelo editor,
  evitando um quadro intermediário na posição antiga. Mudança de contexto,
  rejeição ou silêncio por 1200 ms libera a prévia; não depende do autosave
  e não cria protocolo ou histórico paralelos.
- Rolagem não muda a câmera durante o arraste autoral, de altura ou de alças.

## Enquadramento

`renderer-camera-framing.mjs` calcula a distância pela projeção, proporção da
tela e espaço reservado aos controles. Considera quadra/rede, objetos elevados,
caminhos autorais e trajetórias completas da simulação. O enquadramento não
segue a bola quadro a quadro. A vista inicial em retrato usa inclinação de
0,65 radiano; as vistas desktop existentes permanecem disponíveis.

Redimensionar conserva órbita, alvo e intenção de zoom relativa ao enquadramento.
A razão fica separada da distância efetiva limitada a 12–140, permitindo voltar
ao tamanho anterior sem acumular erro quando um limite é atingido. Gestos e
comandos explícitos da câmera passam a definir a nova intenção.

## Validação e limites

Testes focados usam geometria/projeção Three.js reais e handlers de eventos do
renderer em `node:vm`. Na integração, WebGL e entrega física dos eventos são
substituídos por objetos de teste; isso verifica transições, não fluidez de GPU.
92 testes cobertos: 67 adjacentes preservados, 9 do helper de gestos e 16 de
integração dos handlers. Os casos finais verificam soltura, quadro antigo,
confirmação/rejeição, timeout, altura, vínculos da bola, cancelamentos e wheel.
Typecheck aprovado com Node 24 executando diretamente os mesmos argumentos de
`typecheck:app`: `node node_modules/typescript/bin/tsc -p tsconfig.app-check.json --noEmit`.
Duas tentativas anteriores falharam por memória/paginação do Windows, sem
diagnóstico TypeScript; o registro local preserva o incidente. Sintaxe e diff
check aprovados, revisão independente sem achados finais pendentes. Renderer
congelado: SHA-256 `2A9EC92CC36D2ECEAB5A5158722E1A714281A610D91BCE012C16C6D4DC6F06DE`.

O ensaio do coordenador usa IAB no `localhost:8081`, com os componentes reais
e uma cena fictícia em memória. Viewports solicitados 390 × 844 e 844 × 390;
áreas CSS efetivas 379 × 819 e 819 × 379. Arraste com mouse nesses tamanhos
não equivale a toque físico ou gesto real de dois dedos em aparelho.
Arrastes de jogador em ambas as orientações mantiveram a câmera e a posição
após soltar. O retorno ao retrato recuperou a distância anterior. Na versão
final, elevar um jogador de 0 para aproximadamente 1,48 m e movê-lo em X/Z
preservou sua altura e a câmera; sem erros de console. A tela desktop de
1124 × 857 também foi inspecionada após remover o override de viewport.
Capturas estáticas não medem um flash de um quadro: essa regressão é coberta
pelos testes do handoff, complementados pelos arrastes no navegador.

Evidências locais ignoradas: `.tmp/work/quadra-gestures-20261112/` (capturas) e
`.tmp/work/quadra-appearance-20261112/gesture-validation.md` (testes e tipos).
A fixture local `quadra-mobile-qa-local.html` permanece disponível para revisão,
sem gravação remota. Sem commit, publicação ou ativação de serviços.
