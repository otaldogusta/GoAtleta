# Treinamento integrado e consultoria

Base inspecionada: `d5120cff`, em 05/10/2026. Contexto do código local do Go Atleta;
não é validação clínica, confirmação de piloto nem certificação do backend ativo.
Atualização local posterior em 05/10: [isolamento da consultoria](../../operations/consultation-and-rules-sync-local.md).

## Responsabilidade e fluxo

O treino resistido compõe a semana e a aula de quadra conforme ambiente, materiais
e contexto da turma. A consultoria mantém perfil individual, prescrição, execução,
percepção de esforço/dor e revisão do professor em entidades próprias.
O workspace de treino edita planos e integra atividades; a percepção do aluno
alimenta o acompanhamento sem substituir decisão profissional.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [training/index.tsx](../../../app/training/index.tsx) | Workspace de planos e biblioteca local. |
| [student-plan.tsx](../../../app/student-plan.tsx), [resolve-training-plan-for-date.ts](../../../src/core/resolve-training-plan-for-date.ts) | Plano exibido ao atleta e seleção compartilhada por data. |
| [training-context.ts](../../../src/core/resistance/training-context.ts) | Acesso a academia, modelo integrado e elegibilidade. |
| [weekly-integrated-context.ts](../../../src/core/resistance/weekly-integrated-context.ts) | Distribuição do resistido no microciclo. |
| [build-resistance-session-plan.ts](../../../src/core/resistance/build-resistance-session-plan.ts) | Prescrição estruturada a partir dos templates. |
| [resolve-session-environment.ts](../../../src/core/resistance/resolve-session-environment.ts) | Ambiente e componentes da sessão. |
| [SessionResistanceTrainingSection](../../../src/screens/session/components/SessionResistanceTrainingSection.tsx) | Apresentação do resistido dentro da aula. |
| [consultation/index.tsx](../../../app/consultation/index.tsx) | Perfil, prescrição e revisão pelo professor. |
| [student-consultation.tsx](../../../app/student-consultation.tsx) | Execução, PSE, dor e feedback do aluno. |
| [consultation.ts](../../../src/core/consultation/consultation.ts) | Regras de perfil, execução, progresso e revisão. |
| [consultation.ts — DB](../../../src/db/consultation.ts) | Persistência Supabase, mapeamento e status de fallback. |
| [consultation-local.ts](../../../src/db/consultation-local.ts) | Armazenamento local do fluxo individual. |
| [consultation-context.ts](../../../src/db/consultation-context.ts), [use-consultation-screen-context.ts](../../../src/hooks/use-consultation-screen-context.ts) | Identidade capturada, operações e respostas tardias. |
| [consultationNotifications.ts](../../../src/notifications/consultationNotifications.ts) | Encaminhamento de eventos de consultoria. |

## Contratos a preservar

- Na seleção datada, `applyDate` exata prevalece sobre recorrência `applyDays` sem
  data específica. Aceitar somente plano `final` ou legado sem status, da turma
  solicitada; desempatar por versão e depois `createdAt`, preservando a data civil.
- `equipment` determina acesso a academia; overrides explícitos do modelo integrado
  e perfil resistido têm precedência. Faixa etária, nível e modalidade participam
  da elegibilidade: ter equipamento não autoriza qualquer prescrição.
- Semana conserva `weeklyIntegratedContextJson`; plano diário conserva ambiente
  e componentes. A academia permanece componente do planejamento integrado.
- Templates resistidos controlados preservam séries, repetições, descanso,
  observações e transferência pretendida para a quadra; não introduzir recálculo
  autônomo de cargas a partir de um alerta observacional.
- Consultoria separa treino prescrito de execução registrada. PSE/dor/feedback e
  revisão do professor são dados distintos da carga planejada ou diagnóstico médico.
- `ConsultationProgressSummary` explicita amostra inicial, adesão e alertas de
  esforço/dor; pouca amostra não deve virar tendência conclusiva.
- Repositório distingue `supabase`, `local` e `unavailable`. Fallback apenas para
  rede/schema; ausência de usuário/organização, troca de identidade, autenticação,
  permissão e erros desconhecidos não podem produzir sucesso local.
- Snapshot fornece contexto para mutações; validar sessão, organização e geração
  entre etapas. Troca de conta/workspace descarta respostas e reinicia a tela.
- Atleta sem cargo de equipe usa vínculo verificado pela sessão com sua organização;
  primeira abertura exige verificar esse vínculo, sem criar membership artificial.
- Novas escritas usam v2 por usuário/organização, envelope validado e fila por chave.
  Legado `goatleta_consultation_v1` fica intacto, sem exposição/adoção automática.
  Salvar localmente não prova envio futuro; notificações exigem resultado remoto.
- Notificações externas de atenção não incluem valor exato de dor nem narrativa
  livre. Links de demonstração são apoio à execução, não fonte de autorização.

## Decisões atuais e histórico

O [guia de treinamento resistido](../../../docs/resistance-training/README.md)
registra integração, templates, QA observacional e limites de escopo; seus slices
são histórico, não lista de novas tarefas autorizadas.
O [guia de consultoria](../../../docs/consultoria/README.md) reúne entidades,
notificações e roteiro do piloto, com a política de fallback atualizada.
O checklist de piloto desse guia não comprova execução real nesta revisão.
Testes locais de isolamento e envio simulado não certificam entrega de notificações
nem equivalência completa entre operação offline e servidor.

## Validação seletiva

Testes existentes a selecionar conforme a alteração:

- [contexto resistido](../../../src/core/resistance/__tests__/training-context.test.ts),
  [ambiente](../../../src/core/resistance/__tests__/resolve-session-environment.test.ts) e
  [prescrição](../../../src/core/resistance/__tests__/build-resistance-session-plan.test.ts).
- [consultoria](../../../src/core/consultation/__tests__/consultation.test.ts),
  [mapeamento DB](../../../src/core/consultation/__tests__/consultation-db-mappers.test.ts) e
  [notificações](../../../src/core/consultation/__tests__/consultation-notifications.test.ts).
- [composição da sessão](../../../src/db/__tests__/training-session-composition.test.ts) e
  [resistido na aula](../../../src/screens/session/components/__tests__/SessionResistanceBlock.test.ts).
- [seleção de plano por data](../../../src/core/__tests__/resolve-training-plan-for-date.test.ts).
- [isolamento local](../../../src/db/__tests__/consultation-local.test.ts) e
  [repositório](../../../src/db/__tests__/consultation-repository.test.ts).

Aplicar a [escada](../../../docs/operations/validation-ladder.md), com org-scope ao
alterar dados/rotas e smoke professor → aluno → revisão quando afetado. Resultados
da correção posterior e limites de ambiente estão no relatório vinculado acima.
O [smoke autenticado posterior](../../operations/consultation-authenticated-local-smoke-2026-10-05.md)
exercitou perfil, publicação, atleta sem membership, devolutiva, 403 e fallback
com isolamento entre contas/organizações. Não é aceite do piloto com alunas reais.
