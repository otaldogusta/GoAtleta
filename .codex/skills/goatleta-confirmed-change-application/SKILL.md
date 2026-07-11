---
name: goatleta-confirmed-change-application
description: Orienta a aplicação transacional, idempotente, auditável e reversível de mudanças documentais confirmadas no GoAtleta. Usar ao criar preview, aprovação item a item, conjunto aprovado, recibo, histórico, versionamento e desfazer, nunca para aplicar o documento inteiro.
---

# Aplicar mudanças confirmadas

## Entradas e saídas

Receber `DocumentMergeProposal` persistida e `ApprovedChangeSet` contendo somente IDs selecionados e aprovador autenticado. Produzir `ChangeApplicationReceipt`. Usar os contratos canônicos da skill coordenadora.

Aplicar `goatleta-document-security` antes de autorizar ou executar qualquer escrita.

## Procedimento

1. Exibir preview com valor atual, proposto, razão, confiança e origem.
2. Exigir seleção explícita item a item; impedir aplicação direta em baixa confiança.
3. Revalidar organização, turma, permissões, `expectedStateVersion`, versão atual e integridade da proposta no servidor.
4. Receber apenas `proposalId` e `approvedItemIds`; rejeitar IDs ausentes, duplicados ou pertencentes a outra proposta.
5. Aplicar tudo em transação, com chave de idempotência e bloqueio/versionamento otimista.
6. Preservar entidades afetadas, valores anteriores e aplicados; registrar aprovador, origem, timestamps e operação/transação de origem.
7. Produzir recibo determinístico; repetição da mesma chave retorna o mesmo efeito lógico.
8. Implementar desfazer autorizado como nova operação auditada, restaurando a versão anterior sem apagar histórico.

## Proibições

- Não criar `applyEverythingFromDocument` nem equivalente.
- Não implementar ingestão, parsing ou reconciliação nesta etapa.
- Não confiar em autorização, valores atuais ou IDs enviados pelo cliente.
- Não aplicar item não aprovado ou proposta obsoleta.
- Não desfazer apagando trilha de auditoria.

## Checklist

- [ ] Preview e seleção explícita
- [ ] Autorização e versões revalidadas
- [ ] Transação e idempotência testadas
- [ ] Somente IDs aprovados aplicados
- [ ] Origem, aprovador e antes/depois registrados
- [ ] Desfazer restaura e audita
