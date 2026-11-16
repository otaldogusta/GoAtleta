# Revisão da composição do Go Atleta · 13/11/2026

Esta rodada responde aos doze apontamentos do usuário sobre nove telas. A revisão
anterior tratou principalmente comportamento e acessibilidade; suas capturas não
demonstravam a melhoria de composição solicitada. Este documento substitui a
avaliação visual dessas nove superfícies, preservando o registro funcional anterior.

[Comparativos locais preservados](http://127.0.0.1:8096/antes-depois-lote3.html) ·
[Inventário por abas](http://127.0.0.1:8096/por-abas.html).

## Referências realmente utilizadas

- As abas contínuas de `ScoutingNavigation` orientam `UnderlineTabs`: seleção
  sublinhada, hierarquia discreta e painéis irmãos. O vazio de `ClassesListSection`
  orienta `ListEmptyState`, sem cartão externo. O print enviado pelo usuário
  orienta a linha da chamada, com nome e ações lado a lado.
- [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)
  foi lida pelo Designer UI para alinhamento, hierarquia e redução de decoração.
  [Awesome Design MD](https://github.com/VoltAgent/awesome-design-md) foi usado
  pela [análise do Linear](https://getdesign.md/linear.app/design-md), confrontada
  com o [relato da equipe do Linear](https://linear.app/now/how-we-redesigned-the-linear-ui).
  Nenhuma biblioteca, fonte ou framework externo foi introduzido.
- [Adobe Spectrum Tabs](https://react-spectrum.adobe.com/v3/Tabs.html) e
  [Web Interface Guidelines da Vercel](https://vercel.com/design/guidelines)
  apoiam seleção, nomes acessíveis, teclado, retorno do foco e alvos de toque.
- Playwright com Chromium local executou percursos e capturas. Isso não significa
  que o Playwright CLI tenha sido instalado. A referência de imagem aplicada foi
  a chamada real fornecida, sem gerar uma interface substituta para o aplicativo.

Direção visual e evidências auxiliares estão em
`.tmp/auditoria-go-atleta-2026-11-13/lote-3/direcao-ui.md`.

## Alterações por apontamento

| Comentários | Superfície | Resultado implementado |
| --- | --- | --- |
| 1, 12 | Avisos | Todos, Não lidos e Arquivados como abas; Tipo em seletor. O estado vazio segue Turmas. Contagens zero deixam de ocupar o cabeçalho. A seleção continua exclusiva, preservando as consultas existentes. |
| 5, 6, 7 | Biblioteca | Meus Links e Catálogo no padrão sublinhado. Busca, Fundamento e Mais filtros substituem as linhas de pills. Critérios avançados usam seletores dentro da ficha. Vazio com ação de limpar. |
| 2 | Família · Hoje | Vínculo, próxima atividade e frequência numa sequência. Removidos atalhos duplicados da navegação e cartões de capacidades. Falha tem uma mensagem e nova tentativa; preservadas as permissões e regras de dados desatualizados. |
| 3 | Consultoria | Entrada pela escolha de pessoa; cadastro local aparece sob ação. Identidade selecionada uma vez, Trocar e abas contínuas. Objetivo/Local usam seletores e Materiais abre ficha. Assistente vai ao cabeçalho compacto, liberando os campos. |
| 4 | Periodização sem ciclo | Margens laterais de 16 px, alinhamento do contexto e uma ação para configurar, sem duplicação no cabeçalho. |
| 8 | Relatórios | Hierarquia única para frequência e contagens, linhas e divisores no lugar de caixas encaixadas. Abas contínuas e evolução semanal horizontal. Fórmulas e exportação preservadas. |
| 9 | Presença NFC web | Mensagem de compatibilidade, seletor de turma e chamada manual, sem moldura de scanner dentro de outra caixa. Leitura NFC nativa preservada. |
| 10 | Chamada | Corrigido o limite que empilhava nome e botões em 390 px. Nome, Presente e Faltou ficam na mesma linha, com ações de 44 px. Abaixo de 300 px de conteúdo, o reflow continua disponível. |
| 11 | Presença individual | Identidade, resumo, filtro por data e linhas do histórico. Vazio segue Turmas e oferece recuperar o histórico. Sem percentual de zero para ausência de registros. |

## Contratos compartilhados

- `UnderlineTabs` compartilha a composição do Scouting; na web, setas, Home e
  End movem seleção/foco. Apenas a aba ativa pertence à sequência de Tab.
- `CompactSelect` usa o portal de `AnchoredDropdown`, com seleção textual e
  rolagem própria. Enter abre/foca; setas percorrem; Enter escolhe; Escape retorna
  ao acionador. Tab segue para o próximo controle, sem voltar ao gatilho.
- `ListEmptyState` centraliza título, descrição e uma ação textual, sem card.
- `ModalSheet.dialogLabel` é opt-in: o **card**, não o backdrop, recebe semântica
  de diálogo. Na web, o conteúdo externo fica inerte, Tab permanece no diálogo e
  o fechamento restaura o foco. Seletores em portal continuam operáveis dentro
  da ficha. Biblioteca e Materiais adotam o contrato; demais consumidores mantêm
  o comportamento existente.
- Consultoria compacta tem Assistente no cabeçalho e oculta o botão flutuante
  equivalente, usando os helpers de visibilidade de rota existentes.

## Validação e limites

Classificação: nível 2 da [escada de validação](../operations/validation-ladder.md),
por mudar composição e comportamento de filtros/foco em múltiplas áreas.
Designer UI, Designer UX, Implementação e Revisão independente participaram.

- Designer UI inspecionou as nove telas em **390 × 844, claro e escuro**, além
  das referências de Scouting/Turmas e dos estados selecionado, vazio e falha.
- UX capturou onze pares em 390 × 844. Chamada também conferida em 483 × 726:
  ações de 69,5/70,5 × 44 px, mesma linha e foco visível. Biblioteca em 834 × 1194
  confirmou limites do painel, rolagem da lista e teclado do seletor aninhado.
- Fluxos conferidos: abas e Tipo em Avisos; limpar busca e filtros na Biblioteca;
  recuperação após falha sintética na Família; configurar ciclo e fechar;
  alternar Relatórios; NFC abrir a mesma turma; recuperar histórico individual;
  escolher/trocar pessoa e abrir Materiais na Consultoria. Escape e Concluir
  devolvem foco ao acionador após a saída da ficha. A revisão independente final
  não encontrou defeito acionável no recorte; reabertura e desmontagem cancelam
  o callback de retorno.
- Testes focados passaram: `ClassOperationsWorkspace`,
  `activity-catalog-library-ui`, `notice-feed-view-model`, `family-request-races`,
  `trainer-report-export`, `trainer-report-selectors`, `route-visibility` e
  `ModalSheet-route-focus`. Passaram tipos do app, lint dos arquivos afetados,
  escopo organizacional e higiene de performance. Os executáveis locais foram
  chamados diretamente porque o wrapper npm desta estação falhou ao iniciar
  `cmd.exe`; isso não foi descrito como execução bem-sucedida do wrapper.
  A checagem final de tipos e `git diff --check` também passaram após o ajuste de
  retorno do foco em Materiais.

O servidor existente em `localhost:8081` respondeu, mas sua sessão foi preservada.
Os testes autenticados rodaram **o mesmo checkout em 127.0.0.1:8082**, com Supabase
isolado em 54321 e contas fictícias. Falha 503 e lista vazia foram simuladas apenas
no navegador de teste; a ficha da Consultoria permaneceu em memória, sem salvar.
As reinicializações do Metro por falta de memória não contam como testes aprovados.
Os percursos finais usam o servidor reiniciado com heap de 6144 MB.

Artefatos: `.tmp/auditoria-go-atleta-2026-11-13/lote-3/ux/README.md`,
`ux/antes`, `ux/depois`, `ui-light` e `ui-dark`. O gerador `lote-3/build_review.py`
mantém a galeria atual e preserva `antes-depois-lote2.html`. Os pares principais
comparam o mesmo estado; perfil selecionado e tema claro estão identificados à
parte. A diferença de ilustração do Catálogo não é uma alteração desta rodada.

Esta evidência não certifica todas as abas do aplicativo, aparelho físico,
leitor NFC, todas as larguras desktop ou publicação. O inventário conserva as
pendências das demais superfícies. Nenhum commit, push ou deploy foi realizado.
