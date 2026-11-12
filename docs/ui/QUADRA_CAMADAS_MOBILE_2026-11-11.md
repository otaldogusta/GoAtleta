# Quadra visual — seleção móvel e camadas

Data: 11/11/2026 (America/Sao_Paulo). Implementação local do Go Atleta.
Escopo: interação da quadra, ordem visual 2D e metadados do documento.
Sem publicação ou migração remota. Validação pela [escada](../operations/validation-ladder.md).

## Interação móvel

- Selecionar permanece acessível fora da rolagem da barra. Os controles de
  ferramentas têm alvo real de 44 px, com ícones compactos e sem escala redutora.
- Voltar a Selecionar preserva o item selecionado, assim como o atalho V.
- A seleção acompanha a silhueta do jogador e o formato dos objetos. Contornos
  usam a geometria, tamanho e rotação da própria figura, sem alterar o toque.
  Jogadores circulares mantêm seu anel; materiais e desenhos deixam de usar
  uma caixa genérica. Cor e traço originais permanecem visíveis.
- Aplicar cor percorre todos os jogadores e desenhos editáveis selecionados,
  tanto no atalho contextual quanto em Propriedades. Bloqueados, ocultos e itens
  fora da seleção permanecem intactos. Uma troca corresponde a uma única edição
  no histórico, preservando a seleção; repetir a cor atual não cria edição.
  Cores diferentes na seleção aparecem no botão como uma bolinha dividida em
  até quatro cores reais, em faixas diagonais com separadores brancos, conforme
  referência do usuário; uma cor comum ocupa a bolinha inteira. O traço neutro
  anterior foi removido porque parecia indicar ação desativada.
- A ferramenta ativa mostra instrução curta e retorno à seleção. Escolher uma
  ferramenta, inclusive pelo botão de adicionar no painel, libera a quadra.
- Jogadores e materiais já retornavam à seleção após inserir. No celular,
  desenhos concluídos também retornam; animação mantém seu modo contínuo.
  Retrato até 700 px e paisagem até 1000 × 500 px usam esse comportamento;
  desktop baixo, como 1366 × 650 px, conserva desenho contínuo e tooltips.
- Autosave não bloqueia seleção/arraste. A interface reutiliza a distinção
  existente entre salvamento automático e operações bloqueantes. Não mudou o
  protocolo de gravação nem o histórico. Ver [contrato de autosave](QUADRA_AUTOSAVE_2026-10-28.md).

## Seleção e hover 3D — 12/11

O alvo recebe uma superfície invisível de seleção que inclui o centro e os
anéis. Essa superfície acompanha posição e altura do material, conservando o
raycast por profundidade. Antes, somente os tubos finos dos anéis recebiam
cliques, deixando a região interna sem resposta.

Passar o mouse realça a geometria do item selecionável sem adicionar um
contorno grosso. Jogadores e seus rótulos, materiais, linhas, áreas e textos
usam o mesmo objeto identificado pelo clique. O destaque não altera cor salva,
seleção ou histórico. Bloqueados continuam selecionáveis, com cursor de clique;
ocultos ficam fora da cena e do picking. Toque, gestos, câmera e mudanças de
contexto limpam o hover; reprodução/leitura não oferecem edição pelo destaque.

Validação local nível 2: 38 testes Node aprovados (8 de interação reaproveitados
com hashes conferidos e 30 de geometria, altura e ciclo de vida executados),
tipos, sintaxe e diff aprovados. Revisão independente por leitura sem achados.
No IAB, o coordenador conferiu hover nos nove tipos de desenho e no jogador,
clique no centro do alvo no piso e a 2 m com câmera oblíqua, bloqueio e ocultação
em cena fictícia. Contraste de texto branco refinado após comparação visual.
A própria jogada autenticada foi recarregada: clique no centro do alvo abriu
suas ações e altura; hover de jogador também conferido, sem editar dados reais.
Ensaio em 1243 × 699 e jogada em 1307 × 857; sem validação em aparelho físico.
Relatório local ignorado: `.tmp/work/quadra-mobile-20261111/hover-validation-summary.md`.
Fixture temporária retirada; servidor e Habblaud mantidos. Sem publicação.

