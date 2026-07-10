# Documentação do GoAtleta

Este é o índice canônico dos documentos do projeto. Use esta página como ponto
de entrada antes de abrir arquivos antigos soltos na raiz.

## Leitura rápida

| Objetivo | Documento |
| --- | --- |
| Entender o projeto e rodar localmente | [README.md](../README.md) |
| Ver prioridades de produto | [ROADMAP.md](../ROADMAP.md) |
| Acompanhar mudanças entregues | [CHANGELOG.md](../CHANGELOG.md) |
| Rodar checklist antes de deploy | [production.md](operations/production.md) |
| Regras de performance/refatoração | [perf-hygiene.md](perf-hygiene.md) |
| Design System e layout web | [ui/README.md](ui/README.md) |

## Produto e pedagogia

| Área | Documento |
| --- | --- |
| Periodização e contexto do dia | [CYCLE_DAY_PLANNING_IMPLEMENTATION_BACKLOG.md](CYCLE_DAY_PLANNING_IMPLEMENTATION_BACKLOG.md) |
| Checklist de PR do ciclo | [CYCLE_DAY_PLANNING_PR_CHECKLIST.md](CYCLE_DAY_PLANNING_PR_CHECKLIST.md) |
| Sistema de dimensões pedagógicas | [PEDAGOGICAL_DIMENSIONS_SYSTEM.md](PEDAGOGICAL_DIMENSIONS_SYSTEM.md) |
| Verificação pedagógica | [PEDAGOGICAL_DIMENSIONS_VERIFICATION.md](PEDAGOGICAL_DIMENSIONS_VERIFICATION.md) |
| Rubrica humana de validação | [ficha-validacao-pedagogica-humana.md](ficha-validacao-pedagogica-humana.md) |
| Expansão do catálogo pedagógico | [expansao-catalogo-pedagogico.md](expansao-catalogo-pedagogico.md) |
| Catálogo pedagógico operacional | [catalog-pedagogico/README.md](catalog-pedagogico/README.md) |

## Treinamento resistido

| Uso | Documento |
| --- | --- |
| Entrada principal | [RESISTANCE_TRAINING_README.md](RESISTANCE_TRAINING_README.md) |
| Estado atual | [RESISTANCE_TRAINING_STATUS.md](RESISTANCE_TRAINING_STATUS.md) |
| Runbook de implementação | [RESISTANCE_TRAINING_RUNBOOK.md](RESISTANCE_TRAINING_RUNBOOK.md) |
| Versão condensada | [RESISTANCE_TRAINING_INTEGRATION_CONDENSED.md](RESISTANCE_TRAINING_INTEGRATION_CONDENSED.md) |

## Operação, segurança e deploy

Antes de criar outro `.md` sobre deploy, segurança ou validação, atualize um
dos documentos canônicos abaixo.

| Tema | Documento |
| --- | --- |
| Produção, deploy e rollback | [production.md](operations/production.md) |
| Segurança | [overview.md](security/overview.md) |
| Checklist curto de release | [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) |

## NFC

| Documento | Uso |
| --- | --- |
| [overview.md](nfc/overview.md) | Estado atual e links canônicos |
| [NFC_ARCHITECTURE_REFACTOR.md](NFC_ARCHITECTURE_REFACTOR.md) | Direção técnica do refactor |

## Consultoria

Os arquivos `CONSULTORIA_*` documentam uma trilha específica de treino online
individual. Eles ficam em `docs/` e não devem ser duplicados na raiz.

## Regras para novos documentos

- Use `docs/README.md` como índice antes de criar novo arquivo.
- Evite duplicar assunto já coberto por outro `.md`; atualize o documento
  existente.
- Documentos operacionais antigos continuam na raiz apenas como ponteiros de
  compatibilidade.
- Texto novo deve ficar em português brasileiro e UTF-8 real, sem mojibake.
