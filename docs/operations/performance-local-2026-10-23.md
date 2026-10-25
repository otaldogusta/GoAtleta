# Desempenho local — 23–24/10/2026

Análise e correções locais do Go Atleta, base `187043ec`, com alterações ainda no
working tree. Execução em 23–24/10/2026, America/Sao_Paulo.
O usuário relatou lentidão na web e no Android.

Continuação: [carga pesada de 24/10](performance-stress-local-2026-10-24.md), com
100 turmas/5.000 atletas, correções de fotos, paginação e planejamento. Os números
abaixo pertencem à primeira rodada; o comparativo final no browser continua
separado da implementação e foi interrompido por segurança da automação.

O pacote reduz trabalho comprovadamente repetido no cliente. As medições abaixo
separam benchmarks controlados, testes funcionais e validação do aplicativo.
Não certificam fluidez global, desempenho nativo ou produção. Sem commit, push,
deploy, alteração de segredo ou migration remota neste escopo.

## Diagnóstico e prioridade

| Prioridade | Evidência encontrada | Tratamento local |
| --- | --- | --- |
| Alta — JavaScript inicial | Documentos PDF e o wrapper legado da quadra incluíam dependências pesadas na entrada web. | Uma fronteira assíncrona PDF compartilhada e uso direto do canvas moderno; redução de 21,0% no JavaScript inicial gzip. |
| Alta — trabalho global desnecessário | A checagem de aniversários carregava o diretório completo de atletas e a hidratação financeira para obter nome/data. | Projeção mínima por organização, cache separado e guarda de sessão. |
| Alta — CPU durante reprodução | `useVideoDraft` normalizava e serializava todo o documento a cada rerender, mesmo quando só mudava o relógio do player. | Assinatura memoizada pelo documento imutável. |
| Alta — CPU durante digitação | O callback de navegação do ScreenChat capturava todo o objeto `chat`, invalidando o cache do React Compiler entre teclas. | Referência pós-commit à conversa/histórico vigentes, lida na confirmação. |
| Média — consultas duplicadas | Consumidores simultâneos consultavam separadamente acesso à plataforma e a mesma lista de notificações. | Compartilhamento apenas de requisições ainda pendentes, com chaves e guardas de identidade. |
| Média — leitura em sequência | Unidades e turmas eram buscadas uma depois da outra, apesar de independentes. | Leitura concorrente, mantendo perfil pedagógico fresco e proteção de contexto. |

Já existiam React Compiler habilitado, imports sob demanda no estúdio/PDF/GIF,
Worker de inferência ONNX, miniaturas visíveis sob demanda e instrumentação
`markRender`/`measureAsync`. A correção não substitui essas estruturas nem presume
que a existência dos guardrails demonstre desempenho aceitável.

## Alterações e contratos preservados

### Turmas e aniversários

- [getClasses](../../src/db/classes.ts) busca unidades e turmas em paralelo.
  Captura identidade e geração do cache; uma troca de conta/workspace invalida
  respostas anteriores. Perfis pedagógicos continuam sendo buscados na sequência;
  falha de rede conserva o fallback do cache com perfil indisponível.
- O breadcrumb `getClasses` agora termina após a leitura dos perfis. Seu intervalo
  mudou; não comparar o número antigo e o novo como a mesma medição.
- [getStudentBirthdayCandidates](../../src/db/students.ts) consulta somente
  `id,name,birthdate`. O [hook global](../../src/hooks/use-birthday-notifications.ts)
  usa essa projeção e descarta resultados de uma sessão anterior antes de notificar
  ou registrar o dia como conferido.
- O cache mínimo tem chave própria. Offline, ele prevalece sobre um diretório
  anterior, inclusive quando contém `[]`. Uma nova leitura completa do diretório
  invalida a projeção antiga, conservando o caminho inverso e a remoção total.
  Falha de autorização não é convertida em sucesso de cache. Não foram retiradas
  a hidratação financeira do diretório nem as proteções de campos financeiros.

### Scouting e chat

- [useVideoDraft](../../src/screens/scouting/video/use-video-draft.ts) calcula a
  assinatura normalizada apenas quando muda a referência do documento. A
  comparação com o último conteúdo salvo permanece atual; editar, desfazer,
  refazer e salvar continuam alterando `dirty` corretamente. Autosave, revisão,
  conflitos, readonly e identidade permanecem nos fluxos existentes.
