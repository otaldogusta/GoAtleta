---
name: goatleta-design-system
description: Aplicar identidade, tokens e componentes canônicos do Go Atleta em telas web e nativas, sem inventar uma linguagem visual paralela.
---

# Design system do Go Atleta

Para mudança ou revisão real de motion, ler `references/motion.md`; não carregar por padrão em tarefas sem animação.

Os caminhos partem da raiz do repositório. Ler `docs/ui/README.md` e os documentos relevantes indicados ali; tokens vivem em `src/theme/tokens.ts` e componentes em `src/ui/`.

Para web responsiva, formulários, densidade e modais, ler a skill existente `.codex/skills/goatleta-web-ui/SKILL.md`. Ela é a fonte operacional desses padrões; não copiar suas regras para uma nova implementação divergente.

Usar a Home do professor como referência de hierarquia e densidade. Inspecionar primitives existentes antes de criar estilos. Propostas genéricas de tipografia condensada, fotografia ou geometria esportiva não são decisões aprovadas: conferir `docs/ui/brand-guidelines.md` e `docs/ui/DESIGN_SYSTEM.md`.

Em autenticação/recuperação, seguir `AGENTS.md`: bloco compacto centralizado de até 440 px, inputs e autofill coerentes com o tema, mensagens sem duplicação, balões sem deslocar layout e estados de ação válidos. Preservar o roteamento de recovery.

Em superfícies de quadra, complementar com `.agents/skills/goatleta-courtside-ux/SKILL.md`. Não adicionar dependências visuais ou trocar a biblioteca de componentes por conveniência de uma skill externa.

Validar primeiro em `http://localhost:8081`, no nível exigido por `docs/operations/validation-ladder.md`. Uma troca de texto não exige a matriz completa. Separar revisão de tokens de conferência visual efetiva.
