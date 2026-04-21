# Expansao do Catalogo Pedagogico

Objetivo: orientar a evolucao do catalogo canônico de pedagogia do voleibol para que o gerador semanal e diário produza aulas com identidade real de categoria, forma de jogo e momento do ciclo.

## Principios

- O mes define a faixa do conteudo.
- O historico recente define o degrau correto dentro do mes.
- A forma de jogo ancora a progressao e impede salto precoce para logica adulta.
- A linguagem exibida sempre passa pelo renderer e pelo lexico oficial.
- O catalogo deve ser forte primeiro em 08-10 e depois manter a mesma coerencia anual em 11-12 e 13-14.

## Estrutura de Stage

Cada stage precisa declarar:

- faixa etaria canonica
- mes do ciclo
- sequencia dentro do mes
- fase pedagogica
- forma de jogo
- complexidade
- habilidades ja introduzidas
- contextos ja praticados
- proximo passo
- restricoes pedagogicas
- blocos ricos por aquecimento, parte principal e fechamento
- rastreabilidade metodologica

## Blocos Ricos

Cada bloco precisa carregar:

- `skills`
- `contexts`
- `organization`
- `taskStyle`
- `intensity`

Isso permite que o renderer monte instrucoes menos genericas e mais aplicaveis em quadra.

## Regra de Progressao Intra-Mes

- Sem historico recente, usar o primeiro stage do mes.
- Com historico consistente, subir para stages mais altos do mesmo mes.
- Com override do professor para revisar, segurar ou retomar, priorizar stages iniciais.
- Com override para avancar e confianca historica alta, permitir stage mais alto do mes.

## Distribuicao 08-10

- Janeiro: familiarizacao, controle inicial, toque inicial, mini jogo muito simples.
- Fevereiro: saque por baixo adaptado, alvo simples, continuidade com 2 acoes, mini 2x2 inicial.
- Marco: recepcao, levantamento a frente, devolucao, continuidade com 2 a 3 acoes.
- Abril: direcionamento simples, colega certo, mini 2x2 mais estavel.
- Maio: alternancia entre toque e recepcao, repertorio maior, espaco livre simples.
- Junho: metas curtas, consolidacao e autonomia inicial.
- Julho: retomada e revisao dos pontos mais frageis.
- Agosto: integracao mais consistente e mini 2x2 mais fluido.
- Setembro: jogos de aplicacao, transicoes simples e cobertura inicial basica.
- Outubro: consolidacao com 2 a 3 acoes e decisao simples sem abstracao tatica.
- Novembro: aplicacao ludica mais autonoma com desafios combinados.
- Dezembro: revisao integrada, jogos de fechamento e avaliacao pedagogica leve.

## Regras de Linguagem

- 08-10: frases curtas, comandos concretos, pouca abstracao.
- 11-12: mais cooperacao, organizacao e explicacao funcional.
- 13-14: linguagem mais proxima de treino, sem virar adulto formal cedo demais.

## Status Atual

- 08-10: trilha anual completa com multiplos stages por mes.
- 11-12: trilha anual completa com mini 3x3, defesa, cobertura, ataque inicial e bloqueio inicial.
- 13-14: trilha anual completa com mini 4x4, transicao funcional e ponte controlada para o jogo formal.

## Proximos Passos

1. Alimentar o resolvedor com historico real confirmado a partir das ultimas aulas validadas tambem na geracao semanal.
2. Criar testes por bloco do ano para evitar regressao pedagogica em 08-10, 11-12 e 13-14.
3. Refinar os textos renderizados por bloco para diferenciar melhor aquecimento, parte principal e fechamento por faixa.
4. Cruzar o catalogo com a ficha de validacao humana para calibracao de campo.
