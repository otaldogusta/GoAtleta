# Atletas, equipe e famílias

Leitura do código em 05/10/2026, base `d5120cff`. Descreve implementação local;
evidência de publicação em documentos antigos não foi revalidada neste trabalho.

## Responsabilidades e entradas

Manter o cadastro institucional do atleta, matrícula, perfil e acesso de login;
apresentar perfis da equipe; administrar convites e relações familiares com capacidades
explícitas. Leia ao alterar cadastro/importação, ficha da pessoa, vínculos ou troca de filho.

| Arquivo principal | Responsabilidade atual |
| --- | --- |
| [students/index.tsx](../../../app/students/index.tsx), [screens/students](../../../src/screens/students/) | Lista, cadastro, edição, importação e ações operacionais. |
| [db/students.ts](../../../src/db/students.ts) | Persistência, projeções, matrícula, cache escopado e status operacional. |
| [StudentProfilePage.tsx](../../../src/screens/students/StudentProfilePage.tsx), [StaffProfilePage.tsx](../../../src/screens/coordination/StaffProfilePage.tsx) | Perfis de atleta/equipe compostos sobre [PersonProfilePage](../../../src/screens/profiles/PersonProfilePage.tsx). |
| [student-list-status.ts](../../../src/screens/students/application/student-list-status.ts), [student-login-access.ts](../../../src/screens/students/application/student-login-access.ts) | Estado do cadastro e indicador de acesso de login independentes. |
| [student-invite.ts](../../../src/api/student-invite.ts), [trainer-invite.ts](../../../src/api/trainer-invite.ts) | Transporte dos convites legados de atleta e equipe. |
| [student-relationship-invite.ts](../../../src/api/student-relationship-invite.ts) | Convites, recibos, relações, permissões, revogação e resumo familiar por atleta. |
| [family-access-request.ts](../../../src/api/family-access-request.ts), [family-invite](../../../app/family-invite/) | Solicitação familiar e consumo explícito de convite. |
| [family-access.ts](../../../src/api/family-access.ts), [useFamilyOverview.ts](../../../src/screens/family/useFamilyOverview.ts) | Projeções autorizadas, seleção por relação e descarte de respostas antigas. |
| [screens/family](../../../src/screens/family/), [student/profile.tsx](../../../app/student/profile.tsx) | Início, agenda, pagamentos e perfil do contexto selecionado; perfil próprio do atleta. |
| [student-photo-storage.ts](../../../src/api/student-photo-storage.ts), [student-self-photo.ts](../../../src/api/student-self-photo.ts) | Armazenamento/foto e RPC `set_my_student_photo`. |

## Contratos a preservar

- Cadastro ativo/inativo, matrícula, vínculo de login e condição financeira são
  dimensões diferentes. Não deduzir acesso pela presença de telefone ou e-mail na ficha.
- A gestão operacional usa inativação. Não reintroduzir exclusão permanente em
  Gestão/turma nem apagar atletas ao remover uma turma com vínculos.
- Dados financeiros são hidratados pela projeção autorizada; o cache geral guarda
  atletas sem esse estado sensível. Ausência de permissão não deve quebrar o cadastro.
- Tipos `athlete`, `guardian`, `payer`, `viewer` têm capacidades explícitas.
  [relationship-presets.ts](../../../src/family/application/relationship-presets.ts) mantém saúde/consentimento
  desabilitados e exige leitura financeira quando `canPay` estiver ativo.
- Um vínculo familiar não adiciona cargo em `organization_members`; o vínculo do
  próprio atleta mantém a compatibilidade com `students.student_user_id`.
- Convites têm criação, validação e consumo separados. Preservar destinatário,
  expiração, revogação, idempotência e recibo; não transferir automaticamente outra conta.
- Preferência de filho/papel não cria permissão. A visão familiar deriva de
  `get_my_student_contexts_v1`, `get_my_family_overview_v1` e `get_my_family_finance_v1`.
- O hook de resumo familiar associa resultado a `relationshipId` e geração da requisição;
  trocar de filho não pode exibir o resultado atrasado do contexto anterior.

## Decisões atuais e limites

- O perfil compartilhado é composição visual; autorização permanece nas APIs/RPCs e
  capacidades de cada consumidor. A aba financeira do atleta exige `canViewFinance`.
- Reconciliação automática é restrita à identidade verificada e recarrega sob RLS;
  ver [acesso e organizações](acesso-organizacoes.md).
- A fundação familiar distingue RPC ausente de falhas de acesso/transporte.
  Não transformar indisponibilidade em uma lista vazia que pareça autorizada.
- Fotos, importação e exportação precisam preservar organização, privacidade e o
  vínculo existente. Não tratar a importação como autorização de acesso ao aplicativo.

## Documentação existente e precedência

- [Pacote familiar](../../operations/family-access-package.md): desenho implementado,
  fixtures e evidências de setembro; lista também gates pendentes e tentativas antigas.
  Suas frases de autorização/publicação não autorizam executar ações agora.
- [Reconciliação do atleta](../../qa/student-access-reconciliation.md): contrato e
  validações registradas; contagens, versão de Edge e produção são histórico datado.
- [Contato de segurança](../../operations/security-contact-verification.md): separa
  e-mail alternativo confirmado do login/recuperação; evidência remota é datada.
- [Mockup de equipe](../../ui/mockups/equipe-profile.md): referência de design;
  implementação atual é `StaffProfilePage`/`PersonProfilePage`, não o HTML do mockup.

## Validação relevante

Nesta organização documental: inspeção estática, sem executar testes do app ou SQL.

- [Testes de estudantes](../../../src/screens/students/application/__tests__/): estado,
  duplicidades, exclusão operacional, perfil e indicadores; [testes de banco](../../../src/db/__tests__/)
  incluem matrícula, privacidade financeira e preservação ao excluir turma.
- [Testes familiares](../../../src/screens/family/__tests__/), [testes de API](../../../src/api/__tests__/)
  e [family_access_requests.sql](../../../supabase/tests/family_access_requests.sql) cobrem contratos de vínculo.
- Para mudanças de vínculo, usar nível de dados/segurança da [escada](../../operations/validation-ladder.md)
  e testar aceitação autenticada, conta incorreta, revogação e troca de contexto.
