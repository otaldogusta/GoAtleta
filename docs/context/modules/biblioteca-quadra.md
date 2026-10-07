# Biblioteca, quadra visual e scouting

Base inspecionada: `d5120cff`, em 05/10/2026. Inventário do código local do Go Atleta;
publicação, qualidade pedagógica e sincronização remota exigem evidência própria.

## Responsabilidade e fluxo

A Biblioteca reúne links/vídeos e atividades do catálogo pedagógico. O catálogo
orienta a seleção e explica atividades dos planos. A Quadra Visual é um editor
de documentos táticos por turma, com etapas, atores, desenhos, biblioteca e exportação.
São superfícies relacionadas; mídia, regra pedagógica e documento tático não são
a mesma entidade nem devem ganhar persistência duplicada por conveniência visual.
Scouting registra observações técnicas da equipe e autorregistros individuais separados.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [exercises/index.tsx](../../../app/exercises/index.tsx) | Biblioteca de links e aba do catálogo. |
| [ActivityCatalogTab](../../../src/screens/library/ActivityCatalogTab.tsx) | Busca, filtros e apresentação de atividades. |
| [activity-catalog.ts](../../../src/core/volleyball/activity-catalog.ts) | Catálogo TypeScript e conhecimento pedagógico. |
| [activity-catalog-plan-actions.ts](../../../src/screens/library/activity-catalog-plan-actions.ts) | Escolha de aula de destino e criação de versão do plano. |
| [planning-library-bridge.ts](../../../src/screens/training/application/planning-library-bridge.ts) | Conversão de atividade para bloco planejado. |
| [visual-tech.tsx](../../../app/class/[id]/visual-tech.tsx) | Entrada autorizada da quadra por turma. |
| [CourtEditorWorkspace](../../../src/components/visual-court/CourtEditorWorkspace.tsx) | Composição do editor e ferramentas. |
| [useCourtEditor](../../../src/components/visual-court/useCourtEditor.ts) | Estado, histórico, rascunhos e salvamento. |
| [visual-court.ts](../../../src/core/visual-court.ts) | Documento, atores, etapas e presets. |
| [visual-court-editor.ts](../../../src/core/visual-court-editor.ts) | Comandos, conversão e importação validada. |
| [technical-visuals.ts](../../../src/db/technical-visuals.ts) | Persistência local/remota e revisões por turma/organização. |
| [court-export.web.tsx](../../../src/components/visual-court/court-export.web.tsx) | Exportação visual web. |
| [scouting.tsx](../../../app/class/[id]/scouting.tsx), [student-scouting.tsx](../../../app/student-scouting.tsx) | Sessões de equipe e autorregistro do atleta, respectivamente. |
| [core/scouting.ts](../../../src/core/scouting.ts), [db/scouting-sessions.ts](../../../src/db/scouting-sessions.ts) | Resultados por fundamento, agregação, ações e conclusão da sessão. |

## Contratos a preservar

- `TrainingPlan.pedagogy.blocks` é referência semântica; campos legados de
  aquecimento/principal/volta à calma conservam compatibilidade de apresentação.
- Seleção de catálogo segue contexto de turma, ciclo, semana, aula e restrições;
  recomendação não sobrescreve plano sem ação do professor.
- Adicionar atividade à aula usa origem da atividade e versionamento do plano;
  preservar a detecção de duplicação e a escolha explícita de destino/bloco.
- Documento visual v1 conserva extensão `editor.version = 1` e conversão dos
  documentos antigos. Parser de arquivo aceita formato/tipos/limites explícitos.
- Atores, posições, números, cores e desenhos autorais devem sobreviver a mudanças
  de representação/orientação. Transformação visual não é recriação do documento.
- Etapa, rodízio, posição estática e trajetória têm papéis distintos. Histórico é
  transacional por gesto; seleção, zoom e reprodução não redefinem dados autorais.
- Rascunho local, sincronização pendente e revisão remota não são o mesmo sucesso.
  Preservar escopo de usuário no rascunho e organização/turma na persistência.
- Exportação/importação editável remove vínculos pessoais segundo o serializer;
  rótulos/notas visíveis ainda são conteúdo do autor. Não criar compartilhamento
  público implícito nem substituir autorização pela existência de arquivo/link.
- Scouting de equipe preserva organização, turma, sessão, fundamento e resultado;
  ações sincronizam contagens legadas. Sessão concluída rejeita adição/exclusão de ações.
- A coleta por jogada foi implementada localmente em 07/10: contatos vinculados
  ao ponto, reabertura, revisão/idempotência e rascunho por usuário/organização.
  Treino permanece por repetição; legado não recebe placar/rubrica presumidos.
  Migration `20261007112922` aplicada em 07/10; gravação real de jogo/treino validada
  pelo app local. Pacote validado para prévia; produção do app pendente. Ver [contrato e validação](../../ui/SCOUTING_IMPLEMENTACAO_2026-10-07.md)
  e [adaptador](../../../src/db/scouting-collection.ts).
- Autorregistro do atleta usa notas `0/1/2` por fundamento com limites próprios.
  A UI permite salvar no dia agendado, do início da aula até quatro horas depois;
  essa guarda cliente não comprova enforcement temporal no servidor.

## Decisões atuais e histórico

Reutilizar [guia do catálogo](../../../docs/catalog-pedagogico/CATALOG_GUIDE.md) e
[integração do motor](../../../docs/catalog-pedagogico/ENGINE_INTEGRATION.md).
A afirmação antiga de Biblioteca como consumidora futura no
[README do catálogo](../../../docs/catalog-pedagogico/README.md) já foi parcialmente
superada por `ActivityCatalogTab` e pela ponte de inclusão em aula existentes.
A [proposta de Quadra Visual](../../../docs/operations/visual-court-workspace-proposal.md)
mistura desenho inicial, implementação local e limites; consultar suas seções datadas.
Vídeo/GIF, geração por assistente e validação automática de legalidade não são
capacidades comprovadas por este mapa. Referenciar aula não reescreve plano aplicado.

## Validação seletiva

Testes encontrados, sem execução nesta rodada:

- [catálogo](../../../src/core/__tests__/activity-catalog.test.ts),
  [Biblioteca/UI](../../../src/screens/library/__tests__/activity-catalog-library-ui.test.ts) e
  [ponte de planejamento](../../../src/screens/training/application/__tests__/planning-library-bridge.test.ts).
- [modelo visual](../../../src/core/__tests__/visual-court.test.ts),
  [comandos/importação](../../../src/core/__tests__/visual-court-editor.test.ts),
  [persistência](../../../src/db/__tests__/technical-visuals.test.ts) e
  [exportação](../../../src/components/visual-court/__tests__/court-export-utils.test.ts).
- [domínio scouting](../../../src/core/__tests__/scouting-sessions.test.ts) e
  [sessões persistidas](../../../src/db/__tests__/scouting-sessions.test.ts).

Em mudança funcional, usar a [escada](../../../docs/operations/validation-ladder.md)
e smoke local de abrir/editar/desfazer/salvar/reabrir/exportar. Evidência web não
certifica exportação nativa nem gravação remota; esta rodada apenas inspecionou fontes.
