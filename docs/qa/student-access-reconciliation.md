# Vinculação do atleta após confirmação do e-mail

## Escopo

Correção para contas autenticadas sem perfil que já correspondem a um cadastro
de atleta. Nenhum cadastro ou usuário hospedado foi alterado para testar.

- `src/auth/role.tsx`: tenta a reconciliação antes de publicar o estado pendente;
  recarrega o aluno sob RLS antes de liberar a navegação. Respostas de uma sessão
  antiga são descartadas. Perfis já existentes de coordenação/família não mudam.
- `app/verify-email.tsx`: atualiza o perfil depois da confirmação, preservando a
  prioridade dos convites e o fluxo canônico de autenticação.
- `app/pending.tsx`: diferencia confirmação, revisão, convite e indisponibilidade
  de um cadastro realmente novo. Falha no envio de código aparece uma única vez.
- Lista de atletas: cadastro ativo/inativo e vínculo de login são independentes.
  O indicador usa dados já carregados, sem consultas adicionais por linha.
- Migração `20260904004732_reconcile_verified_student_access.sql` e função
  `auto-link-student`: reaproveitam uma verificação no servidor. O cliente não
  escolhe e-mail, usuário, instituição ou permissões para essa vinculação.

## Segurança

A vinculação exige conta não anônima, não banida/excluída, e-mail confirmado e
prova confiável em metadados administrados pelo servidor. O e-mail normalizado
deve corresponder a um único atleta ativo, com instituição e sem outro usuário.
Convites existentes continuam sob suas próprias regras. Relações familiares,
conflitos e evidências de revogação impedem a vinculação automática.

A migração registra futuras remoções de `student_user_id` em
`student_access_revoked_at`, inclusive quando não existe convite. Ela não inventa
permissões familiares/financeiras, não cria aluno e não altera `organization_members`.
Não há reativação automática. Convites validados continuam podendo restaurar o
acesso explicitamente.

Limite histórico: uma remoção anterior à migração sem qualquer registro em
convites/relações não pode ser inferida retroativamente. Revisar os candidatos
antes da publicação; eventuais revogações antigas conhecidas precisam ser
marcadas pela coordenação antes de habilitar a retomada.

## Validação

- `scripts/test-student-access-reconciliation.cjs`: 31 cenários executando as
  duas migrações reais em PostgreSQL/PGlite isolado, com papéis, RLS e dependências mínimas.
  Inclui verificação, idempotência, duplicidades entre instituições e irmãos,
  revogações, privilégios, convites e rollback em erro. Inclui edição e resumo
  familiar, negação entre instituições, preservação da identidade, expiração
  de convites e bloqueio de permissões de saúde/consentimento.
- Jest: resolução de perfil, cancelamento de sessão, transporte e timeout,
  estados reais de `/pending`, envio do código e rótulos de acesso.
- Rodada final completa: `npm test -- --maxWorkers=2 --silent` — 387 suítes e
  2.193 testes aprovados. Dois contratos antigos de navegação foram alinhados ao
  fluxo familiar aprovado em Atletas; a repetição completa terminou sem falhas.
- Typecheck, isolamento por instituição, higiene estrita de performance e build web.
- Build final: 110 rotas estáticas; permanece apenas o aviso preexistente de
  fallback de exportação do `expo-font`. Encoding, assinaturas de assets e Edge JWT aprovados.
- Localhost autenticado: indicador visível e sem overflow horizontal nas larguras
  CSS medidas de 390×844, 834×1194 e 1440×1024. No celular, o texto compacto ocupa
  duas linhas; no tablet/desktop, uma. Viewport e busca anteriores restaurados.

O runtime SQL foi instalado em diretório temporário, fora das dependências do app.
Para repetir: instalar `@electric-sql/pglite` fora do projeto e executar
`node scripts/test-student-access-reconciliation.cjs <caminho-do-modulo-pglite>`.
Docker estava indisponível. Esses testes não substituem o smoke completo de
Auth/PostgREST/Edge Functions nem um teste de concorrência em conexões separadas.

## Publicação autorizada — 03/09/2026 (04/09 UTC)

- `main` reconciliada com `origin/main` antes da preparação do release.
- Dry-run identificou somente as migrações `20260903174500` e `20260904004732`.
  Ambas foram aplicadas, sem seed, remoção de dados ou atualização de segredos.
- Auditoria somente de leitura encontrou um candidato elegível, recém-criado,
  correspondente ao caso reportado. Nenhuma vinculação em lote foi executada.
  O cadastro permaneceu sem vínculo após a verificação, aguardando o próprio login.
- `auto-link-student` publicada como versão 22, ACTIVE. Chamada sem autenticação
  retornou HTTP 401. A autenticação do webhook foi preservada.
- Endpoints públicos novos são SECURITY INVOKER; implementações privilegiadas
  ficam em `private`, com checagem de identidade/permissão. Privilégios hospedados
  conferidos: anônimo negado e wrapper de serviço negado a `authenticated`.
- Advisor: nenhum ERROR e nenhum alerta para as funções deste pacote. Existem
  avisos anteriores, incluindo funções legadas SECURITY DEFINER e proteção contra
  senhas vazadas desativada; não foram alterados neste release.
  Referências: [funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
  e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Smoke autenticado local: perfil, resumo financeiro sem navegação, drawer familiar,
  botão Adicionar e dropdown de relação. O botão de salvar manteve y=491,923828125
  antes/depois do dropdown. Nenhum convite nem alteração de aluno foi salvo.
- Larguras CSS 390, 834 e 1440 sem overflow horizontal. Viewport, busca e perfil
  inicialmente aberto foram restaurados.
- As imagens com dados de alunos ficam apenas no computador, fora do repositório
  público. Publicação web usa um único push na main; EAS segue o workflow existente.

## Confirmações restantes após a publicação

- Login real do atleta no site atualizado, sem intervenção administrativa na conta:
  deve abrir o mesmo cadastro em `/student/home`, sem criar instituição.
- Teste ponta a ponta de Auth/OTP e concorrência entre conexões em ambiente de teste.
  A indisponibilidade do Docker não foi contornada com usuários artificiais em produção.
- Execução em aparelho nativo e conclusão dos pipelines remotos não são comprovadas
  pelo build web nem pela aceitação do envio.

Não restaurar o antigo update irrestrito por e-mail como rollback. Para interromper
a retomada automática, retirar a execução dos novos endpoints de reconciliação,
preservando os vínculos existentes e os marcadores de revogação. Nenhum rollback
deve apagar alunos ou revogar acessos em lote.
