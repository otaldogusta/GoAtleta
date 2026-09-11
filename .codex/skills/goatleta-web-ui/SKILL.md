---
name: goatleta-web-ui
description: Criar, revisar ou refatorar interfaces web responsivas do GoAtleta. Usar em telas desktop, grids, layouts responsivos, componentes compartilhados, migração de telas mobile para web e Design QA visual do produto.
---

# GoAtleta Web UI

## Preparação

1. Ler `docs/ui/README.md` e somente os documentos ligados à tarefa.
2. Inspecionar a Home do professor como referência visual e uma tela semelhante.
3. Ler tokens e primitives existentes antes de criar estilos ou componentes.
4. Preservar regras de negócio, permissões, rotas e comportamento mobile.

## Implementação

- Usar `ResponsivePage`, `ResponsiveGrid` e resolvers de `src/ui/responsive-layout.ts`.
- Manter resolvers puros separados de hooks React.
- Criar duas colunas principais apenas a partir de 1200 px.
- Preferir agrupamento, separadores e tipografia a cards aninhados.
- Usar tokens de cor, spacing, radius e sombra; não criar equivalentes locais.
- Manter uma ação primária por região e ocultar ações sem utilidade para o papel atual.
- Em listas interativas, o estado de hover/foco deve ter respiro próprio: aplicar padding interno, raio coerente com `radius.internal` e pequeno afastamento dos divisores ou itens vizinhos. O fundo de interação não pode ficar colado ao texto, ícone, borda do container ou separador. Preservar alvos de toque de 40–44 px sem transformar cada linha em um card pesado.
- Em listas sanfonadas, animar a revelação e o recolhimento com transições curtas de opacidade e deslocamento (aproximadamente 140–200 ms). Reutilizar `Animated`/`LayoutAnimation`, respeitar preferência por movimento reduzido quando disponível e evitar bibliotecas, medições contínuas ou animações de layout pesadas.
- Formulários editáveis devem manter um baseline explícito e considerar a tela suja somente quando o valor normalizado divergir desse baseline. Habilitar a ação de salvar apenas nesse estado e restaurar o baseline depois de uma gravação bem-sucedida.
- Ao surgir a primeira alteração não salva, usar o `SaveToast` global no topo com variante de aviso e duração visível pela barra de progresso; não criar banners locais concorrentes nem repetir o aviso a cada tecla.
- Antes de voltar, trocar de seção, recolher uma sanfona ou sair da página com alterações não salvas, usar o `ConfirmDialog` global para continuar editando ou descartar. No web, também proteger recarregamento/fechamento com `beforeunload`. A confirmação deve limpar o rascunho descartado antes da navegação.
- Não repetir atribuição à IA quando um marcador visual já estabelece o contexto.
- Manter componentes de domínio sem consultas diretas; receber dados e callbacks por props.

## Validação

1. Rodar testes focados, `typecheck:app`, perf-hygiene estrito e diff check.
2. Validar 390×844, 834×1194 e 1440×1024 no navegador local.
3. Conferir temas claro/escuro, foco, URLs longas, modal e ausência de overflow horizontal.
4. Comparar a implementação com a Home no mesmo viewport.
5. Corrigir todo P0, P1 ou P2 antes do handoff.
