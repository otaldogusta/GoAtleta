# Vínculo de atleta por solicitação

Migração `20260914025117_athlete_access_requests.sql` aplicada no Supabase do Go Atleta
com autorização em 13/09/2026 (horário de Brasília). Regressão SQL passou após a
aplicação, com dados fictícios e rollback. App não publicado. Falta validar o ciclo
autenticado visual no localhost; nenhuma solicitação real foi aprovada ou convertida.

- Entrada pelo perfil usa `/pending?returnTo=%2Fstudent%2Fprofile` e a RPC
  `request_athlete_access`, sem produto/cargo de equipe nem plano demonstrativo.
- Solicitação pendente antiga permanece visível e pode ser explicitamente corrigida
  pelo próprio solicitante. Não inferir o tipo de solicitações históricas em massa.
- Coordenação: Convites e solicitações > Revisar vínculo. Selecionar o cadastro
  existente na instituição. Sem cadastro, cadastrar pelo fluxo de atletas e atualizar.
- Aprovação liga `students.student_user_id`; não cria trainers/organization_members.
  Não reativa cadastros revogados/inativos nem transfere contas já vinculadas.
- Plataforma mostra que a revisão de atleta pertence à coordenação. A proteção no
  banco também bloqueia aprovações por RPCs antigas de equipe, com rollback integral.
- O status é consultado periodicamente enquanto a aba está visível; após aprovação,
  a atualização de papel confirma o acesso sob RLS e retorna ao perfil.
- As leituras v2 só usam fallback legado quando a RPC ainda não existe. Erros de
  permissão/rede não são convertidos em fila vazia.

## Validação

`supabase/tests/athlete_access_requests.sql` usa contas e instituições fictícias com
rollback. Exercita escopo, aprovação, rejeição, idempotência, bloqueio de elevação
para equipe e impedimento de tomar cadastro vinculado. Executado junto à migração
em uma transação revertida: nenhuma conta real aprovada ou modificada.

Antes de concluir a publicação: aplicar somente esta migração, executar advisors,
verificar a fila real da instituição e validar visualmente seleção/erro/carregamento
em mobile e desktop. Não aprovar vínculos reais apenas para smoke test.
