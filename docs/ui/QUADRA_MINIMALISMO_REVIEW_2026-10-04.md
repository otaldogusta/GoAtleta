# Quadra visual — revisão de minimalismo

Data: 04/10/2026. Produto: Go Atleta. Estado: revisão e primeira aplicação local autorizada. Os achados abaixo registram o diagnóstico anterior; a evidência da correção aparece no fechamento.

## Diagnóstico

A quadra já oferece boa parte do necessário para desenhar e explicar uma jogada. O principal problema é a distribuição das ações: documento, objetos, reprodução e etapas competem em barras independentes. Há comandos repetidos, comandos visualmente iguais com destinos diferentes e estados de armazenamento que o usuário precisa interpretar.

A recomendação é reduzir decisões simultâneas e tornar o resultado de cada ação previsível. Diminuir fontes, botões e opacidade indiscriminadamente apenas deixa a mesma complexidade mais difícil de enxergar.

## Método e limites

- Inspeção do código atual do workspace, canvas, cena, controles, biblioteca, etapas e persistência; leitura das capturas e comentários fornecidos pelo usuário.
- Comparação com documentação oficial do TacticalPad e FastDraw, e descrição e imagens oficiais do Coach Tactic Board: Volley na App Store. São referências de organização e interação, não testes comparativos de desempenho ou de todas as versões instaladas.
- Tentativa de conferência em localhost:8081: não havia servidor ativo. O servidor temporário iniciou e gerou o bundle, mas indicou ausência de configuração Supabase nos extras do app; o navegador permaneceu em carregamento. O processo iniciado para a revisão foi encerrado. Não houve smoke autenticado novo, nem matriz responsiva nesta revisão.
- Medidas abaixo vêm do código, não de um DOM autenticado atual. Capturas anteriores mostram problemas e estados daquele momento; correções recentes não são tratadas como bugs ainda reproduzidos.
- Risco da entrega: baixo, somente documentação e checklist. Alterações futuras em salvamento, rascunhos e vínculo com a aula exigem validação funcional e de escopo organizacional.

## O que já está no caminho certo

Preservar a quadra como protagonista; edição de texto no local; Bola e Cone com seleção direta; velocidade em uma lista compacta; ação contextual junto ao objeto; propriedades abertas por intenção; card selecionado sem saltar na biblioteca; um único modelo padrão de recepção 5×1; e o card de adicionar etapa no fim da sequência.

Esses avanços resolvem reclamações concretas. A revisão não propõe restaurar a caixa de texto, abrir propriedades automaticamente, trazer de volta o bloco “Em edição agora”, nem recriar os presets antigos em todas as turmas.

Jogadores, nomes, numeração, posições, trajetos e cores autorais devem permanecer intactos. Uma apresentação mais discreta da quadra deve ser uma preferência de visualização, nunca uma limpeza dos dados.

## Referências externas e aplicação

| Referência | Evidência consultada | O que aproveitar | Limite da comparação |
| --- | --- | --- | --- |
| TacticalPad | O treinamento oficial separa gestão de projetos e quadros, uso básico e criação de animações. | Uma hierarquia clara: jogada contém etapas; a ferramenta modifica o objeto; reprodução apresenta o resultado. | Produto amplo; sua quantidade de funções e o 3D não são uma meta de minimalismo para o Go Atleta. |
| FastDraw | O guia descreve prévia de jogador junto ao cursor, edição direta e FastBuild para transportar jogadores e bola à próxima posição. | Previsibilidade ao colocar objetos e distinção entre copiar uma etapa e continuar sua posição final. | Guia de basquete, com material histórico indexado. Não foi executada uma versão atual do aplicativo. |
| Coach Tactic Board: Volley | A descrição oficial inclui pastas e apresentação de jogadores; as imagens promocionais mostram biblioteca com miniaturas e pastas, além de ferramentas ao redor da quadra. | Reconhecer uma jogada pela imagem e organizar arquivos pelo uso. | As imagens também exibem muitas ferramentas. Não justificam copiar sua densidade; a alegação de simplicidade é do fornecedor. |

