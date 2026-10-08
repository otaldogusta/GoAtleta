# Confirmação de telefone pelo WhatsApp

## Estado

O fluxo oficial usa `Supabase Auth -> Send SMS Hook -> Meta WhatsApp Cloud API`.
Ele confirma a propriedade do telefone informado no perfil por meio de
`phone_change`; o telefone não é usado como método primário de login e nenhuma
credencial fica no cliente ou neste repositório.

Resultado mais recente em 07/10/2026: remetente oficial configurado, template
ativo e pagamento confirmado. Após autorização, o diagnóstico do receptor foi
publicado na versão 11 e a Meta confirmou `Successfully subscribed to webhooks`.
O envio das 22:12 BRT chegou ao destinatário controlado; a confirmação no perfil
mostrou `Número verificado`. O estado confirmado também foi observado no
localhost autenticado e no Android instalado. A rejeição de códigos e o limite
de reenvio foram testados localmente com respostas simuladas do Supabase.
O motivo da falha anterior, o recebimento dos eventos no receptor, um novo ciclo
OTP completo no Android e a expiração/rate limit reais continuam pendentes.
Por decisão do usuário, o WhatsApp permanece somente para códigos; o assistente
continua dentro do app, sem ativação de bot ou lembretes neste canal.

Configuração registrada em 25/09/2026 (conferência parcial atual descrita abaixo):

- a confirmação está habilitada na tela de perfil;
- `whatsapp-auth-hook` e `meta-whatsapp-webhook` estão ativos no projeto Supabase;
- todos os nomes de segredo exigidos estão cadastrados no Supabase (valores não inspecionados);
- a revisão Meta de `whatsapp_business_messaging` e `public_profile` estava em andamento naquela data;
- `whatsapp_business_management` não fazia parte daquela solicitação, focada no
  envio de OTP; isso não cobria o onboarding/coexistência do número oficial.

Esse inventário confirma a configuração, mas não substitui um teste de ponta a
ponta com um novo OTP em telefone controlado.

Atualização operacional em 07/10/2026, conferida no painel autenticado da Meta:

