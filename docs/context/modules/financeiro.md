# Financeiro e provedores

Referência inspecionada: `d5120cff`, 05/10/2026. [Índice e regra de leitura](../README.md).

## Responsabilidade e implementação atual

Mensalidades, contratos, cobranças internas, baixa manual e consulta de recebíveis
externos. Existe conector Asaas com sincronização/webhook e credencial protegida no
backend. A fundação de pagamentos possui providers mock e
`REAL_MONEY_PAYMENTS_ENABLED = false`; isso não elimina o conector de leitura nem
autoriza emissão/captura real. Ativação/configuração remota não foi consultada.

| Entrada | Responsabilidade |
| --- | --- |
| [CoordinationFinanceDashboard.tsx](../../../src/screens/finance/CoordinationFinanceDashboard.tsx) | Resumo financeiro da coordenação |
| [CoordinationReceivables.tsx](../../../src/screens/finance/CoordinationReceivables.tsx), [CoordinationTuitionSetup.tsx](../../../src/screens/finance/CoordinationTuitionSetup.tsx) | Cobranças e configuração de mensalidades |
| [finance.ts](../../../src/api/finance.ts) | DTOs e RPCs de planos, acordos, faturas e pagamentos manuais |
| [finance-provider.ts](../../../src/api/finance-provider.ts) | Conexão, verificação, sincronização, webhook e desconexão |
| [application](../../../src/finance/application/), [provider-receivables.ts](../../../src/finance/domain/provider-receivables.ts) | Permissões de UI, datas, estados e projeções |
| [payments/types.ts](../../../src/core/payments/types.ts), [providers.ts](../../../src/core/payments/providers.ts) | Dinheiro, escopos e interfaces dos providers |
| [finance-provider-connection](../../../supabase/functions/finance-provider-connection/index.ts), [asaas-webhook](../../../supabase/functions/asaas-webhook/index.ts) | Autorização e fronteira com Asaas |
| [asaas-sync.ts](../../../supabase/functions/_shared/asaas-sync.ts), [provider-secret.ts](../../../supabase/functions/_shared/provider-secret.ts) | Importação e proteção da credencial |

## Contratos a preservar

- Valores monetários em centavos/inteiros; não misturar reais exibidos com payload.
- `platform_saas` e `institution_tuition` são escopos distintos. Provider mock não
  comprova pagamento real; baixa manual registra recebimento, não processa cartão/PIX.
- `organizationId` explícito nas RPCs; permissão `financial` e vínculo verificados
  no servidor. Permissão financeira e gestão de alunos/família são capacidades distintas.
- Namespace externo inclui conexão, conta e ambiente: identificador do pagamento
  isolado não basta. Replay deve manter idempotência e histórico ambíguo em quarentena.
- Perfil do atleta consulta resumo/histórico sem virar gestão financeira paralela.
  Consulte [atletas e famílias](atletas-familias.md) ao mudar esse acesso.
- Não expor chave do provedor no DTO, log, Git ou documentação; UI recebe estado
  e indicação mascarada. Conectar, rotacionar ou emitir não faz parte de ler contexto.

## Decisões e fontes

- [Rollout do namespace](../../architecture/finance-provider-rollout.md): explica
  compatibilidade de schema/Edge e rollback. Aplicação em setembro é registro
  histórico; confirmar o destino antes de qualquer operação remota futura.
- [Pacote familiar](../../operations/family-access-package.md): fundamenta acesso
  e finanças, mas seus resultados e pendências são datados.
- O código atual conserva fundação mock e importação do provedor. Propostas de
  checkout, assinaturas e novos providers não equivalem a integração ativada.

## Validação relevante

Localizados, não reexecutados nesta rodada:
[finance.test.ts](../../../src/api/__tests__/finance.test.ts),
[finance-provider.test.ts](../../../src/api/__tests__/finance-provider.test.ts),
[pagamento manual](../../../src/finance/application/__tests__/coordination-manual-payment-contract.test.ts),
[conector seguro](../../../supabase/functions/_shared/__tests__/asaas-connector-security-contract.test.ts),
[SQL financeiro](../../../scripts/validation/finance-audit-sql.mjs).
Mudanças funcionais exigem casos de outra organização, repetição do webhook,
troca sandbox/production, paginação e totalização; `typecheck:app` e
`check:org-scope` conforme a escada. Smoke local usa fixtures, sem cobrar pessoas.
