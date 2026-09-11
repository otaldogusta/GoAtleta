# Revisão de período — painel aprovado

Frontend local implementado conforme mockup: turmas agrupadas, seleção explícita, motivos condicionais, descrição para Outro, data original/nova data para campeonato remarcado e rodapé fixo. Campos de remarcação representam uma data original por revisão, evitando comprimir várias aulas numa reposição.

Backend preparado na migração `20260908010000_activity_review_details.sql`, ainda não aplicado. RPC anterior continua funcionando para recesso, suspensão e aulas realizadas. Novos motivos usam uma RPC separada; falta de ativação produz mensagem específica sem gravação.

Remarcação cria um evento de treino de dia inteiro, com horário a definir, vinculado às turmas selecionadas. A data original recebe exceção; nenhuma presença é inventada. Substituição por campeonato registra somente o motivo no calendário, sem fabricar participação em evento. A IA passa a ler motivo, resolução, nova data e referência da reposição após atualização do helper.

Validado: detector e painel (6 testes), rascunho e contexto (testes focados), migração em PGlite incluindo escopo, datas, duplicidade, motivo livre, uma única reposição e preservação dos registros. Typecheck, org-scope, perf-hygiene strict e diff-check passaram. Smoke local em 390, 834 e 1440 px, sem confirmação de períodos reais. Tema escuro conferido visualmente; tema claro usa os mesmos tokens mas não foi conferido nesta rodada.

Gate: autorização para aplicar a migração remota e publicar somente a atualização de contexto do assistente. Frontend permanece local. Não houve commit, push ou publicação nesta rodada.

Build web concluído em .codex-tmp/activity-review-redesign-web. ESLint dos três arquivos de interface/API passou sem saída.
