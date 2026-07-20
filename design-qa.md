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

# Design QA — Agrupamento de configurações e conta

- Source visual truth: `artifacts/design-qa/profile-account-cards-polish-desktop.jpg`
- Implementation screenshot: `artifacts/design-qa/profile-settings-account-grouping-focused.jpg`
- Full-page implementation screenshot: `artifacts/design-qa/profile-settings-account-grouping-desktop.jpg`
- Mobile implementation screenshot: `artifacts/design-qa/profile-settings-account-grouping-mobile.jpg`
- Comparison input: `artifacts/design-qa/profile-settings-account-grouping-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: perfil administrativo, Google Drive e conta Google conectados

## Full-view comparison evidence

O comparativo antes/depois confirma a nova separação por assunto. `Configurações`
contém notificações e aparência; `Conta` reúne e-mail, base acadêmica no Google
Drive, conta Google e saída. A hierarquia superior de perfil e workspace não foi
alterada.

## Focused region comparison evidence

Referência e implementação foram combinadas no mesmo viewport de 1422 × 800. A
mudança preserva alturas, bordas, tipografia, ícones, menus e estados dos cartões,
removendo somente o subtítulo redundante `Segurança da conta` e reposicionando a
base acadêmica.

## Required fidelity surfaces

- Tipografia: títulos, rótulos e metadados mantêm família, peso, tamanho e truncamento existentes.
- Espaçamento: o ritmo de 8 px entre linhas e seções foi preservado, sem criar cards aninhados.
- Cores: todas as superfícies continuam usando os tokens existentes de card, borda e ação.
- Ativos: o logo oficial do Google Drive e os ícones do registro existente foram preservados.
- Conteúdo: cada integração aparece uma única vez no bloco correspondente, sem o subtítulo redundante.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.

## Verificações concluídas

- Ordem confirmada no DOM: `Configurações`, `Notificações`, `Modo escuro`, `Conta`, e-mail, base acadêmica, Google e `Sair`.
- Os menus de três pontos do Google Drive e da conta Google continuam abrindo como menus globais.
- O tema claro foi acionado e o tema escuro restaurado sem alterar a organização.
- Não há overflow horizontal nos três viewports.
- O console não apresentou erros; permanecem somente avisos conhecidos do React Native Web sobre `pointerEvents` e propriedades legadas de sombra.

## Comparison history

1. A referência mostrava a base acadêmica entre notificações e aparência, e um subtítulo extra antes dos itens de conta.
2. A base acadêmica foi movida sem alterar sua permissão, estado ou menu; o subtítulo redundante foi removido.
3. O comparativo final confirmou os dois blocos temáticos e a preservação visual e funcional dos cartões.

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

---

# Design QA — coordenação unificada

- Source visual: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-8959cd22-4748-41cf-b777-f0d90776ce10.png`
- Implementation screenshot: `artifacts/design-qa/coordination-unified.png`
- Side-by-side comparison: `artifacts/design-qa/coordination-comparison.png`
- Route: `http://localhost:8081/coord/management`
- Viewport: 1387 × 917
- State: coordenação autenticada, Gustavo Ribeiro selecionado, 2 membros, 1 convite, 4 turmas e 4 chamadas pendentes.

## Evidence

- A tela deixou de separar Dashboard e Gerenciar membros.
- Pessoas e responsabilidades são o módulo principal.
- A seleção de uma pessoa atualiza o painel lateral com função, turmas, permissões e chamadas.
- A chamada é a ação operacional prioritária; relatórios permanecem recolhidos.
- O painel lateral mostra uma chamada por padrão e permite expandir as demais.
- Os módulos secundários são recolhíveis.
- O modo Organizar painel expõe controles de ordenação e persiste a preferência por organização.
- A navegação lateral e os tokens visuais existentes do GoAtleta foram preservados.

## Interaction checks

- Seleção de coordenador: passou.
- Seleção de professor sem turma: passou.
- Estado sem chamadas do professor: passou.
- Ativação e encerramento do modo Organizar painel: passou.
- Expansão e recolhimento de módulos: passou.
- Ações com efeitos externos, como Cobrar chamada e Convidar, não foram disparadas no QA visual.

## History

