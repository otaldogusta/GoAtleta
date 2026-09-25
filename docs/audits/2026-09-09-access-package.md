# Pacote de acesso institucional e gestão SaaS

## Objetivo

Separar criação de conta, vínculo institucional e liberação comercial. Uma conta
confirmada pode procurar uma instituição e enviar uma solicitação. A coordenação
aprova o vínculo da própria organização; um administrador da plataforma enxerga
e audita a fila global.

## Jornada canônica

1. A pessoa cria e confirma a conta.
2. Em `/pending`, procura uma instituição pelo nome.
3. Envia uma solicitação idempotente para o produto Go Atleta.
4. A tela passa a exibir instituição, produto e status da solicitação.
5. A coordenação recebe a solicitação em `Coordenação > Gestão` e pode aprovar ou
   recusar.
6. A aprovação cria/atualiza o membro da organização e notifica o solicitante.
7. O administrador da plataforma acompanha todas as solicitações em
   `/platform/accesses`, incluindo produto e estado de pagamento.

Convites continuam disponíveis como atalho para fluxos em que a instituição
inicia o vínculo, mas deixam de ser a única saída do estado pendente.

## Notificações transacionais do vínculo

Toda mudança confirmada do vínculo ou do plano deve gerar uma notificação no
aplicativo e, quando existir um dispositivo habilitado, um push. O push abre a
tela relacionada e nunca é a única fonte do histórico.

| Evento confirmado | Destinatário | Título canônico | Próximo passo |
| --- | --- | --- | --- |
| Solicitação enviada | Coordenação da instituição | `Nova solicitação de plano` | Abrir a solicitação |
| Plano aprovado | Solicitante | `Plano aprovado` | Abrir o plano |
| Solicitação recusada | Solicitante | `Solicitação não aprovada` | Ver motivo ou escolher outro plano |
| Cancelamento solicitado | Coordenação da instituição | `Pedido de cancelamento` | Revisar o pedido |
| Cancelamento aceito | Solicitante | `Plano cancelado` | Ver encerramento e termos aplicados |
| Cancelamento recusado | Solicitante | `Cancelamento não aprovado` | Ver motivo e falar com a instituição |
| Vencimento próximo | Solicitante | `Pagamento próximo do vencimento` | Consultar instruções da instituição |
| Pagamento vencido | Solicitante | `Pagamento vencido` | Falar com a instituição |
| Vínculo suspenso manualmente | Solicitante | `Acesso limitado pela instituição` | Ver motivo e contato |
| Vínculo encerrado | Solicitante | `Vínculo encerrado` | Escolher outra instituição ou plano |

Uma mesma transação não pode gerar mensagens redundantes como `Plano cancelado`
e `Desligamento do time` quando ambos representam o mesmo resultado. Eventos
distintos podem gerar notificações separadas somente quando possuírem recibos,
motivos e efeitos diferentes. Mensagens não usam tom ameaçador, não prometem
cobrança automática e não expõem dados financeiros sensíveis na tela bloqueada.

## Estados

- Acesso: `pending`, `approved`, `rejected`.
- Produto: `goatleta`, `goatleta_pro`.
- Pagamento: `not_started`, `pending`, `paid`, `overdue`.
- A solicitação pendente é única por pessoa e organização.
- Revisões exigem chave de idempotência e produzem recibo transacional.

## Segurança

- A busca institucional retorna somente `id` e `name`.
- O solicitante lê somente as próprias solicitações.
- A coordenação continua limitada por `organization_id` e `is_org_admin`.
- A fila global e sua revisão exigem `platform_admins` ou a claim protegida
  `app_metadata.platform_admin`.
- Tabelas internas permanecem sem acesso direto de `anon`/`authenticated`;
  operações são expostas apenas por RPCs com verificação explícita.
- A criação de instituições permanece exclusiva de serviço administrativo.

## Operação local e publicação

- Em desenvolvimento, o painel usa dados demonstrativos se a migração ainda não
  estiver aplicada, deixando essa condição visível na interface.
- Em produção, falha de autorização sempre mostra `Acesso restrito`.
- Antes de publicar: aplicar a migração, cadastrar o primeiro administrador de
  plataforma por processo com `service_role`, implantar a Edge Function
  `request-access-review` e executar smoke autenticado dos dois papéis.
- Pagamentos continuam como estado de coordenação; este pacote não habilita
  cobrança real.

## Decisão financeira validada com a operação

O Go Atleta deve representar duas relações financeiras independentes:

1. **Atleta → instituição:** mensalidade, matrícula ou taxa cobrada pela escola.
   A instituição combina e recebe o pagamento fora do Go Atleta enquanto a
   cobrança real permanecer desabilitada.
