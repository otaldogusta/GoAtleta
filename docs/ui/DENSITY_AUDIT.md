# Revisão de densidade e aproveitamento do espaço

## Escopo

Revisão local de desktop e mobile, tomando `/periodization` como referência de organização do espaço. Sem publicação. Evidências privadas em `.codex-artifacts/density-audit/`, ignoradas pelo Git.

## Diagnóstico e correções

A escala compartilhada ampliava título, corpo, padding e gaps conforme o monitor crescia. Além disso, cabeçalhos e Home tinham escalas próprias. A largura extra produzia componentes maiores em vez de mais conteúdo.

- Escala estável de tablet a ultrawide: título 22/28, seção 16, corpo/card 14, metadados 12, padding 14 e gaps 10–12. Mobile mantém organização e alvos de toque, com título 20/26.
- AppHeader, ClassContextHeader e formulário de turma seguem os tokens.
- Home: destaque de aula, agenda semanal, atalhos e lista do dia compactados; removido excesso de espaço inferior no workspace.
- Turmas: linhas de tabela de 88 para 68 px. Atletas: linhas de 72/76 para 60/68 px, mantendo cards mobile; paginação usa a altura disponível, limitada a 8–20 itens.
- Consultoria: aluno e perfil de treino lado a lado em desktop largo; tablet e celular empilham os painéis e campos. ResponsiveGrid permite desativar a divisão sem alterar seu padrão existente.

## Cobertura visual

Inventário: 116 arquivos de rota, incluindo aliases e variantes; 83 arquivos com candidatos a overlays. Contagens não equivalem a telas únicas nem a cobertura completa.

Foram capturados dashboard, Home professor, turmas, visão geral da turma, atletas, gestão, financeiro, eventos, NFC, periodização global e da turma, planejamento, assistente, comunicados, calendário, exercícios, consultoria, perfil e workspace aluno. Foram abertos menus de turma/perfil/workspace, filtros de alunos, cadastro/edição de turma, cadastro/perfil de aluno, convite, evento, importação de plano, cadastro de vídeo e as seis etapas do editor de periodização, sem salvar dados.

Comparações antes/depois em desktop: dashboard, turmas, atletas e consultoria. Home professor, turmas, atletas e consultoria conferidos em 1440×1024, 834×1194 e 390×844. Formulários de turma/aluno, importação e vídeo também capturados em mobile. Consultoria sem overflow horizontal nos três tamanhos.

Galeria local `index.html`: capturas rotuladas pelo arquivo, com filtro. Capturas com carregamento ou navegação não confirmada são separadas como evidência limitada. Não publicar a galeria: contém dados da sessão autenticada.

## Limites e pendências da varredura

A revisão não é uma certificação de todas as combinações de telas, estados e permissões. Família e administração não estavam disponíveis no seletor desta sessão. Auth/recovery, convites com token, erros de backend, dados vazios alternativos e fluxos que exigem gravação não foram exercitados. Tema claro conferido nesta continuação nos estados relacionados abaixo. Aplicativo nativo não conferido: o controle de aplicativos nativos está indisponível neste ambiente.

O workspace aluno foi capturado em desktop; plano e agenda tiveram carregamento concluído e estados vazios confirmados em desktop e celular. Chamada, relatório em modal, scouting com formulário e quadra visual com configurações também foram capturados em desktop; seus estados condicionais e mobile ainda precisam de revisão dedicada. O wizard de periodização foi inspecionado nas seis etapas; a primeira tem área vazia considerável, enquanto a etapa de nível utiliza a quadra. A primeira etapa passou de 820 para 560 px máximos no desktop; quadra e revisão mantêm 820 px. Limite pelo viewport preservado, mobile permanece com 92%. Conferidos desktop, tablet e mobile.

## Validação

Nível 3 da escada: 12 suítes focadas, 133 testes aprovados; typecheck, ESLint dos arquivos alterados, org-scope, perf-hygiene e diff-check aprovados. Smoke autenticado em localhost:8081. Build e validação de release não executados, pois as alterações permanecem locais.


## Continuação — tema claro e estados pendentes

