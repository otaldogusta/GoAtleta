# Confirmação de telefone pelo WhatsApp

## Estado

O fluxo oficial usa `Supabase Auth -> Send SMS Hook -> Meta WhatsApp Cloud API`.
Ele confirma a propriedade do telefone informado no perfil por meio de
`phone_change`; o telefone não é usado como método primário de login e nenhuma
credencial fica no cliente ou neste repositório.

Estado verificado em 25/09/2026:

- a confirmação está habilitada na tela de perfil;
- `whatsapp-auth-hook` e `meta-whatsapp-webhook` estão ativos no projeto Supabase;
- todos os nomes de segredo exigidos estão cadastrados no Supabase (valores não inspecionados);
- a revisão Meta de `whatsapp_business_messaging` e `public_profile` está em andamento;
- `whatsapp_business_management` não faz parte da solicitação, pois não é necessária para o OTP.

Esse inventário confirma a configuração, mas não substitui um teste de ponta a
ponta com um novo OTP em telefone controlado.

As páginas públicas exigidas pela Meta ficam em `/privacy`, `/terms` e
`/data-deletion`. A recepção de eventos usa `meta-whatsapp-webhook`, separada
do hook de envio de OTP.

O retorno web do Embedded Signup usa `/whatsapp-settings`. A tela reconhece sucesso,
cancelamento ou erro e remove os parâmetros da URL para não manter códigos no histórico.
Ela não troca o código no cliente: a conclusão da conexão deve ocorrer em um endpoint
servidor autenticado, com validação de `state`, depois que a Meta liberar o fluxo e as
credenciais definitivas estiverem disponíveis.

## Responsabilidades

- Supabase Auth gera, expira e valida o OTP de seis dígitos.
- `whatsapp-auth-hook` autentica o evento pela assinatura Standard Webhooks.
- A Edge Function envia o OTP com um template Meta da categoria `AUTHENTICATION`.
- O cliente confirma o código no endpoint canônico `type=phone_change`; a função nunca marca telefone como verificado.

## Configuração operacional

1. No painel Meta for Developers, mantenha o produto WhatsApp associado ao número oficial ou a um número controlado de teste.
2. Cadastre somente os telefones fictícios/controlados permitidos como destinatários de teste.
3. Crie um template `AUTHENTICATION` com botão OTP `COPY_CODE`, idioma `pt_BR`, expiração de cinco minutos e nome `goatleta_phone_verification`.
4. Configure os segredos diretamente no Supabase, sem colocá-los em `.env`, GitHub, chat ou código cliente:
   - `SEND_SMS_HOOK_SECRET`
   - `META_WHATSAPP_ACCESS_TOKEN`
   - `META_WHATSAPP_PHONE_NUMBER_ID`
   - `META_WHATSAPP_GRAPH_API_VERSION`
   - `META_WHATSAPP_AUTH_TEMPLATE_NAME`
   - `META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE`
   - `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - `META_WHATSAPP_APP_SECRET`
5. Ao alterar o transporte de OTP, publique somente `whatsapp-auth-hook`; publique `meta-whatsapp-webhook` apenas quando o receptor também mudar.
6. Em Authentication > Hooks, selecione `Send SMS` e informe o endpoint HTTPS da função. Copie o segredo gerado para `SEND_SMS_HOOK_SECRET`.
7. Mantenha Phone Auth habilitado com confirmação automática desligada.

Valores não secretos esperados no primeiro teste:

```text
META_WHATSAPP_GRAPH_API_VERSION=v26.0
META_WHATSAPP_AUTH_TEMPLATE_NAME=goatleta_phone_verification
META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE=pt_BR
```

Confirme a versão da Graph API exibida no painel Meta antes do teste; ela é configurável para evitar dependência de uma versão fixa no código.

## Webhook oficial

1. Gere `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` fora do repositório e salve-o
   apenas nos segredos do Supabase.
2. Copie o App Secret do app Meta diretamente para o segredo
   `META_WHATSAPP_APP_SECRET`; nunca o envie ao frontend ou ao chat.
3. Publique `meta-whatsapp-webhook` com verificação JWT desabilitada. A função
   autentica o `GET` pelo verify token e cada `POST` pela assinatura
   `X-Hub-Signature-256` antes de interpretar o JSON.
4. Use o endpoint HTTPS publicado como callback e assine o tópico
   `whatsapp_business_account`. Comece pelos campos `messages`,
   `message_template_status_update`, `phone_number_name_update` e
   `phone_number_quality_update`.
5. A implementação inicial apenas confirma o recebimento. Ela não grava o
   corpo, telefone, nome ou conteúdo das mensagens em logs ou tabelas.

## Portões de operação contínua

- template aprovado e envio recebido em um telefone controlado;
- OTP correto aceito e OTP incorreto/expirado recusado pelo Supabase;
- reenvio limitado no cliente e rate limits do Supabase Auth revisados; avaliar CAPTCHA antes de ampliar o volume;
- nenhuma credencial exposta no bundle ou logs;
- falha da Meta não confirma telefone e retorna erro recuperável;
- política de privacidade e consentimento atualizados;
- teste Android real do fluxo completo;
- custos e número de produção revisados;
- aprovação e eventuais exigências da análise Meta acompanhadas até a conclusão.

Não use Baileys, sessão por QR Code ou WhatsApp Web como fallback deste fluxo.
