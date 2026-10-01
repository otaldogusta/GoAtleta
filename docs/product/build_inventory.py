"""Gera um snapshot local verificável. Execute na raiz do repositório."""
import json
import hashlib
from datetime import datetime, timedelta, timezone
import subprocess
from pathlib import Path

root = Path.cwd()
modules = []
def add(title, route, source, text):
    items = []
    for line in text.strip().splitlines():
        status, name, detail, *evidence = line.split('|')
        file = evidence[0] if evidence else source
        if not (root / file).is_file():
            raise ValueError(f'Fonte inexistente: {file}')
        items.append(dict(status=status, title=name, detail=detail, evidence=file))
    modules.append(dict(id=f'm{len(modules)}', title=title, route=route, items=items))

add('Alunos · diretório e perfil', '/students', 'app/students/index.tsx', """
code|Listagem e resumo|Lista, linhas, resumo e estados vazios.|src/screens/students/components/StudentsListSection.tsx
code|Busca de alunos|Busca normalizada em camada de aplicação.|src/screens/students/application/student-search.ts
code|Filtros de turma e modalidade|Controles próprios para o diretório.|src/screens/students/components/StudentDirectoryFilterBar.tsx
code|Status do cadastro|Badge de situação no diretório.|src/screens/students/components/StudentDirectoryStatusBadge.tsx
code|Status de acesso ao app|Distinto do estado do cadastro.|src/screens/students/components/StudentLoginAccessStatus.tsx
code|Cadastro e pré-cadastro|Hooks e formulário próprios.|src/screens/students/hooks/useSavePreRegistration.ts
code|Perfil em modal|Edição com seções e contexto operacional.|src/screens/students/modals/StudentEditModal.tsx
code|Nome, e-mail e telefone|Campos presentes no perfil.|src/screens/students/modals/StudentEditModal.tsx
code|Nascimento e aniversário|Data no perfil e indicador de aniversário.|src/screens/students/components/BirthdayAvatar.tsx
code|Turmas, unidade e modalidade|Seleção de vínculo no modal.|src/screens/students/components/StudentClassDropdownPanel.tsx
code|Posição no voleibol|Levantador, oposto, ponteiro, central e líbero.|src/screens/students/modals/StudentEditModal.tsx
code|Saúde e observações|Avaliação de saúde, medicação e observações. Conferir permissões antes de usar.|src/core/student-health.ts
code|Dados do responsável|Nome, telefone e parentesco.|src/screens/students/modals/StudentEditModal.tsx
code|CPF e RG|Seção de documentos pessoais.|src/screens/students/components/StudentDocumentsFields.tsx
code|Revelação de CPF|Hook específico; não implica acesso irrestrito.|src/screens/students/hooks/useRevealCpf.ts
code|RA e curso|Seção de informações acadêmicas.|src/screens/students/components/StudentAcademicFields.tsx
code|Foto do aluno|Upload, acesso e remoção em API específica.|src/api/student-photo-storage.ts
code|Foto ampliada|Modal próprio de visualização.|src/screens/students/components/StudentPhotoViewerModal.tsx
code|Resumo financeiro|Popover operacional separado da gestão completa.|src/screens/students/components/StudentFinanceSummaryPopover.tsx
code|Frequência e indicadores|Contexto operacional derivado para o perfil.|src/screens/students/application/student-operational-indicators.ts
code|Histórico operacional|Modal específico.|src/screens/students/modals/StudentOperationalHistoryModal.tsx
code|Ativação e inativação|Estado operacional e motivo.|src/screens/students/application/student-operational-status.ts
code|Sugestão de inatividade|Regra própria; sugestão não equivale a mudança automática.|src/screens/students/application/student-inactivity-suggestion.ts
code|Possíveis duplicados|Autocomplete e aviso para cadastro existente.|src/screens/students/components/StudentExistingAutocomplete.tsx
code|Revisão de duplicidades|Contrato específico de revisão.|src/screens/students/application/student-duplicate-reviews.ts
code|Convites e acesso familiar|Painéis vinculados ao aluno.|src/screens/students/components/StudentFamilyAccessPanels.tsx
code|Importação de alunos|Modal e API de importação.|src/screens/students/modals/StudentsImportModal.tsx
code|Sincronização Google Forms|Modal e implementação específicos.|src/screens/students/google-forms-sync.ts
code|Exportação XLSX|Exportador de planilha.|src/screens/students/export/exportStudentsXlsx.ts
code|Aniversariantes|Rota específica.|app/students/birthdays.tsx
verify|Smoke integrado do perfil|Salvar/reabrir, campos ausentes, saúde, foto e permissões não foram exercitados nesta rodada.|src/screens/students/modals/StudentEditModal.tsx
""")
add('WhatsApp · mensagens e convites', '/students', 'src/screens/students/modals/WhatsAppModal.tsx', """
code|Modal de WhatsApp|Seleção de contato, modelo e edição antes da abertura externa.
code|Aluno ou responsável|Escolha explícita do destinatário.
code|Faltou hoje|Modelo disponível.|src/utils/whatsapp-templates.ts
code|Lembrete de aula|Modelo com contexto da aula.|src/utils/whatsapp-templates.ts
code|Convite para grupo|Modelo para compartilhar grupo.|src/utils/whatsapp-templates.ts
code|Parabéns e feedback|Modelo disponível.|src/utils/whatsapp-templates.ts
code|Aviso rápido|Modelo de comunicação breve.|src/utils/whatsapp-templates.ts
code|Convite do aluno|Modelo de acesso ao app.|src/utils/whatsapp-templates.ts
code|Texto e campos personalizados|Mensagem editável antes de abrir o WhatsApp.
code|Link wa.me|Normalização brasileira e abertura externa.|src/utils/whatsapp.ts
code|Revogar e compartilhar convite|Fluxo com confirmação e regra de compartilhamento.|src/screens/students/application/student-invite-sharing.ts
verify|Destinatário e abertura externa|Conferir telefone inválido, ausência de responsável e cancelamento. Nenhuma mensagem foi enviada.
""")
add('Turmas · editor e equipe', '/classes', 'docs/operations/handoff.md', """
code|Listagem de turmas|Entradas por papel reutilizam a base.|app/classes/index.tsx
code|Workspace da turma|Entrada principal do detalhe.|app/class/[id].tsx
code|Alunos da turma|Rota de elenco.|app/class/[id]/students.tsx
code|Planejamento e periodização|Rotas com contexto da turma.|app/class/[id]/periodization.tsx
code|Sessão e histórico|Rotas específicas.|app/class/[id]/log.tsx
recorded|Editor compartilhado|Registro de 21/09: mesmo editor na listagem e no detalhe.
recorded|Equipe temporal|Substituições agendadas, retorno, autoria e correções versionadas.
recorded|Unidade e quadra|Busca/badge e distinção de vôlei de quadra/areia.
recorded|Proteção de saída|Aviso de fechamento apenas quando o estado normalizado mudou.
verify|Revisão do editor atual|Conferir horários, vínculos e troca de professor no localhost.
""")
add('Perfil pedagógico da turma', '/class/[id]', 'docs/operations/class-pedagogical-profile.md', """
recorded|Diagnóstico compacto|Seis etapas e acesso ao perfil da turma.
recorded|Perfil persistente e versionado|Histórico, origem, autor, concorrência, idempotência, desfazer e RLS.
recorded|Formato e condições de jogo|Quadras proporcionais, altura de rede e regras adaptadas.
recorded|Influência nos planos|Contexto mensal, semanal e diário; versão usada fica no plano.
recorded|Planos existentes preservados|Revisão seletiva; sem sobrescrever aulas realizadas ou edições manuais.
recorded|Validação de 29/09|Handoff registra suíte e smoke autenticado; não reexecutados agora.|docs/operations/handoff.md
verify|Rastreabilidade na jornada|Conferir versão do perfil usada no plano e efeito de uma nova revisão.
""")
add('Planejamento · planos e importação', '/prof/planning', 'app/prof/planning.tsx', """
code|Planejamento da turma e mês|Rotas específicas.|app/class/[id]/planning/[month].tsx
code|Criação de sessão|Conteúdo de modal próprio.|src/screens/training/components/TrainingSessionCreateModalContent.tsx
code|Detalhes do plano|Modal específico.|src/screens/training/components/TrainingPlanDetailsModalContent.tsx
code|Ações e aplicação|Modais próprios e camada de aplicação.|src/screens/training/application/apply-training-plan.ts
code|Rascunho do workspace|Contrato de rascunho próprio.|src/screens/training/application/training-plan-workspace-draft.ts
code|Proteção de saída|Contrato separado para fechar sem perder trabalho.|src/screens/training/application/training-plan-workspace-exit.ts
code|Importação PDF|Modal dedicado.|src/screens/training/components/TrainingPlanPdfImportModal.tsx
code|Importação de planilha|Modal dedicado.|src/screens/training/components/TrainingSpreadsheetImportModal.tsx
code|Ponte para biblioteca|Reutilização de atividades no plano.|src/screens/training/application/planning-library-bridge.ts
recorded|Assistente compartilhado|Conversa contextual entre chatbot, planejamento e modais.|docs/operations/planning-assistant-local.md
recorded|Editor compacto e PDF|Registro de densidade e professor/nível canônicos no PDF.|docs/operations/handoff.md
verify|Salvar/aplicar com resposta real|Smoke de conversa documentado não certifica aplicar rascunhos.|docs/operations/planning-assistant-local.md
""")
add('Periodização · ciclos e progressão', '/periodization', 'app/periodization/index.tsx', """
code|Visão unificada|View model próprio.|src/screens/periodization/application/unified-planning-view-model.ts
code|Salvar semana|Função de aplicação específica.|src/screens/periodization/application/save-week-plan.ts
code|Editar semana|Função de aplicação específica.|src/screens/periodization/application/edit-week-plan.ts
code|Estratégia do ciclo|Resolução da estratégia semanal.|src/screens/periodization/application/resolve-week-strategy-from-cycle-context.ts
code|Prévia de sessões|Builder de prévia.|src/screens/periodization/application/build-week-session-preview.ts
code|Geração por dia|Builder com contexto do ciclo.|src/screens/periodization/application/build-auto-plan-for-cycle-day.ts
code|Próximo ciclo|Rascunho específico.|src/screens/periodization/application/next-cycle-draft.ts
code|Resumo observacional|Builder semanal.|src/screens/periodization/application/build-weekly-observability-summary.ts
recorded|Digest, early warning e timeline|Roadmap marca fases 3.7, 3.6 e 3.5 concluídas; evidência histórica.|ROADMAP.md
verify|Papel da sessão perceptível|Roadmap pede exploração/consolidação/pressão/transferência/síntese. Reconciliar com gerador atual.|ROADMAP.md
verify|Progressão e fechamento trimestral|Backlog pede contraste funcional; conclusão atual não certificada.|ROADMAP.md
verify|Anti-repetição funcional|Conferir variação real de tarefas antes de implementar nova solução.|ROADMAP.md
verify|Plano × eixo × recomendação|Metas P1 antigas precisam ser reconciliadas com código atual.|ROADMAP.md
future|Learning que altera builder sozinho|Congelado no roadmap, não é defeito a corrigir.|ROADMAP.md
""")
add('Aula · execução e relatório', '/class/[id]/session', 'app/class/[id]/session.tsx', """
code|Sessão da turma|Entrada de execução da aula.
code|Relatório de aula|Hook e aba próprios.|src/screens/session/hooks/useSessionReport.ts
code|Histórico da turma|Rota dedicada.|app/class/[id]/log.tsx
recorded|Bloco de treino resistido|Prescrição de academia integrada à sessão.|docs/resistance-training/README.md
verify|Fechamento e reabertura|Conferir persistência do relatório e associação à chamada.
""")
add('Presença · chamada, NFC e QR', '/class/[id]/attendance', 'docs/nfc/overview.md', """
code|Chamada nativa|Rota da turma.|app/class/[id]/attendance.tsx
code|Chamada web|Implementação por plataforma.|app/class/[id]/attendance.web.tsx
code|Frequência individual|Rota por aluno.|app/students/[id]/attendance.tsx
code|Vínculo de tag NFC|Hook no contexto da chamada.|src/screens/attendance/use-student-nfc-binding.ts
code|Rota NFC independente|Compatibilidade e diagnóstico.|app/nfc-attendance.tsx
code|Scanner QR|Rota presente; alcance precisa de smoke.|app/qr-scan.tsx
code|Avisos e relatório de faltas|Rotas operacionais.|app/absence-report.tsx
recorded|NFC restrito à administração|Vínculo no modal do aluno; sem reassociação silenciosa.
recorded|Erros Web NFC distintos|Documento diferencia navegador, permissão, hardware e tag sem NDEF.
verify|Aparelho físico e persistência|API disponível não comprova leitura de hardware nem chamada salva.
""")
add('Quadra visual · editor tático', '/class/[id]/visual-tech', 'docs/operations/handoff.md', """
code|Workspace e canvas|Editor em componentes próprios.|src/components/visual-court/CourtEditorWorkspace.tsx
code|Etapas e reprodução|Timeline e controles próprios.|src/components/visual-court/VisualCourtTimelineControls.tsx
code|Exportadores por plataforma|Módulos web e nativo separados.|src/components/visual-court/court-export.web.tsx
recorded|Jogadores, banco e materiais|Ferramentas agrupadas e propriedades por contexto.
recorded|Seleção e edição em grupo|Retângulo, teclado, camadas, alinhamento e desfazer.
recorded|Zoom e deslocamento|Atalhos e encaixe da grade documentados.
recorded|Animação livre e reta|Trajeto, repetição de etapa e miniaturas documentados.
recorded|Versões e rascunhos|Versões imutáveis; rascunhos por usuário/organização/turma.
recorded|Biblioteca e lixeira local|Jogadas, Sistemas, Dados e Lixeira reversível.
recorded|Exportação web PNG/PDF/JSON|JSON permite transportar conteúdo local entre máquinas.
pending|Exportação PNG/PDF nativa|Fora do pacote de export web documentado; reconciliar estado atual.
verify|Tema claro e gestos nativos|Limites de conferência registrados no handoff.
verify|Tela limpa e inversão de lados|Pendências históricas; conferir código atual antes de abrir tarefa.
future|GIF e vídeo|Fora do pacote documentado.|docs/operations/visual-court-workspace-proposal.md
future|Análise tática por IA|Proposta separada, não certificada como entregue.
""")
add('Scouting · observação esportiva', '/class/[id]/scouting', 'app/class/[id]/scouting.tsx', """
code|Listagem e nova sessão|Rotas específicas.|app/class/[id]/scouting/new.tsx
code|Detalhe da sessão|Rota com ID de sessão.|app/class/[id]/scouting/[scoutingSessionId].tsx
code|Persistência de sessões|Camada de banco específica.|src/db/scouting-sessions.ts
code|Núcleo de scouting|Regras no core.|src/core/scouting.ts
code|Visão individual|Entrada student-scouting.|app/student-scouting.tsx
verify|Métricas e encerramento|Conferir coleta, edição e consolidação no fluxo real.
""")
add('Assistente · conversa e contexto', '/assistant', 'docs/operations/planning-assistant-local.md', """
code|Tela dedicada|Entradas gerais e por papel.|app/assistant/index.tsx
code|Contexto do planejamento|Builder específico.|src/screens/periodization/application/planning-assistant-context.ts
code|Contexto do copilot de treino|Função própria.|src/screens/training/application/planning-copilot-context.ts
recorded|Conversa compartilhada|Chatbot, planejamento e modais usam conversa contextual.
recorded|Planos preservados|Conversa não sobrescreve planos existentes.
recorded|Ranking de faltas|Handoff registra ranking determinístico por chamadas realizadas.|docs/operations/handoff.md
recorded|Smoke real v87|Registro de 30/09; versão remota atual não consultada.
pending|Tema claro e modal com resposta real|Pendência explícita na documentação de 30/09.
verify|Frontend publicado|HEAD contém merge #96, documento ainda diz frontend pendente. Confirmar deploy do commit.
future|Avaliação de qualidade e custo|Proposta: casos representativos, tokens, latência e custo por tarefa. Não é bug confirmado.
""")
add('Conhecimento acadêmico · documentos', '/academic-knowledge', 'docs/document-context-runtime.md', """
code|Tela de conhecimento|Rota específica.|app/academic-knowledge.tsx
recorded|Sync rastreável do Drive|Hash, revisão, classificação, trechos e embeddings.
recorded|Resolvedor compartilhado|Mesmo contexto documental para assistente e gerador.
recorded|Escopos acadêmicos/institucionais|Fonte privada não vira conhecimento global automaticamente.
recorded|Vínculo confirmado de turma|Contexto operacional exige vínculo e escopo confirmados.
recorded|Data e mês verificáveis|Conteúdo ambíguo permanece em revisão.
recorded|Referências no novo plano|Fontes usadas são registradas.
recorded|Planos confirmados preservados|Sync não regenera planos já confirmados.
verify|Operação atual das fontes|Permissões, revisões e sincronização não consultadas remotamente.
""")
add('Exercícios e biblioteca', '/exercises', 'app/exercises/index.tsx', """
code|Catálogo de atividades|Aba específica.|src/screens/library/ActivityCatalogTab.tsx
code|Filtros do catálogo|Controles e sheet de filtros.|src/screens/library/ActivityCatalogFilters.tsx
code|Mídia e thumbnails|Cartões e visualização.|src/screens/library/ActivityCatalogVideoCard.tsx
code|Detalhe de vídeo|Sheet próprio.|src/screens/library/ActivityCatalogVideoDetailSheet.tsx
code|Adicionar à aula|Modal de associação ao planejamento.|src/screens/library/ActivityCatalogAddToLessonModal.tsx
code|Biblioteca/importação de treino|Entradas gerais.|app/training/import.tsx
verify|Disponibilidade dos links|Conferir fonte, mídia e abertura externa dos itens efetivamente usados.
""")
add('Academia · treino resistido integrado', '/class/[id]/session', 'docs/resistance-training/README.md', """
recorded|Ambientes de sessão|Quadra, academia, mista e preventiva nos modelos documentados.
recorded|Prescrição|Séries, repetições, intervalo, cadência e notas.
recorded|Contexto semanal integrado|Ênfase física e distribuição no microciclo.
recorded|Templates A–E|Especialização por ênfase semanal.
recorded|Alertas observacionais|Interferência, transferência fraca e equilíbrio; professor decide.
verify|Piloto e sobreposição de carga|Revisar recuperação e transferência em casos representativos.
""")
add('Consultoria individual', '/consultation', 'docs/consultoria/README.md', """
code|Entrada do profissional|Rota própria.|app/consultation/index.tsx
code|Entrada do aluno|Rota individual.|app/student-consultation.tsx
code|Banco e regras|Camada específica.|src/db/consultation.ts
code|Notificações do fluxo|Eventos próprios.|src/notifications/consultationNotifications.ts
recorded|Prescrição com demonstração|Link de mídia opcional por exercício.
recorded|Feedback e alertas|Execução, dor alta e baixa adesão descritos.
recorded|Push sem dados sensíveis|Evita valores exatos de dor e comentários externos.
verify|Piloto completo|Checklist exige publicar, executar, enviar feedback e revisar; não executado agora.
""")
add('Área do atleta', '/student/home', 'src/screens/student/StudentAthleteHome.tsx', """
code|Início do atleta|Home dedicada.
code|Agenda e ações|Entradas individuais.|app/student/agenda.tsx
code|Perfil e instituição|Perfil e resolução de instituição.|src/screens/student/profile-institution.ts
code|Modalidades|Hook específico.|src/screens/student/useAthleteModalities.ts
code|Conquistas|Rota presente; revisar conteúdo funcional.|app/student/achievements.tsx
code|Plano individual|Rota student-plan.|app/student-plan.tsx
code|Foto própria|API específica.|src/api/student-self-photo.ts
code|Contatos de segurança|Campos e hook próprios.|src/screens/student/SecurityContactFields.tsx
verify|Refresh e navegação Android|Handoff registra limite nativo: conferir instituição/turma e atualização física.|docs/operations/handoff.md
""")
add('Família · vínculos e revisão', '/family/home', 'src/screens/family/FamilyHomeScreen.tsx', """
code|Início familiar|Home própria.
code|Alternância de aluno|Switcher do contexto familiar.|src/screens/family/FamilyStudentSwitcher.tsx
code|Agenda familiar|Tela e cartões próprios.|src/screens/family/FamilyAgendaScreen.tsx
code|Perfil do responsável|Tela específica.|src/screens/family/FamilyProfileScreen.tsx
code|Pagamentos familiares|Tela existe; dinheiro real depende de gate financeiro.|src/screens/family/FamilyPaymentsScreen.tsx
code|Convite identificado|Componente de convite para atleta vinculado.|src/screens/family/GuardianAthleteInvite.tsx
code|Revisão pela coordenação|Diretório familiar separado.|src/screens/family/CoordinationFamilyAccessScreen.tsx
recorded|Separação da equipe|Handoff registra vínculo familiar sem membership administrativo.|docs/operations/handoff.md
verify|Conflito, contexto e resposta perdida|Gates históricos precisam de jornada ponta a ponta.|docs/operations/family-access-package.md
verify|Documentação antiga de publicação|14/09 diz local; handoff de 16/09 registra publicação posterior. Não reaplicar só pelo documento antigo.|docs/operations/handoff.md
""")
add('Financeiro · mensalidades e recebíveis', '/coord/finance', 'src/screens/finance/CoordinationFinanceDashboard.tsx', """
code|Dashboard financeiro|Painel de coordenação.
code|Mensalidades|Configuração específica.|src/screens/finance/CoordinationTuitionSetup.tsx
code|Planos e modalidade|Editor próprio.|src/screens/finance/PlanModalityEditor.tsx
code|Recebíveis|Tela específica.|src/screens/finance/CoordinationReceivables.tsx
code|Nova cobrança|Modal próprio.|src/screens/finance/components/NewChargeModal.tsx
code|Status de pagamento|Badge específico.|src/screens/finance/components/PaymentStatusBadge.tsx
code|Configuração de provedor|Capability de dinheiro real respeitada pela tela.|src/screens/finance/CoordinationFinanceSettings.tsx
pending|Pagamentos reais desabilitados|REAL_MONEY_PAYMENTS_ENABLED=false no código atual. Ativação depende de escopo e autorização específicos.|src/core/payments/types.ts
verify|Cobrança e conciliação|Smoke com fixtures de QA; nenhuma transação realizada nesta revisão.
""")
add('Agenda, eventos e comunicações', '/calendar', 'app/calendar.tsx', """
code|Calendário|Entradas gerais e por papel.
code|Agenda|Rota própria.|app/agenda/index.tsx
code|Eventos e detalhe|Rotas específicas.|app/events/[id].tsx
code|API de eventos|Camada específica.|src/api/events.ts
code|Comunicações|Entrada da coordenação.|app/coord/communications.tsx
code|Avisos de ausência|Entrada do professor.|app/prof/absence-notices.tsx
verify|Destinatários e escopo|Conferir papel, instituição, datas e visibilidade no fluxo real.
""")
add('Relatórios e evidências', '/reports', 'app/reports/index.tsx', """
code|Relatórios por papel|Professor, coordenação e trainer.|app/reports/trainer.tsx
code|API de relatórios|Camada específica.|src/api/reports.ts
code|Seletores|Regras de aplicação.|src/screens/reports/application/trainer-report-selectors.ts
code|Auditoria do catálogo|Painel e insights.|src/screens/reports/CatalogAuditPanel.tsx
code|Evidências|Entrada própria.|app/evidence/index.tsx
code|Regulamentação|Fontes e histórico.|app/regulation-history.tsx
verify|Reconciliação dos números|Comparar com chamadas, turmas e período antes de certificar métricas.
""")
add('Coordenação e administração', '/coord/dashboard', 'app/coord/dashboard.tsx', """
code|Dashboard e insights|Loader próprio.|src/screens/coordination/application/load-coordination-dashboard.ts
code|Radar de turmas|Painel específico.|src/screens/coordination/ClassRadarPanel.tsx
code|Auditoria|Painel específico.|src/screens/coordination/AuditPanel.tsx
code|Consistência|Painel específico.|src/screens/coordination/ConsistencyPanel.tsx
code|Membros e convites|Ciclo de vida de convite.|src/screens/coordination/application/invite-lifecycle.ts
code|Desativação de membro|Contrato próprio.|src/screens/coordination/application/member-deactivation.ts
code|Último acesso|Regra específica.|src/screens/coordination/application/member-last-access.ts
code|Gestão de atletas|Rota administrativa.|app/coord/management/athletes.tsx
code|Plataforma e acessos|Entradas próprias.|app/platform/accesses.tsx
verify|Matriz de permissões|Conferir equipe, atleta, família e administrador com contas de QA.
""")
add('Autenticação e onboarding', '/login', 'app/login.tsx', """
code|Boas-vindas|Rota dedicada.|app/welcome.tsx
code|Login|Entrada de autenticação.
code|Cadastro|Tela e rota próprias.|src/screens/auth/SignupScreen.tsx
code|Verificar e-mail|Rota de verificação.|app/verify-email.tsx
code|Recuperar senha|Rota com testes existentes.|app/reset-password.tsx
code|Callback|Retorno de autenticação.|app/auth-callback.tsx
code|Onboarding|Entrada específica.|app/onboarding.tsx
code|Acesso pendente|Intenção e entrada institucional.|app/pending.tsx
code|Convite familiar por token|Rota específica.|app/family-invite/[token].tsx
code|Convite de equipe|Entrada própria.|app/staff-invite.tsx
code|Páginas legais|Termos, privacidade e exclusão.|app/data-deletion.tsx
verify|Links expirados e autorização|Conferir recuperação, confirmação e limites de dados. Sem autenticação real agora.
""")
add('Confirmação de contatos', '/student/profile', 'docs/operations/security-contact-verification.md', """
recorded|E-mail alternativo confirmado|Documento registra recebimento e confirmação em 13/09 sem mudar login.
recorded|Proteções do desafio|Validade, tentativas, rate limit e consumo transacional.
recorded|Telefone por Supabase Auth|phone_change com transporte WhatsApp oficial.|docs/operations/whatsapp-auth-prototype.md
recorded|Hooks WhatsApp configurados|Registro de 25/09; estado remoto atual não verificado.|docs/operations/whatsapp-auth-prototype.md
pending|OTP WhatsApp ponta a ponta|Receber, confirmar, rejeitar expirado/incorreto e reenviar em telefone controlado.|docs/operations/whatsapp-auth-prototype.md
pending|Revisão Meta e Embedded Signup|Documento registra revisão em andamento e conclusão no servidor ainda necessária.|docs/operations/whatsapp-auth-prototype.md
pending|Android e custos do transporte|Gates operacionais explícitos; status atual requer conferência.|docs/operations/whatsapp-auth-prototype.md
""")
add('Notificações e push', '/notifications', 'app/notifications/index.tsx', """
code|Caixa interna|Implementação de inbox.|src/notificationsInbox.ts
code|Não lidas|Hook e contagem.|src/notifications/useUnreadNotificationCount.ts
code|Escopo da organização|Função específica.|src/notifications/inbox-scope.ts
code|Consultoria|Eventos específicos.|src/notifications/consultationNotifications.ts
code|Notificações web|Implementação específica.|src/push/web-notifications.ts
pending|Push de aprovação|Handoff registra entrega pendente. Permissão não prova token, envio ou recebimento.|docs/operations/handoff.md
verify|Recebimento real|Conferir destinatário, token e aparelho controlado.
""")
add('Operação, segurança e entrega', 'Transversal', 'docs/operations/production.md', """
code|Escada de validação|Checks proporcionais ao risco.|docs/operations/validation-ladder.md
recorded|Checklist atualizado por entrega|AGENTS.md exige atualizar os itens afetados sem novo pedido; perguntas sem mudança de estado dispensam regeneração.|AGENTS.md
code|Continuidade entre máquinas|Setup, doctor e handoff versionados.|docs/operations/workstations.md
code|Build verificado|validate:app e export web.|package.json
code|Testes unitários e SQL|Scripts específicos.|package.json
code|Escopo, arquitetura e performance|Checks separados.|package.json
pending|Preparar este worktree|dev:doctor de 01/10 detectou dependências e configuração pública local ausentes.|docs/operations/workstations.md
verify|Produção atual|HEAD não certifica Vercel/EAS, Edge Functions ou migrações remotas.
future|Fluxo econômico de tarefas|Entrega por módulo, contexto enxuto e checks proporcionais; sugestão de processo.|docs/operations/validation-ladder.md
""")

