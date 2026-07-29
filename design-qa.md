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
