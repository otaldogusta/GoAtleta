# Retorno de Turmas e retenção local — 26/10/2026

O RootWebShell alternava Fragment e AppShell acima do Stack web ao entrar numa turma. Isso remontava o navegador, reiniciava abas no painel inicial e descartava dados das telas. A leitura atual da navegação no breadcrumb, corrigida anteriormente, não eliminava essa causa.

O shell web agora conserva os mesmos ancestrais do Stack; chromeVisible controla apenas a composição visual. O caminho nativo permanece com o comportamento anterior. A lista conserva dados no mesmo escopo e revalida em segundo plano; mudanças de identidade, organização, permissões ou geração do cache exigem carregamento bloqueante. O detalhe usa organização explícita e descarta respostas de sessão/cache antigos ou tela desmontada.

## Evidência local

- Teste executando RootWebShell e AppShell: três idas/voltas causavam sete montagens antes; após a correção, uma montagem e nenhuma desmontagem.
- Checkout 031b: 54 testes em nove suítes passaram; tipos, lint, org-scope, arquitetura e higiene de performance dos dois arquivos de tela passaram.
- Checkout 577e, que atende localhost:8081: os 12 testes centrais e os tipos passaram. Código corrigido conferido no bundle e nos dois checkouts.
- Navegador autenticado: três ciclos lista → Raposas → Turmas → Raposas preservaram conteúdo. Reaberturas observadas entre 446–562 ms, sem novas consultas de classes, alunos, chamada ou planos no intervalo medido. Retornos entre 625–724 ms mantiveram a lista visível durante atualização em segundo plano. Primeira entrada observada: 3359 ms.
- Com a lista previamente carregada, entrada pela chamada do painel em 26/10/2026, retorno pelo breadcrumb e três ciclos Voltar/Avançar conservaram data, seção, alunos e lista visível.

Os tempos incluem automação/observação em desenvolvimento local, com o backend configurado; não são benchmark de produção nem comparação controlada de latência antes/depois. Primeira visita e branch removida/recriada pelo histórico ainda podem exigir busca inicial: no ensaio de deep link frio, a URL de Avançar estava correta, mas a lista precisou carregar. Nenhuma chamada foi salva. Sem commit, publicação ou alteração remota de políticas. Testes de identidade são isolados e não comprovam RLS hospedada.

Artefatos privados em .tmp/class-return-performance no checkout 031b: samples.json e turmas.png.
