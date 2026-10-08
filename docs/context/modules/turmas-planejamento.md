# Turmas, equipe e planejamento

Base inspecionada: `d5120cff`, em 05/10/2026. Contexto do código local do Go Atleta;
não certifica ativação do backend nem publicação do frontend.

## Responsabilidade e fluxo

Turma reúne identidade, modalidade, horários, unidade e responsáveis. O perfil
pedagógico descreve a turma; ciclos e planos organizam o trabalho no tempo.
O planejamento mensal, semanal e diário reutiliza esse contexto, preservando
edições do professor e distinguindo proposta, plano aplicado e aula realizada.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [classes/index.tsx](../../../app/classes/index.tsx) | Lista, edição e composição operacional de turmas. |
| [ClassOperationsWorkspace](../../../src/screens/classes/components/ClassOperationsWorkspace.tsx) | Workspace com operações da turma. |
| [classes.ts](../../../src/db/classes.ts) | Leitura, gravação, duplicação e exclusão de turmas. |
| [class-staff-history.ts](../../../src/api/class-staff-history.ts) | Vínculos temporais, substituições e versões da equipe. |
| [class-session-coverages.ts](../../../src/api/class-session-coverages.ts) | Cobertura específica de uma turma/data. |
| [class-pedagogical-profile.ts](../../../src/api/class-pedagogical-profile.ts) | Comandos autorizados e eventos do perfil canônico. |
| [useClassPlanning](../../../src/screens/planning/hooks/useClassPlanning.ts) | Carregamento e coordenação do planejamento. |
| [planning-cycle-selection.ts](../../../src/screens/planning/application/planning-cycle-selection.ts) | Seleção do ciclo que cobre o mês solicitado. |
| [monthly-planning-blueprints.ts](../../../src/db/monthly-planning-blueprints.ts) | Blueprint mensal, identidade do ciclo e sincronização. |
| [planning.ts](../../../src/db/planning.ts) | Planos diários e invalidação após mudança semanal. |
| [review-profile-plans.ts](../../../src/screens/planning/application/review-profile-plans.ts) | Prévia de revisão a partir de novo perfil. |

## Contratos a preservar

- Organização e turma acompanham acesso, cache e resposta assíncrona. Na API do
  perfil, mudança de organização invalida a operação e a resposta recebida.
- Perfil é canônico por organização/turma, versionado e independente do ciclo;
  relatos, revisões e sugestões têm proveniência. O diagnóstico antigo do ciclo
  serve à compatibilidade, sem substituir automaticamente o perfil vigente.
- Equipe temporal tem início/fim, papel e estado próprios; cobertura de uma aula
  não equivale a trocar o responsável permanente. A API histórica usa versão
  esperada e chave de idempotência. Placeholder não é identidade autenticada.
- Um mês fora da janela dos ciclos retorna ausência de ciclo correspondente;
  não associar indiscriminadamente qualquer mês ao ciclo ativo.
- Plano diário conserva `in_sync`, `out_of_sync`, `overridden` e `stale_parent`;
  geração não deve apagar edição manual nem ocultar desatualização do pai.
- Revisão de planos futuros exige seleção e aplicação explícitas, com rechecagem
  de versão/hash/execução no servidor. Não tratar prévia como gravação efetiva.
- Excluir turma e duplicar turma têm contratos próprios: consultar os testes de
  preservação de alunos e duplicação antes de ampliar cascatas ou copiar vínculos.

## Decisões atuais e histórico

- O [refinamento local de convites](../../operations/trainer-invite-refinement.md)
  associa perfil sem conta somente por seleção explícita e aceite verificado;
  preserva equipe/histórico e avança versões. Novas turmas não substituem responsáveis.
  A migration de 08/10 está preparada, sem aplicação remota nesta tarefa.

O [perfil pedagógico](../../../docs/operations/class-pedagogical-profile.md) é a
referência detalhada de segurança, interpretação e revisão de planos. Seu relato
de ativação/smoke é datado; não é uma nova verificação deste levantamento.
O [assistente de planejamento](../../../docs/operations/planning-assistant-local.md)
documenta conversa contextual e publicação parcial: conversar não altera perfil,
ciclo ou plano. O workspace institucional dedicado tem outro fluxo de aplicação.
O [backlog arquivado](../../../docs/archive/cycle-day-planning/BACKLOG_AND_PR_CHECKLIST.md)
explica a evolução do motor; tarefas e sprints ali não representam pendências atuais.

## Validação seletiva

Testes localizados, para executar conforme a mudança:

- [equipe temporal](../../../src/api/__tests__/class-staff-history.test.ts),
  [perfil/API](../../../src/api/__tests__/class-pedagogical-profile.test.ts) e
  [exclusão preservando alunos](../../../src/db/__tests__/class-delete-preserves-students.test.ts).
- [seleção do ciclo](../../../src/screens/planning/application/__tests__/planning-cycle-selection.test.ts),
  [blueprint mensal](../../../src/db/__tests__/monthly-planning-blueprints.test.ts) e
  [regeneração diária](../../../src/screens/planning/application/__tests__/regenerate-daily-lesson-plan.integration.test.ts).

Na edição funcional, classificar pela [escada de validação](../../../docs/operations/validation-ladder.md);
dados/rotas exigem org-scope e smoke autenticado do fluxo afetado. Neste levantamento
foram inspecionados código, fontes e caminhos; testes do app e backend não foram executados.