- [CopilotScreenChat](../../src/copilot/components/CopilotScreenChat.tsx) conserva
  uma referência à conversa/histórico atualizada em effect após o commit React.
  Confirmar navegação usa o texto/histórico mais recentes. Resposta ocupada,
  perda de permissão ou desmontagem impedem a navegação; troca de usuário ou
  organização mantém o isolamento do provider.
- A comparação com código transformado pelo Babel Expo mostrou que o Compiler
  pula `useVideoDraft`, preservando a necessidade do `useMemo` explícito. Já o chat
  dedicado e o chat da aula recebem cache automático: não foram modificados.
  O custo do ScreenChat foi confirmado com parent, provider e hooks reais.
- Não houve virtualização de listas, alteração de keys, mudança do autoscroll,
  do modelo de IA ou do contrato de aplicação de rascunhos.

### Acesso à plataforma e notificações

- [isPlatformAdmin](../../src/api/organization-access-requests.ts) compartilha
  somente a consulta pendente da mesma identidade/geração. Uma chamada posterior
  consulta o servidor novamente; não há TTL de concessão. O
  [hook de acesso](../../src/auth/use-platform-admin-access.ts) nega enquanto
  carrega e descarta concessões da sessão anterior, inclusive novo login da
  mesma conta.
- [listNotifications](../../src/api/notifications.ts) compartilha somente GETs
  pendentes equivalentes por usuário, geração da sessão/cache, token, organização,
  caixa, limite, offset, não lidas e arquivo. Resultados resolvidos não ficam
  retidos como snapshot da caixa.
- Mutações invalidam as leituras antigas. Um consumidor atrasado acompanha a
  geração atual, sem publicar uma lista vazia sobre o refresh recente; mudança
  de sessão/workspace impede esse replay. Falha libera uma nova tentativa.
- A guarda opcional do [transporte REST](../../src/api/rest.ts) acompanha espera
  por token, envio, refresh/retry de 401 e parsing. Chamadas sem essa opção mantêm
  o contrato anterior. Coalescência não substitui autorização do servidor/RLS.

### Carregamento de PDF e quadra

- Os consumidores web usam um único alvo de importação dinâmica,
  [pdf-runtime.web](../../src/pdf/pdf-runtime.web.tsx), para documentos,
  primitivas e renderização. Isso evita que dependências compartilhadas entre
  vários chunks assíncronos voltem ao arquivo comum obrigatório do Metro.
- Os handlers preservam os dados, nomes de arquivo e HTML capturados antes da
  espera. Falhas de importação/exportação usam os estados e avisos existentes.
  O [adaptador nativo](../../src/pdf/pdf-runtime.tsx) mantém os stubs tipados;
  os caminhos nativos continuam exportando HTML, sem executar o SDK PDF web.
- O [workspace da quadra](../../src/components/visual-court/CourtEditorWorkspace.tsx)
  chama diretamente o canvas moderno com as mesmas props. O wrapper anterior
  sempre selecionava esse filho nesse caminho, mas importava também o renderer
  legado e Skia. Os fontes legados, documentos, gestos e histórico foram mantidos.

## Medições locais

### JavaScript inicial do export web

Exports de produção locais comparados nas páginas inicial, login, painel e atletas
da coordenação. Contagem de todos os scripts obrigatórios do HTML, incluindo
runtime e arquivo comum; não apenas o entry. Fontes e outros assets ficam fora.

| Medida | Antes da fronteira PDF/canvas direto | Depois |
| --- | --- | --- |
| JavaScript inicial bruto | 11.798.354 bytes | 9.506.896 bytes |
| JavaScript inicial gzip | 3.225.482 bytes | 2.547.517 bytes (**−21,0%**) |
| Módulos do grafo web | 3.420 | 3.104 |

O chunk PDF sob demanda tem 1.779.977 bytes brutos. Router, configuração do app e
deploy não foram alterados. Os tempos de build frio e quente não são comparáveis;
esta medição comprova redução de código inicial, não uma porcentagem de melhora
de startup, INP ou FPS. Evidência privada em `web-release-initial-js.json` e
`web-slim-initial-js.json`, dentro de `.tmp/performance-20261023/`.

### Contagens e payloads controlados

