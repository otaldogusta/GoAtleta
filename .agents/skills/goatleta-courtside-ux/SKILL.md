---
name: goatleta-courtside-ux
description: Revisar acessibilidade e operação com uma mão em chamada, scouting e Aula do Dia do Go Atleta, incluindo foco, toque, contraste e falha de rede.
---

# Uso na quadra e acessibilidade

Resolver caminhos na raiz. Usar os componentes/tokens de `src/ui/` e `src/theme/tokens.ts`, `docs/ui/README.md` e `.codex/skills/goatleta-web-ui/SKILL.md` quando o fluxo for web.

## Conferir a tarefa principal

- Identificar a ação repetida e medir quantos toques requer. Reduzir etapas sem remover informação ou confirmação necessária; dois toques em scouting é uma meta de melhoria, não um contrato já existente.
- Preservar os alvos de toque previstos pelas primitives e seu espaçamento. Considerar uso com uma mão, luz forte e nomes longos; não aumentar todos os containers indiscriminadamente.
- Dar rótulo acessível a ícones; estado selecionado, erro e resultado não podem depender só de cor. Conferir contraste nos temas efetivamente usados.
- Na web, testar Tab/Shift+Tab, ativação por teclado, foco visível e retorno de foco de modal. Em native, conferir propriedades de acessibilidade e testar leitor de tela quando houver dispositivo disponível.
- Conferir ampliação de texto, ordem de leitura, movimentos reduzidos e ausência de corte/overflow. Balões de erro precisam ser percebidos também por quem não vê a tela.
- A ação assíncrona mostra progresso, evita duplicação e mantém rascunho em falha. Distinguir pendente local de salvo no servidor; não prometer offline quando o fluxo não o suporta.

Validar o fluxo afetado no localhost antes de preview, com a escada canônica. Em auditoria de acessibilidade solicitada, consultar WCAG/WAI como fonte primária atual; automação não substitui avaliação manual e não autoriza afirmar conformidade integral. Relatar o que foi exercitado em browser e o que continua pendente em aparelho.