1. Primeira implementação manteve três cartões de chamada no painel lateral.
2. A comparação visual mostrou excesso de altura e competição com os módulos principais.
3. A versão final mantém somente a chamada prioritária visível e oferece Ver todas as chamadas.
4. Pluralização de chamada/chamadas foi corrigida.

## Final result

Passed.

## Correção de fidelidade visual

- Referência aprovada: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-cf7d3cf2-0961-468e-b5ca-b46107689071.png`
- Implementação corrigida: `artifacts/design-qa/coordination-approved-viewport.jpg`
- Comparação final: `artifacts/design-qa/coordination-approved-comparison-v2.png`
- Foram adicionados busca global, convite no cabeçalho, filtros por função e status, cabeçalhos de coluna, status e ações por pessoa, edição contextual de turmas e permissões, chamada prioritária e comunicação.
- Os módulos secundários iniciam recolhidos e continuam reordenáveis.
- Diferenças numéricas entre as imagens correspondem aos dados reais da organização autenticada usada no teste.

final result: passed

---

# Design QA — Troca de perfil minimalista

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-09424274-d79a-4e2c-988b-6ad828850180.png`
- Implementation screenshot anterior à correção: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-2fb772cb-2b9c-4201-9025-534a69224331.png`
- Implementation screenshot posterior à correção: pendente
- Viewport alvo: 1387 × 917
- Estado alvo: `/prof/profile`, tema escuro, menu `Trocar` aberto para uma conta autorizada

## Full-view comparison evidence

A referência selecionada e a captura anterior à correção foram abertas e inspecionadas. A captura mostrou o menu atrás do cartão `Workspace(s)` e feedback interativo em toda a linha de perfil. A implementação corrigida ainda precisa de uma nova captura, pois a política de segurança da superfície bloqueia automação em `localhost`. O servidor local respondeu HTTP 200, mas essa verificação não substitui evidência visual.

## Focused region comparison evidence

A região `Perfil` foi comparada entre a referência e a captura anterior à correção. Permanecem pendentes a confirmação visual do menu na camada global e a ausência de hover/click fora do acionador `Trocar`.

## Findings

- [P1] Menu coberto pelo cartão seguinte
  - Local: `Perfil`, em `/prof/profile`.
  - Evidência: a captura anterior à correção mostra `Workspace(s)` sobre parte da lista.
  - Impacto: opções ficam ocultas e a troca de perfil perde legibilidade.
  - Correção aplicada: lista movida para um `Modal` transparente global, ancorado ao acionador e independente da pilha de `z-index` da página.

- [P2] Linha inteira aparentava ser acionável
  - Local: linha `Professor / Treinador`.
  - Evidência: a captura anterior à correção mostra o cartão inteiro no estado interativo.
  - Impacto: área clicável não corresponde ao affordance `Trocar`.
  - Correção aplicada: a linha passou a ser estática; somente `Trocar` e sua seta são um `Pressable`.

- [P2] Confirmação visual pós-correção pendente
  - Local: bloco `Perfil`, com o menu aberto.
  - Evidência: não há captura renderizada posterior às correções.
  - Impacto: sobreposição, ancoragem e affordance corrigidos em código ainda precisam de validação visual.
  - Correção: capturar o estado aberto em 1387 × 917 e comparar com a referência.

## Verificações concluídas

- A troca antiga `Mudar perfil (DEV)` foi removida da composição.
- O menu usa apenas perfis autorizados: treinador, aluno e nível administrativo.
- Contas sem mais de um perfil autorizado não recebem o acionador `Trocar`.
- O preview local permanece restrito à conta de desenvolvimento já autorizada.
- A lista é renderizada em uma camada global acima do conteúdo da tela.
- Apenas `Trocar` abre e fecha o menu; a linha de perfil permanece estática.
- Clique externo, rolagem e `Esc` fecham o menu.
- Typecheck, teste focado de permissões, higiene de performance e diff check passaram.

## Comparison history

1. Referência selecionada: opção 2, com menu compacto ancorado à direita.
2. A primeira captura revelou o menu atrás de `Workspace(s)` e a linha inteira acionável.
3. A lista foi movida para uma camada global e o alvo de clique foi restringido a `Trocar`.
4. Captura pós-correção pendente pela política de segurança do navegador para `localhost`.

final result: blocked

---

# Design QA — Menu da base acadêmica

- Source visual truth:
  - `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-cf8cf765-dec6-4502-a760-ccd8dc9274f0.png`
  - `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-7c09723e-f4a5-4505-b96f-c13fc9a807ce.png`
- Implementation screenshot: `artifacts/design-qa/profile-academic-drive-menu-mobile.jpg`
- Comparison input: `artifacts/design-qa/profile-academic-drive-menu-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: Google Drive conectado, menu contextual aberto