| Cenário | Antes | Depois | Natureza da evidência |
| --- | --- | --- | --- |
| Aniversários, 1.000 atletas sintéticos | 11 consultas | 1 consulta | Loaders reais, PostgREST mockado. |
| JSON de respostas no mesmo cenário | 1.022.461 bytes | 82.781 bytes | JSON serializado sintético; redução de 91,9%. |
| Objeto de cache no mesmo cenário | 1.168.561 bytes | 82.781 bytes | Projeção serializada; redução de 92,9%. |
| Quatro consumidores de acesso à plataforma | 4 consultas independentes | 1 consulta pendente compartilhada | Teste controlado; a próxima chamada faz nova consulta. |
| Quatro consumidores da mesma inbox | 4 GETs independentes | 1 GET pendente compartilhado | Teste controlado; oito combinações diferentes de filtro continuam com oito GETs. |
| Turmas: unidades/classes/perfis de 100 ms, cache de 25 ms | Modelo sequencial de 325 ms | 225 ms em relógio controlado | Verifica a remoção da dependência sequencial; não mede rede real. |

Esses números não representam banda, latência de produção, CPU, INP ou FPS.

### HTTP e isolamento com backend local real

Supabase/Auth/PostgREST isolados, schema obtido de snapshot do backend local,
duas contas e duas organizações fictícias, 21 turmas e 1.001 atletas sintéticos.
O snapshot não contém todas as migrations posteriores do outro ambiente local;
esse ensaio não demonstra paridade com produção.

| Medida | Antes | Depois | Escopo |
| --- | --- | --- | --- |
| Corpo JSON de GET dos mesmos 1.000 atletas | 1.132.441 bytes (`select=*`) | 80.891 bytes (`id,name,birthdate`) | Resposta HTTP real local; redução de 92,86%. |
| Fases HTTP de unidades/classes/perfis | Mediana de 24,206 ms | Mediana de 17,060 ms | Dez amostras por versão, ordem alternada e aquecimento; redução de 29,5%. |
| Intervalo observado das fases HTTP | 21,981–25,165 ms | 15,446–19,169 ms | Não inclui React, cache, SQLite ou startup do app. |

Leituras entre as duas organizações retornaram `[]` nos dois sentidos sob RLS.
Isso valida esses casos negativos no schema/fixtures locais; não certifica RLS
de todas as tabelas, grants hospedados ou funções remotas. O corpo HTTP foi
medido separadamente da hidratação financeira e do cache do benchmark anterior.

O ensaio de coalescência também usou sign-in Auth real e HTTP local, comparando
fontes API/REST/inbox-scope/push/safe-json do `HEAD` e atuais transpiladas; somente
os adaptadores de sessão/cache/configuração ficaram em memória. Quatro
consumidores na mesma onda passaram de **quatro para um POST** em
`is_platform_admin` e de **quatro para um GET** em notificações. Em duas ondas de
quatro consumidores, cada endpoint passou de **oito para duas requisições**,
confirmando nova consulta por onda, sem reter o resultado resolvido.

A rodada final teve HTTP 200 e respostas equivalentes (`false` para plataforma e
inbox `prof` vazia na fixture). Isso mede compartilhamento de transporte com esse
resultado; não certifica renderização ou todos os estados de uma inbox populada.
Uma primeira coleta durante o setup concorrente recebeu resposta não 200 e foi
descartada; a comparação completa foi refeita. Nenhuma mutação foi executada
nesse ensaio, e o wall clock não é latência de produção.

### Scouting com documento inalterado

Node `24.13.0`, React `19.2.3`, TypeScript `6.0.3`, dependências próprias do
worktree. Hook original do Git e atual transformados pelo Babel/preset Expo com
caller Metro web e React Compiler habilitado. Auth, storage e RPC em memória.
Por tamanho: cinco rodadas de 60 rerenders após dez aquecimentos, 78 rallies e
201 contatos sintéticos. Os valores são medianas dos percentis de cada rodada.

| Posições | p50 antes → depois | p95 antes → depois |
| --- | --- | --- |
| 1.000 | 0,764 → 0,163 ms | 1,410 → 0,384 ms |
| 20.222 | 10,099 → 0,204 ms | 13,670 → 0,516 ms |
| 54.000 | 26,493 → 0,512 ms | 33,048 → 1,298 ms |

Assinaturas recalculadas: **60 → zero por rodada**, em todos os tamanhos. O
benchmark mede rerender do hook; não inclui decoder, layout, GPU ou rede e não
é medição de FPS do estúdio.

### Digitação no ScreenChat

