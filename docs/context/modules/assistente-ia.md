# Assistente, Copilot e contexto de IA

Base inspecionada: `d5120cff`, 05/10/2026. Código local; relatos de publicação e smoke são evidências datadas, não verificação atual de produção.

## Responsabilidades e implementação atual

O Copilot reúne sinais, ações e contexto das telas. O chat flutuante compartilha conversa, modelo, texto e pedido pendente pelo `UnifiedAssistantProvider`, isolado por usuário/organização. A tela dedicada `/assistant` conserva fluxos próprios de relatório, rascunho e regra da turma.

O backend resolve autorização, memória, governança, periodização e fontes. Planejamento contextual é orientativo; conversa de aula pode produzir rascunho datado. Fala preenche o campo editável, sem enviar mensagem ou confirmar mudança.

## Arquivos principais

| Fluxo | Entradas |
| --- | --- |
| Tela dedicada/Copilot | [assistant/index.tsx](../../../app/assistant/index.tsx), [CopilotProvider.tsx](../../../src/copilot/CopilotProvider.tsx), [operational-context.ts](../../../src/copilot/operational-context.ts) |
| Conversa compartilhada | [UnifiedAssistantProvider.tsx](../../../src/assistant/UnifiedAssistantProvider.tsx), [useScreenConversation.ts](../../../src/assistant/hooks/useScreenConversation.ts), [conversation-history.ts](../../../src/assistant/conversation-history.ts) |
| Transporte/orquestração | [api/ai.ts](../../../src/api/ai.ts), [assistant-stream.ts](../../../src/api/assistant-stream.ts), [assistant/index.ts](../../../supabase/functions/assistant/index.ts) |
| Modelos | [model-router.ts](../../../supabase/functions/assistant/model-router.ts), [model-policy.ts](../../../supabase/functions/assistant/model-policy.ts), [model-choice.ts](../../../src/assistant/model-choice.ts) |
| Contexto/memória | [ai-context.ts](../../../supabase/functions/_shared/ai-context.ts), [ai-memory.ts](../../../supabase/functions/_shared/ai-memory.ts), [ai-governance.ts](../../../supabase/functions/_shared/ai-governance.ts) |
| Planejamento/aula | [planning-context-handler.ts](../../../supabase/functions/assistant/planning-context-handler.ts), [lesson-history.ts](../../../supabase/functions/assistant/lesson-history.ts), [apply-lesson-draft.ts](../../../src/screens/session/application/apply-lesson-draft.ts) |
| Voz | [LessonVoiceInput.tsx](../../../src/screens/session/components/LessonVoiceInput.tsx), [lesson-audio.ts](../../../src/api/lesson-audio.ts), [assistant-transcribe](../../../supabase/functions/assistant-transcribe/index.ts) |
| Sinais/explicação | [signal-engine.ts](../../../src/ai/signal-engine.ts), [session-decision-trace.ts](../../../src/core/cycle-day-planning/session-decision-trace.ts) |

## Contratos a preservar

- Organização ativa explícita, associação validada e turma pertencente ao workspace. Conteúdo de mensagens, memórias, documentos e snapshots nunca altera permissões.
- `lessonContext` identifica versão, organização, turma e data. Cliente rejeita envelope incompatível; servidor fixa turma e descarta rascunho em `discuss`.
- Rascunho exige blocos/tempos válidos. Aplicação explícita confere plano de origem, preserva versões e reconhece reenvio; não garante exclusão global de concorrência entre editores.
- Confirmação conversacional continua uma proposta, não prova gravação. Relatório/regra têm controles de salvar; [class-profile-handler.ts](../../../supabase/functions/assistant/class-profile-handler.ts) usa comandos próprios para perfil.
- `ai_facts` fica no workspace/sujeito correto; `ai_user_global_facts` é separado. Histórico e `assistant_memory_entries`, com retenção, não são perfil pedagógico canônico.
- Perfil atual substitui padrões antigos da turma no contexto. Relato docente não comprova domínio técnico; transição de equipe não vira preferência pessoal.
- Preservar Responses API, JSON Schema, `store: false`, streaming, cancelamento e validação. Texto parcial não aplica efeitos. Registrar modelos pedido/selecionado/retornado; custo estimado não é faturamento nem teto.
- Planejamento contextual usa projeção privada e até oito sessões concluídas em 30 dias. Falha na preparação de privacidade impede envio; ausência, indisponibilidade, previsão e execução são estados distintos.
- Decisões/feedback usam `ai_decision_traces`/outcomes; fontes seguem [documentos-academico](documentos-academico.md), sem converter inferência em fato.
- Transcrição limita áudio a 8 MB e quatro tentativas/minuto por instância, após autorização. Endpoint não persiste áudio/transcrição; texto enviado depois segue a memória normal da conversa.

## Decisões e histórico

- Roteador atual: `gpt-5.6-luna` para rotina/proativo, `gpt-5.6-terra` para análise complexa; `gpt-4o-mini` permanece permitido. Override e escolha manual válida precedem automático; orçamento é do servidor.
- Saudação exata é determinística após autorização. Não há classificação paga nem escalada automática por qualidade. Voz usa `gpt-transcribe`; PDF/embeddings têm políticas independentes.
- [Planejamento contextual](../../operations/planning-assistant-local.md) registra unificação, privacidade e smoke de 30/09; sua pendência de frontend exige conciliação com Git/deploy.
- [Roteamento](../../audits/2026-09-06-assistant-model-routing.md) contém fechamentos posteriores às pendências iniciais. [Copiloto da aula](../../audits/2026-09-06-lesson-conversation-copilot.md) antecede o seletor manual atual.
- [AI_PILLARS](../../AI_PILLARS.md) é conceitual: lista ampla de fontes/modelos não descreve todos os caminhos. Propostas de novos modelos não significam implementação ou ativação.
- Preservar explicação de resultado/evidência/próxima ação conforme [explicabilidade](../../ui/AI_DECISION_EXPLAINABILITY.md).

## Validações relevantes

Suítes existentes, não executadas nesta organização documental:

- [Hooks/conversa](../../../src/assistant/hooks/__tests__), [histórico](../../../src/assistant/__tests__/conversation-history.test.ts), [rascunho](../../../src/screens/session/application/__tests__/lesson-draft.test.ts).
- [Backend assistant](../../../supabase/functions/assistant/__tests__): modelos, streaming, workspace, fontes e planejamento; [ai-memory-scope](../../../supabase/functions/_shared/__tests__/ai-memory-scope.test.ts).
- [Voz no cliente](../../../src/screens/session/components/__tests__/LessonVoiceRecorder.test.ts) e [acesso/áudio Deno](../../../supabase/functions/assistant-transcribe/audio-access.deno-test.ts).
- [eval-lesson-copilot](../../../scripts/validation/eval-lesson-copilot.ts) chama API: revisar helper/autorização; qualidade exige revisão humana. Mocks não certificam microfone, resposta real ou aplicação.

## Antes de editar

Selecione superfície e contrato cliente/servidor antes das dependências. Use a [escada](../../operations/validation-ladder.md); alterações de escopo exigem `check:org-scope`. Smoke pertinente cobre continuidade, troca de identidade, cancelamento, seleção capturada e aplicação explícita. Não ampliar memória/modelos para resolver mudança visual.
