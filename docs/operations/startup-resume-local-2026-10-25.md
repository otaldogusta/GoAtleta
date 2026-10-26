# Recuperação da entrada ao retomar a aba — 25/10/2026

Correção local, sem publicação, exercitada com as contas fictícias de atleta e
responsável dos ciclos anteriores. Frontend isolado em 8082, Supabase local em
54321. A sessão e o frontend existentes em 8081 foram preservados.

## Diagnóstico e correção

A tela genérica de erro é compartilhada por falhas de bootstrap e de papel no
layout raiz. Foi reproduzida ao bloquear a leitura `rpc/is_trainer`: o
`RoleProvider` publica erro e remove o contexto autorizado, mas não refazia a
leitura após voltar a conexão ou a aba. O botão manual funcionava porque chamava
`retryRole`. O registro original da aba antiga não estava disponível; a reprodução
isola este caminho confirmado, sem atribuir a ele toda possível falha de bootstrap.

`use-role-recovery.ts` agora faz até duas tentativas, em 1 e 3 segundos, para
falhas transitórias (rede, abort, 408, 429 e 5xx). Pausa o agendamento enquanto o
documento está oculto. Eventos `visibilitychange`, `resume`, `online` e `pageshow`
permitem novo ciclo de recuperação. Timers e listeners são removidos ao desmontar
ou trocar a sessão. Erros 401/403/404 e erros de programação não são repetidos.

As tentativas reutilizam a leitura de autorização e suas guardas de geração e
identidade. Não restauram papéis do cache quando a resposta falha. Log de
desenvolvimento registra somente nome e status da falha, sem sessão/token.

## Validação

- Reprodução por indisponibilidade controlada de `is_trainer` no navegador.
- Responsável: rede restabelecida e evento `online` simulado por CDP; voltou a
  `/family/home`, com atleta, parentesco e financeiro restrito, sem botão de
  retry ou novo login. Recarga normal também passou.
- Atleta: mesma interrupção, seguida de conexão restabelecida e evento de
  visibilidade simulado; voltou a `/student/home` com a turma própria, sem retry
  manual ou novo login. Suspensão/retomada controlada da aba carregada e recarga
  verificadas separadamente.
- Interceptações, bloqueios de rede e suspensão do navegador removidos ao final.
  A injeção de eventos é evidência de recuperação controlada; não representa um
  teste prolongado de suspensão pelo sistema operacional ou dispositivo nativo.
- Testes focados cobrem limite de tentativas, ocultação/retomada, online, limpeza,
  troca de identidade, negação e recuperação integrada do provedor sob autorização.

Prints em `.tmp/resume-cycle/review/`, com galeria e manifest de hashes.
Galeria em `http://127.0.0.1:8086/`, com 9 capturas inspecionadas.
31 testes em 3 suítes, `typecheck:app`, `check:org-scope`, lint dos arquivos
alterados nesta etapa e `git diff --check` aprovados.
Os artefatos são locais; credenciais permanecem fora da pasta servida.
Sem commit, push, deploy, migration remota ou alteração de produção.
