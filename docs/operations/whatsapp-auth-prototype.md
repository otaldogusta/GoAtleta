# Protótipo de confirmação de telefone pelo WhatsApp

## Estado

Este pacote prepara o transporte oficial `Supabase Auth -> Send SMS Hook -> Meta WhatsApp Cloud API`.
Ele não habilita autenticação por telefone, não altera produção e não contém credenciais.
O perfil continua com `phoneVerificationEnabled = false` até o teste oficial completo passar.

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

## Configuração do teste oficial

1. No painel Meta for Developers, adicione o produto WhatsApp e use o número de teste fornecido pela Meta.
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
5. Faça deploy somente da função `whatsapp-auth-hook` em um ambiente de teste.
6. Em Authentication > Hooks, selecione `Send SMS` e informe o endpoint HTTPS da função. Copie o segredo gerado para `SEND_SMS_HOOK_SECRET`.
7. Habilite Phone Auth no ambiente de teste com confirmação automática desligada.

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

## Portões antes de habilitar no produto

- template aprovado e envio recebido em um telefone controlado;
- OTP correto aceito e OTP incorreto/expirado recusado pelo Supabase;
- reenvio limitado, CAPTCHA e rate limits revisados;
- nenhuma credencial exposta no bundle ou logs;
- falha da Meta não confirma telefone e retorna erro recuperável;
- política de privacidade e consentimento atualizados;
- teste Android real do fluxo completo;
- decisão explícita sobre custo e número de produção.

Não use Baileys, sessão por QR Code ou WhatsApp Web como fallback deste fluxo.