Parent `CopilotScreenChat`, `UnifiedAssistantProvider`, hooks de conversa,
histórico e rolagem e componentes de mensagens reais, transformados pelo Babel
Expo/Metro com Compiler. Primitivas nativas, composer/voz, router e auth foram
substituídos no harness; o histórico real serializa para storage em memória.
Cinco rodadas de 30 teclas após cinco aquecimentos.

| Histórico | p50 antes → depois | p95 antes → depois | Parses históricos por rodada |
| --- | --- | --- | --- |
| 16 mensagens | 23,223 → 1,107 ms | 44,282 → 2,109 ms | 240 → zero |
| 64 mensagens | 20,608 → 0,988 ms | 138,991 → 2,118 ms | 960 → zero |

As latências variaram entre rodadas; não são orçamento de resposta do app. A
eliminação dos parses foi consistente. O histórico manteve **30 gravações por
30 teclas** nas duas versões; rascunhos não foram descartados para obter ganho.
Não é medição de INP, layout DOM, Android ou tempo do modelo de IA.

## Testes focados registrados

- Scouting: quatro suítes/61 testes, incluindo dirty em rerenders, autosave,
  conflitos, troca de fonte, readonly e identidade.
- Chat: seis regressões do ScreenChat e 12 testes existentes de provider,
  conversa e mensagens. Um primeiro caso atingiu o timeout no cache frio;
  repetição focada passou, assim como a rodada final após ajuste do teste.
- Aniversários: quatro suítes/47 testes, incluindo privacidade financeira,
  frescor dos caches nas duas ordens, lista vazia, offline, 403 e identidade;
  três testes do core de aniversário registrados separadamente.
- Notificações: três suítes/32 testes, incluindo consumidores concorrentes,
  filtros, sessão/token/workspace e dois refreshes sucessivos após mutações.
- Turmas: três suítes/24 testes, incluindo oito novos casos
  [de leitura concorrente](../../src/db/__tests__/classes-read-performance.test.ts),
  duplicação e identidade/offline.
- Plataforma: três suítes/20 testes, incluindo 11 casos
  [de acesso compartilhado](../../src/auth/__tests__/use-platform-admin-access.test.ts),
  retry, logout/novo login e estado negado durante carregamento.
- Quadra: três suítes/49 testes de renderização, gestos, cena, persistência,
  histórico e importação legada; comparação do wrapper com o filho moderno.
- PDF: 18 regressões novas e 24 testes existentes aprovados. Os testes novos
  exercitam a fronteira assíncrona e handlers reais extraídos das rotas,
  incluindo falhas e preservação do snapshot; SDK mockado nesses testes.

Os recortes receberam lint e diff check. Essas execuções não constituem smoke
autenticado, validação de RLS hospedada ou release; não somar contagens de rodadas
que podem se sobrepor. Gates finais permanecem separados.

## Evidência local e reprodução

Artefatos de desenvolvimento ignorados em `.tmp/performance/`:

- `scouting-dirty-bench.cjs`, `compile-perf-sources.cjs`,
  `scouting-dirty-compiled-before.json` e `scouting-dirty-compiled-after.json`;
- `screen-chat-provider-bench.cjs`, `screen-chat-provider-before.json` e
  `screen-chat-provider-after.json`, com saída compilada para inspeção;
- os primeiros ensaios de chat em TypeScript puro são exploratórios: o ganho
  aparente de memoização já existia no Compiler e não fundamenta uma alteração.

O ensaio HTTP real usa `.tmp/performance-20261023/real-local-backend-metrics.json`
e seu helper local; coalescência REST usa `local-read-benchmark.json` e
`local-read-benchmark.mjs` no mesmo diretório. Esses diretórios foram conferidos
como ignorados pelo Git.

Asserções reproduzíveis de payload/consultas estão nos testes versionados
[de aniversários](../../src/db/__tests__/student-birthday-candidates.test.ts),
[turmas](../../src/db/__tests__/classes-read-performance.test.ts),
[notificações](../../src/api/__tests__/notification-read-coalescing.test.ts) e
[acesso](../../src/auth/__tests__/use-platform-admin-access.test.ts).

Capturas, sessões autenticadas, tokens e snapshots privados permanecem fora do
Git. Os JSONs citados são evidência local, não artefatos públicos de entrega.
Não copiar conteúdo de usuário para documentação ou fixtures versionadas.