## Full-view comparison evidence

A referência e a implementação foram avaliadas juntas no mesmo comparativo. A implementação preserva a composição do perfil e substitui somente o botão `Gerenciar` por um acionador circular de três pontos, seguindo o padrão existente dos cartões de Turmas. O menu abre em uma camada global, acima dos cartões vizinhos, sem alterar a altura da linha.

## Focused region comparison evidence

O menu mantém a hierarquia da referência — ações operacionais primeiro e ação destrutiva por último — com a linguagem visual do GoAtleta. As opções são `Abrir documentos`, `Sincronizar agora` e `Desconectar`; a última usa a cor de perigo. No mobile, o menu permanece dentro da largura disponível e se ancora ao acionador.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.
- Diferenças intencionais: ícones internos foram omitidos para manter o mesmo padrão textual do menu de Turmas; o ícone da base acadêmica permanece no próprio cartão.

## Verificações concluídas

- Somente os três pontos abrem o menu; o cartão não é acionável.
- Clique externo e `Esc` fecham o menu.
- A camada contextual aparece acima dos cartões de Configurações.
- O estado desconectado continua exibindo a ação direta `Conectar`.
- As três opções aparecem uma única vez em desktop, tablet e mobile.
- Após recarga limpa, não houve erro de console relacionado ao menu; permaneceram apenas avisos de depreciação já existentes do React Native Web.

## Comparison history

1. A referência definiu o gatilho de três pontos e a ordem das ações.
2. O padrão de Turmas definiu dimensões, raio, borda, sombra e comportamento de fechamento.
3. A captura mobile confirmou o posicionamento global, a ausência de recorte horizontal e a hierarquia das ações.

final result: passed

---

# Design QA — Feedback de salvamento da chamada

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-75519780-5978-4cab-b64c-a25fb8c113ba.png`
- Implementation screenshot: pendente
- Viewport alvo: 1920 × 1280
- Estado alvo: `/class/c_1767460923209/attendance`, tema escuro, chamada preenchida

## Full-view comparison evidence

A captura de referência foi aberta e analisada anteriormente. A estrutura existente da chamada foi mantida: cabeçalho, data, lista de alunos, controles `Presente`/`Faltou` e ações no rodapé não foram reorganizados. A implementação acrescenta somente o estado textual de persistência junto à ação já existente.

Não há captura renderizada pós-correção. A rota local respondeu HTTP 200, mas isso não substitui a comparação visual exigida.

## Focused region comparison evidence

A região relevante é apenas o rodapé da chamada, onde já existe `Salvar chamada`. O código mantém o botão no mesmo lugar e diferencia os estados `Salvando`, `Sincronizada`, `Salva no dispositivo` e `Offline`. A confirmação visual de espaçamento e quebra de texto em desktop e mobile permanece pendente.

## Findings

- [P1] Salvamento offline era comunicado como sucesso remoto
  - Local: ação `Salvar chamada`.
  - Evidência: a camada de dados colocava a escrita na fila local após erro de rede, mas retornava sem informar essa condição; a tela sempre mostrava `Chamada salva com sucesso`.
  - Impacto: o professor não sabia se a chamada havia chegado ao servidor ou apenas ficado aguardando conexão.
  - Correção aplicada: a persistência agora retorna `synced` ou `queued`, e a tela apresenta a mensagem correspondente.

- [P2] Ausência de estado persistente após salvar
  - Local: rodapé da lista.
  - Evidência: o feedback dependia apenas de um toast temporário.
  - Impacto: após o toast desaparecer, não havia confirmação visível do estado atual.
  - Correção aplicada: um indicador discreto permanece junto à ação até que os dados sejam alterados novamente.

- [P2] Estado offline não antecipava o comportamento
  - Local: rodapé da lista.
  - Evidência: antes do clique não havia explicação de que a chamada seria armazenada no dispositivo.
  - Impacto: o usuário podia evitar salvar por receio de perder a chamada.
  - Correção aplicada: offline, a tela informa que o salvamento será local e que o envio ocorrerá quando a internet voltar.

## Verificações concluídas

- Layout e controles da chamada não foram reorganizados.
- O botão mantém o estado de carregamento existente.
- A confirmação remota só usa `Chamada sincronizada` quando o servidor respondeu.
- Falha de rede com fila disponível usa `Salva no dispositivo` e informa o envio posterior.
- Falha de rede também na persistência local usa estado de erro.
- Typecheck, 5 testes focados, higiene de performance, escopo organizacional e diff check passaram.
- A rota local respondeu HTTP 200.

## Comparison history

1. Os mockups com mudanças de composição foram rejeitados.
2. O escopo foi reduzido a feedback de salvamento e comportamento offline, preservando a tela atual.
3. A implementação corrigiu o contrato da camada de dados e adicionou somente os estados de persistência.
4. Captura pós-correção pendente para validar visualmente o rodapé em desktop e mobile.

final result: blocked

---

# Design QA — Transição de carregamento da Gestão

- Evidência do defeito: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-f510e66e-6791-4da4-b28c-3eb8a4729491.png`
- Rota: `http://localhost:8081/coord/management`
- Estado alvo: carregamento inicial em tema escuro
- Captura posterior à correção: pendente