add('Início do professor · rotina e agenda', '/prof/home', 'src/screens/home/HomeProfessor.tsx', """
code|Home do professor|Tela principal específica.
code|Conteúdo abaixo da agenda|Componente separado.|src/screens/home/HomeProfessorBelowFold.tsx
code|Aula atual|Hero e carrossel próprios.|src/screens/home/components/CurrentLessonHero.tsx
code|Agenda do dia|Rail de horários e seletor semanal.|src/screens/home/components/TodayScheduleRail.tsx
code|Slots da agenda|Builder separado da apresentação.|src/screens/home/components/build-home-schedule-slots.ts
code|Sugestão de revisão de atividade|Componente de revisão contextual.|src/screens/home/ActivityReviewSuggestion.tsx
code|Recomendação de feriado|Hook e componente próprios.|src/screens/home/useHolidayRecommendation.ts
verify|Data, vazio e contexto de turma|Conferir dia sem aula, aula atual e navegação no localhost.
""")
add('Perfil, preferências e regulamentação', '/profile', 'app/profile.tsx', """
code|Perfil geral|Entrada compartilhada.
code|Perfil por papel|Entradas de professor, coordenação, atleta e família.|app/prof/profile.tsx
code|Configuração de WhatsApp|Rota de retorno/configuração; conclusão do Embedded Signup depende do servidor.|app/whatsapp-settings.tsx
code|Fontes regulamentares|Rota para fontes.|app/regulation-sources.tsx
code|Histórico regulamentar|Rotas gerais e por papel.|app/regulation-history.tsx
verify|Preferências e permissões nativas|Conferir tema, sessão e retorno das configurações do sistema.|docs/operations/handoff.md
""")
add('Interface compartilhada · padrões', 'Transversal', 'docs/ui/DENSITY_AUDIT.md', """
code|Cabeçalho e shell de telas|Primitives comuns de apresentação.|src/components/ui/ScreenPageHeader.tsx
code|Modais compartilhados|ModalSheet como primitive.|src/ui/ModalSheet.tsx
code|Dropdowns e overlays|AnchoredDropdown e camadas de overlay.|src/ui/AnchoredDropdown.tsx
code|Feedback de formulário|Contrato visual compartilhado.|src/ui/form-validation-feedback.tsx
recorded|Auditoria de densidade|Documento de revisão local de compactação e contexto.
verify|Paridade e acessibilidade|Tema claro/escuro, foco, teclado e mobile exigem conferência no fluxo afetado.
""")