## Smoke localhost com backend isolado

A porta 8081 pertencia a outro worktree e foi preservada. Este checkout usou
`localhost:8082`, com dependências próprias e Supabase local isolado na porta
54421. Contas, organizações e dados são fictícios. No app de desenvolvimento,
login, início com 20 turmas/120 horários, badge com três notificações, diretório
com 1.000 atletas e navegação repetida Início/Atletas foram exercitados.
O export web anterior à separação PDF/canvas também abriu o início autenticado.

Uma primeira execução do Metro atingiu o backend hospedado inesperadamente;
foi interrompida, o cache foi limpo e a configuração local foi conferida pela
origem efetiva das chamadas. Essa execução foi excluída das comparações.
O ambiente conferido usou `127.0.0.1:54421`. Nenhuma operação manual de dados
operacionais, migration remota ou publicação foi realizada.

O ambiente dev apresentou eventos de interação de 336–472 ms em quatro cliques
quentes. Não são INP nem comparação antes/depois: compilação fria, memória da
máquina e trabalho do servidor interferiram. A automação depois perdeu a conexão
com o navegador (`Debugger unattached`), inclusive após recuperação e nova aba.
O export final `web-slim` compilou, mas seu smoke visual completo, busca, replay,
gestos e download PDF no navegador continuam pendentes. Não se declara fluidez
global com base nesses ensaios.

### PDFs reais

O runtime web e os documentos reais, transformados pelo Babel Expo, geraram três
binários com `@react-pdf/renderer` 4.3.2 e Yoga/PDFKit/FontKit reais:
lista de atletas (11.908 bytes, A4 paisagem), plano mensal Calibri
(49.937 bytes, A4 retrato) e relatório de sessão (3.227 bytes, A4 retrato).
Texto, paginação e incorporação das fontes Calibri foram conferidos; as três
páginas rasterizadas foram inspecionadas visualmente.

Somente a resolução dos assets TTF foi adaptada para os caminhos locais dos
arquivos, suportados pelo FontStore. Não substituiu o renderer. Evidências em
`.tmp/validation/pdf-runtime-smoke/`. Isso valida a geração dos binários,
mas não o carregamento do chunk/fontes por HTTP ou o download no navegador.

## Gates do pacote

Após as alterações de implementação, passaram:

- testes focados e lint dos recortes acima;
- `npm run typecheck:app` e `npm run check:org-scope`;
- `node scripts/check-perf-hygiene.js --strict --base HEAD --worktree`;
- `node scripts/check-architecture-hygiene.js --strict`;
- export web de produção local, com 122 páginas estáticas;
- `git diff --check`.

Aplicada a [escada de validação](validation-ladder.md) para dados, autorização,
renderização e bundle. Não houve `build:verified` nem release completo: os gates
aprovados não substituem o smoke final pendente e não autorizam publicação.
O checklist preserva os títulos/IDs/status e contratos de revisão pessoal;
somente as entradas afetadas recebem descrições e evidências locais atualizadas.
Regeneração em 24/10: 29 módulos, 374 itens e 121 arquivos de rota. Comparação
com `HEAD` confirmou os IDs/títulos/status, alinhamento Engineer, rotas e scripts
de revisão/importação/exportação/storage preservados. Sete Markdowns alterados
somam 252 referências locais válidas. A prévia em `localhost:8082` serve
`web-slim`; os hashes dos três scripts iniciais conferem com o artefato medido.

## Pendências de desempenho

- Medir startup frio/quente, navegação, scroll, memória retida e interação no
  browser com dataset/conta/viewport comparáveis, separando build dev e release.
- Validar Android em dispositivo/build apropriado; benchmark Node/web não
  certifica a experiência nativa relatada. O usuário optou por seguir nesta
  rodada sem dispositivo; essa validação permanece pendente.
- Perfil por etapa de ONNX: inferência já usa Worker; extração de pixels,
  preparação de lotes e busca de frames ainda merecem medição da thread da UI.
- Medir reprodução/arraste na quadra, ponte do iframe e metadados por frame;
  comparar exportação PDF/GIF e retenção de mídia ao abrir/fechar o estúdio.
  São hipóteses remanescentes, sem correção ou causalidade comprovada neste pacote.
- Confirmar impacto na distribuição real de uso e, somente sob autorização
  própria, publicação e ambiente remoto. Não encerrar a auditoria global com
  base nos ganhos localizados acima.
