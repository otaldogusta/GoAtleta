# Design QA — Tela da turma com plano integrado

## Evidências

- Referência aprovada: `C:\Users\gusta\.codex\generated_images\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\exec-7f9e56b9-542a-47de-a000-24dd118b180c.png`
- Implementação desktop: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-implemented-desktop.png`
- Implementação mobile: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-implemented-mobile.png`
- Iteração desktop: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-iteration-desktop.png`
- Iteração mobile: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-iteration-mobile.png`
- Plano gerado no card: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-generated-desktop.png`
- Transição de data/plano: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-date-transition-desktop.png`
- Viewports verificados: desktop padrão e mobile responsivo com override equivalente a 390×844; DOM sem overflow horizontal observado.
- Estado real disponível no seed: sem plano final aplicado para a data selecionada; o fallback vazio foi validado. O estado aplicado está implementado para planos finais vinculados por data ou dia da semana.

## Comparação visual

A implementação preserva a direção aprovada: cabeçalho compacto, strip de contexto, navegador de data, plano da aula integrado, ações de chamada/relatório e indicadores compactos. No desktop, o rail permanece separado do conteúdo principal e os indicadores ocupam a coluna lateral. No mobile, o rail desaparece, o cabeçalho mantém apenas unidade e frequência, e os indicadores são empilhados verticalmente para evitar compressão.

## Findings

- P0/P1: nenhum.
- P2 resolvidos nesta iteração: o navegador mantém a aula de hoje até o horário final e só depois avança; o horário duplicado foi removido do navegador; o CTA aplicado passou de `Iniciar aula` para `Ver plano` com modal detalhado; o estado vazio ganhou `Gerar plano automático` ao lado de `Aplicar treino`, com estado intermediário `Preparando o plano` no próprio card; a troca de data desabilita os controles, exibe `Carregando a aula` no card e anima o novo plano com slide-in curto após o carregamento; planos gerados para uma data não são mais reutilizados automaticamente em outras datas da turma.
- P2 histórico: indicadores mobile em coluna e ícones não registrados foram ajustados em iterações anteriores.
- Limitação de conteúdo: não há plano final aplicado no registro atual para demonstrar a variante preenchida diretamente no navegador; a variante preenchida é renderizada quando o plano elegível existir.

## Interações e acessibilidade

- Navegação de aula anterior/próxima possui rótulos acessíveis.
- `Aplicar treino`, `Gerar plano automático`, `Ver plano`, `Editar plano`, `Chamada` e `Relatório` são controles semânticos.
- A navegação por data recalcula o plano por `applyDate` e, como fallback, por `applyWeekday`.
- Validação no `localhost:8081`: anterior levou de 15/07 para 13/07 e próxima retornou para 15/07; não há ocorrência duplicada de `14:00 – 15:00` no navegador; os dois CTAs do estado vazio foram localizados.
- `Gerar plano automático` permaneceu na mesma URL, exibiu `Preparando o plano` durante a geração e terminou com `Plano aplicado` e `Ver plano` no card.
- Ao clicar em `Próxima aula`, `Carregando a aula` apareceu durante a transição; após o carregamento, a data mudou para `16/07/2026` e o plano correspondente permaneceu visível no mesmo card.
- Planos com `applyDate` agora permanecem vinculados à data aplicada; o fallback por dia da semana considera apenas planos recorrentes sem data específica.
- A validação do modal preenchido ficou limitada pelo seed inicial sem plano final aplicado; após a geração local, a variante preenchida foi confirmada no navegador.

final result: passed

---

# Design QA — Correções funcionais do editor integrado

## Evidências

- Referência: comentários do navegador no modal desktop de 1209×812.
- Implementação verificada no `localhost:8081/class/c_1767111579656` em 1209×812 e 390×844.
- Fluxos exercitados no navegador: abrir por `Editar Aquecimento`, recolher/expandir, adicionar uma segunda atividade, remover e desfazer com `Ctrl+Z`.

## Findings resolvidos

- P1: `Adicionar atividade` criava uma linha vazia que era descartada pela normalização; agora cria uma atividade visível e editável com nome inicial único.
- P1: a exclusão de atividade agora mantém histórico local e pode ser desfeita com `Ctrl+Z`, sem capturar o atalho enquanto o usuário edita texto em um campo.
- P2: o cabeçalho `Editar <bloco>` virou um controle acessível de recolher/expandir e reduz o editor para uma faixa compacta.
- P2: o botão desktop redundante `Editar plano` foi removido; a edição começa diretamente ao selecionar Aquecimento, Parte principal ou Volta à calma.

## Interações e acessibilidade

- O controle de recolhimento expõe rótulo dinâmico e estado `expanded`.
- Após adicionar, `Nome da atividade 2` foi localizado com o valor `Nova atividade`.
- Após excluir a segunda atividade, o campo desapareceu; depois de `Ctrl+Z`, voltou com o mesmo valor.
- No mobile, o mesmo bloco apresentou os controles de recolher e expandir sem mudar de tela.

final result: passed

---

# Design QA — Editor integrado do plano (versão 3)

## Evidências

