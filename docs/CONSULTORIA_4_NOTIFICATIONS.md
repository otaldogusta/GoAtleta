# CONSULTORIA 4 - Notificacoes internas e push

Este pacote adiciona eventos de notificacao para a Consultoria Online, sem criar chat, automacao pesada ou envio direto inseguro pelo cliente.

## Eventos

| Evento | Quando acontece | Destinatario | Titulo | Corpo |
| --- | --- | --- | --- | --- |
| `consultation_workout_published` | Professor publica um treino | Aluna | Treino publicado | Seu treino ja esta disponivel. |
| `consultation_workout_completed` | Aluna conclui o treino | Professor | Treino concluido | `[Nome] concluiu o treino.` |
| `consultation_high_pain_reported` | Aluna envia dor alta | Professor | Atencao no treino | `[Nome] enviou um feedback que precisa de revisao.` |
| `consultation_execution_reviewed` | Professor revisa a devolutiva | Aluna | Devolutiva revisada | O profissional revisou seu feedback de treino. |

Quando o nome da aluna nao esta disponivel, a mensagem usa texto neutro: `A aluna`.

## Implementacao

- Builder puro: `src/core/consultation/consultation-notifications.ts`.
- Adapter de entrega: `src/notifications/consultationNotifications.ts`.
- Integracoes:
  - publicacao de treino em `/consultation`;
  - revisao de feedback em `/consultation`;
  - conclusao de treino em `/student-consultation`;
  - dor alta em `/student-consultation`.

## Inbox interna

Toda notificacao cria uma entrada no inbox oficial via `notificationsInbox`, que agora atua como ponte para a tabela `notifications` no Supabase.

O adapter usa uma chave idempotente por evento, aluna, treino e execucao para evitar duplicidade quando a mesma acao e repetida.

## Push remoto

O push remoto fica preparado e so e acionado quando o adapter recebe:

- `organizationId`;
- `targetUserId`.

Nesse caso, o envio usa `sendPushToUser`, que chama a Edge Function `send-push` com JWT do usuario atual. O cliente nao carrega segredo de servico e nao envia push direto para outro usuario.

No fluxo atual da consultoria, ainda nao ha contrato final para descobrir o `targetUserId` da aluna ou do professor em todos os cenarios. Por isso, a entrega principal deste pacote e inbox interna, com push remoto preparado para ser ligado apos CONSULTORIA 7.

## Protecao de dados sensiveis

- O push de dor alta nao expoe nivel de dor.
- O push nao expoe comentario completo da aluna.
- Detalhes de PSE, dor, observacao e historico permanecem dentro do app.
- As mensagens evitam linguagem medica e nao fazem diagnostico.

## Limites

- Nao cria chat.
- Nao cria automacao de lembrete.
- Nao resolve permissoes finas aluno/professor.
- Push remoto depende de `organizationId` e `targetUserId`, que ficam para o pacote de permissoes e vinculo final.

## Proximos pacotes relacionados

- CONSULTORIA 5: midia dos exercicios.
- CONSULTORIA 6: relatorio/devolutiva.
- CONSULTORIA 7: permissoes robustas e vinculo aluno/professor para ativar push remoto completo.
