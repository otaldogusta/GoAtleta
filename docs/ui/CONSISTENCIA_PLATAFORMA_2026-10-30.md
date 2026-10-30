# Consistência da Plataforma — refinamento de 30/10/2026

**REGISTRO LOCAL — recortes conferidos, sem aceite do usuário.** A rodada anterior foi rejeitada pelo usuário quanto à
composição: reduzir fontes não resolveu proporções, indicadores, espaçamento e
controles. O [registro anterior](DENSITY_ROLES_2026-10-30.md) conserva suas
inspeções e limites como histórico, sem representar aceite do resultado visual.
Este recorte separa apresentação e correção da entrada autenticada da Plataforma.

## Escopo e ambientes

- Origem do código: `031b`; runtime principal: `577e`, `localhost:8081`.
- Studio e quadra compartilhada foram conferidos em código/tokens; Agenda e
  editor também foram renderizados e capturados no navegador. Não se infere
  inspeção visual de todas as referências. A composição mantém tokens/tema e
  não altera a geometria do canvas.
- Frontend de QA reiniciado em `localhost:8082`, ligado ao Supabase real local
  em loopback `54321`. Auth/RPC são reais locais; conta, organização e dados são
  sintéticos. Não equivale ao backend remoto.
- O vínculo complementar de treinador da conta sintética da Plataforma foi
  removido antes deste smoke. A prova local registra `is_trainer=false` e
  administrador verdadeiro; o novo teste não depende desse complemento.
- Sem publicação, migração remota ou concessão de acesso de produção.

Ao encerrar, somente o frontend QA8082 foi parado; o localhost8081 permaneceu
rodando, com Professor restaurado em `/prof/home` e viewport resetado. Backend e
fixtures locais foram preservados, sem vínculo complementar de treinador. A aba
de Acessos em designPreview8081 ficou disponível para revisão. Os recibos
privados `cleanup-proof.json` e `root-final-validation.json` registram o estado.

## Mudanças delimitadas

| Frente | Alteração preparada | Situação |
| --- | --- | --- |
| [Acessos](../../src/screens/platform/PlatformAccessDashboard.tsx) e [painel](../../src/screens/platform/PlatformDashboard.tsx) | Indicadores com valor e rótulo em linha; altura intrínseca, padding/gaps revistos; ações compactas com hierarquia tonal e hover do tema. | Conferido em 320/390/834/960/1440 para Acessos e 390/1440 no painel. |
| [Controles da Plataforma](../../src/screens/platform/PlatformUiControls.tsx) | Separa pintura do controle e alvo de toque; preserva foco, teclado e escala de texto. | Pintura 32/alvo 44, tonal, hover e foco por teclado conferidos; sem regra de autorização. |
| [Menu de workspace](../../src/ui/WebSidebar.tsx) | Composição compacta, sem descrições repetidas; mantém opções, ancoragem e operações existentes. | Em 390/320, menu 208×146, opções 44 inteiras e troca Coordenação → Professor conferidos. |
| Entrada da Plataforma | Sequenciamento de restauração de sessão e leitura da autorização antes de decidir redirecionamento, incluindo administrador sem vínculo de treinador. | Aplicado no runtime. Seis entradas/reloads, três ciclos finais de logout/link/login e casos negativos locais passaram. |

O delta contém oito fontes: as três de apresentação e `WebSidebar` acima, mais
[layout raiz](../../app/_layout.tsx), [decisão de rota](../../src/auth/platform-route-access.ts),
[leitura administrativa](../../src/auth/use-platform-admin-access.ts) e
[gate pendente](../../src/auth/pending-invite.ts). Não altera concessões do servidor.