## Hover 2D — 12/11

O mesmo realce discreto do 3D chega à seleção 2D, sem engrossar contornos.
Jogadores em círculo ou silhueta, bola, cone, alvo, escada, seta, curva, traço,
área e texto usam a resolução de clique existente, com a ordem das camadas e
prioridade da bola ligada a setas. Ocultos não participam; bloqueados continuam
selecionáveis com cursor de clique, sem sugerir arraste permitido.

O estado fica na apresentação: não muda cor salva, seleção, histórico nem
exportações. Sair da quadra, usar toque, iniciar gestos, trocar contexto ou
passar sobre controles internos limpa o destaque. O item só muda quando muda
o resultado do picking, evitando atualização de estado a cada pixel.

Validação nível 2: 129 testes em seis suítes aprovados (127 de hover, cena,
picking, alças e áreas reaproveitados com hashes finais conferidos, mais dois
de exportação JSON), tipos e diff aprovados. Revisão independente sem achados.
No IAB, nove tipos de desenho e
jogadores em círculo/silhueta responderam; a árvore SVG voltou exatamente ao
estado inicial ao sair. Cone/escada girados, texto branco, sobreposição,
cadeado/ocultação, menu de ações, zoom de 125% e troca de ferramenta conferidos
na fixture em memória. Na jogada autenticada, hover conferido no estado editável
e ausência do destaque fora dele, sem editar seu documento. Dimensão final
1307 × 857; sem teste em aparelho físico. Relatório ignorado em
`.tmp/work/quadra-mobile-20261111/hover-2d-validation-summary.md`.

Limite herdado registrado durante o smoke: áreas usam o hit-test existente dos
segmentos consecutivos; interior e trecho de fechamento não acrescentado ao
array não participam. Hover acompanha esse clique. Ampliar a superfície de
seleção da área permanece fora deste recorte; não é regressão do realce.

## Camadas

Decisão explícita do usuário: ordem de sobreposição no **2D**; o **3D mantém
profundidade**. O painel lista os jogadores e objetos da etapa, da frente para
o fundo. Selecionar na lista não altera posições. A alça dedicada permite
reordenar; os comandos de subir/descer oferecem alternativa ao gesto.

A ordem vive em `editor.layerOrder`, opcional e indexada pelo ID da etapa, com
referências `{ kind: "actor" | "drawing", id }`. A ordem armazenada vai do fundo
para a frente. O resolvedor compartilhado filtra referências inválidas e
duplicadas, preserva a composição legada quando não há ordem explícita e inclui
novos itens sem apagar a ordem anterior.

Renderização e prioridade de seleção 2D usam o mesmo resolvedor. Isso corrige a
divergência anterior: jogadores eram pintados acima dos desenhos, mas o hit-test
priorizava desenhos. Não se altera a ordem global dos atores, seus IDs, posições,
papéis esportivos ou configuração de simulação.

O arraste mostra uma prévia local: a linha acompanha o gesto, as vizinhas abrem
espaço e o destino fica demarcado. Movimento reduzido mantém o feedback direto,
sem interpolação decorativa. Soltar confirma uma única edição, integrada
ao desfazer/refazer e autosave existentes. Cancelar descarta a prévia. A
serialização preserva os metadados; o resolvedor filtra referências na apresentação.
Importação e cópia compartilhável sanitizam referências e rejeitam IDs ambíguos;
duplicar/continuar etapa remapeia IDs de desenhos e conserva IDs de atores.
Arquivos antigos continuam válidos. O JSON da quadra utiliza a persistência já
existente, sem tabela, coluna, RPC ou permissão nova.

PNG/GIF/PDF web e miniaturas reutilizam a cena 2D. A cena 3D continua usando
oclusão física; a lista pode selecionar itens sem forçar desenhos através da rede.

## Ocultar e bloquear por camada

