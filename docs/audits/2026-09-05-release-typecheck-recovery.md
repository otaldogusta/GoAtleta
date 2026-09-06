# Recuperação da publicação após a auditoria

O commit `de4f6ab7e4672e123e6e0ebe0d5f811f3b69e02a` foi bloqueado no Vercel e no Core CI do EAS durante `typecheck:app`. O backend já havia sido publicado; o cliente novo não chegou à produção nessa tentativa.

## Causa e correção

`expo start` gera o arquivo ignorado `expo-env.d.ts`, que referencia `expo/types`. Essas declarações incluem o estado web `hovered` de Pressable e as posições CSS adicionais. O checkout local tinha esse arquivo; a instalação limpa do servidor não tinha. Assim, o mesmo comando TypeScript carregava contratos diferentes.

`src/types/expo.d.ts` passa a referenciar oficialmente `expo/types` dentro da árvore versionada que `tsconfig.app-check.json` já inclui. A correção não acrescenta casts às telas, não altera componentes em execução e não reduz a cobertura do compilador.

## Reprodução isolada

Foi criado um worktree separado, no commit que falhou, sem copiar `node_modules`, `.expo`, `expo-env.d.ts` ou arquivos de ambiente. `npm ci` instalou o lockfile e aplicou os patches com sucesso. Antes da correção, `npm run typecheck:app` saiu com código 2 e reproduziu os mesmos erros de `hovered` e `position: fixed` dos dois pipelines.

Após incluir a referência versionada, `npm run typecheck:app` passou no mesmo worktree limpo. `npm audit --omit=dev` também passou, sem vulnerabilidades reportadas. Arquitetura, escopo, performance e lint passaram; o lint completo registrou zero erros e zero avisos. O build web foi exportado com sucesso a partir dessa instalação.

A execução completa de Jest terminou com 412 suítes aprovadas e um timeout no primeiro cenário da quadra visual. A investigação sem cache confirmou o custo da inicialização das dependências nativas dentro do teste. O preparo desse teste agora isola primitivas nativas, cabeçalho, navegação e telemetria, preserva as ações do cabeçalho e desmonta cada tela ao encerrar o cenário. A lógica real da rota, edição, histórico e persistência continua sob teste.

Depois da correção, os 14 cenários dessa suíte passaram sem cache no worktree limpo; o primeiro levou 283 ms, com o limite padrão de 5 segundos preservado. As demais 412 suítes já haviam passado na execução completa. O pipeline remoto executará novamente a suíte completa no commit publicado.

O build mantém o aviso conhecido sobre a importação interna de `ExpoFontLoader`. Sucesso local não representa confirmação de conclusão do Vercel ou do EAS; os estados remotos precisam ser verificados separadamente.

## Concorrência PostgreSQL comprovada

Depois de abrir o Docker, foi executado `npm run test:sql:concurrency` em PostgreSQL 17.6, com container descartável, sem rede ou acesso ao banco remoto. O teste reutiliza o preparo das migrações da suíte financeira, em vez de manter uma segunda implementação das regras.

Passaram quatro grupos de cenários: replay aguardando o commit, retry assumindo o trabalho após rollback, rejeição de payload divergente no mesmo evento e rajada de 12 conexões com um único escritor. As sessões de processamento usam `service_role`. Uma conexão observadora confirma o bloqueio concorrente e a invisibilidade do evento/projeção ainda não confirmados; outro evento consegue progredir durante esse bloqueio.

O teste foi incluído no Core CI, do qual o job de publicação EAS depende. O container da execução local foi removido ao concluir.

As três suítes PGlite passaram novamente após a extração do preparo compartilhado, incluindo 18 cenários financeiros. O smoke autenticado em `localhost:8081` confirmou o painel financeiro carregado, os recebimentos importados, o seletor mensal com fechamento por Esc e a aba de pagadores.

## Conferência remota e estabilização do CI

O commit `8e3755f8d2118f43bf1ec0a9d042676e370a0d15` chegou a `READY` no Vercel, com o domínio `goatleta.com` associado. No GitHub, as 413 suítes / 2.342 testes, SQL isolado e build web passaram. O EAS foi bloqueado em seguida pela inicialização do container do teste de concorrência: o socket Unix aceitou o health check no servidor temporário de initdb e desapareceu antes de abrir a sessão.

Readiness e sessões agora usam o mesmo endpoint TCP de loopback interno, disponível no servidor definitivo. Uma inicialização sintética com espera de oito segundos reproduziu a diferença: socket Unix pronto enquanto TCP ainda estava indisponível, seguido de consulta bem-sucedida pelo endpoint definitivo. Os quatro grupos de concorrência passaram após a correção.

Os avisos de SecureStore e `Row level security` vistos nos logs eram erros intencionais dos testes. Os três cenários negativos agora verificam o texto, erro e quantidade esperada de avisos sem imprimi-los como falhas aparentes de publicação. As duas suítes afetadas passaram, com 30 testes. Os avisos de produção permanecem ativos.

## Pendências independentes

O teste financeiro com várias conexões deixou de ser pendência. Isso não equivale a um teste de carga prolongado de todo o app nem a uma validação multiconexão de todos os workers.

A entrega de um novo evento pelo Asaas, a evolução das rotas extensas e as entregas de produto financeiro/familiar continuam descritas no relatório de fechamento. A correção de tipos não habilita cobranças nem altera a configuração do provedor.