- Referência aprovada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-15a00ed6-9708-4fe5-96b7-0b2a05f44bca.png`
- Implementação desktop em edição: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-editor-desktop-v3.png`
- Menu contextual de remoção: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-remove-menu-v3.png`
- Implementação tablet: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-editor-tablet-v3.png`
- Implementação mobile em edição: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-editor-mobile-v3.png`
- Viewports verificados: 1440×1024, 834×1194 e 390×844.

## Comparação visual

A implementação preserva a composição selecionada: PDF real e roteiro lado a lado no desktop, edição do bloco imediatamente abaixo e ações de salvar no rodapé. Em telas compactas, PDF e roteiro viram abas, o formulário permanece no próprio modal e o rodapé concentra a ação principal. Conforme o ajuste solicitado, a remoção deixou de ocupar uma faixa vermelha permanente e passou a existir somente no menu de três pontos.

## Findings

- P2 resolvido: em 390 px, os três controles do cabeçalho comprimiam o título e deslocavam o fechamento; o download foi levado ao rodapé mobile, mantendo no topo apenas fechar e, fora da edição, o menu contextual.
- P2 resolvido: a edição salva uma nova versão do plano e só então atualiza a prévia do PDF, evitando regeneração pesada a cada tecla.
- P2 resolvido: `Remover plano` ficou isolado no menu de três pontos e abre a confirmação padrão antes de retornar ao estado sem plano.
- P0/P1/P2 pendentes: nenhum.

## Interações e acessibilidade

- `Baixar PDF da aula`, `Editar plano`, `Mais opções do plano`, `Fechar plano` e `Salvar e atualizar PDF` possuem rótulos acessíveis.
- A seleção do bloco mantém destaque visual e abre o formulário correspondente.
- O PDF foi confirmado com a alteração salva no objetivo da parte principal.
- O fluxo direto legado de `/session` redireciona para a tela da turma; o relatório continua reutilizando o componente incorporado.

final result: passed

---

# Design QA — Modal do plano com PDF e resumo

## Evidências

- Referência aprovada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-21627613-523b-4db7-b2a7-246593c51a22.png`
- Implementação desktop: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-pdf-split-desktop-v2.png`
- Implementação mobile — PDF: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-summary-mobile.png`
- Implementação mobile — resumo: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-summary-mobile-v3.png`
- Implementação tablet — resumo: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-summary-tablet.png`
- Feedback global após download: `C:\Users\gusta\.codex\visualizations\2026\07\14\019f5e0c-8cff-7fc3-b8d6-cb3a895bf322\class-plan-download-toast-v2.png`
- Viewports verificados: 1440×1024, 834×1194 e 390×844.

## Comparação visual

A composição replica a referência escolhida: documento pedagógico à esquerda, resumo operacional compacto à direita, ação de download destacada e fundo da tela preservado sob o modal. No mobile, o documento ocupa a tela e o rodapé alterna entre `Resumo` e `Ver PDF`, mantendo `Baixar PDF` como ação primária. O documento mostrado é o modelo real do GoAtleta, sem a marca fictícia do mockup.

## Findings

- P1 resolvido: o `iframe` de blob aparecia branco na captura do navegador; a prévia passou a reutilizar o HTML do mesmo template que gera o PDF, sem adicionar uma biblioteca pesada de renderização.
- P2 resolvido: a coluna de resumo recebeu largura fixa apenas no desktop e volta a ocupar toda a largura nos breakpoints compactos.
- P2 resolvido: a ação mobile alterna o conteúdo sem abrir outra tela e preserva o download no rodapé.
- P0/P1/P2 pendentes: nenhum.

## Interações e acessibilidade

- `Fechar plano`, `Voltar`, `Mostrar resumo`, `Mostrar PDF` e `Baixar PDF da aula` possuem rótulos acessíveis.
- Clique fora e tecla `Esc` continuam delegados ao `ModalSheet` compartilhado.
- A prévia e o download usam os mesmos dados; o blob medido no caso validado ficou em 54 KB.
- O download exibe o toast global `PDF gerado com sucesso.`; falhas usam o mesmo toast de erro das demais exportações do app.
- Console do navegador e testes automatizados foram verificados no `localhost:8081`.

final result: passed

---

# Design QA — PDF do plano de aula (modelo de referência)

## Evidências

- Referência solicitada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-ed78a969-dccc-4ee7-97d7-b83efa06ea84.png`
- PDF real exportado no localhost: `C:\Users\gusta\Downloads\plano-aula-dia-primeiros-saques-2026-07-02 (5).pdf`
- Render final: `C:\Users\gusta\Downloads\GoAtleta\tmp\pdfs\session-verified\page-1.png`
- Comparação lado a lado: `C:\Users\gusta\Downloads\GoAtleta\tmp\pdfs\compare-target-vs-live-final.png`
- Estado verificado: exportação avulsa da aula de 02/07/2026 no `localhost:8081`.

## Findings resolvidos

- P1: a exportação avulsa ainda usava o formulário legado; agora reutiliza o mesmo documento pedagógico do mês e da semana.
- P1: tabela estreita e recuada; agora ocupa toda a largura útil com margens equivalentes à referência.
- P1: professor vazio e duração exibida como horário; agora mostra `Gustavo Ribeiro dos Santos` e `14h às 15h`.
- P2: data, faixa etária, gênero, verde do cabeçalho, fundo da situação-problema e separadores foram alinhados à referência.
- P2: `Aula 1 de 1` foi removido da exportação avulsa; a numeração permanece somente em documentos com várias aulas.
- P2: tempos dos blocos usam a notação compacta `10'`, `45'`.

## Observação de conteúdo

A estrutura, hierarquia, tipografia e composição agora correspondem ao modelo. O texto pedagógico exibido continua sendo o plano salvo para a aula selecionada; por isso ele não replica o conteúdo específico do exemplo de diagnóstico sem que esse conteúdo esteja aplicado à aula.

final result: passed
