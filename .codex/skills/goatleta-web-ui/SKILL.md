---
name: goatleta-web-ui
description: Criar, revisar ou refatorar interfaces responsivas do GoAtleta, incluindo formulários, configurações, seletores, feedback de ações e navegação com rascunhos, além de layouts desktop e Design QA.
---

# GoAtleta Web UI

## Preparação

1. Ler `docs/ui/README.md` e somente os documentos ligados à tarefa.
2. Inspecionar a Home do professor como referência de densidade e hierarquia. Para formulários e configurações, ler `docs/ui/FORM_SETTINGS_PATTERNS.md` e inspecionar `/student/profile` e seus componentes como referência de interação, não como implementação perfeita a copiar.
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
- Listas suspensas curtas devem ajustar a altura ao conteúdo (`fitContent` no `AnchoredDropdown`), sem forçar rolagem quando todas as opções cabem. Limitar a altura ao espaço disponível; se houver overflow real, manter indicador de rolagem fino e visível. Não combinar rolagem forçada com indicador oculto, nem aceitar setas soltas sem barra. Conferir a lista aberta no navegador, inclusive perto da borda inferior.
- Em listas sanfonadas, animar a revelação e o recolhimento com transições curtas de opacidade e deslocamento (aproximadamente 140–200 ms). Reutilizar `Animated`/`LayoutAnimation`, respeitar preferência por movimento reduzido quando disponível e evitar bibliotecas, medições contínuas ou animações de layout pesadas.
- Formulários editáveis devem manter um baseline explícito e considerar a tela suja somente quando o valor normalizado divergir desse baseline. Habilitar a ação de salvar apenas nesse estado e restaurar o baseline depois de uma gravação bem-sucedida.
- Não mostrar toast ou banner apenas porque o formulário ficou sujo. Enquanto a pessoa permanece editando, comunicar o estado pelo botão de salvar habilitado e demais feedbacks locais do formulário.
- Abrir/recolher cards ou trocar seções da mesma tela preserva rascunhos e não pede confirmação. Proteger a saída real da tela (voltar, menu lateral, abas de navegação) e o fechamento/recarregamento web quando houver alterações. Descartar restaura o baseline antes de navegar; continuar editando preserva dados e sinaliza todos os cards alterados.
- Em formulários com vários cards que compõem um único rascunho, usar uma única `FloatingSaveBar`, visível assim que houver mudanças, independentemente do card aberto. Não duplicar botões de salvar por seção. Operações independentes, como verificar e-mail e alterar senha, mantêm ações próprias.
- Ações assíncronas aguardam a Promise real, mostram progresso imediato, bloqueiam repetição e preservam contexto em falha. Usar `ConfirmDialog`/`Button` existentes; não capturar erros em alertas invisíveis na web.
- Não repetir atribuição à IA quando um marcador visual já estabelece o contexto.
- Manter componentes de domínio sem consultas diretas; receber dados e callbacks por props.

## Validação

1. Classificar a alteração pela escada canônica em `docs/operations/validation-ladder.md` antes de executar comandos.
2. Para microajuste visual, usar o ciclo rápido: inspeção do diff, teste focado quando existir e uma verificação direta do comportamento afetado. Não rodar automaticamente build, org-scope, perf-hygiene ou matriz completa de viewports.
3. Rodar `typecheck:app`, perf-hygiene, org-scope, build e smoke ampliado somente quando o nível de risco ou a etapa de entrega da escada exigir.
4. Validar 390×844, 834×1194 e 1440×1024 quando houver mudança responsiva, estrutural, de modal/layout compartilhado ou fechamento de pacote; não para toda troca local de texto, cor, espaçamento ou seletor já padronizado.
5. Conferir temas claro/escuro, foco, URLs longas, modal e ausência de overflow horizontal apenas nas dimensões realmente afetadas pela mudança.
6. Comparar a implementação com a Home quando a tarefa alterar hierarquia, densidade ou estrutura da página.
7. Corrigir todo P0 ou P1 relacionado à mudança. Corrigir P2 no mesmo turno somente se foi introduzido pela alteração ou impede o fluxo solicitado; não ampliar silenciosamente um microajuste para uma revisão geral.