## Finding

- [P1] Conteúdo liberado entre dois estados de carregamento
  - Evidência: durante a resolução inicial da organização, o carregamento do dashboard concluía cedo sem uma organização ativa. Quando a organização administrativa aparecia, a tela real era renderizada por um frame antes de a busca de dados reativar `loading`.
  - Impacto: sequência perceptível `shimmer → conteúdo vazio → shimmer → conteúdo`, com flick e perda de estabilidade visual.
  - Correção aplicada: a fase da tela agora depende da organização ativa realmente carregada; o dashboard não encerra o loading enquanto o contexto organizacional está pendente e resultados de requisições antigas são descartados.

## Verificações concluídas

- O estado inicial permanece em shimmer até os dados corresponderem à organização ativa.
- A troca de organização volta ao shimmer sem expor dados da organização anterior.
- Uma conta sem acesso continua seguindo a tela de permissão negada após a resolução do contexto.
- Typecheck, 5 testes focados, higiene de performance, escopo organizacional e diff check passaram.
- A rota local respondeu HTTP 200.

## Confirmação visual pendente

É necessária uma nova observação do carregamento completo para confirmar a ausência do flick temporal; uma captura estática isolada não demonstra a sequência de frames.

final result: blocked

---

# Design QA — Menu da conta Google

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-7c09723e-f4a5-4505-b96f-c13fc9a807ce.png`
- Implementation screenshot: `artifacts/design-qa/profile-google-account-menu-desktop.jpg`
- Comparison input: `artifacts/design-qa/profile-google-account-menu-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: conta Google conectada, menu contextual aberto

## Full-view comparison evidence

A implementação mantém a seção `Segurança da conta` e troca apenas os chips de status e desvinculação por uma linha estática com ícone, título, status e acionador de três pontos. A hierarquia e a densidade seguem o padrão já validado na base acadêmica e nos cartões de Turmas.

## Focused region comparison evidence

Referência e implementação foram avaliadas juntas no mesmo comparativo. A ação destrutiva fica recolhida no menu global, com a mesma borda, raio, sombra e cor de perigo do menu da base acadêmica. O menu permanece dentro da viewport e não altera a altura do cartão.

## Required fidelity surfaces

- Tipografia: pesos, tamanhos e truncamento seguem os demais itens do perfil.
- Espaçamento: ícone de 36 px, acionador de 34 px e ritmo vertical de 58 px preservam a densidade do produto.
- Cores: superfícies e estados usam os tokens existentes; vermelho aparece somente na ação destrutiva.
- Ativos: o ícone Google vem do registro de ícones existente, sem substituição visual improvisada.
- Conteúdo: `Google`, `Conta conectada` e `Desvincular Google` comunicam estado e ação sem duplicação.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.
- Diferença intencional: o menu tem apenas uma opção porque a integração de login oferece somente a ação contextual de desvinculação.

