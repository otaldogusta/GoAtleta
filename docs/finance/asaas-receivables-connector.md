# Conector Asaas de recebimentos

## Escopo desta etapa

O conector pertence à instituição e começa obrigatoriamente em modo de leitura.
Ele valida a conta Asaas, importa clientes, cobranças e assinaturas existentes e
mantém um espelho atualizado por webhook. Ele não cria, altera, cancela ou
reembolsa cobranças no Asaas.

A assinatura que a instituição paga ao GoAtleta continua fora deste fluxo.

## Proteções

- A chave do Asaas é enviada uma única vez para a Edge Function autenticada.
- A credencial é criptografada com AES-GCM antes de ser persistida.
- A chave nunca é devolvida para o aplicativo; a tela recebe somente os quatro
  últimos caracteres.
- As tabelas de credenciais e importação não têm acesso para `anon` ou
  `authenticated` e são operadas somente pelo `service_role` das funções.
- `merchant_accounts.charges_enabled` permanece `false` após conexão e
  sincronização.
- Eventos de webhook são autenticados, deduplicados pelo identificador do
  provedor e auditados sem guardar o payload bruto.

## Preparação do ambiente

1. Aplicar a migration
   `20260901160250_add_asaas_receivables_connector.sql` no ambiente escolhido.
2. Configurar `PAYMENT_PROVIDER_ENCRYPTION_KEY` como segredo da Edge Function.
   `ASAAS_WEBHOOK_URL` e `ASAAS_WEBHOOK_ALERT_EMAIL` são substituições
   opcionais: no ambiente hospedado, o conector deriva o endpoint de
   `SUPABASE_URL` e usa o e-mail da coordenação autenticada.
3. Publicar `finance-provider-connection` com validação de JWT.
4. Publicar `asaas-webhook` sem validação de JWT do Supabase. Esse endpoint usa
   o token secreto enviado no header `asaas-access-token` pelo próprio Asaas.
5. Validar primeiro com uma conta Sandbox pela tela **Configurações
   financeiras**.

Nenhum valor real de segredo deve ser salvo neste repositório.

## Demonstração local

Em builds de desenvolvimento, a tela oferece **Testar com dados fictícios**.
Essa demonstração mantém o estado somente na memória do aplicativo, simula
validação, histórico e atualizações e nunca chama o Asaas ou persiste dados. O
controle não é renderizado em builds de produção.

## Conexão da instituição

Na tela **Financeiro > Configurações financeiras**:

1. Colar uma chave exclusiva criada no Asaas para o GoAtleta.
2. Usar **Validar e conectar**. O servidor identifica automaticamente se a
   chave pertence ao ambiente de teste ou à conta real.
3. Usar **Sincronizar histórico**.
4. Conferir clientes vinculados, ambíguos e não vinculados.
5. Usar **Ativar atualizações** para provisionar o webhook.

Se a chave expirar ou for revogada, use **Gerenciar > Trocar chave**. A nova
chave é validada antes da substituição e precisa pertencer à mesma conta Asaas;
o histórico importado e o webhook permanecem preservados. Para usar outra conta,
remova a conexão atual e conecte a nova conta explicitamente.

A sincronização automática só vincula por e-mail quando existe exatamente uma
relação pagadora candidata. Casos sem correspondência ou com mais de uma
possibilidade ficam separados para revisão.

## Gate para emissão futura

Ativar cobranças reais é outra entrega. Ela exige reconciliação aprovada,
política de migração do sistema anterior, idempotência de criação, tratamento
de falhas e um corte explícito que impeça emissão simultânea por dois sistemas.
Até esse gate, a interface deve continuar mostrando **Conectado em leitura** e
**Emissão de cobranças: bloqueada**.
