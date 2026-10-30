# Validação de release

`npm run validate:app` executa os 12 checks com até dois processos
simultâneos. O resultado de cada check aparece assim que termina, junto com o
tempo. Logs completos ficam em `.tmp/validation/`, ignorado pelo Git.

`npm run build:verified` usa a mesma validação e só executa o build após todos os
checks passarem. A exportação usa dois workers para limitar memória. Este comando
nunca faz commit, push, deploy ou mudança remota de banco.

O check `court-runtime` executa os testes Node do renderer 3D e do motor da
quadra, incluindo a paridade com as fixtures de referência. Ele também pode ser
executado sozinho com `npm run test:court-runtime`. Os globs são resolvidos pelo
Node 24, sem depender da expansão do shell. Uma falha impede o build verificado.

## Reaproveitamento local

Lint, tipos, Jest, runtime da quadra, SQL e build podem reutilizar um sucesso por até oito horas,
somente no mesmo checkout, runtime e ambiente. As chaves consideram o conteúdo
atual dos arquivos, inclusive novos, removidos, configurações, patches,
dependências instaladas e arquivos locais de ambiente. Valores de ambiente não
são gravados nos recibos nem mostrados no terminal.

- Lint: app, src e scripts; o cache próprio do ESLint também usa conteúdo.
- Tipos: app e src.
- SQL: scripts e Supabase.
- Runtime da quadra: renderer em `public/visual-court-3d/`, motor em
  `src/core/court-simulation/` e fixtures em `src/core/__tests__/fixtures/court-reference/`.
- Jest e build: todos os arquivos conhecidos pelo Git, entradas não versionadas
  e diretórios de runtime, incluindo entradas ignoradas.
- A descoberta do Jest exclui `.tmp/`, que guarda cópias e fixtures privadas
  de QA; as suítes do produto continuam na busca normal.
- Configurações na raiz, scripts do executor, patches, dependências e ambiente
  invalidam todos os recibos afetados.
- Encoding, marca, JWT, escopo, assets, arquitetura e comparação de performance
  são sempre executados. Isso preserva também os checks que dependem de Git.
- Build exige ainda `dist/index.html` e hash idêntico de todos os arquivos de
  `dist`. Saída apagada ou modificada exige nova exportação.

Uma falha não produz recibo de sucesso. Checks aprovados podem ser reaproveitados
no próximo comando. Se o conteúdo mudar durante a execução, a execução falha e
não grava novos recibos. Evite editar enquanto um release é validado.

`npm run validate:app -- --fresh` e `npm run build:verified -- --fresh` executam
todos os comandos novamente. Os caches internos de transformação do Jest e
diagnósticos do ESLint continuam disponíveis. Para máquinas com pouca memória,
use `--jobs=1`. Dependências devem ser instaladas com `npm ci`; alterações manuais
em `node_modules` exigem reinstalação, não são uma forma suportada de aplicar patches.

O lock `.tmp/validation/running.lock` impede duas validações simultâneas no mesmo
checkout. Após encerramento forçado, confira se o PID gravado ainda está ativo
antes de remover somente esse arquivo. Recibos são conveniência local, não uma
atestação de segurança transferível nem um substituto do smoke autenticado.

## CI e publicação

O job continua se chamando **Core checks**, preservando branch protection e o
workflow EAS que depende dele. O CI sempre executa os checks, independentemente
de recibos. Só caches internos de ESLint e Jest são restaurados pelo GitHub
Actions; dependências, configuração e patches fazem parte da chave. Execuções
anteriores da mesma referência são canceladas quando substituídas.

O build local e o build da Vercel continuam presentes. A integração Git atual
publica diretamente; remover o build local exigiria primeiro implementar e
validar uma promoção condicionada aos checks do mesmo commit. Nenhuma configuração
remota de promoção foi alterada nesta implementação.