## Verificações concluídas

- Somente os três pontos abrem o menu; a linha Google permanece estática.
- Clique externo e `Esc` fecham o menu.
- O estado desconectado continua exibindo a ação direta `Conectar`.
- O menu aparece uma única vez em desktop, tablet e mobile.
- Nenhum erro ou aviso novo foi registrado no console durante a validação.

## Comparison history

1. A referência definiu o acionador de três pontos e a ação destrutiva recolhida.
2. O padrão já aplicado à base acadêmica definiu o comportamento e os tokens.
3. A captura final confirmou a linha estática, o menu global e o posicionamento responsivo.

final result: passed

---

# Design QA — Acabamento dos cartões do perfil

- Source visual truth: anotações do perfil e `artifacts/design-qa/profile-google-account-menu-desktop.jpg`
- Implementation screenshot: `artifacts/design-qa/profile-account-cards-polish-desktop.jpg`
- Comparison input: `artifacts/design-qa/profile-account-cards-polish-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: perfil administrativo, Google Drive e conta Google conectados

## Full-view comparison evidence

O comparativo antes/depois confirma três correções localizadas: a base acadêmica usa a marca colorida oficial do Google Drive, o cartão de e-mail não repete o estado `Confirmado` e os cartões de e-mail e Google adotam a mesma superfície usada pelos demais cartões do perfil.

## Focused region comparison evidence

A região `Configurações` e a seção `Conta` foram alinhadas no mesmo comparativo. A estrutura, tipografia, bordas, altura das linhas e ações permaneceram inalteradas; somente ativo visual, conteúdo redundante e token de superfície foram corrigidos.

## Required fidelity surfaces

- Tipografia: títulos e metadados preservam tamanhos e pesos existentes.
- Espaçamento: ícone do Drive ocupa 22 px dentro do contêiner de 36 px, sem alterar a linha.
- Cores: e-mail, Google e `Sair` usam `colors.card`, com borda e raio idênticos.
- Ativos: o PNG oficial do Google Drive foi usado sem deformação ou recriação.
- Conteúdo: o selo `Confirmado` foi removido; a confirmação pendente continua tratada pelo aviso global existente.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.

## Verificações concluídas

- O logo do Google Drive aparece uma única vez com texto alternativo.
- O texto `Confirmado` não aparece na seção.
- As superfícies de e-mail, Google e `Sair` resolvem para a mesma cor, borda e raio.
- Não há overflow horizontal no mobile.

## Comparison history

1. A captura anterior mostrou ícone genérico, selo redundante e cartões com superfície diferente.
2. O ativo oficial, a remoção do selo e os tokens de card foram aplicados.
3. O comparativo final confirmou que as três diferenças foram eliminadas.

final result: passed

---

# Design QA — Validação visual de e-mail no cadastro

- Source visual truth: estado inicial capturado em `artifacts/design-qa/signup-missing-email-baseline.jpg` e anotação do usuário na rota `/signup`
- Implementation screenshot: `artifacts/design-qa/signup-missing-email-desktop.jpg`
- Mobile implementation screenshot: `artifacts/design-qa/signup-missing-email-mobile.jpg`
- Animation evidence: `artifacts/design-qa/signup-missing-email-shake-frame.jpg`
- Comparison input: `artifacts/design-qa/signup-missing-email-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: envio do cadastro com o campo de e-mail vazio

## Full-view comparison evidence

O comparativo no mesmo viewport mostra que a mensagem textual solta foi substituída
por um estado visual ancorado diretamente no campo: balão de alerta, seta, borda
de perigo e foco automático. O restante do formulário, sua densidade e a ação
primária permanecem inalterados.

## Focused region comparison evidence

A captura durante a animação confirma o deslocamento horizontal curto do conjunto
balão/campo. A captura estabilizada confirma que a animação termina na posição
original, mantendo o alerta legível acima do campo e sem sobreposição com a senha.

## Required fidelity surfaces