- [App Review](https://developers.facebook.com/apps/1067379672746420/app-review/submissions/)
  exibiu `Submission approved`, com `whatsapp_business_messaging` e `public_profile` aprovados;
- a tela de publicação confirmou que todas as configurações obrigatórias estavam completas;
- após autorização explícita do usuário, o app Go Atleta foi publicado na Meta;
  o [painel](https://developers.facebook.com/apps/1067379672746420/go_live/)
  exibiu `Your app was successfully published` e status `Published`;
- não houve deploy do código, alteração de segredos ou envio de OTP nesta conferência.

A aprovação e a publicação Meta foram confirmadas nessa etapa. O teste do
transporte e da confirmação de OTP ocorreu depois, conforme o resultado mais
recente acima; publicação do app isoladamente não comprova esses fluxos.

Conferência operacional adicional em 07/10/2026:

- Supabase `hgmdpetpwclucvquoklv`: `whatsapp-auth-hook` versão 14 e
  `meta-whatsapp-webhook` versão 9 estão `ACTIVE`. A invocação real e a comparação
  de metadados descritas abaixo complementam esse estado; credenciais não foram lidas.
- Conta WhatsApp Business **Go Atleta** (`4782924745327983`): o
  [gerenciador de números](https://business.facebook.com/latest/whatsapp_manager/phone_numbers?business_id=1656570121144658&asset_id=4782924745327983)
  inicialmente não tinha número cadastrado; o cadastro direto posterior está
  descrito abaixo. A lista de modelos exibiu somente `hello_world`.
- **Test WhatsApp Business Account** (`1617341659742255`): número de teste terminado
  em `1659` com estado `Ligado` e qualidade `Elevada`; o template
  `goatleta_phone_verification`, categoria Autenticação, idioma Portuguese (BR),
  aparece `Ativo – Qualidade pendente`. Esses ativos pertencem à conta de teste.
- O usuário escolheu receber o teste no celular já cadastrado no seu perfil. A sessão
  inicial estava sem os dados; depois abriu o perfil profissional correto e informou
  seu telefone pessoal para a tentativa descrita abaixo.

Tentativa real em 07/10/2026, às 13:17:43 BRT:

- o perfil exibiu `Service currently unavailable due to hook`;
- logs de `whatsapp-auth-hook` registraram `A Meta recusou o envio (100)`;
  a função respondeu HTTP 503 e o Supabase Auth registrou `Hook errored out`;
- o caminho executado passou pela verificação da assinatura e pela validação de
  configuração antes da chamada à Meta. O registro atual conserva somente o código
  do provedor; não há detalhe suficiente para atribuir uma causa única ao erro 100;
- comparação dos hashes de metadados, sem ler valores de credenciais, confirmou
  correspondência do remetente de teste, template `goatleta_phone_verification`,
  idioma `pt_BR` e versão `v25.0` com o painel/configuração esperada. A referência
  anterior a `v26.0` neste documento estava desatualizada;
- o telefone escolhido não estava na lista de destinatários de teste. O usuário
  concluiu a confirmação de cinco dígitos na Meta e o painel passou a exibir o
  destinatário selecionado;
- nova tentativa pelo Go Atleta, às 13:28:01 BRT, falhou novamente com Meta 100.
  A inclusão não resolveu o envio; recebimento e confirmação do OTP de seis
  dígitos continuam não validados.

Antes de liberar envio pela conta de produção, cadastrar/verificar um remetente
escolhido pelo usuário e configurar o template de autenticação nessa mesma conta.
O telefone destinatário do teste não deve ser tratado automaticamente como remetente.

O usuário confirmou em 07/10 que o número reservado para o Go Atleta, terminado
em `8130`, já está em uso no aplicativo WhatsApp Business. A intenção é usá-lo
como remetente dos códigos e canal de atendimento/assistente. Na conferência, ele
aparecia somente como destinatário de teste, não como remetente da Cloud API.
Para manter o aplicativo móvel junto da API, o caminho a avaliar é a
[coexistência oficial da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
O usuário confirmou depois que o número pode ficar dedicado ao sistema Go Atleta,
dispensando o uso simultâneo no aplicativo. Essa escolha não autoriza descartar
histórico/backups sem confirmação específica do impacto.
O Embedded Signup Builder exibiu `WhatsApp Business App Onboarding`, versão v4.
Depois da tentativa inicial sem avanço no navegador, o usuário abriu o popup e
recebeu o erro `2655111`: o app parceiro não tinha as permissões avançadas de
mensagens/gestão necessárias à integração. A conferência do painel mostrou
`whatsapp_business_messaging` aprovada na revisão anterior e
`whatsapp_business_management` em `Ready for testing`, com zero chamadas.

Foi adicionado `whatsapp_business_management` ao rascunho de revisão
`1081314961352891`, confirmado em `Not submitted`. O formulário exige justificativa,
gravação de tela do fluxo completo, teste da API (indicador `0 of 1 API call(s)
required`) e revisão das declarações de uso/tratamento de dados. A descrição
pré-preenchida deve ser reconciliada com a implementação antes do envio; não houve
novo envio à Meta nem declaração de conformidade marcada. A conexão do número
segue pendente. Esse erro de onboarding não comprova a causa do erro 100 no OTP.

Reavaliação do caminho em 07/10: a [documentação oficial de permissões](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions)
dispensa App Review e acesso avançado para desenvolvedores diretos que acessam
somente os dados da própria empresa. Portanto, a revisão adicional não é um
requisito universal para o número do próprio Go Atleta: o bloqueio observado é
do fluxo de parceiro/Embedded Signup escolhido. O usuário escolheu integração
direta com número dedicado à API; a dispensa de revisão não comprova elegibilidade,
entrega de OTP ou bot pronto. O rascunho adicional permanece não enviado.

Cadastro direto realizado na conta Go Atleta em 07/10:

- a Meta confirmou `O teu número de telemóvel foi adicionado` e a lista, após
  atualização, exibiu o número reservado terminado em `8130`;
- Phone Number ID `1311109835426845`; nome `Go Atleta` em revisão e número
  `Não verificado`. Categoria `Serviços profissionais`, descrição da plataforma
  de gestão esportiva. Não houve alteração de credenciais nem do remetente no hook;
- a tentativa de verificação por SMS abriu o formulário de seis dígitos, mas
  exibiu erro `2655122`: número ainda registrado em uma conta WhatsApp; é preciso
  migrar/desassociar antes de tentar novamente. O formulário menciona até três
  minutos para a atualização após liberar o vínculo. Não há entrega de SMS comprovada;
- a [documentação de números](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers)
  e a [central de ajuda](https://faq.whatsapp.com/2138577903196467/) descrevem a
  liberação pela exclusão da conta móvel. Como isso apaga histórico/backups e remove
  a participação nos grupos, foi pedida confirmação específica sobre os dados.
  O usuário informou depois que apagou a conta no aplicativo. Na retomada em
  07/10, às 21:25 BRT, a nova solicitação ainda exibiu `2655122`. Após a janela
  informada pela Meta, a tentativa às 21:28 BRT exibiu `Código enviado com sucesso`
  e o formulário de seis dígitos sem o erro de vínculo. O usuário recebeu e
  forneceu o código; após submissão às 21:29 BRT, o formulário e a exigência de
  verificação desapareceram, e o número passou de `Não verificado` para
  `Pendente`. O nome permanece `Em revisão`. A confirmação de propriedade não
  comprova registro para envio nem o OTP do perfil Go Atleta.
- criado o template `goatleta_phone_verification` na conta oficial
  `4782924745327983`, categoria Autenticação, idioma `pt_BR`, botão `Copiar código`,
  recomendação de segurança, expiração e prazo de entrega de cinco minutos.
  Após o envio, a lista exibiu `Ativo – Qualidade pendente`, ID `1435383401850451`.
  O seletor do Manager confirmou o ID `4782924745327983`; recebimento de OTP pelo
  app continua pendente.
- em `Step 2. Production setup > Register your WhatsApp phone number`, o mesmo
  Phone Number ID `1311109835426845` apareceu como `Not registered`. `Register`
  abriu `Enter your PIN`, que pede um novo PIN de seis dígitos para futuros
  registros. A tela foi entregue ao usuário para definir e submeter essa
  credencial diretamente, sem registrá-la no chat ou nos documentos. Após a
  ação do usuário, o painel confirmou `Registered` / `Phone number registered
  successfully`. O Manager atualizado mostrou `Ligado`, com nome ainda `Em revisão`.
- Production setup ainda pede `Add payment method` para mensagens iniciadas pela
  empresa, incluindo autenticação. O callback já aponta para
  `https://hgmdpetpwclucvquoklv.supabase.co/functions/v1/meta-whatsapp-webhook`,
  com o campo `messages` assinado em `v26.0`; o switch de assinatura da conta
  (`Subscribe webhooks`) está desligado. Não houve cadastro de pagamento,
  ativação desse switch ou alteração dos segredos de produção nesta conferência.
- há uma divergência de identificação a reconciliar antes de ativar o transporte:
  o seletor do Manager mostra a conta `4782924745327983`, enquanto Production
  setup exibe `WhatsApp Business account ID: 1933520117630293` para o mesmo número
  e Phone Number ID. Não inferir vínculo de token/template a partir do nome;
  conferir a associação efetiva dos ativos antes de alterar a configuração do hook.
  Em Business Settings, a conta `4782924745327983` foi confirmada como propriedade
  do Go Atleta, com negócio `Verificado`, conta `Aprovada` e o número terminado em
  `8130` listado em `Phone numbers` como `Ligado`. Isso confirma a associação no
  Manager, mas não explica o identificador diferente no painel do desenvolvedor.
- o usuário concluiu o cadastro de pagamento. A conferência no Billing Hub da
  conta `4782924745327983` confirmou método padrão, moeda BRL e saldo zero, sem
  registrar dados do cartão neste documento. Na conferência final, Production
  setup também mostrou a etapa de pagamento concluída em verde. O botão interno
  `Add payment method` continua disponível; não indica ausência de pagamento.
- após autorização explícita do usuário, somente `META_WHATSAPP_PHONE_NUMBER_ID`
  foi alterado do remetente de teste para `1311109835426845`, com comparação de
  hashes antes/depois. Token, template `goatleta_phone_verification`, idioma
  `pt_BR` e Graph `v25.0` permaneceram iguais; nenhuma Edge foi publicada nessa etapa.
  A mudança afeta as próximas confirmações de telefone. Supabase Auth continua
  responsável pela geração e validação do OTP.
- o teste autorizado pelo perfil do Go Atleta retornou `Código enviado pelo
  WhatsApp`; `whatsapp-auth-hook` respondeu HTTP 200 em 07/10 às 22:01:42 BRT
  (`2026-10-08T01:01:42.364Z`). O adaptador exige um ID de mensagem da Meta para
  sucesso, portanto há evidência de aceitação do envio. O usuário informou que
  não recebeu nessa tentativa; a repetição posterior está registrada abaixo.
- o receptor remoto `meta-whatsapp-webhook` v10 apenas confirmava eventos,
  sem registrar resultados de entrega. `Subscribe webhooks` estava desligado.
  Foi preparado diagnóstico com apenas status permitido
  (`sent`, `delivered`, `read`, `failed`) e códigos numéricos de erro, após HMAC
  válido. Não registra IDs, destinatário, corpo, OTP ou descrição de erro.
  Oito testes Deno passaram, cobrindo assinatura, filtragem de dados, payload
  opcional malformado e falha do registrador; `deno check --no-lock` também
  aprovou o entrypoint. Checklist regenerado e `git diff --check` aprovado.
  Validação focada no receptor Edge, sem build/QA do app: `tsconfig.app.json`
  exclui `supabase/**` e nenhuma interface foi alterada.
- após nova autorização explícita, somente `meta-whatsapp-webhook` foi publicado
  no projeto `hgmdpetpwclucvquoklv`, versão 11 `ACTIVE`, às 22:12 BRT. O GET remoto
  de código confirmou correspondência integral com os dois arquivos locais.
  `verify_jwt=false` foi preservado porque o receptor autentica por HMAC;
  nenhuma configuração de segredo foi alterada nessa publicação. Não houve
  commit/push nessa etapa: base Git `2fe4c659` mais o patch local validado.
- no cartão do número oficial, `Subscribe webhooks` passou a ligado e a Meta
  exibiu `Successfully subscribed to webhooks`. O cartão mantém o WABA
  `1933520117630293`, diferente do Manager; a divergência segue registrada.
- o novo envio pelo perfil teve HTTP 200 às 22:12:38 BRT
  (`2026-10-08T01:12:38.081Z`). O usuário recebeu o código e o informou para
  confirmação; o Go Atleta aceitou e exibiu `Número verificado`. O valor do OTP
  não foi guardado neste documento. A consulta de logs feita após esse teste
  ainda não mostrou `whatsapp_delivery_status` nem invocação do receptor.
  Assim, o caminho feliz está comprovado pelo destinatário e pelo perfil, mas
  a entrega de eventos ao diagnóstico e a causa da primeira falha não estão.

### Validação de fechamento em 07/10/2026

- Branch de versionamento: `codex/whatsapp-delivery-validation`, criada a partir
  de `2fe4c659`. Nenhuma mudança no fluxo de autenticação ou nova publicação
  remota foi necessária nesta etapa; foram adicionados testes do contrato existente.
- 23 testes Jest focados passaram (quatro suítes): AuthProvider, funções de
  confirmação/contagem de reenvio, provedor de OTP e recepção Meta. Os novos
  testes exercitam o AuthProvider real com transporte/storage simulados:
  erro de código, expiração, HTTP 429, código incompleto, envio sem confirmação,
  divergência entre telefone solicitado e retornado e persistência somente após
  confirmação pelo servidor. Nenhuma chamada desses testes chega à produção.
- A validação completa `npm run build:verified` passou em 225 segundos, sem
  reutilização de resultados: 560 suítes Jest / 3.147 testes, sete suítes SQL
  locais, tipos, lint, verificações do projeto e exportação web. Os logs ficam
  em `.tmp/validation/`. Esse resultado não substitui os testes operacionais
  pendentes e não representa uma nova publicação em produção.
- A contagem local mantém o segundo final antes dos 60 segundos e considera o
  tempo decorrido em segundo plano. A tela existente guarda o clique durante
  envio/contagem. O teste de HTTP 429 verifica a resposta do cliente, não impõe
  nem certifica o limite remoto do Supabase Auth.
- Oito testes Deno do webhook e `deno check --no-lock` do entrypoint passaram.
  Assinatura inválida não emite diagnóstico; IDs, destinatários e conteúdo ficam
  fora dos registros; falha no registrador não transforma evento válido em retry.
- Smoke autenticado em `http://localhost:8081/prof/profile`: após uma falha
  transitória de conexão no primeiro carregamento, `Tentar novamente` recuperou
  a sessão. O modal abriu com `Número verificado`; nenhuma alteração foi salva.
- Android físico autorizado: variante `com.otaldogusta.goatleta.perf`,
  `1.0.3-perf`/versionCode 3. Lançamento frio em 460 ms, perfil autenticado e
  `Número verificado` observados, sem `FATAL EXCEPTION` no processo inspecionado.
  Não houve instalação, troca de canal, exclusão de dados ou novo envio de OTP.
  Isso não comprova novo desafio completo no Android nem o runtime OTA aplicado.
- Capturas locais privadas em `.tmp/whatsapp-validation/`, ignoradas no Git.
  A confirmação existente foi preservada. Os negativos em produção exigem um
  desafio controlado separado; não foram substituídos por uma remoção do telefone.
- Foto oficial (`assets/images/icon.png`) e site `https://goatleta.com/` foram
  salvos no perfil comercial pela Meta com autorização anterior. O nome continua
  em revisão. A consulta até 22:55 BRT não encontrou eventos do receptor, mesmo
  após a entrega real do código; não concluir que o diagnóstico remoto está validado.

A coexistência requer conclusão do onboarding no servidor e processamento dos
eventos correspondentes. O receptor atual verifica a assinatura, valida o objeto,
registra somente o diagnóstico permitido e responde `received: true`; não persiste conversas, sincroniza histórico, invoca
o assistente ou envia respostas. Portanto, o bot ainda não está implementado nesse
canal, mesmo com a aprovação/publicação do app Meta. Preparar esses contratos antes
de concluir a conexão; credenciais e ativação remotas continuam dependentes de
autorização explícita e validação operacional.

As páginas públicas exigidas pela Meta ficam em `/privacy`, `/terms` e
`/data-deletion`. A recepção de eventos usa `meta-whatsapp-webhook`, separada
do hook de envio de OTP.

O retorno web do Embedded Signup usa `/whatsapp-settings`. A tela reconhece sucesso,
cancelamento ou erro e remove os parâmetros da URL para não manter códigos no histórico.
Ela não troca o código no cliente: a conclusão da conexão deve ocorrer em um endpoint
servidor autenticado, com validação de `state`, quando a configuração do Embedded
Signup e as credenciais definitivas estiverem disponíveis. A aprovação do App Review
não comprova essa conclusão.

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
META_WHATSAPP_GRAPH_API_VERSION=v25.0
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
- aprovação e publicação Meta confirmadas em 07/10/2026; acompanhar novas exigências do painel.

Não use Baileys, sessão por QR Code ou WhatsApp Web como fallback deste fluxo.
