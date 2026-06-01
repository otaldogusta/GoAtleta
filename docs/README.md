# Documentação do GoAtleta

Este é o índice canônico dos documentos do projeto. Use esta página como ponto
de entrada antes de abrir arquivos antigos soltos na raiz.

## Leitura rápida

| Objetivo | Documento |
| --- | --- |
| Entender o projeto e rodar localmente | [README.md](../README.md) |
| Ver prioridades de produto | [ROADMAP.md](../ROADMAP.md) |
| Acompanhar mudanças entregues | [CHANGELOG.md](../CHANGELOG.md) |
| Rodar checklist antes de deploy | [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) |
| Regras de performance/refatoração | [perf-hygiene.md](perf-hygiene.md) |

## Produto e pedagogia

| Área | Documento |
| --- | --- |
| Periodização e contexto do dia | [CYCLE_DAY_PLANNING_IMPLEMENTATION_BACKLOG.md](CYCLE_DAY_PLANNING_IMPLEMENTATION_BACKLOG.md) |
| Checklist de PR do ciclo | [CYCLE_DAY_PLANNING_PR_CHECKLIST.md](CYCLE_DAY_PLANNING_PR_CHECKLIST.md) |
| Sistema de dimensões pedagógicas | [PEDAGOGICAL_DIMENSIONS_SYSTEM.md](PEDAGOGICAL_DIMENSIONS_SYSTEM.md) |
| Verificação pedagógica | [PEDAGOGICAL_DIMENSIONS_VERIFICATION.md](PEDAGOGICAL_DIMENSIONS_VERIFICATION.md) |
| Rubrica humana de validação | [ficha-validacao-pedagogica-humana.md](ficha-validacao-pedagogica-humana.md) |
| Expansão do catálogo pedagógico | [expansao-catalogo-pedagogico.md](expansao-catalogo-pedagogico.md) |

## Treinamento resistido

| Uso | Documento |
| --- | --- |
| Entrada principal | [RESISTANCE_TRAINING_README.md](RESISTANCE_TRAINING_README.md) |
| Estado atual | [RESISTANCE_TRAINING_STATUS.md](RESISTANCE_TRAINING_STATUS.md) |
| Runbook de implementação | [RESISTANCE_TRAINING_RUNBOOK.md](RESISTANCE_TRAINING_RUNBOOK.md) |
| Versão condensada | [RESISTANCE_TRAINING_INTEGRATION_CONDENSED.md](RESISTANCE_TRAINING_INTEGRATION_CONDENSED.md) |

## Operação, segurança e deploy

Estes documentos são históricos/operacionais. Antes de criar outro `.md` sobre
deploy, segurança ou validação, atualize um dos arquivos abaixo.

| Tema | Documento |
| --- | --- |
| Prontidão de produção | [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) |
| Resumo de deploy | [PRODUCTION_DEPLOYMENT_SUMMARY.md](../PRODUCTION_DEPLOYMENT_SUMMARY.md) |
| Monitoramento pós-deploy | [POST_DEPLOY_MONITORING.md](../POST_DEPLOY_MONITORING.md) |
| Sign-off de produção | [SIGN_OFF_PRODUCTION.md](../SIGN_OFF_PRODUCTION.md) |
| Validação final | [VALIDACAO_FINAL_PRODUCAO.md](../VALIDACAO_FINAL_PRODUCAO.md) |
| Auditoria técnica completa | [SECURITY_AUDIT_AND_PERFORMANCE.md](../SECURITY_AUDIT_AND_PERFORMANCE.md) |
| Plano de execução de segurança | [SECURITY_FIXES_EXECUTION_PLAN.md](../SECURITY_FIXES_EXECUTION_PLAN.md) |
| Resumo executivo de segurança | [SECURITY_AUDIT_EXECUTIVE_SUMMARY.md](../SECURITY_AUDIT_EXECUTIVE_SUMMARY.md) |
| Árvore de ataque | [SECURITY_AUDIT_ATTACK_TREE.md](../SECURITY_AUDIT_ATTACK_TREE.md) |
| Referência rápida de segurança | [SECURITY_AUDIT_QUICK_REFERENCE.md](../SECURITY_AUDIT_QUICK_REFERENCE.md) |

## NFC

| Documento | Uso |
| --- | --- |
| [NFC_ARCHITECTURE_AND_FIXES.md](../NFC_ARCHITECTURE_AND_FIXES.md) | Análise completa e correções implementadas |
| [NFC_ARCHITECTURE_REFACTOR.md](NFC_ARCHITECTURE_REFACTOR.md) | Direção técnica do refactor |

## Consultoria

Os arquivos `CONSULTORIA_*` documentam uma trilha específica de treino online
individual. Eles ficam em `docs/` e não devem ser duplicados na raiz.

## Regras para novos documentos

- Use `docs/README.md` como índice antes de criar novo arquivo.
- Evite duplicar assunto já coberto por outro `.md`; atualize o documento
  existente.
- Documentos operacionais antigos podem continuar na raiz por compatibilidade,
  mas novos documentos de produto/engenharia devem ficar em `docs/`.
- Texto novo deve ficar em portugues brasileiro e UTF-8 real, sem mojibake.