As skills devem usar estes comandos no nível de release e relatar o que foi
executado ou reaproveitado. Microajustes continuam seguindo a
[escada de validação](validation-ladder.md). Não rodar release completo a cada
alteração visual.

## Medição local em 02/10/2026

No checkout com dependências, `build:verified --fresh` concluiu em 279 segundos:
lint 156s, tipos 28s, Jest 203s, SQL 16s e export 44s, com sobreposição dos checks.
Foram 540 suites e 2.979 testes aprovados, sete suites SQL e 117 rotas exportadas.
A repetição sem alterações concluiu em 7 segundos e reutilizou os cinco resultados
pesados. Os tempos são do executor; incluem o cache de transformação já existente
do Metro e não são uma promessa para código alterado ou outro computador.

O CI ainda precisa de execução remota após publicar este pacote. A revisão final
adicionou uma regressão de exclusão de arquivo ao teste de fingerprint, validada
na suíte focada; nenhuma aprovação local é transferida para o CI.
## Release pequeno de apresentação

Para correção revisada de texto, ícone, estilo ou título, usar:

```sh
npm run build:small -- --base=<commit-ja-validado> --test=src/caminho/__tests__/fluxo.test.ts
```

Repetir `--test=` quando houver mais de uma suíte afetada. A base é o último
commit validado antes da correção; usar uma base anterior ao patch também quando
a correção já estiver commitada. O comando considera todo o diff até a árvore de
trabalho, incluindo staged/unstaged e arquivos novos. Não esconder mudanças
concorrentes escolhendo apenas os arquivos que serão staged: preparar um checkout
de release isolado quando a árvore contiver outro pacote.

O perfil mantém ESLint nos arquivos visuais alterados, tipos, encoding, marca,
JWT, escopo, assets, arquitetura, performance e export web. Executa somente as
suítes Jest explicitamente indicadas; não executa SQL nem runtime da quadra.
Recibos `small-lint` e `focused-tests` não equivalem aos recibos do perfil completo.
Build e caches continuam exigindo inputs/ambiente idênticos; mudança durante a
execução invalida o resultado. Falha impede o build. O perfil é recusado no CI;
Core CI permanece executando toda a suíte, sem confiar em recibos locais.

Elegibilidade conservadora: até cinco arquivos de apresentação existentes em
`src/components`, `src/screens` ou `src/ui`, até 80 linhas alteradas por arquivo;
CSS ou TSX sem mudanças de handlers, hooks, imports ou fluxo de controle.
`app/+html.tsx` admite somente alteração de `<title>`. Documentação e testes
podem acompanhar. Exclusões, novas telas/componentes, dependências, configuração,
rotas, auth, permissões, API/DB/core, migrations, scripts e workflows exigem o
perfil completo. O detector textual é um guardrail conservador, não uma prova
semântica: o responsável ainda deve revisar o diff e escolher suítes relevantes.
Mudança de comportamento, dado ou autorização não se torna pequena pela contagem
de linhas. Se o plano for recusado, usar `build:verified`, sem enfraquecer o filtro.

A conferência do fluxo afetado na 8081 continua obrigatória; título/metadados
exigem também conferir o HTML exportado. Não alegar smoke autenticado quando
somente o HTML foi inspecionado. Meta de tempo é 1–3 minutos em ambiente saudável,
sem garantia; reportar duração real e quais gates foram executados/reutilizados.

## Uma publicação, um destino

No release direto de produção autorizado, fazer push do commit apenas para
`main`. Enviar simultaneamente o mesmo commit a `codex/...` cria também um preview
na integração Git da Vercel, consumindo outra posição na fila. Publicar a branch
somente quando houver pedido de sincronização/PR/preview; nesse caso, não criar
produção junto por hábito. Não alterar configurações remotas nem cancelar deploys
existentes apenas para corrigir esse fluxo. Informar destino, commit, URL e estado
real, e encerrar após o deploy autorizado ser acionado, salvo pedido para aguardar.