A regra canônica está em [Proporção dos elementos](RESPONSIVE_RULES.md#proporção-dos-elementos).
Não se aplica zoom, escala global da página ou desativação da ampliação de texto.
A correção de entrada continua dependente da autorização real do servidor;
preview/demo não demonstra essa autorização.

## Validação e evidências

As capturas originais desta rodada ficam privadamente em
`.tmp/consistency-refinement-20261030/`. Referências do produto e pares de
antes/depois têm papéis diferentes; uma captura de referência não é um antes.
Acessos 390/1440 usa designPreview/demo em 8081; painel 390/1440 usa Auth/RPC
reais em 8082 com dados sintéticos. Agenda/editor e menu de workspace usam a
sessão real de Professor em 8081. Origem e viewport constam por arquivo na
galeria. Há cinco pares completos: Acessos e painel em 390/1440, menu em 390.
As inspeções de 320 e hover 1440 e as duas referências ficam separadas, sem
inflar a contagem dos pares. As imagens originais não foram editadas.
A presença de arquivos não gera aceite visual automático.

| Conjunto | Evidência disponível | Limite |
| --- | --- | --- |
| Entrada autenticada | 80 testes em 5 suítes, lint e aplicação incremental verificada no recibo `.tmp/platform-direct-entry-20261030/validation.json`. | Servidor/Auth/RLS hospedados não exercitados. |
| Retorno pelo login | 18 testes em 2 suítes (`platform-route-access.test.ts` e `post-login-redirect.test.ts`) passaram, com lint. Sanitizador existente rejeita destinos externos, relativos a protocolo e inválidos. Recibo `return-query-validation.json`, na pasta do delta Auth. | Sobrepõe parte dos 80 testes: não somar. |
| RootLayout integrado | 2 testes em 1 suíte em [platform-root-entry.test.ts](../../src/auth/__tests__/platform-root-entry.test.ts) passaram, com lint. Executa layout/decisões reais; controla Auth/Role, transporte RPC e dispatch de navegação. | Não é backend real nem substitui o smoke de navegador. Recibo `root-entry-integration-validation.json`. |
| Menu de workspace | 12 testes em 1 suíte e lint passaram após o acabamento do hover. Em 390, x 170/direita 378; em 320, x 100/direita 308. Sem subtítulo/título duplicado. Coordenação abriu `/coord/dashboard`; retorno a Professor terminou em `/prof/home`. | Aceite do usuário não inferido da inspeção. |
| Apresentação da Plataforma | 4 testes em 2 suítes e lint passaram no recibo `.tmp/platform-visual-consistency-20261030/validation.json`. Acessos 320 conferido: indicadores de valor/rótulo em linha, altura 42, sem ampliar o card. | Os recortes listados foram inspecionados; não certifica outros perfis ou telas. |

Acessos não apresentou overflow em 320/390/834/960/1440; busca por Mariana e
seleção atualizaram o detalhe. No painel, fundo tonal preservado e borda neutra
no hover, sem escala; secundário neutro e foco visível via Tab/ShiftTab. Não houve
revisão/concessão de acesso ou outra gravação administrativa.

Resultados ficam por grupo, sem total agregado: há sobreposição entre o
conjunto Auth inicial e o delta de retorno. Cada recibo registra o comando Jest
exato e `--runInBand --silent`; UI usa `platform-responsive-list` e
`platform-lifecycle-ui-contract`, menu usa `web-sidebar-profile-menu`. Não se
somam testes históricos. O agente principal comunicou `typecheck:app`,
`check:org-scope`, perf hygiene strict e diffs finais aprovados nos dois roots.
As oito fontes de produto são equivalentes após normalizar quebras de linha.

O antes reproduziu `/platform/accesses` → `/student/home` com administrador
puro. Após o patch, seis verificações com Auth/RPC locais mantiveram o destino:
entrada direta e reload de Acessos, entrada e reload com a query da instituição
preservada, entrada direta e reload do painel. Recibo privado:
`direct-entry-checks.json`. O smoke final confirmou:

- Sem sessão, Acessos vai ao login preservando a query no `next` sanitizado.
- Família, pelo login com `next` e por link direto, termina em `/family/home`,
  sem heading Acessos nem conteúdo administrativo da Plataforma.
- Três ciclos finais do administrador puro, com logout/link/login, preservaram
  Acessos com query, Acessos sem query e painel; reload após o terceiro manteve
  o painel. Nenhum vínculo de treinador foi recriado para esses testes.

Houve um desvio intermediário na primeira nova entrada durante a iteração;
não se repetiu nos três ciclos finais. A causa não foi estabelecida nem
atribuída a HMR. Esse histórico permanece registrado. O resultado de navegador
usa Auth/RPC reais locais e dados sintéticos; o teste integrado tem fronteiras
controladas. Nenhum dos dois certifica Auth/RLS hospedados.
Este registro não certifica todas as telas, produção, motion ou build nativo.
