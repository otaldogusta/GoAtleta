# Roadmap GoAtleta

Documento vivo com fases, objetivos e entregaveis. Use como guia de execucao.

## Fase 0 — Base do projeto e estabilidade de dev/build

Objetivo: ambiente consistente para desenvolver, debugar e fazer builds.

Feito
- Config unificada em app.config.js (remocao do app.json duplicado)
- Android SDK ok (ANDROID_HOME, PATH)
- EAS development build funcionando
- Metro bundler estabilizado (porta 8083)
- Sentry configurado (token/DSN/plugin)

Recomendado
- Criar profiles adicionais no EAS: preview e production
- Padronizar .env e documentacao rapida do setup

DoD
- Build dev e preview OK
- README com passos minimos de setup

## Fase 1 — Seguranca e banco (RLS + ownership + vinculo aluno↔auth)

Objetivo: ninguem acessa o que nao deve; vinculo automatico aluno-auth funciona.

Feito
- RLS + ownership com trainers, student_user_id e policies por papel (migration 20260120...)
- login_email + indice unico para auto-link (migration 2026012101...)
- Seeds/queries exigindo token (sem anon), mapeando login_email
- supabase db push --include-all aplicado

Recomendado
- Definir fonte de verdade do papel:
  - trainers como papel treinador
  - students.student_user_id como papel aluno
- Auditoria minima (created_at, created_by nas tabelas sensiveis)

DoD
- Politicas RLS revisadas e testadas
- Acesso anon bloqueado nas tabelas principais

## Fase 2 — Edge Functions (seguranca + SSRF + service role)

Objetivo: functions seguras, com JWT e protecao; automacoes confiaveis.

Feito
- assistant e link-metadata exigindo JWT, SSRF protection, service role no server
- Function de auto-link do aluno criada e deployada (auto-link-student)
- verify_jwt = false no config.toml (validacao manual via hook/header)
- Webhook auth.users INSERT -> auto-link-student com Authorization Bearer secret

Recomendado
- Padronizar middleware comum nas functions (auth, logs, rate limit)
- Criar funcao get-my-role (opcional, ajuda o app a rotear com 1 chamada)

DoD
- Funcoes com logs consistentes e erros tratados
- Sem secrets no client

## Fase 3 — App (sessao, bloqueios, estabilidade)

Objetivo: app so opera com token valido; sem crashes por platform API.

Feito
- Campo "Email do aluno (login)" no cadastro/edicao
- App pega token valido e bloqueia seed sem sessao
- Fix de acesso a document no Android

Recomendado
- Centralizar gate de autenticacao (AuthGuard)
- Estados para conta sem vinculo (aluno sem student_user_id)

DoD
- Fluxo de login e sessao ok em web/ios/android
- Erros amigaveis para falta de sessao

## Fase 4 — Rotas por papel (aluno vs treinador)

Objetivo: aluno ve somente o que e dele; treinador ve gestao/planejamento.

Recomendado
- Separar stacks/navegacao por role
- Bloquear telas de treino/gestao para alunos
- Ajustar menus e atalhos

DoD
- Aluno nao acessa cadastro de turmas/alunos/relatorios
- Treinador nao perde acesso ao que precisa
- Teste manual: login aluno vs login treinador

## Fase 5 — Cadastro por papel + convite de treinador

Objetivo: escolha aluno/treinador com seguranca real.

Recomendado
- Banco:
  - trainer_invites (hash, expira, max_uses, revoked)
  - trainers (user_id unico, unit_id, role_level)
- RLS:
  - trainers select so do proprio + admins
  - trainer_invites restrito
- Edge:
  - claim-trainer-invite (JWT + service role)
  - opcional create-trainer-invite (admin)
- App:
  - Sign up com seletor Aluno vs Treinador
  - Treinador pede codigo e valida
  - Roteamento pos-login por role real, nao pela escolha

DoD
- Convite cria/ativa treinador com seguranca
- Aluno nao consegue virar treinador sem convite valido

## Fase 6 — Presenca / Check-in com cautela

Objetivo: aluno pode avisar ausencia, mas presenca oficial e do treinador.

Recomendado
- Tabela absence_notices (student_id, session_id, reason, note, created_at, status)
- Tela aluno: "Avisar ausencia"
- Tela treinador: "Avisos pendentes" + acao confirmar/ignorar
- Rate limit + janela de alteracao

DoD
- Aviso do aluno nao altera presenca automaticamente
- Treinador confirma ausencia manualmente

## Fase 7 — Qualidade, UX e polimento

Objetivo: consistencia, performance e menos bugs.

Recomendado
- Estados vazios + skeletons (Home/Agenda)
- Erros amigaveis + retry
- Acessibilidade (fonte/contraste)
- Modo escuro consistente (tokens de cor)
- Telemetria minima (navegacao, falhas API, performance)
- Revisao de dependencias e assets

DoD
- Fluxos criticos com estados vazios e erro claro
- Performance minima aceitavel no device alvo

## Fase 8 — Operacao e processos

Objetivo: deploy e manutencao sem dor.

Recomendado
- Checklist de release (preview -> production)
- Sentry releases e sourcemaps no pipeline
- Migracoes versionadas + rollback basico
- Politica de chaves/secrets (rotacao)

DoD
- Pipeline documentado e repetivel
- Processo minimo de rollback

## Sequencia sugerida

1) Fase 4 (rotas por role)
2) Fase 5 (convite treinador)
3) Fase 6 (aviso de ausencia)
4) Fase 7 (polimento)
