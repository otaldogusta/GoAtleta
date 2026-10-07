# Scouting no Go Atleta — pesquisa e direção de produto

Pesquisa em 06/10/2026. Pedido: aprofundar o funcionamento do scouting e refinar
o mockup, dando **a mesma importância a treinos e jogos**. É uma pesquisa aplicada
de produto, não uma revisão sistemática nem validação científica do Go Atleta.

[Abrir proposta interativa](mockups/scouting-2026-10-06.html) ·
[Escopo e conferência do mockup](SCOUTING_MOCKUP_2026-10-06.md)

## Conclusão de projeto

A melhor melhoria é tornar clara a passagem de **observação → registro → leitura
→ decisão do professor**. Uma tela com muitos indicadores não compensa critérios
ambíguos, denominadores incorretos ou um coletor que exige olhar demais para o
celular. Treino e jogo compartilham a base de ações, mas respondem a perguntas
diferentes e precisam preservar o contexto de coleta.

Propomos duas entradas igualmente visíveis, **Treinos** e **Jogos**, com um
coletor comum e leituras específicas. A tela inicial deve responder: há uma
análise para continuar, o que foi observado neste recorte e onde conferir a
evidência? A prioridade de treino é uma decisão explícita, não o menor número
encontrado entre fundamentos diferentes.

## Como um scouting é produzido

1. **Definir a pergunta.** Exemplo de treino: a recepção permite construir a
   jogada no 3 × 3? Exemplo de jogo: em quais rodízios a equipe tem dificuldade
   para conquistar o ponto quando recebe? Escolher formato, tarefa, duração e
   quem observar antes de coletar.
2. **Combinar os critérios.** Nomear cada resultado e definir situações de
   fronteira. Quem registra precisa distinguir erro que encerra a jogada de uma
   bola difícil que ainda permite continuidade.
3. **Registrar.** Ao vivo, o essencial pode ser atleta, fundamento e resultado.
   Na análise de partida completa, registrar também rally, set, quem sacava,
   desfecho e rodízio. Zonas, trajetória e vídeo podem complementar depois.
4. **Conferir.** Corrigir atribuições e resultados; desfazer um toque acidental.
   Ausência de registro não equivale a erro esportivo. Uma coleta parcial não
   deve ser apresentada como toda a partida.
5. **Calcular com o denominador certo.** Tentativas de ataque para eficiência
   de ataque; recepções observadas para qualidade da recepção; rallies recebendo
   para side-out. Contatos e rallies são unidades distintas.
6. **Devolver algo utilizável.** Mostrar a distribuição, permitir revisar as
   ações e definir uma pergunta/foco para a próxima sessão. Reavaliar em condições
   comparáveis, registrando mudanças de tarefa e de critério.