Cada linha oferece Mostrar/Ocultar e Bloquear/Desbloquear, com controles
independentes da seleção e da alça. Ocultos continuam na lista e na ordem salva,
mas saem da apresentação e do toque em 2D/3D. Bloqueados continuam visíveis e
selecionáveis na lista, com edição direta e reordenação impedidas até desbloquear.
Cada alteração integra desfazer/refazer e a gravação já existente da jogada.

`actorMeta[id].hidden` é opcional e vale para o jogador na jogada, seguindo o
escopo do bloqueio existente; `CourtDrawing.hidden` vale para o objeto da etapa.
Importação, JSON exportado e cópia compartilhável preservam esses estados.
O [SQL de publicação](../../supabase/migrations/20261112120823_preserve_court_share_layers.sql)
preserva a ordem das referências válidas e o indicador booleano de ocultação dos
jogadores nos links criados ou republicados. O teste SQL isolado cobriu leitura
anônima, clientes anteriores e limites de autorização. O destino precisa receber
a migração. Links anteriores preservam a projeção já gravada até republicação.
Ocultar não remove o jogador de `visibleActorIds` nem altera a configuração da
simulação. Guias de simulação mantêm seu controle separado em Movimentos.
O olho individual não modifica a visibilidade da categoria inteira em Ajustes.

## Evidência e limites

O indicador de rotação só aparece quando existe simulação configurada: recepção
individual ou sequência canônica de rodízios. Quadra livre e ataque individual
não exibem P1 por padrão nem setas que criem uma simulação acidentalmente.
Transporte e Ajustes seguem a mesma condição; o rodízio existente é preservado.

- Revisão independente do recorte móvel confirmou o contrato de autosave e
  identificou os caminhos do botão de adicionar e do desktop baixo; corrigidos.
- Baseline móvel: 21 testes de interação e 96 regressões relacionadas aprovados
  em Node 24.13.0; tipos e diff passaram antes da etapa de Camadas.
- Localhost autenticado em 390 × 844: alvos de ferramentas medidos em 44 × 44 px;
  selecionar jogador, preservar seleção e armar ferramenta conferidos.
- Ensaio isolado no navegador do Codex usa os componentes reais e controlador
  fictício em memória: adicionar jogador, retornar à seleção, arrastar e concluir
  seta foram exercitados. Não é prova de persistência remota nem aparelho físico.
- A página temporária do ensaio inicialmente omitiu o CSS global de scrollbar;
  a faixa branca foi apontada pelo usuário e corrigida no ensaio. Não é evidência
  de um novo defeito da rolagem global do app.
- No IAB, seleção pela lista, mover para trás, arraste por várias posições e
  desfazer em um único passo foram exercitados. A imprecisão ao arrastar depois
  de reordenar por botão foi corrigida e retestada: a geometria é atualizada a
  cada gesto. Segurar a alça sem deslocamento não reordena nem inicia autoscroll.
- Sobreposição mista conferida: seta movida atrás de jogador, com seleção do
  jogador ao tocar a interseção. Alternância 3D e retorno pelo painel conferidos.
  Composição fictícia inspecionada no IAB em 379 × 819 e 1243 × 699 CSS px.
  Painel também aberto e inspecionado na quadra autenticada em 819 × 379 CSS px,
  sem reordenar dados reais. Altura limitada ao espaço e ações acessíveis.
- Validação nível 3 em Node 24.13.0: 240 testes em 14 suítes aprovados
  (179 regressões, 17 core de camadas, 8 cena/seleção e 36 painel/ferramentas).
  `typecheck:app`, `check:org-scope` e `git diff --check` aprovados. Revisão
  independente final por leitura sem achados acionáveis. Sem build ou publicação.
- Touch em aparelho e gravação remota de camadas permanecem sem validação.
  O ensaio temporário não integra as rotas ou artefatos públicos entregues.
- Refino de motion em 11/11 após comentário do usuário: validação nível 2,
  18 testes do painel aprovados, incluindo quatro novos de acompanhamento,
  reversão/cancelamento, movimento reduzido e escala/rolagem. `typecheck:app` e
  diff aprovados; revisão por leitura sem achados. No IAB, capturas durante o
  gesto confirmaram deslocamento direto,
  abertura de espaço e marca do destino em 1243 × 699 e 379 × 819 CSS px;
  soltar e desfazer conferidos no controlador fictício. A animação nativa em
  aparelho permanece não validada. Sem repetir a suíte ampla ou publicar.
