# Ciclo de entrada com conta e convite de teste — 25/10/2026

Pedido: testar desde cadastro e confirmação de e-mail até liberar acesso, sem
publicar, capturando as fases no navegador. Validação de nível 3.

## Ambiente e limites

- Frontend do worktree atual, porta 8082. O app na porta 8081 foi preservado.
- Supabase local já existente: Auth, PostgREST, PostgreSQL e Mailpit, API em
  `127.0.0.1:54321` e caixa de e-mail em `localhost:54324`. Sem reset do banco.
- Edge Functions do checkout servidas localmente. Nenhum deploy, migration
  remota, envio externo de e-mail ou criação de conta/vínculo em produção.
- Coordenador e instituições identificados como QA foram preparados como
  fixtures locais. O convite foi criado pela Edge autenticada existente.
  A conta convidada foi criada exclusivamente pelo formulário, com código por
  e-mail, confirmação pela Edge e vínculo aplicado pelo claim existente.
- Auth local usa autoconfirmação nativa, mas o produto continuou bloqueando
  acesso institucional até a prova OTP em `app_metadata`. Cadastro sem sessão
  retornada permanece coberto pelos testes de tela, não por este ambiente.
- Mailpit recebeu mensagens reais do Auth local com o template padrão de
  desenvolvimento. Os prints não certificam aparência, entrega ou redirects
  do template de produção. O banco local não foi atualizado para imitar
  todas as migrations hospedadas; não inferir paridade completa de schema.

## Resultado observado

| Etapa | Evidência |
| --- | --- |
| Convite reconhecido | Check no código e ação Criar conta habilitada com os campos válidos. |
| Cadastro | Conta inexistente criada pelo formulário. |
| Antes do OTP | Claim direto negado: HTTP 403, `EMAIL_NOT_VERIFIED`; sem concessão antecipada. |
| Recebimento | E-mail encontrado na caixa Mailpit e código copiado da mensagem. |
| Confirmação | Edge de verificação registrou prova confiável com fonte `otp`. |
| Aplicação | Convite consumido uma vez, limite 1/1 e `claimed_by` da conta correta. |
| Primeiro acesso | Nome preenchido pela UI; foto permaneceu opcional. |
| Portal | Home do professor carregada em `/prof/home`. |
| Escopo | Um vínculo, papel 10, nenhuma outra organização; Turmas e Calendário permitidos; gestão e financeiro negados. |
| Rota administrativa | Tentativa de abrir `/coord/dashboard` retornou ao portal do professor. |

## Defeito encontrado e corrigido

A primeira passagem pelo OTP foi desviada por um convite familiar antigo salvo
no mesmo navegador. Essa primeira conta ficou verificada, mas sem vínculo nem
consumo do convite de equipe. O print do erro foi preservado.

`savePendingInvite`, `savePendingRelationshipInvite` e `savePendingTrainerInvite`
agora mantêm uma única intenção ativa: escolher uma remove as dos outros tipos.
As gravações e remoções são serializadas e as leituras aguardam sua conclusão.
As chaves existentes foram preservadas; não houve migração de storage ou mudança
de autorização. Duas regressões cobrem substituição entre tipos e gravações
concorrentes. O ciclo foi repetido desde o cadastro com conta e convite novos,
após encerrar a sessão antiga do ambiente local de teste.

## Prints e verificações

Galeria privada em `.tmp/entry-cycle/review/index.html`, servida apenas em loopback
na porta 8083. Nove fases do ciclo concluído, mais a evidência do primeiro desvio
e a conferência da rota administrativa. São capturas do navegador; a transição
automática do claim não foi reconstruída ou fabricada. O arquivo
`prints-manifest.json` registra SHA-256 das imagens. Recibos JSON de antes e
depois ficam na mesma pasta; credenciais estão fora da pasta servida e ignoradas
pelo Git. Fixtures locais foram mantidas para revisão; não excluir contas antigas
do banco local como parte de uma limpeza genérica.

Uma sessão de fixture familiar antiga encontrada na segunda origem local foi
encerrada antes de criar a conta nova. O vínculo QA e a linha de professor
adicionados incidentalmente a essa fixture foram revertidos com filtros exatos
de organização, usuário e horário de criação; a conta antiga foi preservada.

125 testes em nove suítes passaram, além de `typecheck:app`, `check:org-scope`,
lint do helper alterado e diff. A etapa anterior já tinha validado performance
das telas; o novo patch muda apenas armazenamento da intenção do convite.
Nenhuma publicação realizada. E2E hospedado, template de produção e fluxos
comerciais ou familiares completos continuam fora da evidência desta execução.