add('Engenharia assistida · skills e agents', 'Ferramentas locais de desenvolvimento', 'docs/operations/goatleta-engineer.md', """
code|Governança em três camadas|Núcleo local, engenharia da stack e catálogo auxiliar; até seis skills por etapa.|docs/operations/skill-governance.md
code|Roteador explicável|Seleção consultiva, métricas reais e indicação de divisão em etapas.|scripts/explain-skill-selection.py
recorded|Validação da governança|21 testes do roteador, matriz de 16 cenários e oito regressões dos helpers.|docs/operations/skill-governance-validation.md
code|Pacote local do Go Atleta Engineer|Arquivos explícitos, skills locais, hashes, perfis e rastreio local; não é executor isolado.|scripts/goatleta-engineer.py
code|Adaptador Agents API|Preparação, dry-run, criação explícita, consulta e pedido de cancelamento; sem início automático de executor.|scripts/goatleta-engineer.py
recorded|Projeto dedicado e hard limit|Go Atleta Engineer criado; limite mensal US$ 10 com enforcement confirmado na plataforma, sujeito a pequeno excedente. Auto-reload OFF; nenhuma compra.|docs/operations/engineer-launch-pack.md
recorded|Quatro agentes persistentes|Quatro perfis registrados e conferidos anteriormente por GET. Run 005 concluída com gates bloqueados; quinto perfil UI/UX Motion existe apenas localmente.|docs/operations/engineer/agents.json
recorded|Testes offline do Engineer|Fechamento do runtime visual: 126 testes locais aprovados (40 controlador, 23 controles, 22 launch, 28 vNext, 7 runtime e 6 harness). São testes da infraestrutura Engineer, não aprovação funcional do app.|docs/operations/engineer/ui-runtime-validation.md
recorded|Teste real pela Agents API|Turno de leitura concluído em 65s; nove comandos, quatro falhas de ferramentas ausentes; zero alterações e container removido. Testes remotos não executados.|docs/operations/engineer-live-validation.md
recorded|Preflight antes da API|Runtime, arquivos, skills e testes conferidos sem rede/chaves; falhas bloqueiam criação da sessão.|scripts/engineer_preflight.py
recorded|Leitura remota com testes|Run 002: 23 testes, zero alterações, 74s e teardown concluído.|docs/operations/engineer-run-history.md
recorded|Escrita remota limitada|Runs 003 e 004: uma frase e regra max_primary; 23/26 testes, somente arquivos esperados, revisão e integração local.|docs/operations/engineer-run-history.md
recorded|Gateway de integração humana|Decisão interativa vinculada ao diff e testes; sem aprovação, com adulteração ou baseline concorrente, integração bloqueada. Ainda sem decisão humana real.|docs/operations/engineer-supervision.md
code|Execução isolada e atestação|Leitura por padrão, zero subagentes, provisionamento explícito, hashes finais e relatório; edição por allowlist auditada posteriormente.|scripts/engineer_runtime.py
recorded|Smoke Docker somente leitura|Container sem chaves e sem rede: criar, alterar, renomear e excluir arquivos bloqueados; temporários liberados.|scripts/test-engineer-docker.py
verify|Revisores em execução real|Run 005: delegação e incorporação comprovadas, 26 testes por agente, zero writes e teardown. Traces confirmam waits sem alvo e 715.514 tokens sem dupla contagem; gates mantidos. US$ 1,91 observado anteriormente no painel.|docs/operations/engineer-run-history.md
recorded|Histórico inicial de runs|Quatro execuções reais com tempo, testes e alterações; amostra insuficiente para benchmark representativo.|docs/operations/engineer-run-history.md
recorded|Dataset histórico de avaliação|24 casos reais em 12 áreas, com commit-base e hash de referência; sem novos replays pagos.|docs/operations/engineer/benchmark.json
recorded|Prontidão do benchmark offline|24 rubricas e dependências históricas revisadas; GA-018 distingue baseline defeituoso (7/10) da referência (10/10), sem avaliar modelo ou chamar API.|docs/operations/engineer-benchmark-readiness.md
recorded|Proteção de escrita por arquivo|Mounts permitem somente arquivos existentes autorizados; Docker real confirmou bloqueio de demais arquivos, rename e exclusão.|scripts/test-engineer-docker.py
recorded|Traces remotos exportados|Um trace exportado de cada uma das quatro sessões anteriores; evidências privadas, sem ampliar permissões.|docs/operations/engineer-supervision.md
code|Política de uso e custo|Limites observados, cancelamento e timeout; teto estrito US$ 5 bloqueia novas sessões sem garantia de enforcement.|scripts/engineer_budget.py
code|Agentes persistentes do Engineer|Registro sem segredos e checagem de definições; quatro IDs preservados sem novas chamadas remotas neste pacote.|scripts/engineer_launch.py
recorded|Doctor de prontidão local|Docker/imagem/Codex verificados; presença de chaves não prova escopo; finanças e novo projeto exigem conferência manual.|docs/operations/engineer-launch-pack.md
code|Modos financeiros separados|Platform-hard-limit foi autorizado somente para Run 005. Novos pacotes vNext são locais e bloqueados antes da API/executor, inclusive com recibo anterior.|scripts/engineer_launch.py
code|Evidência de coordenação e resumo|Delegação, trabalho do especialista e espera vinculados a itens/turns; incorporação exige revisão, custo desconhecido permanece null.|scripts/engineer_coordination.py
code|Engineer vNext local|Contexto por papel, espera por IDs explícitos e suíte final exclusiva do Test Review. Pacotes vNext bloqueiam criação remota.|docs/operations/engineer/vnext.md
code|Revisor UI/UX Motion|Quinto perfil local read-only; skills locais prioritárias, referências externas seletivas e princípios de motion.|docs/operations/engineer/ui-ux-motion-review.md
code|Gates visuais independentes|Screenshots vinculados, viewports, revisão, vídeo e reduced motion; ausência UNVERIFIED e BLOCKER/HIGH bloqueiam.|scripts/engineer_vnext.py
recorded|Run 005b preparada|Preflight core local com 26 testes; Coordinator e Test Review não iniciados, sem usage ou atestação remotos.|docs/operations/engineer/vnext-runs.json
recorded|Runtime visual local|Imagem construída; Expo/Chromium reais, rede isolada, 18 artefatos com hashes, teardown e UI_RUNTIME_READY. 126 testes locais PASS.|docs/operations/engineer/ui-runtime-validation.md
verify|Revisão UI-001|Aparência das seis imagens aprovada por Gustavo e vinculada aos hashes. Revisão completa segue UNVERIFIED; erro de recurso sem origem identificada. Nenhum agente UI remoto executado.|docs/operations/engineer/ui-runtime-validation.md
recorded|Aprovação humana da aparência|Gustavo aprovou somente a aparência das seis imagens do /login; recibo vinculado aos hashes. Não aprova UX, acessibilidade, motion, autenticação ou integração.|docs/operations/engineer/ui-runtime-validation.md
pending|Investigar erro de recurso da captura|Um ERR_FAILED por cenário; origem ainda não identificada. Próximo trabalho local: identificar URL e causa e registrar o resultado.|docs/operations/engineer/ui-runtime-validation.md
pending|Concluir revisão visual completa|UI_UX_GATE permanece UNVERIFIED. Revisar UX e acessibilidade; reduced-motion capturado não comprova qualidade de motion.|docs/operations/engineer/ui-runtime-validation.md
pending|Validar coordenação vNext remotamente|Run 005b antes de UI-001, somente após liberação financeira específica. Ambas não executadas; recibo anterior não libera novos pacotes.|docs/operations/engineer/vnext.md
recorded|Validação para publicação na main|Pacote autorizado por Gustavo: 164 testes focados, typecheck, org-scope, build web com dois workers, encoding, marca e 849 registros do manifesto aprovados. Publicação não libera novas sessões pagas.|docs/operations/handoff.md
future|Inteligência dentro do produto|Manter o assistente existente e avaliar tools de leitura antes de qualquer alteração confirmada; nenhuma migração de runtime implementada.
""")