2. **Instituição → Go Atleta:** assinatura SaaS contratada pela instituição. Esse
   estado pertence exclusivamente ao painel do administrador da plataforma.

O vencimento de uma cobrança do atleta é informativo. Ele não remove o vínculo,
não oculta o plano e não suspende o acesso automaticamente. A suspensão exige
uma ação explícita e auditável da instituição. A interface não pode sugerir que
o aplicativo fará débito, Pix, cobrança automática ou bloqueio quando isso não
for verdade.

### Mensagens canônicas para o atleta

- Antes do vencimento: `Pagamento pendente — vencimento em DD/MM. Consulte a instituição para receber as formas de pagamento.`
- Depois do vencimento: `Pagamento vencido — entre em contato com a instituição para regularizar.`
- Não usar ameaça de bloqueio automático.
- Não mostrar botão de pagamento sem URL confiável criada no servidor.

## Matriz de responsabilidades

| Ação | Atleta | Coordenação da instituição | Administrador SaaS |
| --- | --- | --- | --- |
| Criar conta | Sim | Sim | Não |
| Procurar instituição | Sim | Não | Consulta global |
| Solicitar vínculo | Sim | Não | Acompanha |
| Receber push do pedido | Não | Sim | Opcional |
| Aprovar ou recusar vínculo | Não | Somente da própria instituição | Pode atuar globalmente |
| Informar vencimento do atleta | Consulta | Cria e atualiza | Não altera |
| Marcar pagamento do atleta | Não | Manualmente | Não altera |
| Suspender acesso do atleta | Não | Manual e auditável | Suporte excepcional |
| Contratar/pagar o Go Atleta | Não | Responsável da instituição | Acompanha assinatura |
| Liberar instituição no SaaS | Não | Não | Sim |

## Checklist consolidado

### 1. Conta, onboarding e vínculo

- [x] Remover a criação de instituição como consequência automática do cadastro.
- [x] Encaminhar conta confirmada sem vínculo para `/pending`.
- [x] Permitir busca de instituições pelo nome com retorno público mínimo.
- [x] Permitir solicitação direta de vínculo sem exigir convite.
- [x] Manter convite/código como atalho opcional iniciado pela instituição.
- [x] Exibir a instituição e o estado da solicitação para o usuário.
- [x] Garantir uma solicitação pendente por usuário e instituição.
- [ ] Aplicar as migrations do pacote no ambiente alvo.
- [ ] Executar smoke real com uma nova conta e a instituição Rede Esportes Pinhais.

### 2. Coordenação da instituição

- [x] Registrar a solicitação na fila da organização correta.
- [x] Criar notificação interna idempotente para a coordenação.
- [x] Enviar push Expo aos dispositivos cadastrados dos coordenadores.
- [x] Abrir a solicitação em `Coordenação > Gestão`.
- [x] Manter aprovação limitada por `organization_id` e papel administrativo.
- [x] Aprovar ou recusar com recibo transacional e chave de idempotência.
- [x] Criar/atualizar o membro da organização após aprovação.
- [x] Notificar internamente o solicitante sobre a decisão.
- [ ] Confirmar em dispositivo físico que o push abre a solicitação correta.
- [ ] Confirmar se a notificação da decisão também chega como push ao atleta;
      atualmente a migration garante a notificação interna.
- [ ] Enviar push idempotente ao atleta após aprovação ou recusa, abrindo o
      plano ou o motivo da decisão.
- [ ] Definir e implementar suspensão manual separada da situação financeira.

### 2.1 Cancelamento e comunicação

- [ ] Permitir ao atleta solicitar o cancelamento do plano sem encerrar o vínculo
      antes da decisão da coordenação.
- [ ] Notificar a coordenação sobre o pedido, com acesso direto à revisão.
- [ ] Aprovar ou recusar o cancelamento com recibo transacional e motivo.
- [ ] Notificar o atleta sobre a decisão no inbox e por push idempotente.
- [ ] Encerrar o vínculo somente quando essa for uma ação explícita e separada.
- [ ] Deduplicar `plano cancelado` e `vínculo encerrado` quando vierem da mesma
      operação administrativa.
- [ ] Preservar no histórico instituição, plano, datas, ator e motivo da mudança.

### 3. Financeiro do atleta, apenas informativo

- [x] Manter `REAL_MONEY_PAYMENTS_ENABLED=false`.
- [x] Não integrar débito automático, cartão, Pix, boleto ou webhook neste pacote.
- [x] Já existem estados financeiros de base: aberto/pendente, pago e vencido.
- [x] Remover qualquer associação automática entre aprovação de acesso e
      `payment_status=pending`; aprovação e cobrança são domínios separados.
