# Publicação do namespace financeiro

A migração `20260905173743_finance_provider_atomic_scope.sql` troca os identificadores únicos das importações para conexão, conta e ambiente. Os Edge antigos usam o alvo de conflito anterior e não são compatíveis após essa troca. A sequência foi aplicada em 05/09/2026; evidências em `docs/audits/2026-09-05-code-audit-closeout.md`.

## Sequência

1. Publicar primeiro `asaas-webhook` e `finance-provider-connection` com seus módulos compartilhados novos. Antes da migração, a leitura de `connection_id` falha antes de qualquer escrita ou operação no provedor. O webhook retorna `503`, sem confirmar entrega. Haverá uma breve indisponibilidade do conector.
2. Aplicar a migração em transação. Ela preserva o histórico ambíguo em quarentena, cria o namespace identificado e rejeita novas importações ou alterações sem namespace. A FK composta também impede usar conexão de outra organização. Chamadas antigas ainda em execução passam a falhar antes de criar novos eventos ambíguos.
3. Confirmar as versões dos Edge e os contratos de leitura/RPC, verificar o processamento e o replay idempotente, e sincronizar a conta conectada. A sincronização cria projeções com identidade conhecida; não atribuir conta ao histórico apenas com base na credencial atual. Conferir a fila e os logs do webhook, reativando uma fila interrompida quando o endpoint já estiver funcionando.
4. Publicar o cliente após verificar totais completos, paginação e meses do provedor. Pagamentos reais continuam desabilitados.

O Asaas interrompe a fila após 15 falhas consecutivas e mantém eventos por até 14 dias. A recuperação precisa ocorrer dentro desse prazo; não presumir retries indefinidos. Fonte: [fila interrompida do Asaas](https://docs.asaas.com/docs/webhooks-queue-paused).

## Rollback

Após a migração, não restaurar os Edge antigos nem recriar a unique antiga. Contas e ambientes diferentes podem conter o mesmo identificador externo; recompor a restrição antiga exigiria alterar ou excluir histórico. Corrigir o Edge mantendo o esquema novo ou interromper temporariamente o conector com resposta de falha, preservando a fila. O cliente pode voltar a uma versão anterior somente se os Edge e o esquema novos forem mantidos.

A guarda permite apenas a desassociação do autor de uma sincronização histórica por exclusão da conta; isso não altera seus dados financeiros. Os testes locais em `scripts/validation/finance-audit-sql.mjs` cobrem essa exceção, rejeição de writes antigos, preservação da quarentena e isolamento entre organizações. PGlite executa SQL real em uma conexão serializada; não representa um teste de carga com várias conexões PostgreSQL.
