# Perfil pedagógico da turma — implementação e ativação

## Escopo e ativação

Pacote funcional/de dados (nível 4 da escada), iniciado pelo voleibol. A migração foi aplicada ao projeto Supabase vinculado em 29/09/2026 e a função `assistant` foi atualizada para a versão 86, mantendo `verify_jwt=true`. O frontend não foi publicado, não houve alteração de credenciais e o checkout contém mudanças anteriores de interface que não pertencem a este pacote.

A migração `20260929025310_class_pedagogical_profiles.sql` está registrada no remoto e o dry-run posterior retornou o banco atualizado. O localhost autenticado confirmou o contrato novo com o provedor real. O relato das Raposas foi salvo e recuperado após recarregar a página; nenhuma configuração do ciclo ou plano existente foi aplicada durante o smoke.

## Contrato e segurança

- `class_pedagogical_profiles`: fonte vigente por organização/turma, com versão monotônica. Não pertence a um ciclo.
- `class_profile_messages`: relato original (até 12.000 caracteres por envio), autor, data, resposta e interpretação pendente/concluída.
- `class_profile_revisions`: antes/depois imutáveis, campos alterados, origem e autor. Novas informações podem ser acrescentadas à dimensão sem eliminar os relatos anteriores; `claims` guarda sua proveniência.
- `class_profile_suggestions`: evidências de aulas, versão de origem, aceitação/rejeição e deduplicação por conteúdo das evidências.
- SELECT com RLS para membro responsável pela turma ou administrador. Escrita no perfil somente por RPC service-role, após validar a identidade autenticada, vínculo, organização e turma no servidor.
- `mode=class_diagnostic`: usa o roteamento/provedor do assistente existente. Salva primeiro; interpreta; reconcilia citações literais; aplica por comparação de versão. Falha do modelo preserva o relato pendente.
- Identificador idempotente estável para reenvios. Uma corrida força nova leitura/interpretação; relato enviado antes de uma correção posterior não a substitui silenciosamente.
- Desfazer só reverte os campos que não receberam alterações posteriores. Desfazer sem efeito não anuncia atualização.
- Rascunhos e operações pendentes locais separados por usuário, organização e turma; respostas tardias não preenchem outra turma. Sem servidor, nunca mostrar “salvo”.
- A primeira leitura importa o diagnóstico do ciclo ativo, quando disponível, preservando data/origem. Não reescreve ciclos arquivados. Campos antigos continuam existindo; novas gerações preferem o perfil canônico.

## Interpretação e geração

Relatos são dados, não instruções para executar ações. Perguntas/hipóteses não viram fatos. “Domina fundamentos” permanece relato geral. Formato não representa domínio técnico ou carga. Texto em conflito com formato/altura pede confirmação nos seletores.

Formato, adaptações, espaço, rede e prioridades entram nos geradores mensal, semanal, diário e de aula. O jogo consolidado é a referência; tarefas reduzidas têm transferência para esse formato. Os filtros de idade/segurança permanecem posteriores à aplicação do perfil. Versão e evidências ficam nos snapshots/contextos/traços; a explicação existente do plano identifica o perfil utilizado. O assistente geral lê o mesmo perfil com escopo autorizado. Falha de leitura offline impede gerar com perfil desconhecido; navegação em dados previamente carregados continua separada.

O perfil pode ser consultado no diagnóstico e na turma sem painel permanente. Formato/rede salvam independentemente do ciclo. “Salvar e aplicar” permanece responsável pelas configurações do ciclo.

## Planos existentes e evolução

“Revisar planos futuros” considera as aulas do mês selecionado. Mostra conteúdo atual e prévia completos; nenhuma aula vem selecionada. A aplicação insere nova versão, conservando a original. RPC revalida versão do perfil, hash do plano original, última versão, data futura, ausência de relatório executado e origem automática não finalizada. Edições manuais semanais/diárias também são excluídas da prévia. Reenvio após perda da resposta não duplica a versão. Aplicação em lote informa quantas aulas foram realmente gravadas se uma falhar.

A consulta de evolução ocorre ao abrir o perfil, ou pelo botão de consulta. Examina até seis relatos recentes concluídos; cada alteração proposta precisa de citações concordantes em pelo menos duas datas de aula distintas (America/Sao_Paulo). Contradição não altera fatos. Aceitação é explícita e verifica a versão. Evidência já rejeitada não reaparece sem conteúdo novo. Não há job remoto/background instalado.

## Validação e pendências

- Testes focados: 10 suítes, 80 testes passando — domínio, geração mensal/diária/aula, preservação de regras anteriores, contexto, API, hook de recuperação, ordem salvar/interpretar, falhas do modelo e concorrência. Os quatro testes do hook também foram repetidos após os últimos ajustes de ciclo de vida.
- `node scripts/validation/class-profile-sql.mjs`: PostgreSQL isolado em PGlite com identidades fictícias; RLS, isolamento, idempotência, versões, undo, proveniência aditiva, rejeições e aplicação protegida em planos. Não é um teste de concorrência multiprocesso em PostgreSQL remoto.
- `npm run typecheck:app`, `npm run check:org-scope`, `npm run check:perf-hygiene`, `git diff --check`.
- ESLint direcionado: nenhum erro; dois avisos anteriores de variáveis não utilizadas em `PeriodizationManagerSheet.tsx` (`FieldShell` e `wide`). A verificação ampla encontrou também pendências anteriores em `PeriodizationScheduleDays.tsx` e `app/training/index.tsx`, preservadas fora deste escopo; não se declara lint global aprovado.
- Smoke autenticado localhost: edição e seis etapas preservadas; abertura compacta do perfil; relato salvo antes da interpretação; resposta estruturada do provedor; dúvida curta sobre o alcance do quique; perfil v3 recuperado após fechar/recarregar; preview sem seleção automática e nenhuma aula elegível alterada. O desfazer foi validado e a sincronização visual agora restaura o valor-base do ciclo quando o primeiro fato canônico é removido.
- Segurança remota: RLS habilitada nas quatro tabelas; `anon` sem leitura; `authenticated` com leitura escopada e sem escrita; identidade fictícia sem vínculo retornou zero perfil, mensagens e revisões. Os avisos do advisor sobre três RPCs `SECURITY DEFINER` são exposições autenticadas intencionais: todos validam `auth.uid()` pelo vínculo organização/turma antes de retornar ou gravar dados.
- Pendente para uma rodada posterior com fixtures próprias: aplicação efetiva de uma prévia a uma aula futura elegível, confirmação de evolução a partir de dois relatórios distintos e revisão do fluxo completo em tema claro. O frontend permanece somente no checkout local.

O banco mantém todo o histórico; o modal traz as 30 revisões mais recentes e as 60 mensagens recentes. A citação de cada fato permite recuperar seu relato original mesmo fora da janela recente.
