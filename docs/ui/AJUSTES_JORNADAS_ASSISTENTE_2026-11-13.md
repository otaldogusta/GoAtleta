# Jornadas atuais e compositor do Assistente · 13/11/2026

Correção local após os cinco comentários do usuário na galeria do inventário.
O lote anterior abriu rotas existentes diretamente e deu destaque a duas telas
legadas. Isso não comprovava que elas faziam parte dos percursos atuais.

## O que representa o app atual

| Comentário | Evidência reconciliada | Resultado |
| --- | --- | --- |
| Relatório atual da ficha | `ClassOperationsWorkspace` abre o modal de `app/class/[id].tsx`, que renderiza `SessionScreen embeddedReport`. | A composição aprovada foi preservada e capturada com turma fictícia. |
| Log antigo na galeria | Nenhuma entrada para `/class/[id]/log` foi encontrada nos menus, homes ou Histórico. Histórico reutiliza o modal por data. | O formulário legado saiu dos comparativos principais; a captura anterior permanece no arquivo histórico. |
| Evidências sem caminho conhecido e cabeçalho diferente | `/evidence` existe, exige permissão do Assistente e papel treinador; aprovação exige administração. Nenhuma entrada de menu foi encontrada. | Rota identificada como auxiliar restrita. Cabeçalho canônico com Voltar, Início e Assistente; APIs e permissões preservadas. Pesquisa rápida e painel científico ficam no Assistente da jornada principal. |
| Notificações antigas | Coordenação usa `/coord/communications`; Professor usa `/prof/absence-notices`; Aluno usa `/communications`. O sino da home abre painel local. `/notifications` não tem entrada visível encontrada. | Galeria mostra a central atual como preservada. A tela antiga fica apenas no histórico. |
| Área de escrita do Assistente | A falha ocupava o mesmo grande recipiente do texto; no desktop, o campo se alargava além do eixo das sugestões. O texto digitado não definia a fonte do produto. | Superfície única para escrever e ações; erro externo compacto com nova tentativa. Coluna de até 720 px, margens de 16 px e texto 14/20 com fonte do app na web. |

## Implementação delimitada

- [Página do Assistente](../../app/assistant/index.tsx): coluna, área de escrita e
  mensagem de falha; a pergunta anterior continua disponível se o rascunho mudar.
  A nova tentativa leva o foco ao campo antes do envio, evitando foco perdido
  quando o botão desaparece. O listener de Enter confere o alvo do evento para
  não capturar a ativação de outros controles na troca de foco.
- [AssistantComposer](../../src/assistant/components/AssistantComposer.tsx):
  variante `page` opt-in. Campo acima da barra de modelo, voz e enviar; alvos de
  44 px. O “+” redundante que apenas focava o campo sai somente dessa variante.
  Defaults usados por Copilot e Assistente de Planejamento permanecem.
- [AssistantModelSelector](../../src/assistant/components/AssistantModelSelector.tsx):
  navegação de teclado opt-in na página dedicada. Abre com foco na seleção,
  revela a opção no menu, aceita Tab/setas e devolve foco após seleção/Escape.
  Clique fora fecha sem redirecionar o foco; defaults dos outros consumidores
  e o dropdown compartilhado permanecem.
- [Evidências](../../app/evidence/index.tsx): `ScreenPageHeader` e retorno seguro
  à home do perfil quando não há histórico. Busca, síntese e aprovação não mudam.

Sem alteração no relatório aprovado, central de Avisos, autenticação, Quadra,
Planejamento, cartões de mês, Gestão/Equipe ou Regulamentos.

## Validação e acervo

Nível 2 da escada: componente compartilhado com variante opt-in e navegação de
retorno, sem alteração de dados ou autorização. Skills usadas nesta etapa:
feature-workflow, design-system, web-ui e testing do Go Atleta. A direção foi
baseada nos componentes aprovados do produto, sem alegar uso novo de Pinterest,
Taste ou Awesome Design.

Acervo local em `.tmp/auditoria-go-atleta-2026-11-13/lote-7/`, com fontes anteriores,
capturas de UI/UX e registros de validação. Galeria atual:
`http://127.0.0.1:8096/inventario-revisado.html`; versão histórica do lote 6:
`http://127.0.0.1:8096/inventario-revisado-lote6.html`.

O QA usa o mesmo checkout em `127.0.0.1:8082`, com Supabase local `54321`, mantendo
a sessão de uso em `localhost:8081`. Dados fictícios; falha do Assistente e
pesquisa/síntese são respostas interceptadas no navegador. Não há certificação de
resposta real da IA, gravação de áudio, aprovação científica ou envio externo.

