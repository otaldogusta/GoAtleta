# Identidade das escritas offline

As novas entradas preservam `origin.userId` e `origin.organizationId`, capturados antes da primeira tentativa de envio. O conteúdo SQLite recebe um envelope `queueVersion: 2`; o fallback do navegador conserva os mesmos campos no objeto da fila. Deduplicação e identificadores locais incluem a origem.

O sincronizador seleciona apenas entradas do usuário e da organização ativos. Troca de conta interrompe a requisição e impede o próximo item; troca de organização interrompe o lote antes da próxima escrita. A confirmação remove apenas o payload efetivamente enviado, preservando uma edição posterior feita durante o envio. Falhas de validação permanecem disponíveis para revisão e não são contadas como sincronização concluída.

## Dados anteriores à mudança

Entradas sem origem verificável ficam em quarentena, no armazenamento original, sem envio automático. A migração não infere autoria pelo usuário atual, pela organização selecionada ou pelo acesso à turma. `quarantinedMissingOrigin` informa somente a quantidade; o painel de suporte não expõe o conteúdo a outra conta.

A recuperação exige revisão explícita do conteúdo original, confirmação de autoria e organização e validação do vínculo atual no servidor. Esta mudança não fornece uma ação de apropriação automática. Até existir esse fluxo revisável, manter o registro original intacto e, com o titular presente, reconstruir a alteração na tela correspondente após conferir o estado já persistido no servidor. Não apagar o original para "limpar" uma fila desconhecida.

## Contrato de chamada

`replace_attendance_records` valida organização, turma e alunos; faz upsert e remove somente registros ausentes no novo conjunto, numa transação `SECURITY INVOKER`. As permissões RLS existentes continuam vigentes. Se a remoção não for autorizada, a transação inteira falha e preserva a chamada anterior. Não existe fallback cliente com DELETE seguido de POST.

A migração `20260905173905_replace_attendance_records_atomically.sql` precisa estar aplicada antes de publicar o cliente que usa a RPC. Sem ela, o salvamento retorna erro sem apagar presenças. O teste `node scripts/validation/attendance-atomic-sql.mjs` executa o SQL real em PostgreSQL isolado, incluindo rollback e limites de autorização.

A chamada dentro da turma grava cada marcação e observação concluída no
rascunho local, por usuário, organização, turma e data. O aviso de salvo depende
da confirmação do armazenamento. Um rascunho feito só online aguarda **Salvar
chamada**. Se a pessoa continuar a editar offline, as alterações da mesma
chamada entram juntas na sincronização automática.
Uma falha de armazenamento mantém a edição em memória e o aviso de rascunho
pendente, mesmo que outra marcação seja gravada no dispositivo.

Na reabertura web com falha de rede, a sessão vigente pode continuar marcando na
cópia da turma/data que já abriu com autorização. O editor local mostra nomes e
presenças e preserva as observações concluídas, que voltam ao editor autorizado.
A troca de data na chamada web atualiza a URL usada na retomada.
Papel, organização, relatórios e NFC continuam sob a verificação normal de
acesso. Uma primeira abertura ainda depende da API.

Ao reconectar, `apply_attendance_draft` compara as mudanças por aluno com o
estado anterior e atual no banco. A RPC usa RLS e a mesma trava da gravação
normal da chamada. Um conflito conserva o rascunho para revisão ou descarte
confirmado. Uma repetição já aplicada não grava outra vez. A projeção na sessão
de treino usa a identidade capturada para a chamada. A migração
[`20261112103438_apply_attendance_draft.sql`](../../supabase/migrations/20261112103438_apply_attendance_draft.sql)
foi aplicada ao Supabase isolado do ensaio e precisa estar ativa no destino
antes da publicação do cliente.

Em 12/11/2026, o Chromium abriu a turma fictícia no Expo local com Auth e
PostgREST da instância Supabase de teste. Durante a interrupção da API, o app
salvou uma presença e uma falta para 08/11. Uma leitura independente encontrou
zero registros no banco, e uma nova aba no mesmo perfil mostrou o comprovante.
Após o evento de reconexão do navegador, a fila esvaziou sem ação manual. Uma
RPC confirmou a gravação, a nova leitura encontrou exatamente dois registros e
o relatório mostrou um participante. O servidor web continuou disponível para
carregar a interface durante o ensaio.

Na rodada seguinte de 12/11, o Chromium recuperou a primeira marcação e a
observação concluída após fechar a aba, aceitou a segunda marcação ainda sem API
e enviou ambas ao reconectar, sem clicar em **Salvar chamada**. O servidor
retornou duas linhas sem duplicata e o relatório da mesma aula mostrou um
participante. A validação incluiu desktop e 390 × 844. Digitar 24 caracteres e
concluir a observação produziu uma gravação local de 313 bytes e nenhuma chamada
à API durante a edição. O servidor web continuou disponível.