- Tipografia: o alerta usa 12 px e peso 700, coerente com os feedbacks compactos existentes.
- Espaçamento: balão, seta e campo preservam o ritmo vertical e não comprimem a ação principal.
- Cores: borda, balão e ícone usam os tokens semânticos de perigo existentes.
- Ativos: o alerta usa `warningCircle` do registro de ícones do produto.
- Conteúdo: `Digite seu e-mail` é curto, direto e localizado no ponto de correção.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.

## Verificações concluídas

- O campo e o balão vibram por 250 ms e retornam à posição original.
- O e-mail recebe foco automaticamente após o envio inválido.
- O alerta possui semântica de acessibilidade e desaparece ao digitar.
- Não há overflow horizontal em mobile, tablet ou desktop.
- Nenhum erro de aplicação foi encontrado durante a interação.

## Comparison history

1. O estado original apresentava apenas uma mensagem distante do campo.
2. Balão, destaque, foco e vibração foram adicionados ao campo de e-mail.
3. A comparação final confirmou feedback visual imediato, localizado e responsivo.

final result: passed

---

# Design QA — Formato válido de e-mail no cadastro

- Source visual truth: `artifacts/design-qa/signup-missing-email-desktop.jpg` e anotação do usuário na rota `/signup`
- Implementation screenshot: `artifacts/design-qa/signup-invalid-email-desktop.jpg`
- Mobile implementation screenshot: `artifacts/design-qa/signup-invalid-email-mobile.jpg`
- Comparison input: `artifacts/design-qa/signup-invalid-email-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: tentativa de cadastro com `kjskaj` no campo de e-mail

## Full-view comparison evidence

O comparativo mostra que o padrão visual aprovado para campo vazio foi preservado
e recebeu uma variação específica para formato inválido. A validação acontece
antes da tentativa de cadastro e mantém balão, borda, foco e vibração no próprio
campo.

## Focused region comparison evidence

Os estados vazio e inválido foram avaliados lado a lado no mesmo viewport. Apenas
o valor digitado e a instrução mudam; tamanho do balão, seta, ícone, borda e ritmo
do formulário permanecem consistentes.

## Required fidelity surfaces

- Tipografia: a nova instrução mantém tamanho e peso do alerta anterior.
- Espaçamento: o texto maior cabe no balão sem alterar a largura do campo ou criar sobreposição.
- Cores: o estado inválido reutiliza os mesmos tokens semânticos de perigo.
- Ativos: o ícone `warningCircle` existente foi preservado.
- Conteúdo: `Digite um e-mail válido` diferencia claramente campo vazio de formato inválido.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.

## Verificações concluídas

- `kjskaj` é bloqueado localmente e exibe o alerta de formato inválido.
- `nome+teste@exemplo.com.br` é aceito e avança para a validação da senha.
- O alerta desaparece durante a correção e o foco retorna ao e-mail quando necessário.
- Não há overflow horizontal em mobile, tablet ou desktop.
- Nenhum erro de aplicação foi encontrado durante a interação.

## Comparison history

1. O cadastro aceitava qualquer texto para então depender do erro genérico do servidor.
2. Uma validação local de estrutura `nome@domínio.extensão` foi adicionada.
3. O comparativo final confirmou a variação visual sem regressão no estado de campo vazio.

final result: passed

---

# Design QA — Carregamento do botão Entrar

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-eb2dcea9-8565-46e4-8a18-15d3494c3dbe.png`
- Baseline local: `artifacts/design-qa/login-button-loading-baseline.jpg`
- Implementation screenshot: `artifacts/design-qa/login-button-loading-desktop.jpg`
- Mobile implementation screenshot: `artifacts/design-qa/login-button-loading-mobile.jpg`
- Comparison input: `artifacts/design-qa/login-button-loading-comparison.jpg`
- Viewports verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: autenticação por e-mail e senha em andamento

## Full-view comparison evidence

O comparativo antes/depois confirma que o botão preserva largura e altura enquanto
a autenticação está em andamento. O estado carregando agora combina indicador
animado visível, texto `Entrando...` e bloqueio de interação.

## Focused region comparison evidence

O botão foi avaliado no mesmo viewport antes e durante a requisição. O conteúdo
permanece centralizado, o indicador tem contraste suficiente no fundo desabilitado
e nenhum elemento vizinho muda de posição.

