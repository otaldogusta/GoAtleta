# Comunicação, notificações e WhatsApp

Leitura do código em 05/10/2026, base `d5120cff`. Este mapa não confirma entrega de
push/OTP, aprovação Meta ou configuração atual de provedores.

## Responsabilidades e entradas

Apresentar avisos e caixa de entrada, emitir notificações de eventos permitidos,
registrar dispositivos e abrir contatos no WhatsApp. A confirmação de telefone por
OTP tem transporte próprio no servidor. Leia ao alterar avisos, destinatários ou push.

| Arquivo principal | Responsabilidade atual |
| --- | --- |
| [absence-notices.tsx](../../../app/absence-notices.tsx), [communications.tsx](../../../app/communications.tsx) | Centro compartilhado de avisos; rota de comunicação reutiliza a tela. |
| [notifications/index.tsx](../../../app/notifications/index.tsx) | Entrada da caixa de notificações. |
| [api/notifications.ts](../../../src/api/notifications.ts), [notificationsInbox.ts](../../../src/notificationsInbox.ts) | Consulta, leitura, arquivo, paginação e assinaturas locais da caixa. |
| [inbox-scope.ts](../../../src/notifications/inbox-scope.ts), [notification-organization.ts](../../../src/notifications/notification-organization.ts) | Escopo `prof`/`coord`/`student`/`all` e organização efetiva. |
| [notifications.ts](../../../src/notifications.ts) | Adaptadores de notificações de treino/aniversário e aviso local nativo. |
| [create-notification](../../../supabase/functions/create-notification/index.ts), [notification-authorization-policy.ts](../../../supabase/functions/_shared/notification-authorization-policy.ts) | Validação de payload, identidade, destinatário e relação entre as partes. |
| [send-push](../../../supabase/functions/send-push/index.ts), [register-web-push](../../../supabase/functions/register-web-push/index.ts) | Entrega e registro de push no servidor. |
| [notificationRuntime.ts](../../../src/push/notificationRuntime.ts), [web-notifications.ts](../../../src/push/web-notifications.ts) | Expo Notifications e assinatura web via service worker. |
| [whatsapp.ts](../../../src/utils/whatsapp.ts), [whatsapp-templates.ts](../../../src/utils/whatsapp-templates.ts) | Normalização de telefone, composição e abertura de `wa.me`. |
| [whatsapp-auth-hook](../../../supabase/functions/whatsapp-auth-hook/index.ts), [meta-whatsapp-webhook-handler.ts](../../../supabase/functions/_shared/meta-whatsapp-webhook-handler.ts) | Envio de OTP assinado e recepção autenticada de eventos Meta. |

## Contratos a preservar

- Destinatário, organização e escopo da caixa participam da autorização. Contagem,
  paginação, marcação e assinaturas não devem misturar contextos institucionais.
- Famílias usam a caixa `student`; resolver a instituição a partir do atleta/contexto
  selecionado, não somente da organização que o usuário usou como membro da equipe.
- `create-notification` valida usuário no servidor, payload e política de entrega.
  IDs recebidos do cliente não comprovam vínculo nem autorização de envio.
- A política considera membros, nível de administração, turmas e permissões. Atleta
  não pode emitir qualquer tipo para qualquer pessoa; preservar os eventos permitidos.
- [notification-content.ts](../../../supabase/functions/_shared/notification-content.ts) resolve conteúdo autorizado;
  preservar vínculo com o evento real, deduplicação e destino de navegação.
- Notificação persistida e entrega push são etapas distintas. Permissão concedida,
  token registrado ou HTTP de envio não comprovam recebimento no dispositivo.
- Consultoria propaga uma guarda opcional de contexto até inbox/push, conferida
  após resolver o token e antes do envio. Troca de sessão/workspace bloqueia etapas
  seguintes; envio já iniciado não é desfeito. Fallback local não emite avisos.
- O runtime nativo evita uso incompatível no Expo Go; web usa permissão do navegador,
  `PushManager` e `/push-sw.js`. Não supor paridade a partir de uma única plataforma.
- `wa.me` abre uma composição externa; não é prova de mensagem enviada. O contato
  prioriza telefone válido do responsável e usa o do atleta como alternativa.

## Decisões atuais e limites

- A caixa filtra erros técnicos para não mostrar stack traces ao usuário. Alguns
  caminhos de leitura retornam vazio em falha; isso não é evidência de caixa sem eventos.
- OTP confirma propriedade do telefone por Supabase Auth `phone_change`; não cria
  um segundo login primário nem deve marcar a confirmação por código cliente.
- O hook de envio usa assinatura Standard Webhooks; o receptor Meta usa token de
  verificação no GET e assinatura de corpo no POST antes de interpretar conteúdo.
- [whatsapp-settings.tsx](../../../app/whatsapp-settings.tsx) interpreta o retorno Embedded Signup e limpa
  parâmetros. Retorno de sucesso não conclui por si a troca de código no servidor.
- Configuração/provedor e teste real do destinatário continuam sendo verificação
  operacional separada da existência destes adaptadores.

## Documentação existente e precedência

- [Confirmação pelo WhatsApp](../../operations/whatsapp-auth-prototype.md): apesar do
  nome `prototype`, descreve o contrato atual e a configuração observada em 25/09.
  Aprovação Meta e operação ponta a ponta precisam de confirmação atual; não inferir ativação.
- [Pacote de acesso](../../audits/2026-09-09-access-package.md): taxonomia e decisões de
  notificações transacionais; verificar cada emissor no código antes de tratá-lo como entregue.
- [Consultoria](../../consultoria/README.md): contexto dos avisos do fluxo individual;
  consultar apenas se o evento alterado for de consultoria.

## Validação relevante

Nesta organização documental houve inspeção estática, sem envio de mensagens ou OTP.
Na continuação local, [testes da guarda de contexto](../../../src/api/__tests__/notification-context-guard.test.ts)
e regressões de notificações foram executados; [resultados e limites](../../operations/consultation-and-rules-sync-local.md).

- [Testes da caixa](../../../src/notifications/__tests__/), [web push](../../../src/push/__tests__/web-notifications.test.ts)
  e [templates WhatsApp](../../../src/utils/__tests__/whatsapp-templates.test.ts).
- [Testes compartilhados Edge](../../../supabase/functions/_shared/__tests__/) incluem autorização,
  conteúdo, destinatário, abuso de push, web push e provedor de OTP.
- Alterações de autorização/entrega seguem a [escada](../../operations/validation-ladder.md);
  recebimento real requer teste controlado e autorizado, separado dos testes estáticos.
