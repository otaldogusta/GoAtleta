# Responsável sem convite — ciclo local de 25/10/2026

Smoke real autorizado, sem publicação, no frontend isolado de 8082 com
Supabase local (`127.0.0.1:54321`) e Mailpit (`localhost:54324`). A conta
`guardian-mvogxisf@example.test` foi criada pela interface, sem convite e sem
pré-criação por admin. Reutilizou-se a instituição fictícia e a atleta do
[ciclo anterior](entry-no-invite-local-2026-10-25.md).

## Etapas observadas

1. Cadastro com senha e confirmação, sem preencher convite.
2. OTP recebido no Mailpit e confirmado pela interface.
3. Área pessoal ainda sem vínculo; seleção de `Sou responsável`, nome da atleta
   `Marina QA Sem Convite`, parentesco `Mãe` e instituição de teste.
4. Solicitação enviada e exibida como responsável aguardando aprovação.
5. Coordenação em sessão separada: conferência da sugestão pelo nome e do
   parentesco, seleção explícita do cadastro existente e aprovação.
6. Saída automática da espera para identificação do responsável; após continuar,
   entrada em `/family/home` com atleta, instituição, turma e parentesco.
7. Agenda, financeiro restrito e perfil familiar conferidos. Logout e novo login
   retornaram ao perfil com o mesmo vínculo ativo.

## Evidência de autorização local

- Antes da aprovação: solicitação `pending`, tipo `guardian` e zero relações da
  conta solicitante. Tentativa direta de autoaprovação foi negada pelo RPC e não
  alterou o pedido.
- Depois: pedido `approved`, relação `guardian` ativa com a atleta selecionada,
  label `Mãe` e verificação híbrida de e-mail presente.
- Zero registros de equipe em `organization_members` ou `trainers` para a conta.
  O `students.student_user_id` da atleta permaneceu com sua conta própria anterior.
- Financeiro, pagamento, saúde e consentimentos continuaram desabilitados.
  A interface mostrou `Financeiro restrito` sem apresentar mensalidades.
- A projeção real `get_my_family_overview_v1` entregou o vínculo ao responsável;
  não entregou esse vínculo ao anônimo nem à conta de outra instituição local.

## Artefatos e limites

20 screenshots reais em `.tmp/guardian-cycle/review/`, galeria em
`http://127.0.0.1:8085/`, manifest com hashes e recibos sanitizados
`before-approval.json` / `final-state.json`. Credenciais fora da pasta servida.
As capturas foram inspecionadas. Não foram necessárias alterações no código do
produto nesta etapa; validação por UI e RPCs locais, sem reexecutar gates amplos.

Ao retomar a aba antiga, houve erro de inicialização; `Tentar novamente` recuperou
a sessão anterior e permitiu logout antes do novo cadastro. A causa desse estado
inicial não foi determinada; o êxito do ciclo não comprova sua correção.

O Auth local tem autoconfirmação nativa, mas a entrada exigiu o OTP para a
verificação híbrida do produto. Mailpit usa template padrão local, sem evidência
de entrega ou template em produção. Agenda da fixture estava sem atividades
publicadas. Não houve criação de convite, commit, push, deploy, migration remota
ou mutação de produção.
