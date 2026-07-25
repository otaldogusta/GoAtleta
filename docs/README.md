# Documentação do GoAtleta

Este é o índice canônico dos documentos do projeto. Use esta página como ponto de entrada antes de abrir arquivos antigos.

## Leitura rápida

| Objetivo | Documento |
| --- | --- |
| Entender o projeto e rodar localmente | [README.md](../README.md) |
| Ver prioridades de produto | [ROADMAP.md](../ROADMAP.md) |
| Acompanhar mudanças entregues | [CHANGELOG.md](../CHANGELOG.md) |
| Rodar checklist antes de deploy | [production.md](operations/production.md) |
| Entender fronteiras e regras de arquitetura/performance | [architecture-hygiene.md](architecture-hygiene.md) |
| Design System e layout web | [ui/README.md](ui/README.md) |
| Contexto Documental e Integração de IA/RAG | [document-context-runtime.md](document-context-runtime.md) |

---

## Módulos do Sistema

### 🧠 Inteligência Artificial (Copiloto)
- [Pilares da IA](AI_PILLARS.md) — Conceito central, os 8 pilares de fusão contextual e governança.
- [Contexto Documental e Runtime Acadêmico](document-context-runtime.md) — Fluxo de resolvedor de RAG, perfis de fonte e sync do Drive.

### 🏫 Pedagogia e Planejamento
- [Diretrizes Pedagógicas e de Expansão](pedagogy/README.md) — As 5 dimensões pedagógicas, composição de matrizes e plano estratégico.
- [Rubrica Humana de Validação](pedagogy/ficha-validacao-humana.md) — Ficha de avaliação qualitativa dos planos gerados.
- [Varredura de Referência VolleyballXL](pedagogy/volleyballxl-reference-scan.md) — Mapeamento e inspirações taxonômicas.
- [Catálogo Pedagógico Operacional](catalog-pedagogico/README.md) — Manutenção e estrutura técnica de catálogos.

### 🏋️ Treinamento Resistido (Academia)
- [Treinamento Resistido Integrado](resistance-training/README.md) — Princípios core, runbook de implementação e regras de QA/sobreposição de carga.

### 🤝 Consultoria Online
- [Consultoria Online Individualizada](consultoria/README.md) — Fluxo de treino individual, tabelas do Supabase, progresso (RPE) e notificações.

### 🏷️ NFC (Aproximação)
- [Visão Geral de NFC](nfc/overview.md) — Estado atual do scanner contínuo de tags e chamada.

### 🛡️ Operação, Segurança e Deploy
- [Produção, Deploy e Rollback](operations/production.md) — Manual operacional de entrega.
- [Visão Geral de Segurança](security/overview.md) — Diretrizes de proteção de dados e permissões organizacionais.
- [Checklist Curto de Release](../RELEASE_CHECKLIST.md) — Checklist final pré-deploy.

---

## 🏛️ Histórico e Arquivo
Documentos de backlog de sprints anteriores, checklists concluídos de PRs e propostas antigas de arquitetura foram movidos para a pasta [archive/](archive/).

---

## Regras para novos documentos

- Use `docs/README.md` como índice antes de criar novo arquivo.
- Evite duplicar assunto já coberto por outro `.md`; atualize o documento existente.
- Texto novo deve ficar em português brasileiro e UTF-8 real, sem mojibake.
