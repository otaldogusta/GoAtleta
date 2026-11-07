# Trabalho em duas máquinas

## Primeira instalação

Instale Git, Node.js 24.x (referência: 24.13.0 em `.nvmrc`) e o Codex. Entre nas suas contas no novo computador. No terminal, em uma pasta de projetos:

```sh
git clone --branch main https://github.com/otaldogusta/GoAtleta.git
cd GoAtleta
npm run dev:setup
```

O comando instala exatamente o lockfile com `npm ci`, aplica os patches do projeto e cria `.env.local` apenas se ele não existir. Na primeira execução, terminar com um aviso de configuração pendente é esperado.

Em worktrees, prefira dependências próprias. Uma ligação de `node_modules` para
outro checkout pode fazer o Expo Router carregar as rotas daquela árvore, mesmo
com lockfile idêntico. Preserve a ligação antes de substituir e confira os arquivos
efetivamente carregados. [Preparação e validação de 05/10](worktree-local-ready-2026-10-05.md).

Preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`, usando a URL e a chave pública do projeto correto. Obtenha a configuração pelo painel Supabase ou transfira o arquivo por um canal privado. Nunca use chave `service_role` no frontend. Segredos das Edge Functions continuam no Supabase; não são necessários para iniciar o frontend.

```sh
npm run dev:doctor
npm run dev:web
```

Abra `http://localhost:8081`, entre com sua conta do Go Atleta e confira uma turma. Cada computador tem seu próprio localhost; o computador antigo pode ficar desligado. Ambos devem apontar para o mesmo backend pretendido. Operações feitas pelo app podem modificar dados reais desse backend.

No Codex, abra a pasta clonada. Autentique novamente os conectores que precisar. Leia `AGENTS.md` e `docs/operations/handoff.md` na primeira tarefa.

## Windows local: Node e cache do Metro — 04/11/2026

Nesta máquina, `node` no PATH aponta para 26.7.0; o runtime do projeto continua
em 24.13.0, instalado separadamente. Confira `Get-Command node` e `node --version`.
O executável local aprovado pode ser usado sem alterar o PATH global:

```powershell
$goAtletaNode24 = Join-Path $env:LOCALAPPDATA 'Programs\GoAtletaNode\node-v24.13.0-win-x64\node.exe'
& $goAtletaNode24 scripts/dev-setup.mjs --check
& $goAtletaNode24 node_modules/expo/bin/cli start --web --port 8081 --max-workers 2
```

Esse caminho pertence à instalação desta máquina; em outra, localize o Node 24
instalado. Doctor confirmou dependências próprias e configuração presente, sem
imprimir valores. O companion é separado do Metro: `scripts/start-scouting-live.mjs`
reutiliza um serviço reconhecido sem reiniciá-lo. Reiniciar Expo não autoriza
apagar IndexedDB, certificados, arquivos do celular ou encerrar o companion.

Após EMFILE no cache/graph, `metro.config.js` passou a limitar get/set dos cache
stores a oito operações concorrentes em FIFO. Só EMFILE/ENFILE recebem três
retries limitados; `clear` mantém o contrato síncrono. Nove testes, carregamento
da configuração e lint passaram. Export web local concluído (exit 0, 119,101 s);
Expo reiniciado com companion preservado; a cópia física retomou de 39% para 40%
e concluiu a 100% antes de recarregar a aba. Original e nova UI conferidos após
reload, com um lance preservado. O limite cobre I/O de cache, não todos os
handles do Metro; não certifica estabilidade prolongada de HMR. [Registro e limites](scouting-live-local.md#teste-físico-e-contagem-unificada--rodada-posterior-de-04112026).

## Módulo numérico desconhecido no Metro — recuperação local de 06/11/2026

Após alterações/HMR, o cliente relatou `Requiring unknown module "3349"` ao
carregar `LiveScoutingVideo` pelo estúdio. Os imports literais e arquivos
existiam; dependências eram próprias do checkout e o lockfile não mudou.
A hipótese foi incoerência entre o grafo/chunk do servidor e o mapa do cliente,
sem evidência de pacote ausente.

O processo Metro identificado foi reiniciado com Node 24 e
`expo start --web --port 8081 --max-workers 2 --clear`; depois a página do
computador foi recarregada. O companion da câmera continuou no mesmo processo.
O cache recompilado é de desenvolvimento: IndexedDB, vídeos, certificados e
arquivos do celular não foram limpos. Não foi necessário reinstalar pacotes.

O smoke autenticado abriu a preparação e a revisão de outra análise existente:
original de 43,389917 s em 1920×1080, um rally buscado em 5,1382 s e troca de
abas sem novo erro de módulo. Nove testes do adaptador de cache passaram.
Isso registra a recuperação desta execução; não certifica estabilidade prolongada
de HMR nem conclui o teste físico de uma nova captura.

## Ao trocar de computador

Antes de começar, com a árvore limpa:

```sh
git status
git switch main
git pull --ff-only origin main
```

Se `git status` mostrar alterações, preserve-as em commit antes de atualizar. Se `pull --ff-only` falhar, há divergência: peça ao Codex para revisar e reconciliar os commits. Não use reset ou force-push para contornar isso.

Ao terminar, peça: **“Salve o progresso na branch atual e envie ao GitHub, sem publicar.”** O Codex deve selecionar apenas os arquivos relevantes, revisar o diff e registrar pendências no handoff. Não use `git add .` em árvores com artefatos privados. Rode `npm ci` quando o lockfile mudar.

Trabalhe alternadamente na mesma branch. Para trabalho simultâneo, use uma branch por tarefa e integre depois. Não sincronize a pasta `.git`/`node_modules` por OneDrive ou Dropbox enquanto os dois computadores editam.

## O que acompanha o clone

| Item | Onde fica |
| --- | --- |
| Código, histórico, lockfile, patches, AGENTS.md e skills do projeto | GitHub |
| Dados do app | Backend Supabase configurado |
| App publicado | Vercel; push em main dispara publicação |
| `.env.local`, logins, plugins pessoais e credenciais | Configuração separada em cada máquina |
| Conversas e memórias pessoais do Codex | Não fazem parte do clone; continuidade essencial deve estar no handoff |
| Arquivos gerados, logs e screenshots locais | Backup privado separado, quando necessário |

Enviar uma branch pode criar um preview automático da Vercel. Não é publicação em produção. Só envie para `main` com autorização de publicação.

## Recuperação

O GitHub preserva apenas o que foi enviado. Antes de formatar ou descartar a máquina antiga, confira que o último commit está no remoto, leve os artefatos privados necessários para um armazenamento seguro fora dela e configure/teste a nova máquina.

O backup local criado nesta preparação inclui pendências e artefatos selecionados, mas não credenciais, sessões do Codex, bancos locais, logs temporários, node_modules ou pastas ignoradas. Guardar um backup só no disco antigo não protege contra perda desse disco.