- Olhos/cadeados por camada, 11/11: 276 testes em 15 suítes aprovados nesta
  etapa (sem somar as anteriores); tipos, org-scope e diff aprovados. Cobertura
  de estados/no-op, apresentação/seleção 2D/3D, JSON web/native, importação,
  compartilhamento, UI, leitura e autosave. Um teste antigo passou a verificar
  identidade no-op e visibilidade efetiva: `visibleActorIds` ausente inclui todos.
  No IAB, ocultar/restaurar ator em 2D/3D, bloquear arraste sem criar edição extra,
  desfazer e bola simultaneamente oculta/bloqueada foram conferidos. Controles
  móveis medidos em aproximadamente 44 px, com rótulos legíveis. Download JSON
  real do ensaio preservou uma bola oculta/bloqueada e um ator bloqueado.
  Revisão identificou e corrigiu colagem sobre ator protegido; quatro regressões
  adicionais verificam no-op e preservação de geometria. Sem achados finais.
  Não houve gravação de dados reais; limites de aparelho e persistência remota
  continuam os mesmos.
- Indicador P1, correção nível 2 após comentário do usuário: 59 testes focados
  de ferramentas/workspace e controles de simulação aprovados, incluindo quatro
  cenários de quadra livre, recepção individual, ataque individual e sequência.
  Tipos e diff aprovados; revisão independente por leitura sem achados.
  No IAB, quadra livre sem indicador e navegação real
  P5 → P4 conferidas com dados fictícios, sem gravação remota.
- Seleção por formato, microajuste nível 1 de 11/11: silhueta humana e nove
  tipos de objeto conferidos no IAB em desktop e viewport móvel solicitado de
  390 × 844. Cena fictícia incluiu cone/escada girados, texto branco inclinado,
  seta branca tracejada, curva, desenho livre e área. Contornos saem ao tocar
  no vazio; árvore acessível apresenta uma única ocorrência do texto.
  Os quatro testes existentes da cena passaram; revisão por leitura sem
  achados funcionais. Tracejado permaneceu reconhecível na inspeção móvel.
  O atributo nativo `accessible` passou a ser omitido no web após um aviso do
  React; `aria-hidden` preserva o caráter decorativo do contorno no navegador.
  Sem mudanças em hit-test, persistência ou 3D; aparelho nativo não conferido.
- Cor em grupo, correção funcional nível 2 de 11/11: 47 testes do workspace
  aprovados, com 13 casos novos; tipos e diff aprovados. No IAB fictício, a
  paleta contextual mudou 11 jogadores, cone e texto juntos, mantendo um jogador
  bloqueado; desfazer/refazer restauraram o grupo em um passo. Propriedades
  também aplicou cor ao grupo misto e preservou o ator bloqueado.
  Revisão corrigiu a paleta escondida pelo primeiro item bloqueado e o no-op
  indevido em ator importado sem cor explícita; sem achados finais.
  O indicador acompanha os defaults atuais da vista 2D/3D, que já diferem para
  atores sem cor explícita; renderers preservados. Sem recolorir dados reais.
- Indicador misto, microajuste nível 1 de 11/11: traço substituído por amostra
  circular das cores da seleção. Os 47 testes existentes do workspace passaram;
  revisão por leitura sem achados. Amostras diagonais de duas e quatro cores e
  abertura da paleta inspecionadas no IAB com dados fictícios, preservando
  tamanho e ações. O ajuste diagonal também passou pelos 47 testes existentes.

Fontes: [workspace](../../src/components/visual-court/CourtWorkspaceView.tsx),
[cena 2D](../../src/components/visual-court/CourtEditorScene.tsx),
[gestos](../../src/components/visual-court/CourtEditorCanvas.tsx),
[metadados/importação](../../src/core/visual-court-editor.ts),
[resolvedor de camadas](../../src/core/court-layers.ts).
