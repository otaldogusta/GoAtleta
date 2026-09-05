# Identidade das escritas offline

As novas entradas preservam `origin.userId` e `origin.organizationId`, capturados antes da primeira tentativa de envio. O conteúdo SQLite recebe um envelope `queueVersion: 2`; o fallback do navegador conserva os mesmos campos no objeto da fila. Deduplicação e identificadores locais incluem a origem.

O sincronizador seleciona apenas entradas do usuário e da organização ativos. Troca de conta interrompe a requisição e impede o próximo item; troca de organização interrompe o lote antes da próxima escrita. A confirmação remove apenas o payload efetivamente enviado, preservando uma edição posterior feita durante o envio. Falhas de validação permanecem disponíveis para revisão e não são contadas como sincronização concluída.

## Dados anteriores à mudança

Entradas sem origem verificável ficam em quarentena, no armazenamento original, sem envio automático. A migração não infere autoria pelo usuário atual, pela organização selecionada ou pelo acesso à turma. `quarantinedMissingOrigin` informa somente a quantidade; o painel de suporte não expõe o conteúdo a outra conta.

A recuperação exige revisão explícita do conteúdo original, confirmação de autoria e organização e validação do vínculo atual no servidor. Esta mudança não fornece uma ação de apropriação automática. Até existir esse fluxo revisável, manter o registro original intacto e, com o titular presente, reconstruir a alteração na tela correspondente após conferir o estado já persistido no servidor. Não apagar o original para "limpar" uma fila desconhecida.

## Contrato de chamada

`replace_attendance_records` valida organização, turma e alunos; faz upsert e remove somente registros ausentes no novo conjunto, numa transação `SECURITY INVOKER`. As permissões RLS existentes continuam vigentes. Se a remoção não for autorizada, a transação inteira falha e preserva a chamada anterior. Não existe fallback cliente com DELETE seguido de POST.

A migração `20260905173905_replace_attendance_records_atomically.sql` precisa estar aplicada antes de publicar o cliente que usa a RPC. Sem ela, o salvamento retorna erro sem apagar presenças. O teste `node scripts/validation/attendance-atomic-sql.mjs` executa o SQL real em PostgreSQL isolado, incluindo rollback e limites de autorização.
