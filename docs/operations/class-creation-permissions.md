# Criação de turmas — permissão institucional

Implementação local de 22/10/2026, após o
[diagnóstico](../audits/2026-10-22-class-creation-permissions.md).
Smoke autenticado local concluído nos limites abaixo. Ativação remota pendente.

## Contrato

- `classes` continua liberando acesso às turmas, chamada e sessão.
- `classes_create` é independente e **desligada por padrão para professores**,
  inclusive membros existentes e convites antigos. Não há backfill de liberação.
- Coordenação/dono (`role_level >= 50`) mantém criação e controla a opção
  **Criar turmas** em Equipe → Gestão → Permissões do professor. A liberação
  vale somente naquela instituição e requer também acesso a **Turmas**.
- O convite pode levar a liberação explícita, mas a opção não integra os defaults.
- Botão, `tab=criar`, atalho da sincronização de alunos e submissão usam o mesmo
  gate, que nega criação quando a permissão está ausente ou carregando.
- Criação não concede gestão de unidades ou de outros professores. Para o
  professor, a resolução da unidade reutiliza as disponíveis e mantém o rótulo
  informado sem tentar inserir/renomear unidade.

## Servidor e compatibilidade

A migration [20261022161413](../../supabase/migrations/20261022161413_class_creation_permissions.sql)
acrescenta a chave ao CHECK e aos RPCs existentes de consulta, gestão de acesso,
recibos e convites. As assinaturas e a autorização administrativa são preservadas.
O backend deve ser atualizado antes de oferecer a nova opção no aplicativo.
Sete corpos de RPC foram comparados com o banco conectado e preservados,
alterando apenas a whitelist. O claim instalado contém a extensão
`apply_trainer_invite_staff`, ausente no histórico local: sua whitelist é ampliada
no corpo instalado, com guarda de formato, sem substituir essa extensão.

`can_create_class` exige sessão, vínculo e as duas permissões na instituição.
As policies permissiva e restritiva de INSERT usam a mesma regra; a restritiva
também impede que a policy legada de tenant/usuário do banco conectado contorne
a liberação explícita. O professor só pode inserir com seu próprio `owner_id`.

Um trigger privado inicializa apenas o próprio criador como responsável da turma
nova, com vínculo, mandato temporal e versão de equipe na mesma transação.
Isso permite acessar e operar a turma sem liberar o RPC administrativo de equipe.
Criação pela coordenação/dono mantém o comportamento anterior de atribuição.
Outro trigger protege organização e proprietário contra reassociação por quem
não administra as instituições envolvidas. Não se alteram turmas históricas.

Duplicação com cópia de equipe continua sendo operação administrativa; o menu
da lista e o gerenciador de periodização não oferecem essa ação ao professor.
A nova permissão não amplia gestão
de equipe, exclusão ou outras operações administrativas.

## Falhas de salvamento

`saveNewClass` captura falhas de gravação e apresenta o erro amigável no mesmo
formulário, mantendo todos os campos. Há bloqueio de submissão concorrente e de
fechamento durante o envio, além de descarte de feedback de outro usuário/org.

`createClassAndRefresh` separa o resultado do INSERT da atualização da lista.
Se a gravação falhar, propaga o erro sem atualizar ou limpar o formulário.
Se somente a leitura posterior falhar, retorna a turma salva e informa que a
lista precisa ser atualizada; não repete o INSERT nem o trata como falha de gravação.

## Validação local

- 48 testes Jest focados: gate, defaults do convite, gravação/refresh, payload,
  unidade sem criação, troca de identidade no envio, menu de turma, rotas,
  gestão de permissões e convites.
- `node scripts/validation/class-creation-permissions-sql.mjs`: migration real
  em PGlite, com identidades fictícias e tabelas preexistentes de dependência.
  Cobertos default negado, liberação/revogação e replay por RPC administrativo,
  convite explícito/antigo, sessão ausente, anônimo, outra instituição,
  propriedade forjada, reassociação, policy legada permissiva e equipe/histórico.
  O teste também preserva/exercita a extensão de equipe do claim observado no banco.
- `npm run typecheck:app` e `npm run check:org-scope` aprovados.
- Lint dos arquivos alterados, arquitetura, performance focada das telas e diff
  aprovados.
- Localhost:8081 do próprio checkout, com dependências locais e sessão
  administrativa: cadastro aberto/preenchido com dados fictícios, conexão da aba
  desativada temporariamente por CDP e tentativa de salvar. A falha de leitura da
  unidade antes do INSERT exibiu mensagem de conexão sem apagar nome, unidade,
  espaço, gênero, modalidade, idade, horários ou dia selecionado. A conexão foi
  restaurada e o rascunho fictício descartado sem gravação.
- No convite padrão de professor, a opção **Criar turmas** apareceu desmarcada
  junto de **Turmas** marcada, usando as mesmas linhas, ícones, bordas e tipografia.
  O convite foi fechado sem gerar link ou enviar e-mail. O formulário e o erro
  foram inspecionados visualmente; evidências privadas em `.tmp/validation/`.

PGlite não comprova Auth/PostgREST hospedados. Professor liberado/negado no
backend hospedado e sucesso real de criação continuam pendentes de QA.
Em 22/10/2026, com autorização do usuário, a migration foi aplicada ao projeto
`hgmdpetpwclucvquoklv`, registrada como `20261022161413_class_creation_permissions`.
O arquivo local usa esse mesmo identificador. A leitura posterior confirmou
default negado para professor, permitido para administrador, policies de INSERT
permissiva/restritiva, os dois triggers e preservação da extensão do claim.
`create-trainer-invite` foi publicada como versão 42, ACTIVE, preservando
`verify_jwt = false` e a autenticação implementada no handler.
O release local passou em `npm run build:verified`: 632 suítes, 3.958 testes,
SQL, lint, tipos, escopo, demais checks e exportação web.
O smoke não criou turma, alterou permissão ou enviou convite real.
A publicação do frontend foi autorizada; aceite de fila de deploy não certifica
disponibilidade em produção nem substitui QA autenticado do professor hospedado.

Referência de RLS consultada: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
