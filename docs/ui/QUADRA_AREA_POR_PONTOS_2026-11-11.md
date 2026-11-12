# Área livre e por pontos — implementação local

Pedido de 11/11/2026: preservar o desenho livre da área e permitir marcar seus
vértices por cliques ou toques. Alteração funcional localizada, nível 2 da
[escada de validação](../operations/validation-ladder.md).

## Comportamento

- Mais ferramentas oferece **Área livre** e **Área por pontos**.
- Por pontos abre a quadra 2D. Cada clique/toque acrescenta um vértice;
  a prévia mostra lados, preenchimento e marcadores, com destaque para o início.
- **Fechar área**, Enter ou tocar no primeiro vértice conclui uma área com
  pelo menos três pontos distintos que formem uma superfície, em uma única edição.
- **Voltar um ponto** ou Backspace altera apenas o rascunho. **Cancelar área**
  ou Escape descarta o rascunho e retorna à seleção.
- Concluir a área retorna à seleção no celular e no desktop, com as ações de
  editar, duplicar, cor e excluir junto ao desenho. Selecionar na quadra fecha
  Ferramentas para não esconder essas ações. O desenho livre mantém o gesto
  de arrastar. Botões dos controles não acrescentam pontos à quadra.
- Trocar documento, etapa, ferramenta, modo, editabilidade ou vista descarta o
  rascunho. Zoom e deslocamento apenas reprojetam os vértices existentes.
- O resultado continua um desenho `kind: "area"`, compatível com o renderer 3D
  e o formato existente. Não há novo esquema de persistência nem ordem forçada em 3D.

## Código e validação

Composição em [CourtWorkspaceView](../../src/components/visual-court/CourtWorkspaceView.tsx),
gestos e prévia em [CourtEditorCanvas](../../src/components/visual-court/CourtEditorCanvas.tsx).

Conferência no navegador interno do Codex, em localhost:8081, com os componentes
reais e controlador fictício em memória: fechamento pelo início e Enter,
voltar pelo botão/Backspace, cancelar pelo botão/Escape, uma área por conclusão,
desfazer/refazer em um passo, entrada por pontos a partir de 3D e cancelamento ao
trocar a vista. Em largura móvel solicitada de 390×844 (CSS observado 379×819),
prévia com quatro vértices, fechamento pelo botão, retorno à seleção e desenho
livre por arraste conferidos visualmente.

Validação automatizada: quatro suítes focadas, 85 casos distintos aprovados;
`npm run typecheck:app` aprovado em Node 24.13.0 e `git diff --check` sem erros.
Revisão independente identificou captura de Enter em botões externos: corrigida
com regressão na suíte de pontos (14 testes reexecutados). No IAB, Enter com
Mais ferramentas em foco abre o painel sem concluir; Enter no fundo continua
fechando. Revisão final sem achados acionáveis. Tipos reaproveitados após o
último delta, limitado ao seletor textual de controles interativos.

Evidências locais ignoradas pelo Git em `.tmp/work/quadra-mobile-20261111/`:
`area-por-pontos-desktop.jpg`, `area-por-pontos-mobile.jpg` e entrada fictícia
arquivada `court-area-points-qa-entry.tsx`. Fixture temporária removida da
superfície servida. Quadra autenticada recarregada e duas opções conferidas.
Sem commit, publicação ou gravação remota; aparelho físico não validado.

## Ações da área — correção após uso

O painel Ferramentas escondia ações contextuais, e concluir uma área no desktop
mantinha o modo de desenho. Agora a conclusão livre/por pontos volta à seleção
em ambas as larguras; selecionar na quadra fecha Ferramentas ou Propriedades,
preservando os demais painéis e os bloqueios existentes.

58 testes de `court-mobile-tools.test.ts`, tipos e diff aprovados. Revisão compacta
do coordenador sobre as duas linhas de produção e regressões sem achados.
IAB com dados fictícios confirmou conclusão por pontos, paleta e alteração de cor,
duplicação, exclusão da cópia, seleção com Ferramentas aberto e abertura das
Propriedades. Imagem local `area-acoes-cor.jpg`. Não houve alteração dos dados
reais para testar essas ações nem publicação.
