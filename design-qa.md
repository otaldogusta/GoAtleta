# Design QA — rolagens independentes na periodização

## Fonte de verdade

- Solicitação visual: comentário do navegador sobre a separação de `Parâmetros do ciclo` e `Prévia do impacto`.
- Estado anterior capturado: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\periodization-independent-scroll-before.jpg`.
- Implementação no topo: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\periodization-independent-scroll-top.jpg`.
- Implementação com as duas regiões deslocadas: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\periodization-independent-scroll-after.jpg`.
- Comparação lado a lado: `C:\Users\gusta\Downloads\GoAtleta\artifacts\design-qa\periodization-independent-scroll-comparison.png`.

## Viewport e estado

- Rota autenticada: `http://localhost:8081/class/c_1769011692095/periodization`.
- Desktop comparado em 1209 × 812 CSS px, DPR normalizado em captura de 1209 × 812 px.
- Tema escuro, modal aberto, turma `Turma 10-12`.
- Tablet validado em 833 × 1194 CSS px e celular em 390 × 844 CSS px.
- Comparação completa suficiente para composição; a captura deslocada foi usada como evidência focada da interação.

## Findings

- Nenhum P0, P1 ou P2 restante.
- Desktop: os dois painéis ocupam a mesma região vertical e possuem barras de rolagem próprias.
- Tablet e celular: o conteúdo continua empilhado em uma única rolagem, evitando duas áreas estreitas competindo pelo gesto.
- Cabeçalho e rodapé permanecem fixos em todos os tamanhos.
- Não há overflow horizontal global: 822/833 px no tablet e 379/390 px no celular.

## Interação verificada

- Rolagem somente em `Parâmetros do ciclo`: esquerda 210 px, direita 0 px.
- Rolagem posterior em `Prévia do impacto`: esquerda preservada em 210 px, direita 180 px.
- Limites úteis medidos: 332 px no painel esquerdo e 322 px no painel direito.
- Console sem erros. Permanecem apenas warnings globais conhecidos do React Native Web e o aviso de desconexão causado pelo reinício controlado do Metro.

## Fidelidade

- Tipografia, cores, ícones, bordas, espaçamento e conteúdo foram preservados.
- A única mudança visual é estrutural: duas barras verticais no desktop, uma por painel.
- Nenhuma imagem ou ativo foi alterado.

## Histórico de comparação

1. P2 inicial — uma única rolagem movia os dois blocos e dificultava consultar parâmetros enquanto se lia o impacto.
2. Correção — o corpo desktop foi dividido em duas regiões roláveis, mantendo o shell do modal fixo.
3. Pós-correção — comparação e teste de deslocamento confirmaram independência sem regressão responsiva.

## Resultado final

final result: passed

---

# Design QA — Planejamento unificado da turma

## Fonte de verdade

- Mockup aprovado pelo usuário: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-a576b124-f0b6-4253-a9f9-26c71b46ffa0.png`.
- Implementação autenticada: `http://localhost:8081/class/c_1784666702066/periodization?classId=c_1784666702066&month=2026-07&backTo=%2Fclass%2Fc_1784666702066`.
- A composição foi comparada no navegador local após o carregamento dos dados reais da turma.

## Verificação visual

- Desktop usa uma área operacional plana em três colunas: trilho anual, planejamento mensal e inspetor da aula.
- O trilho anual apresenta mês, fase pedagógica, intervalo de semanas e curva de carga sem cartões altos ou informação duplicada.
- O mês reúne resumo, semanas e aulas em uma tabela compacta; a aula selecionada controla o inspetor à direita.
- O inspetor apresenta origem, distribuição de tempo, resumo, relação com o ciclo e ação para abrir a aula.
- A última aula válida de julho aparece como `Jogo consolidado do mês`, com origem na regra mensal do voleibol e distribuição de 10/45/5 minutos.
- O rodapé informa a preservação de planos personalizados e aulas concluídas antes da ação de aplicar ajustes.
- As fases exibidas são as fases reais salvas para a turma; o mockup define a composição, não dados demonstrativos.

## Responsividade e interação

- Desktop mantém as três regiões simultaneamente visíveis, com rolagens internas nas colunas extensas.
- Tablet transforma o trilho anual em faixa horizontal e mantém planejamento e inspetor lado a lado.
- Celular empilha mês e aulas, mantém o trilho horizontal e insere o detalhe imediatamente abaixo da aula selecionada.
- A seleção de aula atualiza o inspetor sem navegação e sem perder o contexto do mês.
- O navegador local não registrou erros nem avisos durante a verificação final.

## Validações técnicas

- Testes focados de agenda e regra mensal do voleibol: 8 aprovados.
- `npm run typecheck:app`: aprovado.
- `npm run check:org-scope`: aprovado.
- `git diff --check`: aprovado; apenas aviso de normalização futura de CRLF em arquivo já modificado no worktree.
- `npm run build`: aprovado; permanecem somente os avisos conhecidos do `expo-font` e da configuração do Sentry.

## Resultado final

final result: passed

---

# Design QA — Exportar e sincronizar em Turmas

## Fonte de verdade

- Mockup escolhido pelo usuário: `artifacts/design-qa/classes-google-actions-selected-reference.png`.
- Implementação autenticada: `http://localhost:8081/prof/classes`.
- Comparação lado a lado: `artifacts/design-qa/classes-google-actions-comparison.png`.

## Verificação visual

