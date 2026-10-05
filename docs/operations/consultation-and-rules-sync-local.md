# Consultoria e sincronização de regulamentos — correção local de 05/10/2026

Continuação autorizada após a [organização documental](../context/revisao-2026-10-05.md).
Base `d5120cff`, no mesmo worktree. Alterações documentais/checklist anteriores
preservadas; sem commit, push, deploy, migration ou configuração remota.

## Comportamento corrigido

- `rules-sync-admin`: o handler recebe e usa `req` em todos os caminhos. A
  referência indefinida anterior impedia preflight e respostas de erro/sucesso.
  Autorização, payload e rate limit foram preservados.
- Consultoria local: chave v2 e envelope incluem usuário e organização. O formato
  v1 não tem autoria demonstrável; permanece intacto sem leitura/adoção automática.
- Toda operação mantém sessão, organização e geração capturadas no carregamento.
  Mudanças de conta/workspace cancelam respostas e etapas seguintes, inclusive
  retorno A → B → A. O cliente REST aceita identidade esperada também em GET/DELETE.
- Mutações locais na mesma chave são serializadas; uma falha não bloqueia a fila
  seguinte. Envelope inválido produz erro e permanece intacto, sem sobrescrita.
- Apenas rede e schema ausente permitem fallback. Sem usuário/organização,
  autenticação/permissão negada ou identidade alterada, a operação falha.
- Snapshot inclui contexto e status da própria leitura. Telas reiniciam por
  identidade, recusam callbacks antigos e não anunciam salvamento antes de carregar.
- Atleta sem cargo na equipe usa vínculo `students.student_user_id` verificado
  pela sessão e pela organização do cadastro. Isso não cria membership. A primeira
  abertura exige verificar o vínculo; contexto ainda válido pode ser reutilizado
  na mesma tela durante queda de rede. Snapshot do atleta filtra seu próprio cadastro.
- Resultado apenas local não publica notificação. No caminho remoto, o contexto
  é conferido entre as etapas e na preparação das requisições de notificação;
  o próximo envio para ao invalidar.

## Contratos e limites preservados

O isolamento local não substitui RLS nem comprova acesso autorizado ao servidor.
Não foi criada sincronização automática, migração do legado ou tela de recuperação.
Uma recuperação futura deve conferir explicitamente origem/autoria e autorização
atual; nunca inferir propriedade apenas pelo aluno encontrado ou conta ativa.

Operações remotas compostas já usavam múltiplos requests e continuam sem uma
transação única. Uma etapa enviada antes da troca/falha pode ter sido concluída;
o patch impede as seguintes, mas não desfaz escrita ou notificação já enviada.
Não declarar rollback remoto ou atomicidade que esta correção não implementa.

## Validação e ambiente

As execuções focadas somam 11 suítes e 118 testes aprovados; não representam a
suíte completa do produto nem teste de ambiente remoto.

- Handler: 12 testes reproduziram o erro antes do patch e passaram depois, com
  handler/CORS reais e Supabase/sincronizador simulados. Sem rede ou Deno Runtime.
- Armazenamento local: 19 testes aprovados com sessão/client reais, armazenamento
  controlado e rede proibida; cobrem isolamento, legado, concorrência e identidade.
- Regressão existente: 17 testes de identidade/offline e mapeamento aprovados.
- Repositório: 22 testes aprovados, incluindo falhas de acesso, troca de identidade
  entre requisições, fallback, acesso do atleta sem membership e filtro por vínculo.
- Hook das telas e notificações de consultoria: 21 testes aprovados em duas suítes;
  cobrem respostas tardias, callbacks expirados e guardas entre etapas.
- APIs de inbox/push: 27 testes aprovados em quatro suítes, incluindo oito casos
  novos de troca de conta/organização durante resolução de usuário/token.
- `npm run typecheck:app`, `npm run check:org-scope`, ESLint dos arquivos TS/TSX
  do app alterados e `npm run check:architecture:strict` aprovados. O guardrail
  arquitetural analisou 1.116 módulos/4.365 imports, sem violações.
- Perf-hygiene das duas telas de consultoria e `git diff --check` aprovados.
  Validação nível 3 da [escada](validation-ladder.md), sem build de release.
- Checklist regenerado: 29 módulos, 368 itens e 116 rotas. Títulos/IDs anteriores
  mantidos; preparação local continua pendente pela configuração de backend.
- Conferência documental: 20 documentos/485 links locais sem destino ausente.
  Os 359 IDs/títulos anteriores, template, notas pessoais, rotas e alinhamento
  foram preservados; nove itens adicionados nas duas etapas. Apenas dois itens
  antigos tiveram status/detalhes/evidência atualizados conforme o trabalho local.

Node 24.13.0. Na execução dessa etapa, o worktree usava ligação local para dependências já instaladas do
checkout principal, com lockfile SHA-256 idêntico; sem instalação/postinstall.
`dev:doctor` detectou ausência de configuração local de backend, e a porta 8081
já estava ocupada por outro processo. A sessão/processo existente foi preservada.
Na etapa de correção, smoke autenticado e runtime real ainda estavam pendentes.
A [continuação autenticada local](consultation-authenticated-local-smoke-2026-10-05.md)
posteriormente validou navegador, Auth/PostgREST/RLS e Edge Runtime isolados,
com dados fictícios. Seus resultados e limites estão separados dos testes acima.
Nenhum dado real foi enviado; ambiente remoto continua sem certificação.
A [preparação permanente posterior](worktree-local-ready-2026-10-05.md) instalou
dependências próprias e aprovou o doctor, preservando os resultados desta etapa.