Este fluxo é nossa síntese de projeto. A [USA Volleyball](https://usavolleyball.org/resource/using-simple-stats-and-scouting/)
defende estatísticas simples que apoiem decisões e planejamento, sem tirar a
atenção do jogo. O [Data Volley](https://www.dataproject.com/Products/EN/en/Pallavolo/DataVolley)
permite começar com poucos fundamentos, completar detalhes depois e analisar
por atleta, set, rotação e vídeo. São referências práticas, não demonstrações
experimentais de que uma interface específica melhora o desempenho.

## O que as referências acrescentam

| Referência primária | Evidência relevante | Consequência para a proposta |
| --- | --- | --- |
| [USA Volleyball — Using Simple Stats and Scouting](https://usavolleyball.org/resource/using-simple-stats-and-scouting/) | O registro pode apoiar treino e jogo, mas competir com a atenção do treinador; critérios compreensíveis permitem colaboração. | Poucos controles repetidos, feedback discreto, desfazer e observação de um fundamento por vez. |
| [Data Project — Data Volley](https://www.dataproject.com/Products/EN/en/Pallavolo/DataVolley) | Coleta ao vivo ou por vídeo, enriquecimento posterior e recortes situacionais. | Registro básico primeiro; contexto avançado apenas quando coletado. Número abre evidência. |
| [Data Project — Click & Scout](https://www.dataproject.com/Products/IT/en/Volleyball/ClickAndScout) | Fluxo por toque, atleta e efeito; análises por set, rotação e fase. O exemplo de saque/recepção usa quatro etapas. | Nem todo registro cabe em dois toques. A meta de rapidez depende do detalhamento escolhido. |
| [Data Volley Media — manual, seções 2.3.4.4 e 3.1](https://dataprojectwebsoftware.blob.core.windows.net/software/dvw4media/DataVolleyMedia_handbook.pdf) | Positividade e eficiência têm significados diferentes; a avaliação depende do fundamento e do efeito na continuidade. | Remover a barra universal de “ações positivas”. Critérios visíveis e fórmula específica. |
| [Hudl — AI Volleyball Stats Explained, 2025](https://www.hudl.com/blog/ai-volleyball-stats) | Distingue eficiência de ataque, qualidade do passe, side-out, transição e métricas por rodízio. | Treinos e jogos têm leituras próprias; não inferir side-out a partir da nota de recepção. |
| [Nicklin et al., PLOS ONE, 2025](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0337579) | Codificação treinada com definições operacionais; concordância varia entre variáveis, especialmente tipos de levantamento e ataque. | Ajuda contextual e calibração entre observadores antes de automatizar interpretações. |
| [Muñoz Llerena et al., Retos, 2020](https://revistaretos.org/index.php/retos/article/view/77792) | Instrumento de minivôlei com validade de conteúdo, mas sem atingir o mínimo de confiabilidade entre observadores. | Uma escala parecer adequada não prova consistência de uso. Validar no público do app. |
| [Loureiro et al., Children, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9856447/) | Estudo de viabilidade com 18 atletas sub-13, 12 semanas e avaliações em 4 × 4: observação e planejamento se ajustavam mutuamente. | Aproximar observação e foco de treino; adaptar à aprendizagem. Amostra pequena, sem promessa universal. |
| [FIVB — regras 2025–2028, 7.6.2](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf) | Ao recuperar o saque, a equipe roda no sentido horário; posição 1 passa a 6. | Rodízio não é um contador crescente de pontos. Na prévia, R identifica a posição de referência do levantador em 6 × 6. |

Os produtos comerciais comprovam seus fluxos documentados, não eficácia
pedagógica nem precisão de IA. O estudo de Nicklin usou partidas masculinas de
elite: não valida automaticamente notas para turmas escolares. No trabalho de
Loureiro, foram consultados o conteúdo indexado do artigo e seu registro
institucional; a abertura integral no PMC/MDPI encontrou bloqueio. Não usamos
esse estudo para estabelecer metas percentuais ou um tamanho mínimo universal.

## Métricas: o que mostrar e o que evitar

| Pergunta | Indicador proposto | Informação que precisa existir |
| --- | --- | --- |
| A recepção permite construir? | Distribuição das quatro categorias; boas + completas / recepções. | Critério de recepção explícito e número de observações. |
| O saque está entrando e pressionando? | Erros, em jogo, dificultou, ace; pressão e erros consultáveis separadamente. | Resultado do saque e todas as tentativas do recorte. |
| O ataque está produzindo pontos? | (Pontos − erros) / tentativas; mostrar também continuidade. | Erro terminal, bloqueio terminal, continuidade e ponto sem dupla contagem. |
| A defesa permite reorganizar? | Distribuição por resultado e total observado. | Diferenciar tentativa de defesa e simples ausência de observação. |
| A equipe pontua recebendo? | Side-out = rallies ganhos recebendo / rallies recebendo. | Quem sacava no início e vencedor de cada rally. |
| A equipe pontua sacando? | Rallies ganhos sacando / rallies sacando. | Mesma sequência de rallies; não apenas aces. |
| Onde o jogo trava? | Recorte por rodízio/set com numerador e denominador. | Referência do rodízio, set e cobertura da coleta. |

As definições competitivas de ataque e side-out seguem as distinções da
[Hudl](https://www.hudl.com/blog/ai-volleyball-stats). A divisão entre positividade
e eficiência também aparece no [manual Data Volley Media](https://dataprojectwebsoftware.blob.core.windows.net/software/dvw4media/DataVolleyMedia_handbook.pdf).
A nomenclatura pedagógica “limitada/boa/completa” é uma **proposta nossa** e não
uma escala oficial universal. Em iniciação, “todas as opções da tarefa” não
significa exigir três atacantes de uma equipe adulta.

Não ordenar fundamentos pelo menor percentual: 55% de boas recepções e 4% de
eficiência de ataque medem coisas diferentes. Não chamar 6/8 de evolução só por
superar 4/8 da semana passada. Mostrar contagens, formato, tarefa e critério;
investigar diferenças de participantes, adversário e dificuldade. Limites
operacionais de amostra do produto não são intervalos de confiança estatísticos.

## O que encontramos no Go Atleta

Inspeção local de [models.ts](../../src/core/models.ts),
[scouting.ts](../../src/core/scouting.ts) e
[testes de scouting](../../src/core/__tests__/scouting-sessions.test.ts).
Inspeção não equivale a teste executado ou confirmação de produção.

| Já existe no código | Lacuna para esta proposta |
| --- | --- |
| Sessão com tipo, data, adversário, nota e status. | Contexto estruturado da tarefa/formato e rubrica versionada não constam nesse tipo. |
| Ação com atleta opcional, fundamento, fase, resultado 0–3 e horário. | A ação não tem rally, set, rodízio, saque inicial ou vínculo de vídeo. |
| Resultados diferentes por fundamento e sinais para planejamento. | A UI deve explicar o significado, não tratar toda nota ≥2 como a mesma qualidade esportiva. |
| Agregação para contagens legadas 0–2. | Não substituir a escala antiga pela nova nem reinterpretar histórico silenciosamente. |
| Guardas de amostra para sinais/prioridades. | “Confiança” no core deriva de limites de volume (8/20), não de validação estatística. |

Há uma questão específica a resolver antes da eficiência de ataque real: o
resultado atual **“Bloqueado”** precisa distinguir bloqueio que encerrou o rally
de toque no bloqueio seguido de cobertura. O mockup usa “Bloqueio ponto”, sem
renomear nem migrar o app. Não inferir side-out contando ações cuja fase foi
marcada `side_out`: uma sequência pode conter várias ações e ter outro desfecho.

## Refinamentos aplicados apenas ao mockup

- Treinos/Jogos no mesmo nível; histórico e período respeitam a escolha.
- Análise em andamento destacada, fora da comparação de sessões concluídas.
- Filtro de contexto em treinos; 2 × 2 não entra no agregado inicial de 3 × 3.
- Um fundamento selecionado por vez, com distribuição e base de cálculo.
- Critérios, ações e sessões acessíveis diretamente da leitura principal.
- “O que observar” descreve o recorte; o professor escreve o foco de treino.
- Coleta refinada por jogada: selecionar atleta, tocar resultado e fechar o ponto.
  Os contatos ficam em rascunho até o fechamento; treino mantém registro direto.
- Jogos: set demonstrativo 25–21, 46 rallies; 14/22 pontos recebendo e 11/24
  sacando. Consulta por rodízio. Os dados legados do exemplo são separados;
  novos contatos ficam vinculados ao rally registrado, sem inventar vínculos antigos.
- A criação do jogo informa saque e rodízio inicial. Recuperar o saque roda a
  referência R1 → R6 → R5 → R4 → R3 → R2; desfazer restaura o estado anterior.
- Estado vazio único; sem ranking individual, cartão de IA ou vídeo sem função.

Dois toques é o caminho no protótipo para selecionar atleta e resultado com
fundamento já escolhido. Mudar fundamento ou informar uma zona acrescenta toques.
Não alegamos velocidade medida em treino real. A prévia não simula uma súmula
completa: substituições, líbero, múltiplos sets, troca de lado e exceções de
rodízio precisam de desenho próprio. Sem sessão identificada, filmagem ou
gravação autorizada, não exibir clips fictícios como evidência real.

## Caminho recomendado para aplicação futura

1. **Base comum:** hierarquia, critérios, evidência, desfazer e histórico; preservar
   organização, atleta, sessão e bloqueio de alterações após conclusão.
2. **Treinos:** contexto explícito e rubricas versionadas, coleta por amostra
   identificada; foco escolhido pelo professor. Sem sobrescrever plano.
3. **Jogos:** modelo de rally/set/rodízio, revisão de ponto e consistência do
   placar, depois side-out e recortes táticos. Dados antigos continuam parciais.
4. **Depois de validar o uso:** vídeo vinculado a eventos e análise de adversário.
   A IA pode resumir evidências rastreáveis; não preencher ações que não observou,
   inventar precisão nem aplicar alterações pedagógicas automaticamente.

Proposta de avaliação: observar professores registrando um treino e um jogo;
medir ações perdidas, correções, toques e tempo com os olhos na tela. Usar um
mesmo trecho para dois observadores, comparar concordância por fundamento e
revisar critérios com divergência. Fazer perguntas de compreensão dos números
antes de automatizar recomendações. Este é um plano de pesquisa de uso, ainda
não executado.

Sem alteração de app, migração, commit ou deploy nesta entrega.

## Segunda revisão: a jogada como unidade de registro

Pedido do usuário: uma coleta próxima de uma súmula, montando o que aconteceu
antes de registrar o ponto. A revisão substitui a separação anterior entre botões
de placar e formulário de ações. Comparação documental, sem teste presencial
dos concorrentes; as decisões abaixo são hipóteses de UX do Go Atleta.

| Fonte primária consultada | Fluxo documentado | Decisão no mockup |
| --- | --- | --- |
| [Click&Scout — fundamentos e FAQ](https://www.dataproject.com/Products/GLOBAL/it/Pallavolo/ClickAndScout) | Registra a sequência na quadra, permite continuar a ação ou atribuir o ponto. A FAQ descreve desfazer e limitações de correção. | Contatos encadeados, ponto no final e revisão direta. Local opcional, para não exigir mapeamento em toda ação. |
| [AOC VBStats — manual, Coding one team](https://peranasports.com/VBStatsHD/Guide/AOC%20VBStats%20-%20Users%20Guide.pdf) | Sugere atleta/ação com possibilidade de substituir; registra resultado e permite desfazer evento ou rally. | Sugerir apenas o próximo fundamento. Não escolher automaticamente quem tocou. Reabrir o último ponto com todos os contatos. |
| [VolleyStats — instruções do app](https://app.myvolleystats.app/) | Atalhos por jogador/ação, diferentes níveis de detalhe e desfazer. Certas ações alteram o placar automaticamente. | Botões diretos, sem selects na repetição. O Go Atleta mantém uma confirmação explícita do ponto para evitar dupla contagem ou conclusão silenciosa. |
| [Balltime — Rally & Action Editing](https://academy.balltime.com/record-and-upload-your-videos/setting-up-your-videos/rally-and-action-editing) e [FAQ](https://academy.balltime.com/getting-started/faqs) | Permite corrigir atleta, fundamento, resultado, placar e rodízio. A FAQ reconhece influência da qualidade/ângulo do vídeo no reconhecimento. | Sugestões devem ser revisáveis e ligadas à observação. Não presumir que IA elimina correções. |

O manual AOC foi consultado pelo trecho indexado da seção, pois a abertura do
PDF integral expirou. O manual Volleyball Ace também foi localizado, mas a
extração integral não ficou disponível; não sustenta decisões específicas aqui.

### Interação implementada na prévia

1. O exemplo abre em 12–10, recebendo, com passe de Ana e levantamento de Lucas
   em rascunho. Não contam nas estatísticas até fechar a jogada.
2. Escolher Beatriz e “Ponto” acrescenta o ataque. “Nosso ponto” confirma o
   conjunto. Partindo do rascunho vazio, três contatos com sugestões aceitas
   demandam seis toques, mais um para o ponto; zonas e exceções acrescentam gestos.
3. Passe sugere levantamento; levantamento sugere ataque. É um atalho determinístico,
   não uma IA executada. O professor pode trocar o fundamento a qualquer momento.
4. Os atletas são uma lista de atalhos, não uma formação nem inferência de quem
   está em quadra. “Sem atleta” registra ação coletiva. O local opcional indica
   a zona do contato na nossa quadra, não trajetória ou destino da bola.
5. Tocar no contato permite corrigir atleta, fundamento, resultado e local.
   Desfazer remove o último contato; reabrir o ponto restaura sequência, placar,
   saque e rodízio. O histórico mostra os contatos ligados ao ponto.
6. Ponto sem contatos continua possível e fica identificado como somente placar.
   Não entra como erro, tentativa ou fundamento inexistente.
7. Contato incompleto ou sequência com resultado terminal contraditório impede
   fechar. Encerrar a análise exige resolver a jogada pendente; fechar o modal
   conserva o rascunho na memória desta prévia.

Foram acrescentados levantamento e bloqueio à coleta, com critérios demonstrativos.
O painel agregado mantém os quatro fundamentos anteriores; os dois novos aparecem
na sequência/histórico de pontos. O modelo real precisará de rallyId, ordenação,
escopo da equipe, revisão e persistência atômica antes de aplicação. A prévia
observa nossa equipe e um set; não implementa a súmula oficial, substituições,
escalação/libero nem a análise completa dos contatos adversários.

### IA: onde vale avançar

Nossa proposta futura é converter uma descrição curta, como “Ana passou bem,
Lucas levantou, Beatriz atacou para fora”, em **rascunho editável**, indicando
o que falta. Nomes ambíguos exigem escolha; não deduzir nota, zona ou atleta
ausentes. Depois, vídeo autorizado pode fornecer clips para revisar a sequência.
Esses recursos não estão implementados nem são simulados como IA real no mockup.
Não houve chamada de modelo, transmissão de dados ou mudança de configuração.

Validar em quadra se sete toques cabem no intervalo entre rallies, quantas ações
se perdem e quantas correções são necessárias. A simplificação visual e o teste
funcional local ainda não demonstram que esta é a melhor UX para todo treinador.