Fontes: [TacticalPad — Quick Training](https://www.tacticalpad.com/edu/formation.php), [FastDraw — Adding Players and Movements](https://support.fastmodelsports.com/support/solutions/articles/9000223790-adding-players-and-movements), [FastDraw — guia oficial](https://download.fastmodelsports.com/support/FastDrawBasicUserGuide.pdf), [Coach Tactic Board: Volley — página oficial na App Store](https://apps.apple.com/us/app/coach-tactic-board-volley/id861268156).

A conclusão de design abaixo é uma inferência aplicada ao código e às reclamações do Go Atleta. Nenhuma dessas fontes demonstra que o concorrente é globalmente mais fácil de usar.

## Achados, por prioridade

P1: confusão no fluxo principal ou dificuldade de acesso. P2: ruído, legibilidade ou refinamento. Não foi identificada nesta análise uma falha crítica de perda de dados comprovada em execução.

| # | Prioridade | Achado e evidência | Consequência | Recomendação |
| --- | --- | --- | --- | --- |
| 1 | P1 | Seis regiões de controles: histórico, cabeçalho, ferramentas, configurações, etapas e zoom. A seleção e os painéis adicionam outras regiões. | O olhar precisa procurar comandos em vários cantos. | Consolidar ações do documento no topo e ações da etapa embaixo; manter ferramentas e zoom em posições estáveis. |
| 2 | P1 | A timeline mistura reprodução e edição: anterior, play, próxima, velocidade, reinício, editar, animar, duplicar, adicionar e recolher. | O usuário precisa distinguir transporte da animação de alterações na sequência. | Barra de reprodução com poucos controles; editar/duplicar/excluir no menu da etapa. Animar pertence à ferramenta lateral. |
| 3 | P1 | Existem três entradas de etapa vazia. O card final insere no fim; os dois outros comandos usam a etapa atual como ponto de inserção. | O mesmo “+” pode gerar uma etapa em lugares diferentes. | Um card final “+ Etapa”. Outros modos de criação apenas em menu explícito, com destino indicado. |
| 4 | P1 | “Nova quadra” cria um documento; “Adicionar quadra vazia” cria uma etapa; “Nova jogada” também cria documento na biblioteca. | A palavra quadra não esclarece o que será criado. | Quadra = área de trabalho; jogada = arquivo; etapa = item da sequência. “Nova jogada” e “+ Etapa” como ações distintas. |
| 5 | P1 | Rascunho local, arquivo remoto e modelo são distintos, mas Salvar fica desabilitado somente por `!dirty`. | Um rascunho ou modelo aberto sem mudanças pode estar sem salvamento remoto e ainda mostrar Salvar indisponível. | Separar alteração pendente de destino do salvamento. Permitir salvar uma cópia local ainda não sincronizada; só indicar salvo remoto após confirmação. |
| 6 | P1 | Todos os itens da biblioteca usam o mesmo ícone de livro/exercício como miniatura. | Títulos repetidos como “Nova jogada” não permitem reconhecer o conteúdo rapidamente. | Pequena prévia real da primeira etapa, título e uma linha curta de metadados. |
| 7 | P1 | As abas misturam local de armazenamento com “Esta aula”, que é um filtro cumulativo. Favoritos é outro filtro. | Uma combinação ativa pode esconder o arquivo sem explicar por quê. | Manter Esta aula junto à navegação, conforme pedido anterior, mas distingui-la visualmente como filtro; mostrar Limpar filtros quando o resultado estiver vazio. |
| 8 | P1 | A biblioteca chega a 420 px; em 1050 px isso representa cerca de 40% da largura. Painéis sobrepõem a cena. | Parte da jogada pode ficar coberta enquanto o usuário procura ou compara arquivos. | Em desktop amplo reservar espaço real ao painel; em tela intermediária usar sobreposição temporária. Não deslocar atores ou alterar coordenadas para caber. |
| 9 | P2 | Movimento do ponteiro na quadra reduz opacidade dos controles a 0,28; um temporizador restaura após 1,4 s. Existem também estados de fixação/recolhimento. | A aparência varia durante a busca por ações; a redução afeta a leitura dos controles. | Aparência estável ao editar. Usar ocultação intencional em apresentação, com saída clara. |
| 10 | P2 | A barra esquerda possui oito ferramentas e mais dois botões, incluindo excluir seleção. | Há ação destrutiva visível mesmo sem objeto selecionado. | Retirar exclusão da barra fixa; preservar Delete e ação contextual. Agrupar ferramentas menos usadas, mantendo Bola e Cone diretos. |
| 11 | P2 | Ações da seleção ficam em uma coluna com posições alternadas, de até 54 × 170 px, e botões de 32 px. | O grupo invade a cena e muda de comprimento segundo o objeto. | Pequena faixa contextual com editar, duplicar e mais opções; cor permanece próxima. Alvo de toque maior que o ícone. |
| 12 | P2 | X de 28 px em todas as miniaturas, inclusive desabilitado quando há só uma etapa. | A ação de excluir compete com visualizar e selecionar a etapa. | Excluir no menu da etapa selecionada; desktop pode mostrar acesso no hover/foco sem depender dele para touch. |
| 13 | P2 | Metadados da biblioteca usam 10 px, títulos 12 px, filtros 11 px; a referência do produto usa 14 px para linha e 12 px para metadado. | A interface parece compacta, mas custa mais ler e localizar. | Reduzir campos visíveis e repetição; usar a escala legível do produto. |
| 14 | P2 | O scrubber apresenta tempo atual/total e mais cinco marcações de tempo, em 10–11 px. | Há precisão visual além do necessário para assistir à etapa. | Manter atual/total e trilho. Mostrar marcações adicionais somente em edição detalhada de duração. |
| 15 | P2 | Texto inline usa Times New Roman; texto SVG não declara a mesma família. A largura é estimada por número de caracteres. | Possível mudança de métrica entre plataformas, corte ou deslocamento em frases longas. | Definir uma família compartilhada para novos textos e medir o conteúdo real. Preservar textos existentes. |
| 16 | P2 | Seleção de desenhos usa distância aos pontos, não as dimensões reais de um texto longo ou rotacionado. | Uma anotação pode parecer clicável nas pontas, mas responder somente perto do centro. | Hitbox derivada da representação visual, com tolerância de toque e seleção sem exigir precisão excessiva. |
| 17 | P2 | Colocar jogador, bola, cone e texto retorna a Selecionar; desenho livre e seta continuam como ferramenta ativa. | Para inserir vários cones/jogadores o usuário volta repetidamente à barra. | Tornar o comportamento explícito. Avaliar repetição enquanto a ferramenta está ativa e Escape para sair; não mudar o padrão sem conferir com o uso real. |
| 18 | P2 | O tooltip “Materiais de treino” ativa Cone diretamente; ícone de compartilhar abre Exportar. | A legenda anuncia uma ação diferente do resultado. | “Adicionar cone” e “Exportar”, com ícone coerente. Usar painel Materiais apenas para o catálogo. |

### 1. Etapas: eliminar duplicidade sem perder recursos

O código confirma que `addBlankStep(payload, index)` insere depois do índice recebido e seleciona a nova etapa. O card final passa o último índice; o botão da toolbar e o comando textual passam o índice atual. Não se trata de uma etapa perdida: trata-se de dois destinos sob nomes muito parecidos.

Preservar o comportamento aprovado do card final: criar etapa vazia no fim, selecioná-la e fazer sua miniatura aparecer. Texto sugerido: “Etapa vazia 3”, em vez de “Quadra vazia 3”. O resultado deve ficar visível sem o usuário procurar horizontalmente.

Uma lista de opções pode preservar “Duplicar etapa” e “Continuar do final desta etapa” como operações distintas. A função `duplicateStep` copia a etapa e sua animação; `continueStepFromEnd` usa as posições finais como começo da próxima. Não usar “Duplicar com animação” como sinônimo de continuar.

O fluxo da toolbar deveria ser: **anterior · reproduzir/pausar · próxima · velocidade · reiniciar · opções da etapa · recolher**. A miniatura selecionada identifica a etapa atual; o card final resolve criação. Retirar a duplicação da ferramenta Animar nessa barra.

### 2. Biblioteca: reconhecimento antes de organização avançada

Hoje os grupos por armazenamento são úteis para informar onde o arquivo existe, mas exigem ler todos os nomes e metadados. A miniatura genérica ocupa espaço sem ajudar a reconhecer nada.

Primeira mudança recomendada: substituir o ícone repetido pela cena real; título com 14 px; segunda linha com 12 px, normalmente apenas quantidade de etapas e data. Usar “1 etapa” no singular. Mostrar “Neste dispositivo” quando essa condição for relevante, evitando repetir o aviso no grupo, no item e no rodapé ao mesmo tempo.

Conservar o arquivo aberto na mesma posição. Um fundo discreto e “Editando” bastam; o ponto verde pode ser dispensado se a indicação textual já distingue o estado. Não acrescentar contorno forte sobre fundo, ponto e badge simultaneamente.

Busca, filtros e criação devem ficar fora da área rolável de resultados. Atualmente o cabeçalho permanece, mas busca e filtros estão no ScrollView que contém os itens; podem sair da vista em uma biblioteca longa. Isso dificulta refinar uma busca no fim da lista.

Para a primeira rodada, manter as categorias existentes e Esta aula na mesma linha, distinguindo categoria de filtro. Depois avaliar a navegação mais curta “Jogadas / Modelos”, com local, favoritos e aula em filtros. Esse segundo desenho é hipótese para mockup, não decisão de apagar abas ou transformar a biblioteca da turma em biblioteca global.

Pastas por finalidade podem ajudar quando houver volume real, como no Coach Tactic Board. Não são requisito para organizar uma biblioteca de um ou dois arquivos; introduzi-las agora acrescentaria administração.

### 3. Salvar: pouco texto, significado preciso

Há proteção local automática após 300 ms, e a troca de um conteúdo alterado guarda backup. Salvar um arquivo remoto existente envia atualização pelo mesmo ID; salvar conteúdo local ou de modelo cria outro documento. Falhas de rede/autenticação podem produzir salvamento local. A lixeira também é uma preferência local por usuário, organização e turma, não exclusão remota do documento.

Por isso, o cabeçalho pode continuar sem a frase longa “Rascunho salvo no dispositivo”, como solicitado. A confiança deve vir de um único estado curto associado a Salvar: pendente, salvando, salvo ou falha. O detalhe do destino pode aparecer ao abrir os dados da jogada ou no item local da biblioteca. Falha de proteção local precisa continuar perceptível mesmo com a biblioteca fechada.

Proposta de estados: alteração pendente → Salvar disponível; apenas local sem alterações novas → Salvar disponível para sincronizar; operação em curso → Salvando; confirmação remota → Salvo; fallback local → mensagem curta informando que a sincronização continua pendente. Não prometer salvamento remoto por haver backup local.

“Mover para lixeira” deve comunicar seu escopo local no feedback ou nos dados do item. Não deve fazer alguém concluir que removeu a jogada dos outros dispositivos ou de toda a equipe.

### 4. Minimalismo visual e tipografia

O contraste e a organização devem favorecer jogadores, bola e trajetos. A superfície navy dos controles combina com o produto; evitar muitos contornos concêntricos, cartões dentro de cartões e fundos ativos igualmente fortes.

Reservar verde de preenchimento para Salvar e a ferramenta ativa. Seleção de arquivo/etapa pode usar borda fina ou superfície discreta, acompanhada de indicação acessível. Desfazer não precisa ter o mesmo peso de Salvar; reiniciar etapa deve continuar com ícone diferente de Desfazer.

Fontes menores não removem informações: apenas as comprimem. Para biblioteca e menus usar 14 px nas ações, 12 px em metadados, e 16 px no título de seção, conforme o design system. A tipografia dos jogadores é conteúdo pedagógico e deve responder ao zoom; não aplicar a escala de metadado aos números na quadra.

As cores dos atletas e materiais podem ser essenciais para a explicação. Um fundo de quadra mais suave é uma opção de visualização a testar, preservando contraste e marcações. Não desaturar automaticamente jogadores, trocar uniformes ou renumerar o trabalho existente.

### 5. Ferramentas: compacto como um editor, acessível como um app

A referência a Photoshop faz sentido para agrupamento de ferramentas e opções junto à ferramenta ativa. Não implica copiar alvos de mouse pequenos em uma interface também usada com toque.

Preservar Selecionar, Jogador, Bola, Cone, Texto e Animar como acessos claros. Seta, curva, área e desenho livre podem compartilhar um grupo Desenhar; o catálogo avançado permanece em Mais ferramentas. A escolha entre seis ou sete acessos fixos depende de testar se Texto merece acesso próprio; o atalho T pode complementar, sem substituir o acesso por toque.

As opções Livre/Reto podem continuar no popover compacto já criado. Sua escolha deve aparecer como estado da ferramenta ou tooltip; não precisa acrescentar instrução permanente na cena.

A faixa contextual aparece só com seleção. Pode ter editar, cor, duplicar e opções; exclusão e rotação ficam disponíveis sem inflar a barra inteira. Ícones de 16–20 px podem viver dentro de áreas de toque de 40–44 px. Não reduzir o alvo para conseguir aparência menor.

Escape hoje fecha simultaneamente painéis, barras, seleção e modo. Uma alternativa mais previsível é fechar primeiro o menu aberto, depois sair da ferramenta e por fim limpar seleção. Isso é alteração de comportamento a validar, não simples troca visual.

## Estrutura proposta

```text
Topo     [Voltar]  Nome da jogada        [Biblioteca] [Salvar] [⋯]
         Turma                         exportar/criar/configurar em ⋯

Lateral  Selecionar · Jogador · Bola · Cone · Desenhar · Texto · Animar

Centro   QUADRA
         opções do objeto aparecem junto à seleção

Base     anterior · play · próxima · velocidade · reiniciar · ⋯
         tempo atual / total ───────────────
         [etapa 1] [etapa 2] [etapa 3] [+ Etapa]

Canto    zoom · ajustar à tela
```

É um esquema conceitual, não um mockup final. No topo, Biblioteca e Salvar continuam encontráveis; Nova jogada e Exportar podem ir ao menu. Desfazer/refazer podem integrar a mesma região superior, sem criar mais um bloco flutuante. No canto da vista, mover pode ser acessado por Espaço/arraste ou por ferramenta de mão; o touch deve conservar acesso explícito.

| Estado de trabalho | Deve permanecer visível | Deve aparecer por contexto |
| --- | --- | --- |
| Editando a cena | Identidade da jogada, Salvar, ferramentas, acesso a etapas e zoom | Opções da ferramenta e seleção |
| Editando animação | Ferramenta Animar ativa, etapas e reprodução | Trajeto Livre/Reto, opções da etapa |
| Procurando arquivo | Cabeçalho, busca, filtros e resultados da biblioteca | Menu do item e dados da jogada |
| Apresentando | Quadra e reprodução simples | Sair da apresentação; edição reaparece por intenção |

Não criar abas de modo “Desenhar/Editar/Animar” sem necessidade. Esses estados podem ser derivados da ferramenta e dos painéis existentes; novas abas também custam atenção.

## Responsividade

O cabeçalho atual já tem regras para compactar e quebrar ações. Isso é um avanço, mas não resolve sozinho a convivência de todos os painéis.

- Em 1050 px, sem safe areas, a fórmula atual fornece cerca de 430 px à timeline. A fileira de controles pode ultrapassar essa largura; sua rolagem horizontal não exibe scrollbar. A ação principal de reprodução precisa caber sem rolar; opções secundárias vão ao menu.
- Painel de 420 px no mesmo viewport cobre cerca de 40% da largura. No desktop amplo, considerar reserva de uma coluna e recalcular a vista. Em largura intermediária, painel temporário; em mobile, uma superfície própria de busca ou configuração.
- Em telas estreitas, preservar área de toque e usar rolagem nas miniaturas, que são conteúdo sequencial. Evitar depender de rolagem escondida para encontrar comandos.
- Ancorar menu e ações da seleção no espaço útil: não só dentro da viewport, mas fora das regiões já ocupadas por barras e painel. As fórmulas atuais limitam coordenadas à tela, sem um mapa completo de obstruções.
- Reaproveitar capacidades responsivas e largura do container. Não padronizar todos os breakpoints locais automaticamente: a quadra também precisa considerar altura disponível para a cena.

Não há evidência nesta revisão de uma nova regressão responsiva reproduzida. Essas são restrições para a próxima proposta e seus testes.

## Ordem de execução recomendada

1. **Clareza do fluxo:** nomenclatura, criação de etapa em um lugar, destino visível e distinção de Salvar/local/remoto. Corrigir também legendas inconsistentes.
2. **Redução visual:** separar reprodução de edição; retirar ações duplicadas e destrutivas da área fixa; estabilizar opacidade; manter os acessos frequentes.
3. **Biblioteca:** miniaturas reais, escala tipográfica, busca/filtros fixos e seleção discreta. Manter o modelo 5×1 e a posição dos arquivos.
4. **Contexto e espaço:** faixa junto ao objeto, opções ancoradas e tratamento de painéis por largura disponível.
5. **Polimento:** métricas de texto inline, hitbox de texto longo, repetição de inserção e ordem do Escape. Validar cada comportamento isoladamente.

A primeira revisão de layout deve mostrar uma jogada real com muitos atores e etapas, uma quadra vazia e a biblioteca aberta. Aprovar apenas uma cena vazia ocultaria os conflitos que motivaram esta revisão.

## Critérios verificáveis para a futura entrega

- Adicionar pelo card final cria uma única etapa vazia no fim, seleciona e revela sua miniatura. Copiar e continuar têm nomes e resultados distintos.
- Em uma etapa intermediária, criar não muda silenciosamente de destino segundo o botão usado.
- Arquivo local inalterado pode ser salvo remotamente; falha mantém trabalho recuperável e não mostra confirmação remota falsa.
- Trocar arquivos não cria cópia por simples visualização; o item selecionado conserva posição. Nenhum dado autoral ou preset armazenado é apagado pela organização visual.
- Biblioteca permite reconhecer jogadas com nomes iguais pela prévia; busca/filtros permanecem acessíveis ao rolar resultados; filtro vazio oferece limpar.
- Reprodução e velocidade ficam acessíveis sem rolagem de toolbar. Ações secundárias continuam disponíveis no menu.
- Texto curto, longo e rotacionado pode ser selecionado, editado inline, confirmado e cancelado; edição não muda a aparência depois de confirmar.
- Menus não cobrem o alvo selecionado ou saem da tela; touch não depende de hover. Foco, Escape e rótulos continuam acessíveis.
- Conferir desktop intermediário de 1050 px, desktop amplo e uma largura mobile apenas na implementação que alterar layout; não considerar a inspeção estática como essa validação.
- Registrar erros, tempo para encontrar um arquivo e passos para montar duas etapas antes/depois com tarefas equivalentes. Meta: reduzir procura e comandos duplicados sem aumentar erros; não atribuir percentuais de melhoria sem medição.

## Evidência interna

Referências relativas ao repositório, com trechos identificáveis para evitar depender de linhas que mudarão:

- `src/components/visual-court/CourtEditorWorkspace.tsx`: `TOOLS`, `draw`, `addPlayer`, `controlFade`, `headerActions`, `timelineWidth`, barra de etapas, `libraryGroups`, painel e menu dos itens.
- `src/components/visual-court/CourtEditorCanvas.tsx`: seleção por distância aos pontos, `textWidth`, `textDraft`, `actionLeft` e `actionTop`.
- `src/components/visual-court/CourtEditorScene.tsx`: desenho de texto e representação de atores compartilhada com miniaturas.
- `src/components/visual-court/CourtEditorControls.tsx`: `CourtActionButton`, tooltip e alvo mínimo de 44 px.
- `src/components/visual-court/CourtTimelineScrubber.tsx`: tempo atual/total e cinco marcações auxiliares.
- `src/components/visual-court/court-library.ts`: distinção local/turma/modelo, proteção de posição do item e ocultação de starters legados intactos.
- `src/components/visual-court/useCourtEditor.ts`: proteção local, backups, assinatura de alteração, identificação do documento, salvamento e lixeira local.
- `src/core/visual-court-editor.ts`: `addBlankStep`, `duplicateStep` e `continueStepFromEnd`.
- `src/db/technical-visuals.ts`: `saveTechnicalVisual` atualiza arquivo existente e pode retornar fallback local.
- `docs/ui/DESIGN_SYSTEM.md` e `docs/ui/RESPONSIVE_RULES.md`: tipografia, hierarquia, tokens e capacidades.

## Estado de entrega

Primeira aplicação local autorizada após a revisão. Sem commit, push ou publicação. O checklist distingue implementação, verificações e hipóteses futuras.

### Correções aplicadas

- Documento: Voltar, identidade, Biblioteca, Salvar e opções no cabeçalho. Nova jogada, exportação, configurações e histórico no menu. Expansão/recolhimento explícitos; removido o desvanecimento ao mover o ponteiro. Criar uma nova jogada usa o nome novo sem renomear a atual ao salvá-la.
- Etapas: faixa com anterior, reprodução, próxima, velocidade, reinício, opções e recolher; sem rolagem de comandos. Duplicar, continuar e excluir no menu; exclusão não ocupa todas as miniaturas. Um card final cria e seleciona a etapa vazia, com nome “Etapa vazia N”. Mantidos duração, notas, reordenação e limpeza de animação.
- Biblioteca: componente `CourtLibraryBrowser` com miniatura real, título de 14 px e metadados de 12 px; busca e filtros fora da rolagem de resultados. Esta aula continua ao lado de Modelos; resultado vazio permite limpar filtros. Item em edição tem fundo discreto e um único indicador textual. Lixeira continua local e reversível.
- Contexto: FAB em arco de quatro ações de 44 px, com abertura e fechamento animados. Cor atual no botão e paleta compacta restaurada; rotação e exclusão usam a lista flutuante do app; preservados os atalhos. Escape fecha o contexto mais próximo antes de limpar seleção. Menus recebem foco, permitem navegar com Tab/setas e devolvem o foco ao acionador ao fechar. Bola e Cone continuam diretos; tooltip de Cone foi corrigido.
- Espaço: painéis entram com transição de 160 ms sobre a cena estável, respeitando movimento reduzido. Removida a reserva lateral que encolhia a quadra e criava o recorte azul; superfície opaca no painel. Ajustes de vista não alteram coordenadas autorais. Um conflito de alvos da reprodução encontrado em 390 px foi corrigido antes do fechamento.
- Texto: família compartilhada entre SVG e input transparente; largura medida no browser e área de seleção que acompanha texto longo e rotação. Mantida a aparência das anotações existentes. Tempo atual/total e trilho substituem as cinco marcações redundantes.
- Persistência: um modelo ou arquivo somente local pode ser salvo sem editar antes; fallback local permanece recuperável e permite tentar sincronizar novamente. Atualização conserva a posição da linha. Troca de documento bloqueada durante uma gravação em curso. Falha de proteção local fica no cabeçalho até armazenamento bem-sucedido.

### Validação registrada

- 53 testes focados aprovados entre comandos do editor, cena, biblioteca, controlador de persistência e geometria de texto. Incluem falha de gravação, fallback/reabertura/tentativa de sincronização, concorrência e isolamento usuário/organização/turma.
- `typecheck:app`, `check:org-scope`, ESLint dos arquivos de implementação alterados e `git diff --check` aprovados. Perf-hygiene passou, mas seu detector não inclui os componentes alterados; não equivale a uma medição de desempenho do editor.
- Localhost autenticado, usando o checkout Downloads com configuração existente: 1050×704, 390×844, 834×1194 e 1440×1024. Conferidos menus por Enter, Tab/Shift+Tab e retorno de foco por Escape, velocidade, busca vazia/limpar, miniaturas, etapa vazia selecionada e retornada por Desfazer, faixa contextual, texto longo inline/Enter e edição pelo extremo de texto rotacionado. Escape cancelou edição. Mudanças temporárias foram desfeitas; nenhuma gravação remota foi acionada.
- Verificação de 390 px: largura do documento 390 px; Opções da etapa e Recolher sem interseção após o ajuste. Reserva de espaço conferida em desktop amplo. Tema escuro conferido; tema claro e aparelho nativo permanecem sem smoke novo nesta rodada.

Salvar no servidor, erro de quota do armazenamento e cenário sem conexão foram exercitados com mocks, não com gravações reais nesta conta. Isso não prova sincronização de produção. Busca fixa foi conferida pela estrutura e funcionamento; a conta atual tem poucos arquivos visíveis, sem biblioteca volumosa para medir custo de renderização.

### Hipóteses preservadas para avaliação futura

Repetição de inserção, agrupamento adicional de desenhos, pastas por finalidade, nova navegação Jogadas/Modelos, apresentação e preferência por fundo mais suave permanecem hipóteses. Não são requisitos para usar as correções desta rodada, nem autorização para apagar arquivos ou mudar cores pedagógicas. Não foi medido ganho percentual ou tempo de tarefa com usuários.

### Refino solicitado após a primeira aplicação

- Menus de jogada, etapa e seleção: linhas de 40 px, fonte 13 px, 4 px de respiro, sem caixas individuais. Altura calculada pelo conteúdo aproxima a lista do acionador e evita rolagem de poucos pixels.
- Ferramentas: cards reduzidos de 76 para 64 px, ícones de 22 px; abertura curta por `useDisclosureMotion`, sem mudar o enquadramento ou os dados da cena.
- FAB: arco com lápis, duplicar, cor e opções, com alvos de 44 px. Paleta com nove cores; no celular fica acima dos controles da reprodução.
- Verificação nova em localhost autenticado a 1384×704 e 390×844: dimensões da cena iguais antes/depois de abrir Ferramentas; transição observada de opacidade 0,085 e deslocamento −3,66 px para opacidade 1 e deslocamento zero; menu da etapa sem rolagem artificial, Tab/Escape com retorno de foco; paleta aplicada e revertida por Desfazer, preservando a cor anterior. Sem overflow horizontal em 390 px. Tipos e ESLint aprovados nesta rodada; os 53 testes acima pertencem ao fechamento anterior.

- Ajuste posterior: quando Excluir é a única opção, a lixeira ocupa diretamente o quarto botão do arco. Cone, escada, alvo e texto mantêm o menu com girar/excluir. Exclusão continua reversível por Desfazer. Ícone direto conferido no localhost; dois testes focados de exclusão e ESLint aprovados.

### Correção da troca de arquivos na biblioteca

- Causa: sair de um rascunho editado gerava outro ID local para seu backup, mesmo quando ele já tinha um card. Agora o backup atualiza esse mesmo ID e conserva a posição da linha. Um ID local recuperado do cache também é mantido quando seu card ainda não foi carregado.
- Abrir o card atual é uma operação sem efeito: não fecha Biblioteca, não substitui alterações em curso e não limpa histórico. O X fecha normalmente; Escape continua disponível.
- Trocas simultâneas são bloqueadas. A quadra só muda depois da proteção local; falha de armazenamento mantém o documento aberto. Modelos e documentos remotos continuam preservados ao guardar uma versão local alterada.
- Cópias locais com conteúdo idêntico ficam agrupadas visualmente em um card, preferindo o que está aberto. Nenhum registro é apagado e a lixeira conserva os arquivos individuais. Nomes iguais com conteúdo diferente continuam como versões distintas, incluindo alterações ainda não salvas.
- Validação desta rodada: 28 testes entre biblioteca e controlador, tipos, escopo organizacional, ESLint e diff aprovados. Testes com armazenamento/API simulados cobrem edição, troca/reabertura/reload, recuperação de ID, concorrência e erro local. No localhost autenticado a 1384×704, clicar duas vezes no rascunho manteve o painel e o indicador Editando; abrir 5×1 não aumentou a quantidade de cards, e o X fechou. Os dois rascunhos antigos visíveis têm conteúdo diferente e foram preservados. Nenhuma edição autoral ou gravação remota foi feita nesta conferência.
- Microajuste posterior de texto: “Criar com rascunho local” virou “Criar sem salvar na turma”, mantendo a criação de quadra vazia e a proteção das alterações atuais no dispositivo. Rótulo visual e acessível conferido no modal em localhost; ESLint e diff aprovados. Nenhuma nova jogada foi criada durante essa conferência.
- Ajuste de nomenclatura solicitado em seguida: comando do cabeçalho, modal, rótulos acessíveis e nome padrão da cena vazia usam “Nova quadra”. Botão secundário reduzido para “Criar sem salvar” e seção local da Biblioteca para “Rascunhos”. Armazenamento permanece interno ao navegador/app, separado por usuário/organização/turma; não representa download de arquivo ou envio a outro dispositivo. Rótulos e abertura do modal conferidos no localhost, sem acionar criação ou salvamento; ESLint e diff aprovados.
- Filtro “Esta aula”: removida a borda exclusiva; fundo, tamanho e peso de fonte seguem as mesmas regras dos outros filtros, mantendo o comportamento cumulativo. No localhost, estado desmarcado conferido com fundo transparente, borda zero, 12 px/peso 500; selecionado usa o fundo do filtro ativo e peso 700. Filtro ativado e desativado sem alterar arquivos; diff conferido.

### Nome da quadra editável no cabeçalho — 05/10/2026

- O título superior identifica a quadra/jogada aberta; o nome da turma permanece abaixo. Clicar ou acionar o título pelo teclado abre edição inline transparente, com fonte de 16 px/peso 600, sem caixa separada.
- Enter ou perder foco confirma um nome não vazio, removendo espaços nas extremidades. Escape cancela; vazio ou nome inalterado preserva o título e não cria entrada no histórico. Campo remonta ao trocar o documento. Edição usa o mesmo comando de metadados existente, com Desfazer e rascunho; nenhuma nova operação de banco ou renomeação da turma foi introduzida.
- 35 testes focados aprovados: sete de interação/validação do título e 28 existentes de persistência/Biblioteca. Tipos, ESLint e diff aprovados. No localhost autenticado: Enter, perda de foco, Escape, atualização do card e Desfazer; entrada longa medida em 390 px com largura de 254 px, dentro do cabeçalho e sem overflow do documento. Viewport restaurada. Títulos temporários desfeitos/cancelados; sem Salvar remoto. Aparelho nativo não exercitado nesta rodada.
