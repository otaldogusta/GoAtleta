---
name: goatleta-context-reconciliation
description: Reconcilia uma interpretação documental com o estado atual, evidências realizadas, periodização e decisões confirmadas do GoAtleta. Usar ao classificar informação nova, complemento, conflito, dado desatualizado, duplicação e ausências, gerando proposta explicável sem aplicar mudanças.
---

# Reconciliar documento e contexto

## Entradas e saída

Receber `DocumentInterpretation`, `DocumentContextBinding` validado e `AppStateSnapshot` atual. Produzir `DocumentReconciliationResult` e rascunho de `DocumentMergeProposal`; usar os contratos canônicos da skill coordenadora.

Aplicar `goatleta-document-security` ao conteúdo e ao binding antes de comparar. Manter separadas a confiança da extração, a confiança do vínculo contextual e a confiança da recomendação.

## Procedimento

1. Rejeitar contexto sem `organizationId`, turma fora do workspace ou snapshot ausente/desatualizado.
2. Comparar item a item com estado atual, relatórios realizados, periodização e decisões confirmadas.
3. Classificar cada diferença como `new_information`, `complement`, `conflict`, `stale_information`, `duplicate`, `missing_in_document` ou `missing_in_app`.
4. Resolver prioridade: evidência de aula realizada > decisão confirmada pelo professor > segurança e saúde > estado atual do ciclo > documento recente > documento antigo.
5. Não descartar automaticamente documento antigo; reutilizar objetivos e atividades quando compatíveis.
6. Gerar recomendação `apply`, `review`, `keep_current` ou `ignore`, com razão, confiança, valores atual/proposto e proveniência.
7. Tratar ausência no documento como observação, nunca como pedido implícito de exclusão.
8. Encaminhar a proposta para confirmação; não aplicar.

## Proibições

- Não reconciliar sem consultar o estado atual.
- Não implementar ingestão, parsing, aprovação ou aplicação nesta etapa.
- Não promover previsão acima de evidência realizada.
- Não resolver baixa confiança silenciosamente.
- Não transformar resultado em escrita.

## Checklist

- [ ] Binding e snapshot validados
- [ ] Todas as diferenças classificadas
- [ ] Prioridade de evidências documentada
- [ ] Razões e confiança presentes
- [ ] Ausências não viraram exclusões
- [ ] Proposta permanece sem aplicação
