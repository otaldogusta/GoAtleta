# Convites de equipe — refinamento local de 08/10/2026

Banco aplicado e Edge Function ativa em 08/10/2026; frontend em preparação para publicação.

## Fluxo

- Gestão permite selecionar turmas antes de enviar o convite e escolher explicitamente
  um professor cadastrado sem conta. Nomes iguais nunca são associados automaticamente.
- `create_trainer_invite_access_v2` guarda `initial_class_ids` e `staff_profile_id` no
  convite, após validar administrador, organização, turmas e perfil ainda não vinculado.
  A função anterior continua disponível para clientes antigos; os novos campos têm
  defaults vazios/nulos. O perfil referenciado não pode ser excluído enquanto houver
  convites que dependam dele.
- O aceite usa a RPC transacional existente. Membro, permissões, equipe e consumo do
  convite são aplicados juntos. O perfil existente mantém papel, datas e snapshots
  do histórico; novas turmas entram como auxiliar ou estagiário, sem substituir o
  responsável. Ao vincular o responsável atual, `classes.owner_id` também recebe
  a conta aceita, preservando a projeção usada pelas consultas existentes.
  Versões das turmas afetadas avançam para invalidar edições obsoletas.
  Identidades conflitantes ou turmas removidas/de outra organização impedem o aceite
  inteiro, sem consumir o convite. Não há backfill de convites antigos.
- Cadastro por link salva o código antes de publicar a sessão e o carrega na rota
  de verificação. A tela pendente aguarda a leitura do convite antes de oferecer
  escolha de vínculo e prioriza seu progresso sobre solicitações anteriores.
- O fluxo de e-mail já existente usa prova de identidade emitida pelo Auth. O link
  compartilhável continua exigindo confirmação de e-mail quando a conta não possui
  prova confiável. Não se removeu essa fronteira. O e-mail inclui versão texto e
  endereço copiável como alternativa ao botão; a causa no cliente do professor
  não foi reproduzida.
- O modal de convite ativa `ModalSheet.avoidKeyboard`: visual viewport na web e
  KeyboardAvoidingView no nativo. Campo de e-mail com 16 px, sem autocorreção,
  preenchimento automático e rolagem que preserva toques. Envio requer e-mail válido.

## Evidência e limites

- Testes Jest focados de convite, API, snapshots, cadastro e tela pendente passaram.
- Teste do modal cobre atualização de altura/deslocamento do visual viewport e
  remoção dos listeners. Isso não substitui um teclado virtual em dispositivo real.
- `node scripts/validation/trainer-invite-staff-sql.mjs` passou em PostgreSQL/PGlite
  descartável: isolamento de organização, permissões RPC, e-mail divergente,
  preservação de histórico e responsável, aceite idempotente, revogação, expiração,
  conflito entre cadastros e rollback de membro/permissões por turma inválida.
  Não comprova concorrência completa nem Auth/PostgREST hospedado.
- Experimento adicional em PostgreSQL 17.6 descartável, com sessões independentes:
  dois aceites simultâneos do mesmo convite aguardam o lock, geram um único consumo
  e dois vínculos esperados; a segunda chamada retorna `already_claimed`.
  Não cobre todas as disputas possíveis com edição simultânea de equipe.
- Typecheck, org-scope, perf-hygiene e diff check executados na tarefa.
- Gestão real aberta em localhost:8081 com sessão preexistente; formulário em
  390 px aceitou e-mail fictício e seleção local de turma, sem envio nem gravação.
  `dev:doctor` apontou configuração local ausente; dados visíveis podem incluir cache.
  O aceite completo, destinatário real, teclado nativo e temas continuam pendentes.

## Publicação em 08/10/2026

Após autorização do usuário para prosseguir com a publicação:

- Migration aplicada no projeto `hgmdpetpwclucvquoklv`, versão `20261008191304`.
  O arquivo local foi renomeado para corresponder à versão registrada pelo Supabase,
  sem alteração do SQL validado. Os 27 convites preexistentes foram preservados.
- `create-trainer-invite` publicada e confirmada `ACTIVE`, versão 38. Autenticação
  explícita no corpo da função e configuração JWT existentes preservadas.
- Confirmado no banco: cliente autenticado pode chamar a criação validada, mas não
  pode executar diretamente a RPC de aceite reservada ao servidor.
- `build:verified` aprovado: 567 suítes, 3.178 testes e export web. Uma execução
  anterior esbarrou no teste financeiro concorrente de Asaas; a repetição passou,
  sem alterar esse módulo.
- Frontend será publicado a partir da branch `codex/teacher-invite-refinement`;
  aceitação da fila não deve ser apresentada como conclusão de produção.
- Smoke completo de destinatário e teclado em celular real continuam pendentes.
  Nenhum convite real foi enviado nesta tarefa.

Referência de segurança de funções: [documentação Supabase](https://supabase.com/docs/guides/database/functions).