### Resultados registrados

- Designer UI inspecionou Evidências e Assistente em 390 × 844 claro/escuro e
  1158 × 883 escuro. Compositor de 358 px no celular e 720 px no desktop;
  texto 14/20; modelo, voz, envio e nova tentativa com alvos de pelo menos 44 px.
- Designer UX confirmou os menus de Avisos/Assistente por papel. A lista de Turmas
  abriu pelo menu; para a prova do modal, a ficha QA foi acessada por URL e
  Relatório foi acionado por Enter. Foco contido no diálogo e retorno por Escape.
- Em 390 escuro e 1273 × 857 claro: Shift+Enter quebra linha sem request; Enter
  envia uma vez; erro 503 preserva pergunta e foco; edição mantém o novo texto e
  a pergunta anterior; retry envia uma cópia, renderiza proposta fictícia e
  conserva o foco em `Mensagem para o assistente` após sucesso. Nenhuma proposta
  foi salva/aplicada. Registros finais: `ux-assistente-dark-foco-final` e
  `ux-assistente-desktop-light-foco-final` no acervo do lote 7.
- Dez testes focados passaram: cinco do compositor (instância/rascunho entre
  larguras, variantes default/page, voz/busy e Enter/Shift+Enter), cinco do seletor
  (opção selecionada, navegação, restauração, fechamento externo e default).
  Revisão independente apontou a necessidade de revelar a última opção ao abrir
  um menu com rolagem; corrigida e coberta por teste. Encerrou sem novos achados.
- UI confirmou campo → Tab → Modelo → Enter, `aria-expanded`, foco na seleção,
  Tab/seta até Luna, seleção por Enter e fechamento por Escape com retorno ao
  acionador. Rascunho preservado e zero chamadas ao Assistente. Registro:
  `ui-depois-mobile-dark-modelo-teclado-final` no acervo.
- Caso reduzido 390 × 450 escuro: GPT-4o mini selecionado recebe foco ao reabrir,
  painel rola 54 px e mantém toda a opção visível; Escape fecha e retorna ao
  acionador. Zero chamadas. Registro: `ui-modelo-altura-final`.
- Tipos do app, ESLint dos arquivos alterados, escopo de organização e
  `git diff --check` passaram. O typecheck intermediário identificou
  `accessibilityRole="group"` incompatível com React Native; foi corrigido para
  `role="group"` e o check final passou. Build/release não fazem parte deste nível.
- Galeria em 1311 e 390 px: filtros e vazio funcionam, sem imagens ausentes,
  erro de script ou overflow horizontal. Dois comparativos novos do Assistente,
  dois da rota auxiliar, duas referências atuais preservadas e 35 pares anteriores.
- Hashes da ficha de turma, Log e Notificações antigas idênticos à baseline
  desta etapa. Cinco notas do checklist atualizadas; títulos, status e fontes
  preservados, gerador mantém 29 módulos, 381 itens e 124 arquivos de rota.

O Metro de QA esgotou o heap após a sequência acumulada de testes e foi reiniciado
somente em 8082, com a mesma configuração. Os estados finais foram conferidos
após a retomada; capturas anteriores válidas foram preservadas. Sem alteração
da sessão em 8081, commit, push ou publicação.

## Pendência distinta encontrada no rastreio

Atalhos de [HomeProfessor](../../src/screens/home/HomeProfessor.tsx) e
[relatórios](../../app/reports/trainer.tsx) ainda enviam `date/tab` para
`/class/[id]/session`, mas o redirecionamento web conserva somente `id`.
Podem perder a data ou abertura pretendida. É um achado por leitura, separado
da correção visual e sem alteração do modal aprovado nesta rodada.

O sino de Hoje no desktop abriu por clique, mas o DOM não expôs papel `button`;
seu comportamento completo por teclado não foi certificado. As sugestões da
página do Assistente já truncavam textos no celular e conservam esse comportamento.

Atualização em 14/11/2026: o redirect agora conserva `date`, comprovado no
percurso Hoje → 15/11 → Ver aula → ficha de 15/11. O sino ganhou semântica de
botão/expansão e foi conferido com Enter, Espaço, Escape e retorno de foco.
A intenção legada `tab` continua separada; não foi implementada abertura
automática do relatório. [Revisão atual](REVISAO_TELAS_ATUAIS_2026-11-14.md).
