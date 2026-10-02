# Validação de release

`npm run validate:app` executa os 11 checks existentes com até dois processos
simultâneos. O resultado de cada check aparece assim que termina, junto com o
tempo. Logs completos ficam em `.tmp/validation/`, ignorado pelo Git.

`npm run build:verified` usa a mesma validação e só executa o build após todos os
checks passarem. A exportação usa dois workers para limitar memória. Este comando
nunca faz commit, push, deploy ou mudança remota de banco.

## Reaproveitamento local

Lint, tipos, Jest, SQL e build podem reutilizar um sucesso por até oito horas,
somente no mesmo checkout, runtime e ambiente. As chaves consideram o conteúdo
atual dos arquivos, inclusive novos, removidos, configurações, patches,
dependências instaladas e arquivos locais de ambiente. Valores de ambiente não
são gravados nos recibos nem mostrados no terminal.

- Lint: app, src e scripts; o cache próprio do ESLint também usa conteúdo.
- Tipos: app e src.
- SQL: scripts e Supabase.
- Jest e build: todos os arquivos conhecidos pelo Git, entradas não versionadas
  e diretórios de runtime, incluindo entradas ignoradas.
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
