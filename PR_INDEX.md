# PR Index (fonte única)

Este arquivo é a fonte oficial para localizar PRs, resumos e checklist de validação.

Para visão geral de toda a documentação do projeto, consultar `DOCS_INDEX.md`.

## Onde ficam as PRs

- PRs abertas/fechadas: GitHub > aba Pull Requests do repositório.
- Resumos internos de PR: arquivos Markdown listados neste índice.

## Convenção (a partir de agora)

- Um resumo por bloco grande de entrega.
- Sempre atualizar este índice no mesmo commit do resumo.
- Padrões de nome:
  - `PR<number>_SUMMARY.md` para PRs numeradas.
  - `PR<number>_TESTING.md` para roteiro de validação.
  - `PR_STACK_SUMMARY_<yyyy-mm-dd>.md` para handoff diário com vários PRs.
  - `PR_<TEMA>_SUMMARY.md` para iniciativas transversais.

## Mapa atual

### Base e multi-workspace

- `PR1_SUMMARY.md` — Fundação multi-workspace (orgs, provider, RLS inicial).
- `PR1_TESTING.md` — Cenários de validação da PR1.

### IA e coordenação

- `PR_COORDINATION_AI_HARDENING_SUMMARY.md` — Coordenação modular + cache/contexto/sync hardening.
- `PR_STACK_SUMMARY_2026-02-17.md` — Stack consolidado PR A, PR1, PR2, PR3 e PR3.1.
- `PR_SCIENTIFIC_INTELLIGENCE_STACK_2026-02-17.md` — Stack científico (PR12–PR16) para evidência curada + RAG.

### UI e motion

- `ANIMATION_LOG.md` — Catálogo de animações, parâmetros e padrões de reaproveitamento.

### Entregas recentes (PR7–PR10)

- Commit `7fbaa96` — Fechamento de superfícies de relatórios/periodização e correções no assistant.
- Commit `0becb5b` — Autopilot semanal, memória do assistant, simulador, radar de turma e migrations de atleta.

## Checklist rápido para novos PR docs

1. Criar/atualizar arquivo de resumo da entrega.
2. Adicionar entrada neste `PR_INDEX.md`.
3. Referenciar commits principais.
4. Incluir status de validação (lint/test/smoke).
5. Se houver migration, citar arquivo SQL e status de aplicação.
