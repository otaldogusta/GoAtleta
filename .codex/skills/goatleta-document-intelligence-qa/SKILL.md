---
name: goatleta-document-intelligence-qa
description: Cria e executa testes do arco de inteligência documental do GoAtleta, cobrindo ingestão, parsing, vínculo, reconciliação, aprovação, aplicação, isolamento e desfazer. Usar para fixtures anonimizadas, testes de contrato, segurança, integração e avaliação ponta a ponta.
---

# Validar inteligência documental

Ler [references/scenarios.md](references/scenarios.md) antes de montar o plano de testes.

## Estratégia

1. Criar fixtures mínimas e anonimizadas inspiradas em Planejamento de Julho, Relatório de Julho e turma 8–11; não copiar dados pessoais.
2. Testar contratos canônicos, normalização, hash e deduplicação de blocos.
3. Testar contexto ausente, ambíguo e pertencente a outro workspace.
4. Testar prioridade de evidência realizada sobre previsão antiga.
5. Testar preview, confiança baixa, aprovação parcial, concorrência, repetição idempotente e rollback transacional.
6. Testar desfazer como nova operação auditada.
7. Incluir ataques de prompt injection, SSRF, MIME falso e tentativa de quebra de RLS.
8. Verificar que telas futuras reutilizam `goatleta-web-ui`; não duplicar QA visual nesta skill.

## Saídas

Produzir fixtures sem PII, matriz de cobertura, testes automatizados, evidência de execução e falhas acionáveis vinculadas ao contrato ou fronteira responsável.

## Proibições

- Não usar dados pessoais reais desnecessários.
- Não aceitar snapshot ou fixture que já contenha o resultado esperado oculto.
- Não considerar sucesso apenas por happy path.
- Não testar escrita real em produção.

## Checklist

- [ ] Cenários obrigatórios cobertos
- [ ] Contratos e fronteiras testados
- [ ] Segurança multiworkspace testada
- [ ] Aprovação parcial e idempotência testadas
- [ ] Histórico e desfazer verificados
- [ ] Evidências de execução registradas