## Required fidelity surfaces

- Tipografia: `Entrando...` preserva tamanho e peso do rótulo original.
- Espaçamento: indicador e texto usam 8 px de intervalo sem alterar a altura do botão.
- Cores: indicador e texto usam a cor de conteúdo desabilitado, garantindo contraste no estado ocupado.
- Ativos: o indicador é o `ActivityIndicator` nativo do React Native.
- Conteúdo: o verbo no gerúndio comunica claramente que a ação está em andamento.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.

## Verificações concluídas

- O estado carregando expõe um `progressbar` e o texto `Entrando...`.
- Cliques repetidos permanecem bloqueados por `busy` e pela trava de requisição existente.
- O botão retorna ao estado normal após falha de autenticação.
- Não há overflow horizontal em mobile, tablet ou desktop.
- Nenhum erro de aplicação foi encontrado durante a interação.

## Comparison history

1. A referência mostrava apenas `Entrar` em um botão visualmente desabilitado.
2. O indicador recebeu contraste e o componente passou a aceitar um rótulo específico de carregamento.
3. A captura final confirmou animação visível e estabilidade de layout.

final result: passed

---

# Design QA — Menu flutuante de perfil na barra lateral

- Source visual truth: `C:\Users\gusta\AppData\Local\Temp\codex-clipboard-d82e66dd-a783-4ecd-848a-e94f7202640d.png`
- Implementation screenshot: `artifacts/profile-menu-open-final.png`
- Expanded-sidebar screenshot: `artifacts/profile-menu-expanded-1440x1024.png`
- Comparison input: `artifacts/profile-menu-source-vs-final.jpg`
- Viewports solicitados e verificados: 390 × 844, 834 × 1194 e 1440 × 1024
- Estado alvo: menu de perfil aberto a partir do avatar na barra compacta, tema escuro

## Full-view comparison evidence

O comparativo lado a lado confirma a mesma estrutura da referência: card elevado,
identidade no topo, separadores, ações em lista e ancoragem imediatamente acima
do avatar. O card permanece sobre o conteúdo sem ser cortado pela barra lateral.

## Focused region comparison evidence

O recorte do menu e do avatar foi normalizado ao tamanho da referência. A
implementação preserva a hierarquia visual do card do GPT, mas substitui ações
sem correspondência no produto por perfil, configurações, troca autorizada de
perfil e saída.

## Required fidelity surfaces

- Tipografia: nome, função, títulos e metadados usam a hierarquia do GoAtleta com contraste equivalente à referência.
- Espaçamento: cabeçalho, linhas, separadores e rodapé mantêm ritmo uniforme e alvos de toque de pelo menos 44 px.
- Cores: o card usa a superfície navy existente, verde somente para o perfil ativo e vermelho discreto para sair.
- Ativos: todos os símbolos usam o registro existente de ícones Ionicons; não há desenho improvisado.
- Conteúdo: as opções exibidas correspondem a rotas, permissões e ações reais do GoAtleta.

## Findings

- Nenhum problema P0, P1 ou P2 encontrado na comparação final.
- P3 aceito: o card é mais compacto que a referência para respeitar a densidade da Home do professor.

## Verificações concluídas

- O avatar abre e fecha o card sem expandir a barra lateral.
- Clique fora, tecla `Esc` e mudança de rota fecham o menu.
- `Perfil e configurações` navega para `/prof/profile` sem recarregar a aplicação.
- A troca de perfil só aparece para contas com permissão e preserva o perfil ativo.
- O mesmo card funciona na barra expandida e permanece acima do scrim.
- Mobile e tablet mantêm a navegação original sem overflow horizontal.
- Nenhum erro de aplicação foi encontrado; apenas avisos conhecidos do React Native Web sobre `pointerEvents` e sombras legadas.

## Comparison history

1. O avatar compacto expandia a barra inteira e não abria um menu próprio.
2. O card flutuante foi adicionado com conteúdo funcional, fechamento externo e suporte a teclado.
3. O contraste do perfil ativo foi reforçado após a primeira comparação.
4. A comparação final confirmou ancoragem, legibilidade e fidelidade estrutural.

final result: passed