- `Criar turma` permanece como única ação primária em verde.
- `Exportar e sincronizar` usa botão secundário contornado, chevron animado e menu ancorado à direita.
- O menu fica acima da tabela e contém, na ordem aprovada, exportação `.xlsx`, exportação `.ics`, sincronização assistida com Google Agenda e estado da conta Google.
- Tipografia, cores, bordas, espaçamento, altura dos controles e alinhamento seguem a tela de Turmas existente.
- Desktop mantém rótulos completos; tablet e celular usam ações compactas para evitar overflow no cabeçalho.
- Nenhum P0, P1 ou P2 visual restante na comparação.

## Interação e responsividade

- Desktop: menu abre e fecha no mesmo ponto do mockup, sem deslocar a tabela.
- Tablet: ações compactas permanecem integralmente dentro do viewport.
- Celular: menu abre acima do conteúdo, com todas as opções acessíveis e sem overflow horizontal.
- Exportação `.xlsx`: executada no localhost com retorno de sucesso.
- Exportação `.ics`: executada no localhost com retorno de sucesso.
- Sincronização com Google é transparente: gera o arquivo `.ics` e abre a importação do Google Agenda; o estado `Google conectado` só aparece quando a conta autenticada possui identidade Google.

## Validações técnicas

- Testes focados de exportação: 2 aprovados.
- `npm run typecheck:app`: aprovado.
- `npm run check:org-scope`: aprovado.
- `npm run check:perf-hygiene:strict`: aprovado.
- `git diff --check`: aprovado.
- `npm run build`: aprovado; permanecem apenas avisos conhecidos do `expo-font` e da configuração do Sentry.

## Resultado final

final result: passed

---

# Design QA — Fidelidade entre Alunos e Turmas

## Fonte de verdade

- Captura de referência fornecida pelo usuário para a tela de Turmas.
- Tela autenticada de Turmas no mesmo ambiente local.
- Implementação em `http://localhost:8081/prof/students`.

## Comparação visual

- Referência e implementação foram capturadas no mesmo viewport desktop de 1600 × 1138 CSS px.
- O shell de Alunos agora compartilha com Turmas o fundo, a largura de 256 px do painel de unidades, as superfícies, a escala tipográfica, os divisores e o ritmo vertical.
- Cabeçalho, título da coleção, busca de unidades, controle A–Z, linhas da unidade e tabela seguem as mesmas medidas de Turmas.
- Busca e filtros específicos de Alunos foram preservados porque fazem parte da operação dessa tela.
- Nenhum P0, P1 ou P2 visual restante na comparação lado a lado.

## Responsividade e interação

- Desktop: 1600 × 1138 CSS px, sem overflow horizontal.
- Tablet: 926 × 1326 CSS px, sem overflow horizontal.
- Celular: 433 × 938 CSS px, sem overflow horizontal e com cabeçalho compacto equivalente ao de Turmas.
- O filtro de status abre e fecha normalmente após o realinhamento.
- A lista mantém rolagem interna, cabeçalho fixo e paginação fixa.

## Validações técnicas

- `npm run typecheck:app`: aprovado.
- `npm run check:org-scope`: aprovado.
- `git diff --check`: aprovado.
- `npm run build`: aprovado; permanecem apenas avisos conhecidos de resolução do `expo-font` e configuração de build do Sentry.

## Resultado final

final result: passed

---

# Design QA — Alunos e aniversários

## Fonte de verdade

- Mockup aprovado pelo usuário para a lista de alunos e o cadastro em painel lateral.
- Mockup fornecido para a tela de aniversários.
- Implementação validada em `http://localhost:8081/prof/students`.

## Verificação

- A estrutura principal é exibida imediatamente; o carregamento dos dados acontece dentro da área de conteúdo, sem bloquear toda a aplicação.
- A tela de alunos usa o mesmo padrão visual da listagem de turmas: unidades à esquerda e tabela plana à direita.
- Foram removidos o resumo redundante, os agrupamentos expansíveis antigos e o botão flutuante de cadastro.
- A tabela apresenta aluno, idade, turma, status e contato do responsável, com foto ou avatar de fallback.
- O cadastro abre em painel lateral pela direita, com animação, formulário contínuo sem etapas e rodapé fixo.
- A tela de aniversários segue o mesmo shell, com unidades, indicadores de hoje e próximos sete dias, busca, filtro de mês e tabela.
- Cabeçalho, ações e subtítulo mudam de acordo com a visão de alunos ou aniversários.
- A lista renderiza oito alunos por página e expõe paginação com total e navegação.
- No desktop, somente as linhas da tabela possuem rolagem própria; título, busca, filtros e cabeçalho das colunas permanecem fixos.
- O painel de unidades e a paginação permanecem fixos durante a rolagem da lista.
- O teste local confirmou rolagem interna real na lista (`408 px` visíveis para `504 px` de conteúdo), sem deslocar as regiões fixas.
- Status, gênero, turma e contato são filtros funcionais; a busca e a unidade continuam combináveis.
- O filtro de mês abre como dropdown ancorado e rolável, e as linhas não repetem a distância em dias.
- O aniversariante do dia recebe um pequeno chapéu festivo no canto superior direito do avatar, com leve inclinação, tanto na lista de alunos quanto na visão de aniversários, sem substituir a foto.
- As contagens por unidade permanecem globais ao trocar unidade, página ou filtro.
- Clicar novamente em `Alunos` na barra lateral enquanto Aniversários está aberto retorna para a lista.
- Nenhum P0, P1 ou P2 visual restante na comparação local.

## Validações técnicas

- TypeScript do aplicativo: aprovado.
- Isolamento por organização: aprovado.
- Higiene de performance: aprovado.
- `git diff --check`: aprovado nos arquivos alterados.

## Resultado final

final result: passed
