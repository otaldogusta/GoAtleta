# Histórico de relatórios — aplicação local

[Mockup interativo](mockups/historico-relatorios-2026-10-06.html), criado em
06/10/2026 e aprovado para aplicação local. O protótipo permanece separado do app.

## Acesso aplicado

Na turma, ação secundária **Histórico** junto de **Relatório** no menu, também
disponível no menu compacto de celular/tablet. A primeira
consulta registros anteriores; a segunda continua abrindo a aula selecionada.
O bloco de relatórios recentes oferece também **Ver todos os relatórios**.
No mockup, **Ver acesso na turma** revela essa posição sem sair da página.

## Comportamento demonstrado

- Ano, mês e busca no texto; opção de consultar todos os anos/meses.
- Aulas em ordem decrescente, agrupadas por mês, sem sanfonas.
- Cada linha mostra dia, assunto, início do relato e indicação discreta de fotos.
- Abrir uma aula apresenta o relatório no mesmo modal; voltar preserva filtro,
  posição da lista e foco no item selecionado.
- Estado vazio com limpeza dos filtros; tema claro/escuro e prévia de 390 px.

Os 15 registros são fictícios. A edição altera somente dados em memória da página;
o botão PDF demonstra a intenção com uma mensagem e não gera arquivo. Fotos
reutilizam as imagens sintéticas já documentadas em `mockups/assets/relatorio-aula`.
O HTML não consulta o Supabase nem persiste relatórios reais.

## Implementação

- `ClassReportHistory` usa tokens e primitives do app, com filtros de ano/mês,
  busca sem distinção de acentos, grupos mensais e estados de carregamento,
  vazio e erro com nova tentativa. Lista renderiza 30 aulas por vez e permite
  mostrar mais, mantendo a busca sobre todos os resumos carregados.
- `getClassReportHistory` lê páginas de 100 resumos até uma página vazia,
  inclusive quando o servidor limita o tamanho abaixo do solicitado. Cada
  consulta exige usuário, organização e turma; a identidade autenticada fica
  fixada durante a leitura. Erros não viram histórico vazio ou parcial.
- `useClassReportHistory` carrega somente ao abrir, cancela e descarta respostas
  antigas quando muda usuário/organização/turma ou quando fecha o modal.
- Fotografias não entram na consulta da lista: o editor existente carrega os
  detalhes por turma/data. Por esse motivo, o contador de fotos do mockup não
  aparece nas linhas reais. Nenhum dado sintético foi inserido no app.
- Aulas duplicadas legadas usam a prioridade do editor (`client_id` decrescente,
  nulos por último, seguido de `createdat`). Datas da aula não mudam por fuso.
- Abrir um relatório reutiliza `SessionScreen` no mesmo modal, sem alterar a data
  da página da turma. Voltar preserva filtros, rolagem e foco. O rascunho local
  é persistido ao desmontar o editor, mesmo antes dos 250 ms do debounce.
- Hidratação e gravação do rascunho aguardam a leitura do relatório salvo. Uma
  chamada que chega antes dessa leitura não cria um rascunho vazio sobre o relato.
- O histórico mantém os três recentes da visão geral. A rota `/class/[id]/log`
  continua sendo o editor legado por data.

## Conferência local

Ciclo de mockup: sintaxe JavaScript, recursos locais e diff; inspeção no navegador
em 1055×704 e na prévia de largura 390 px, nos dois temas. Conferidos filtros de
ano/mês, busca vazia, abertura de aula, volta com filtros e acesso pela turma.
App real preservado em localhost:8081; HTML servido separadamente em localhost:8082.

58 testes focados de consulta, filtros/deduplicação, cancelamento por escopo,
componentes e rascunho passaram; `typecheck:app`, `check:org-scope`, perf-hygiene
focado e diff passaram. Smoke autenticado em localhost:8081 conferiu filtro
mensal, todos os anos, busca sem resultado/limpeza, abertura de aula, retorno com
filtro e foco e preservação da data da turma. Erro de rede foi provocado bloqueando
somente a consulta de resumo via DevTools; após remover o bloqueio, Tentar novamente
recuperou os três registros reais. Nenhum bloqueio de rede permaneceu ativo.
Layouts conferidos em 390×844, 834×1194 e 1440×1024; claro e escuro.
A leitura autenticada usa o
backend já configurado; testes negativos de identidade e escopo usam mocks.
Nesse ciclo local não houve migration nem escrita remota de relatórios.
O smoke de release revelou a chegada da chamada antes do relato; um teste
reproduziu a gravação prematura e foi adicionado para proteger a sequência.

## Publicação autorizada

Após a aprovação local, o usuário autorizou push, deploy e integração na `main`.
O pacote segue o nível 4 da escada, com `npm run build:verified`, smoke autenticado
e a esteira existente de Vercel/EAS. O despacho remoto é conferido pelo commit;
as evidências locais acima não atestam prontidão em produção.
