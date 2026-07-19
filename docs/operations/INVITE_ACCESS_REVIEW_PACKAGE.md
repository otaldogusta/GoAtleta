# Pacote de revisão de convites e acessos

## Objetivo

Unificar a criação, o envio, o aceite e a administração de convites sem criar
usuários, matrículas ou permissões implícitas. O fluxo deve informar com clareza
se o convite foi apenas criado, copiado ou realmente enviado.

## Escopos

### Funcionários

- Coordenação: nível 50 e acesso administrativo completo.
- Professor: nível 10 e permissões iniciais explicitamente escolhidas.
- Estagiário: nível 5 e permissões iniciais explicitamente escolhidas.
- O convite é restrito ao e-mail informado.
- As turmas são atribuídas depois do aceite, quando já existe um usuário.

### Alunos

- Um convite de aluno sempre referencia um cadastro de aluno existente.
- O fluxo começa pela seleção do aluno em `Alunos`.
- O aceite vincula a conta autenticada ao registro acadêmico correto.
- Informar apenas um e-mail nunca cria automaticamente aluno, matrícula ou turma.

## Criação e envio

1. A coordenação informa o e-mail e escolhe a função.
2. Para Professor ou Estagiário, escolhe as permissões iniciais.
3. O servidor valida organização, administrador, função, permissões e e-mail.
4. O servidor persiste um convite de uso único, com validade de 14 dias.
5. O link é gerado com o domínio oficial.
6. Quando o canal é e-mail, o servidor solicita o envio ao Resend.
7. A interface diferencia:
   - `Enviado por e-mail`;
   - `Criado, mas não enviado`;
   - `Copiado para compartilhamento manual`.
8. Falha do provedor não apaga nem recria silenciosamente o convite.

## Aceite

1. O usuário abre o link e autentica ou cria a conta.
2. Se o convite possui destinatário, o e-mail autenticado deve coincidir.
3. O servidor valida expiração, revogação, limite e concorrência.
4. O aceite aplica de forma idempotente:
   - perfil de treinador quando aplicável;
   - organização;
   - função;
   - permissões iniciais;
   - consumo do convite.
5. Reabrir um convite aceito pela mesma conta retorna sucesso idempotente.
6. Outra conta recebe erro sem obter acesso.

## Permissões

- As permissões disponíveis usam a lista canônica
  `MEMBER_PERMISSION_OPTIONS`.
- Coordenação recebe o contrato administrativo, sem seleção parcial no convite.
- Professor e Estagiário recebem exatamente as permissões selecionadas.
- Permissões não selecionadas ficam explicitamente negadas.
- Depois do aceite, a coordenação pode alterar função, turmas e permissões pelo
  modal de edição.
- Um convite não altera permissões de membros já existentes.

## Segurança e privacidade

- Código e token são armazenados somente como hash.
- O DTO público nunca retorna hash.
- Somente administrador da organização cria, lista ou revoga convites.
- O destinatário não pode aceitar convite destinado a outro e-mail.
- Segredos do Resend ficam exclusivamente nas Edge Functions.
- Logs não exibem token, link completo, senha ou conteúdo de sessão.
- Nenhum fluxo apaga organização, unidade, turma, aluno, matrícula ou chamada.

## Estados operacionais

- `pending_delivery`: persistido e aguardando tentativa de envio.
- `not_applicable`: convite criado para compartilhamento manual.
- `sent`: aceito pelo provedor de e-mail.
- `delivery_failed`: convite válido, mas envio falhou.
- `claimed`: aceito por uma conta.
- `expired`: prazo encerrado.
- `revoked`: cancelado pela coordenação.

## Interface

- O botão principal usa `Enviar convite por e-mail`.
- O resultado nunca usa “enviado” quando só houve cópia.
- A função Aluno explica o vínculo obrigatório e abre a seleção do cadastro.
- As permissões são uma lista rolável e selecionável.
- O resumo lateral mostra função, quantidade de permissões e estado de envio.
- Modal fecha por botão, clique externo e `Esc`, preservando o padrão do app.

## Testes de aceite

- Professor com subconjunto de permissões.
- Estagiário com subconjunto diferente.
- Coordenação com acesso administrativo.
- Tentativa de aceite com e-mail diferente.
- Aceite repetido pela mesma conta.
- Duas tentativas concorrentes.
- Convite expirado e revogado.
- Resend indisponível, sem perda do link.
- Aluno existente convidado e vinculado ao registro correto.
- Tentativa de convite genérico de aluno sem cadastro.
- RLS e DTOs sem exposição de hash ou segredo.
- Viewports 390x844, 834x1194 e 1440x1024.

## Gate de publicação

1. Aplicar a migration.
2. Confirmar `RESEND_API_KEY` e `INVITE_EMAIL_FROM`.
3. Publicar `create-trainer-invite` e `claim-trainer-invite`.
4. Executar smoke autenticado com uma conta QA.
5. Só então publicar o frontend.