- Painel claro: desktop e mobile; listas de turmas mobile e atletas desktop.
- Chamada mobile e relatório mobile em tema claro, sem marcar presença nem salvar relatório.
- Editor de periodização: seis etapas mobile, primeira etapa desktop/tablet e quadra desktop em tema claro. A área de diagnóstico contém perfil assíncrono; capturas com carregamento não confirmam seu conteúdo final.
- Convite de responsável desktop e painel de acessos familiares mobile com formulário de convite. Nenhum convite enviado. Ao mudar breakpoint, o convite da linha desktop é desmontado; a captura `guardian-modal-light-390` mostra a lista, não o modal. Evidência limitada na galeria.
- Agenda do aluno: dia sem aula; plano: ainda não publicado. Ambos confirmados após carregamento, em desktop e mobile.
- Preferência original de tema escuro e viewport original restaurados no fim.
- Ajuste adicional isolado de altura: typecheck, lint e diff-check aprovados; verificação visual nos três tamanhos. Testes anteriores permanecem como evidência do pacote anterior, sem afirmar nova execução.

Pendências de cobertura: temas claro/escuro em todas as combinações de overlays, estados de diagnóstico com dados concluídos, fluxos autenticados indisponíveis (família/admin), auth/recovery e aplicativo nativo. Não preencher essas lacunas com screenshots de aliases ou de carregamento.

Calibração após comentário na turma Raposas: etapa inicial com largura máxima de 820 px e altura de 400 px (460 px ao criar próximo ciclo), cabeçalho/rodapé e margens menores. Conferida no viewport real 1063×704 com os dois campos e ação visíveis. Demais etapas mantêm área de trabalho. Lint e diff-check aprovados.

## Moldura estável e assistente em todas as etapas

A redução isolada da primeira etapa foi substituída por uma moldura constante: máximo de 960×620 px no desktop, limitado pelo viewport; mobile mantém 92% de altura. Cabeçalho, margens e rodapé são estáveis. O assistente ocupa a região lateral em desktop e empilha no mobile.

O hook da conversa agora vive no gerenciador, preservando histórico, texto e pendências ao trocar de etapa. O painel compartilhado aparece em todas as etapas e resume as escolhas atuais. Objetivo, nível, formato/rede, agenda, carga, revisão e contexto de competição/pausas acompanham o rascunho.

Ao enviar uma mensagem, a etapa/contexto é enviado separado do relato. O handler instrui o modelo a usar escolhas provisórias somente para orientar, sem extraí-las como fatos ou afirmar aplicação no ciclo. O usuário pediu reconhecimento e orientação na conversa, sem aplicação automática. Seletores de formato/rede mantêm o comportamento existente.

Validação: 11 testes de hook/handler aprovados, incluindo contexto separado e retry; typecheck, ESLint, org-scope, perf-hygiene e diff-check aprovados. Nenhuma mensagem ou alteração de ciclo foi enviada durante os testes visuais.

Limites atuais: o modo de comentários do navegador (`codex-browser-sidebar-comments-root`) intercepta os cliques. Capturas nomeadas assistant-step2 a step6 desta rodada não demonstram navegação: mostram a primeira etapa e devem ser tratadas como evidência limitada. A primeira etapa com histórico real foi conferida visualmente; interação entre etapas aguarda saída do modo de comentários. O novo contexto do backend foi testado localmente com mocks; a Edge Function não foi publicada, portanto seu uso em respostas reais ainda não foi confirmado.

Limpeza após quatro comentários: removidos o resumo visível de contexto e o link Perfil da turma do painel (contexto continua no envio). ScrollView da conversa usa scrollToEnd ao montar/redimensionar e ao mudar conteúdo; histórico real conferido na última resposta. Rodapé com altura mínima de 52 px e padding vertical 6; Continuar reduzido para 120×40 px. Captura periodization-chat-clean-latest-1063 confirma os textos removidos e última mensagem visível. ESLint e diff-check aprovados.

Correção de flick entre etapas: PeriodizationDiagnosticStep deixou de montar seu próprio assistente/rodapé. O painel compartilhado permanece como irmão fixo do conteúdo variável, com uma única instância e ScrollView preservada. Apenas o conteúdo esquerdo muda. ESLint, typecheck e diff-check aprovados. Navegação interativa ainda limitada pelo modo de comentários do navegador; não afirmar teste de transição ao vivo enquanto ele interceptar cliques.

Rodapé da revisão alinhado às demais etapas: Salvar e aplicar com altura mínima 40, largura mínima 120, raio 10 e padding horizontal 16; Descartar também 40. Captura periodization-review-footer-compact-1063, sem salvar/descartar rascunho. Lint e diff-check aprovados.
