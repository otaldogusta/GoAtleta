# Continuidade da revisão visual · 13/11/2026

Planejamento, Periodização, Turmas, Gestão e Regulamentos receberam a composição
aprovada na [rodada anterior](REVISAO_VISUAL_COMPOSICAO_2026-11-13.md).
[Galeria local preservada com 20 pares](http://127.0.0.1:8096/inventario-continuidade-lote4.html),
organizada pelas superfícies realmente presentes no app. O arquivo
`antes-depois-lote3.html` preserva as nove telas aprovadas.

Após os comentários do usuário, os cartões de mês foram restaurados, o
Assistente ganhou margens e Gestão passou a abrir em Equipe, com indicadores
em Visão geral. Essa composição substitui o recorte correspondente abaixo:
[ajustes posteriores](AJUSTES_PERIODIZACAO_GESTAO_2026-11-13.md).

## Mudanças conferidas

| Área | Composição e comportamento |
| --- | --- |
| Planejamento | Entrada direta com Turma, Data e Criar plano. Biblioteca usa `UnderlineTabs` para Por turma/Rascunhos, lista com divisores e vazio canônico. Ficha móvel parte do rodapé, acompanha o conteúdo e limita a rolagem à altura disponível. O estado Por turma mediu 303 px. Importação conserva seu fluxo. |
| Periodização | Trilho compacto de meses, resumo do mês e semanas no workspace existente; as antigas abas Calendário/Semanas/Aulas não foram reativadas. Dias da semana usam o formatador existente. Fechar o detalhe devolve o foco à aula. Assistente contextual no cabeçalho em todas as larguras, somente quando o host está disponível; os hosts dos editores conservam seus acessos. |
| Turmas | Unidade em `CompactSelect`, lista com divisores, dias e professor legíveis. A tabela exige 820 px de conteúdo; em viewport de 834 px a sidebar reduz o espaço e a lista evita cortes. Plano da aula com menos molduras, preservando a chamada aprovada e as ações operacionais. |
| Gestão | Indicadores em 2 × 2 no compacto e uma linha no amplo. Índice operacional separado e explicável. Equipe e filas usam divisores; ordenar e expandir permanecem controles independentes. Falha mantém uma mensagem e nova tentativa. Assistente no cabeçalho móvel, inclusive na falha. |
| Regulamentos | Versões, cláusulas e fontes em seções alinhadas. Comparação e Autoridade usam seletores compactos; diferenças mostram valores, sem chaves internas. Vazio canônico e detalhes de altura intrínseca. Assistente móvel deixa Monitoramento livre. Permissões e ações existentes preservadas. |

## Teclado e diálogos

`ModalSheet` considera a camada superior para Tab/Escape e captura o teclado dentro
do card, pois o TextInput de React Native Web interrompe a propagação. Seletores
portados continuam tratando Escape antes do diálogo. Calendário e confirmação
possuem rótulo de diálogo e foco próprio.

Na Biblioteca, a hidratação desabilita temporariamente a linha. O acionador é
capturado antes dessa transição e, ao cancelar a substituição, recebe o foco
somente se a seleção continua atual, o elemento está visível e nenhum outro
controle recebeu foco. O rascunho permanece intacto. Não houve mudança de
hidratação, autorização ou regras de substituição.

## Evidência e limites

- Designer UI inspecionou 390 × 844 em claro/escuro e 834 × 1194 em escuro.
  Designer UX percorreu abas, seletores, busca, recuperação, detalhes, calendário
  aninhado e cancelamento da troca de plano. Os dois últimos cenários passaram
  nos dois temas, incluindo retorno de foco e preservação do rascunho.
- Os 20 pares principais têm o mesmo tamanho e tema. Rascunhos e Assistente
  aparecem como estados complementares, sem falso par anterior. Equipe já está
  visível no painel de Gestão e não foi contada como uma segunda imagem igual.
- App real deste checkout em `127.0.0.1:8082`, Auth/Supabase local em `54321`,
  contas e dados fictícios. A sessão existente em `localhost:8081` foi preservada.
- Gestão preenchida substituiu apenas a resposta de leitura de convites,
  indisponível com HTTP 503. A falha natural também foi capturada. Periodização
  preenchida e Regulamentos usam respostas fictícias de leitura apenas no
  contexto Playwright. Isso não certifica backend, sincronização ou publicação.
- Não houve gravação de chamada, salvamento de plano, envio ao Assistente,
  alteração de monitoramento, sincronização de fontes ou acesso a dados reais.

## Validação registrada

Nível 2 para apresentação, teclado e primitives; escopo/performance conferidos
também por atravessar superfícies integradas e aliases de navegação.

- Turmas: 32 testes focados existentes passaram.
- Planejamento/Periodização: 35 testes distintos de hidratação, biblioteca,
  view model, safe area e formatação passaram. Os 15 de hidratação foram repetidos
  após a correção final de foco e passaram, sem somá-los novamente. Jest emitiu
  aviso de handles após os testes e encerrou com código 0.
- Diálogos, calendário e Gestão: 65 testes em sete suítes passaram, incluindo
  Escape com duas camadas, acesso administrativo e estado de carregamento.
- Assistente e aliases: 27 testes passaram, incluindo montar/desmontar o host,
  presença do acionador e conservação da conversa.
- Typecheck do app, ESLint focal, `check:org-scope`, perf-hygiene strict e diff
  check passaram. Sem build de release ou publicação nesta rodada local.
- Revisão independente por leitura encontrou a disputa de foco entre Biblioteca
  e confirmação. Correção revisada e confirmada no navegador; sem achado
  acionável pendente no delta examinado.

Artefatos reproduzíveis e resultados detalhados permanecem em
`.tmp/auditoria-go-atleta-2026-11-13/lote-4/`: fontes anteriores, roteiros, JSONs,
capturas, direção UI e gerador da galeria. A conferência desta rodada cobre as
cinco áreas acima; não transforma as demais entradas históricas do inventário em
validação atual de todas as rotas, papéis ou aparelhos.
