# Scouting — proposta visual local

[Mockup interativo](mockups/scouting-2026-10-06.html), solicitado em 06/10/2026.
Proposta aprovada para implementação. Ver [aplicação local e ativação do banco](SCOUTING_IMPLEMENTACAO_2026-10-07.md).
As seções abaixo preservam o escopo e a evidência do protótipo; não comprovam publicação.

Refinada no mesmo dia com [pesquisa aplicada de scouting](SCOUTING_RESEARCH_2026-10-06.md).
Preferência confirmada: treinos e jogos com a mesma importância.

## Direção

- Uma análise em andamento em destaque, com **Continuar análise** como ação
  principal; **Nova análise** fica secundária enquanto houver uma em andamento.
- Treinos e Jogos são contextos independentes. A leitura reúne somente sessões
  concluídas do formato selecionado. Dados parciais permanecem na coleta.
- Um fundamento por vez, distribuição de resultados, denominador e critérios.
  Ações e sessões sustentam a leitura; o professor define o foco de treino.
  Sem comparação automática entre percentuais de fundamentos diferentes.
- Últimas análises aparecem abaixo; histórico separado com período, tipo e busca.
- Coleta por jogada em jogos: atleta e resultado em botões, sequência editável,
  local opcional e ponto ao final. O próximo fundamento vem sugerido. Reabrir
  o último ponto restaura os contatos, placar, saque e rodízio. Treino continua
  com registro direto por repetição, sem exigir um ponto.
- Não apresentar rankings ou afirmar evolução com amostras/contextos diferentes.
- Cores, raios, escala de texto e espaçamentos espelham os tokens do app. Uma
  coluna até 1199 px; a leitura técnica divide espaço a partir de 1200 px.

## Escopo do protótipo

Dois cenários selecionáveis: **Com registros** e **Começando**, este semelhante
ao estado atual da tela. Nomes, sessões e resultados são fictícios. Há temas
claro/escuro, prévia de 390 px, filtros, resumo de uma análise e criação/registro
demonstrativos em memória. Recarregar descarta as interações. Sem conexão ao
Supabase, gravações no app ou dependências externas.

As sete sessões somam 222 ações confirmadas. No recorte inicial de Treinos/3 × 3 há duas
sessões concluídas, 80 ações e 20 recepções: 4 erros, 5 limitadas, 7 boas e
4 completas (55% boas/completas). A sessão em andamento tem 24 ações e não entra
nesse agregado. O treino 2 × 2 tem contexto próprio.

Em Jogos, outubro contém um exemplo com 62 ações e 46 rallies de um set 25–21:
14/22 pontos recebendo e 11/24 sacando. Ações e rallies são conjuntos distintos.
O amistoso de setembro não tem rallies: não mostra side-out calculado de notas.
Há também um jogo em andamento em 12–10: seus 22 pontos iniciais têm somente
placar. O rascunho inicial contém dois contatos fictícios; os novos contatos
se vinculam ao ponto quando ele é confirmado. Dados antigos não recebem
atribuições inventadas. [Abrir diretamente a coleta](mockups/scouting-2026-10-06.html?coleta=jogo).

Critérios e contexto são demonstrativos. A escala do app não foi renomeada ou
migrada. Rally, set, rodízio e rubrica/contexto estruturado exigem trabalho de
domínio antes de uma aplicação. Não há súmula completa, substituições, vídeo ou
integração real ao planejamento. Ver a pesquisa para a análise das lacunas.

## Conferência

Validação de protótipo local: sintaxe JavaScript, referências, navegação, filtros,
cenário sem registros, temas, modais e responsividade. O app real permanece em
localhost:8081; a proposta é servida separadamente em localhost:8082.
Não exige build, suíte de aplicação ou gates de release.

Conferência da revisão de pesquisa (06/10): criação de jogo, registro de ação
24→25→24 com desfazer, critério contextual, foco mantido ao trocar fundamento,
evidência das 20 recepções, histórico sem resultados e rodízios. Ponto recebendo
levou R1→R6 e saque próprio; desfazer restaurou 0–0, R1 e saque adversário.
Conferidos temas e layouts 390×844, 834×1194 e 1440×1024, sem overflow horizontal;
duas colunas principais apenas no último. Script de
checagem confirmou 222 ações, recepção 4/5/7/4, eficiência negativa de ataque e
sequência de 46 rallies consistente com saque, rodízio e placar 25–21.

Conferência da coleta por jogada (segunda revisão, 06/10): script de estado
exercitou rascunho fora das métricas, vínculo dos contatos ao rally, impedimento
de desfecho contraditório, registro somente de placar, reabertura integral,
restauração de saque/rodízio, edição do resultado e coleta direta de treino.
Sintaxe, IDs e ícones conferidos; `git diff --check` passou.

No navegador: 12–10 → 13–10 → reabrir 12–10 → corrigir ataque → 12–11,
histórico com os três contatos; zona 4 e continuidade; treino 24→25→24.
Critérios abriram por Enter e Escape devolveu foco ao botão de origem. Rascunho
foi mantido ao fechar/reabrir o modal. Conferidos desktop de 1055×704 e celular
390×844, temas escuro/claro, sem overflow horizontal; fechamento fica fixo e
placar acompanha a rolagem. Os rótulos de ataque foram abreviados na coleta,
mantendo “Bloq. ponto” distinto de toque no bloqueio com continuidade.

Não houve teste de campo, processamento de IA, API, build ou publicação nesta
revisão. A sugestão do próximo fundamento é uma regra local visível e substituível.
