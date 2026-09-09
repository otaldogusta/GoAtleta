# Trabalho em duas máquinas

## Primeira instalação

Instale Git, Node.js 24.x (referência: 24.13.0 em `.nvmrc`) e o Codex. Entre nas suas contas no novo computador. No terminal, em uma pasta de projetos:

```sh
git clone --branch main https://github.com/otaldogusta/GoAtleta.git
cd GoAtleta
npm run dev:setup
```

O comando instala exatamente o lockfile com `npm ci`, aplica os patches do projeto e cria `.env.local` apenas se ele não existir. Na primeira execução, terminar com um aviso de configuração pendente é esperado.

Preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`, usando a URL e a chave pública do projeto correto. Obtenha a configuração pelo painel Supabase ou transfira o arquivo por um canal privado. Nunca use chave `service_role` no frontend. Segredos das Edge Functions continuam no Supabase; não são necessários para iniciar o frontend.

```sh
npm run dev:doctor
npm run dev:web
```

Abra `http://localhost:8081`, entre com sua conta do GoAtleta e confira uma turma. Cada computador tem seu próprio localhost; o computador antigo pode ficar desligado. Ambos devem apontar para o mesmo backend pretendido. Operações feitas pelo app podem modificar dados reais desse backend.

No Codex, abra a pasta clonada. Autentique novamente os conectores que precisar. Leia `AGENTS.md` e `docs/operations/handoff.md` na primeira tarefa.

## Ao trocar de computador

Antes de começar, com a árvore limpa:

```sh
git status
git pull --ff-only
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