- [ ] Definir quem cria a cobrança, valor, vencimento, competência e observação.
- [ ] Mostrar aviso de vencimento no aplicativo do atleta com a mensagem canônica.
- [ ] Alterar automaticamente apenas o status financeiro para `vencido` após a
      data, sem mudar acesso, vínculo ou disponibilidade do plano.
- [ ] Permitir à coordenação marcar manualmente `Pago`, `Isento` ou `Cancelado`.
- [ ] Exibir instrução de pagamento informada pela instituição, sem prometer
      processamento dentro do Go Atleta.
- [ ] Testar que cobrança vencida não bloqueia o usuário nem remove seu plano.
- [ ] Testar que somente uma suspensão explícita altera o acesso.

### 4. Administração SaaS do Go Atleta

- [x] Criar rota protegida `/platform/accesses`.
- [x] Criar navegação SaaS separada da coordenação, com `Painel` e `Acessos`.
- [x] Listar solicitações globais com usuário, instituição, produto e status.
- [x] Permitir busca, filtros, seleção, aprovação e recusa.
- [x] Restringir fila e revisão a `platform_admins` ou claim confiável.
- [x] Preservar o shell, sidebar animada e componentes responsivos do Go Atleta.
- [x] Criar mockup e aprovar a nova tela `/platform` antes da implementação.
- [x] Na tela `/platform`, listar instituições, responsáveis, produto contratado,
      período de avaliação, assinatura SaaS e situação comercial.
- [x] Separar visualmente `assinatura da instituição` de `mensalidade do atleta`.
- [ ] Criar ação administrativa segura para liberar, pausar ou encerrar uma
      instituição, com motivo e histórico.
- [ ] Cadastrar o primeiro administrador SaaS por processo com `service_role`.
- [ ] Remover dados demonstrativos depois da ativação e validar dados reais.

### 5. Dados, segurança e auditoria

- [x] Busca institucional expõe somente `id` e `name`.
- [x] Usuário lê apenas as próprias solicitações.
- [x] Coordenação permanece limitada à própria organização.
- [x] Administração global exige autorização explícita no servidor.
- [x] Revisões são idempotentes e bloqueiam dupla decisão.
- [x] Criação de organizações foi restringida à administração da plataforma.
- [x] Revisar grants das novas funções; a aplicação no banco remoto aguarda autorização.
- [ ] Validar RLS e RPCs com contas reais de atleta, coordenador e administrador SaaS.
- [x] Criar auditoria específica para mudanças do ciclo SaaS da instituição.
- [ ] Definir retenção e mascaramento de e-mail, telefone e dados comerciais.

### 6. Qualidade e publicação

- [x] Testes focados da API de solicitações passaram localmente.
- [x] Testes da sidebar animada passaram localmente.
- [x] `npm run typecheck:app` passou.
- [x] `npm run check:org-scope` passou.
- [x] `npm run check:edge-jwt` passou.
- [x] Build web passou.
- [x] QA visual executado em desktop, tablet e mobile.
- [ ] Iniciar Supabase local/Docker e executar `supabase db lint --local`.
- [ ] Aplicar `20260909115540_restrict_organization_creation_to_platform_admin.sql`.
- [ ] Aplicar `20260909154929_platform_access_management.sql`.
- [ ] Aplicar `20260910024838_platform_institution_lifecycle.sql`.
- [ ] Implantar `request-access-review`.
- [ ] Executar smoke autenticado ponta a ponta nos três papéis.
- [ ] Confirmar entrega e abertura dos pushes em Android/iOS reais.
- [ ] Reexecutar baseline completo após as regras financeiras informativas.
- [ ] Criar preview Vercel para homologação, se autorizado.
- [ ] Publicar em produção somente após autorização explícita.

## Ordem recomendada para concluir

1. Corrigir a separação entre aprovação e `payment_status`.
2. Implementar cobrança informativa e suspensão manual auditável.
3. Criar e aprovar o mockup do `Painel` SaaS de instituições.
4. Aplicar migrations e Edge Function em ambiente controlado.
5. Cadastrar o administrador SaaS e executar smoke real.
6. Validar push em dispositivos físicos.
7. Homologar por preview e, somente depois, preparar produção.

## Definition of Done

O pacote estará concluído quando uma conta nova puder solicitar a Rede Esportes
Pinhais, a coordenação receber e abrir o push, aprovar o vínculo, o atleta entrar
no plano e receber avisos financeiros informativos sem bloqueio automático; ao
mesmo tempo, o administrador SaaS deverá enxergar e controlar separadamente o
acesso e a assinatura comercial da instituição, com RLS, auditoria, testes e
smoke autenticado comprovados.
