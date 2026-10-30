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
| [screens/family](../../../src/screens/family/), [student/profile/index.tsx](../../../app/student/profile/index.tsx) | Início, agenda, pagamentos e perfil do contexto selecionado; perfil próprio do atleta com edição na aba Configurações, mantendo rascunho entre abas. `/student/profile/settings` abre diretamente essa aba. |
| [student-photo-storage.ts](../../../src/api/student-photo-storage.ts), [student-self-photo.ts](../../../src/api/student-self-photo.ts) | Armazenamento/foto e RPC `set_my_student_photo`. |

## Contratos a preservar

- Em 25/10, listas usam `StudentDirectoryRecord` (16 colunas de cadastro) e
  turmas/sinais usam `ClassStudentRecord` (5 colunas), com paginação integral de
  500, cache separado e sem substituir o leitor FULL de exportação/domínio.
  A ficha completa baixa ao abrir, opção escolhida pelo usuário; loading/erro
  não montam editor com dados parciais. Ficha já sincronizada permanece offline;
  primeira abertura exige conexão, salvo FULL legado disponível. Cache por ID
  sanitiza finanças; tombstone impede reviver ficha alterada do FULL legado,
  preservando as demais. Salvar relê a ficha canônica antes de fechar; seleção,
  foco, identidade e geração descartam respostas antigas. [Contrato e evidências](../../operations/performance-lists-memory-local-2026-10-25.md).
- URLs assinadas de fotos mantêm TTL de 50 minutos, limpeza de expiradas e LRU
  limitado a 512 entradas; acesso, fila compartilhada e grants continuam escopados.
- Em 24/10/2026, diretório e aniversários passaram a ler todas as páginas, sem
  gravar listas parciais no cache. A retomada usa cursor `(name,id)`, comparado pelo
  PostgreSQL, e índice aditivo por organização/nome/ID testado só no banco isolado.
  Organização explícita autorizada do aluno/família
  pode diferir da ativa; a guarda fixa a sessão e o workspace inicial contra mudanças.
  Fotos do diretório/turmas são solicitadas por página/visibilidade, com fila de seis
  e grants separados por contexto. [Medições e limites locais](../../operations/performance-stress-local-2026-10-24.md).

- Cadastro ativo/inativo, matrícula, vínculo de login e condição financeira são
  dimensões diferentes. Não deduzir acesso pela presença de telefone ou e-mail na ficha.
- Leituras equivalentes pendentes de `getStudents` compartilham somente a tarefa
  base sanitizada, por sessão/token/geração/organização. Hidratação financeira é
  separada e exclusiva dos chamadores habilitados; cada consumidor recebe cópias.
  Escritas canônicas invalidam a tarefa e retomam a leitura, com orçamento finito;
  troca de identidade ou workspace rejeita o resultado. A tarefa sai do mapa ao
  concluir a base, sem acrescentar TTL ao diretório. [Segunda rodada local](../../operations/performance-global-startup-round2-local-2026-10-24.md).
- A gestão operacional usa inativação. Não reintroduzir exclusão permanente em
  Gestão/turma nem apagar atletas ao remover uma turma com vínculos.
- Dados financeiros são hidratados pela projeção autorizada; o cache geral guarda
  atletas sem esse estado sensível. Ausência de permissão não deve quebrar o cadastro.
  `getStudents({ includeFinancial: false })` permite à lista de turmas pular essa
  hidratação; o padrão continua habilitado. Campos, ordem, cache sanitizado e
  guardas de identidade/geração/organização permanecem iguais. A opção não atribui
  um estado financeiro calculado nem muda a autorização.
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

- Refino de composição de Aluno/Família em 30/10: cards e ações usam métricas
  operacionais sem alterar capacidades, consultas ou regras do vínculo. A
  [rodada local de composição](../../ui/CONSISTENCIA_ALUNO_FAMILIA_2026-10-30.md)
  separa implementação, 22 pares novos e conferência sobre Supabase real local
  com dados sintéticos, incluindo vínculo financeiro permitido/restrito.
  Não equivale a aceite global ou validação hospedada.

- Agenda do atleta reutiliza o calendário mensal de `app/calendar.tsx` em modo
  de leitura, alimentado exclusivamente pela turma vinculada via `classId` e
  organização do atleta em `app/agenda/index.tsx`. Mudança de vínculo descarta
  dados e estado anteriores. Sem consultas gerais de turmas, planos, eventos ou
  pausas de gestão nesse modo; parâmetros `openApply` não abrem ações de equipe.
  Treinos abrem `/student-plan` e a exportação ICS do vínculo foi preservada.
  Em 26/10/2026, mês, dia com treino e abertura/retorno conferidos no localhost;
  10 testes de leitura, navegação, erro e seleção passaram, assim como tipos e
  org-scope. Exportação acompanha o mês exibido. Prints privados em
  `.tmp/coord-shortcuts/atleta/`. Sem publicação.
- Responsável sem convite foi exercitado com cadastro, OTP, solicitação,
  conferência e aprovação reais no Supabase/Mailpit locais em 25/10/2026.
  Vínculo familiar preservou o login próprio da atleta e não criou papel de equipe;
  [20 capturas, escopo e limites](../../operations/entry-guardian-local-2026-10-25.md).
- O perfil compartilhado é composição visual; autorização permanece nas APIs/RPCs e
  capacidades de cada consumidor. A aba financeira do atleta exige `canViewFinance`.
- Aluno, professor e coordenação editam o próprio perfil na aba Configurações,
  abaixo da mesma capa. Links de configurações por papel continuam compatíveis;
  perfis de outras pessoas permanecem separados dos controles da própria conta.
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