routes = []
for p in sorted((root / 'app').rglob('*.tsx')):
    if p.name.startswith(('_', '+')):
        continue
    file = p.relative_to(root).as_posix()
    route = '/' + file[4:-4].removesuffix('.web')
    if route.endswith('/index'):
        route = route[:-6]
    if route == '/index':
        route = '/'
    routes.append(dict(file=file, route=route))
commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], text=True).strip()
branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip() or 'HEAD destacado'
for m in modules:
    for n, i in enumerate(m['items']):
        i['id'] = hashlib.sha256((m['title'] + '|' + i['title']).encode('utf-8')).hexdigest()[:16]
snapshot_date = datetime.now(timezone(timedelta(hours=-3))).strftime('%d/%m/%Y')
# Central alignment references existing inventory items so status has one source.
alignment = dict(
    title='Go Atleta Engineer · alinhamento atual',
    summary='Infraestrutura local validada. Aparência aprovada. Revisão completa e coordenação vNext ainda pendentes.',
    architecture='Coordinator vNext → Implementation · Test Review · Security Review · UI/UX + Motion Review. Cinco perfis locais; quatro agentes persistentes remotos registrados anteriormente.',
    groups=[
        dict(title='Validado localmente', items=['Runtime visual local', 'Testes offline do Engineer', 'Run 005b preparada']),
        dict(title='Sua decisão e limites', items=['Aprovação humana da aparência', 'Revisão UI-001', 'Modos financeiros separados']),
        dict(title='Próximos passos, nesta ordem', items=['Investigar erro de recurso da captura', 'Concluir revisão visual completa', 'Validar coordenação vNext remotamente']),
    ],
    history=['Leitura remota com testes', 'Escrita remota limitada', 'Revisores em execução real'],
)
engineer_items = {i['title']: i for i in modules[-1]['items']}
for group in alignment['groups']:
    group['items'] = [engineer_items[name] for name in group['items']]
alignment['history'] = [engineer_items[name] for name in alignment['history']]
data = dict(date=snapshot_date, commit=commit, branch=branch, modules=modules, routes=routes, alignment=alignment)
template = (root / 'docs/product/inventory-template.html').read_text(encoding='utf-8').replace('__DATE__', snapshot_date)
html = template.replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
(root / 'docs/product/goatleta-checklist.html').write_text(html, encoding='utf-8')
print(json.dumps(dict(modules=len(modules), items=sum(len(m['items']) for m in modules), routes=len(routes), commit=commit), ensure_ascii=False))
