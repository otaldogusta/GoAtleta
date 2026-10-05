# Ambiente local do worktree — 05/10/2026

Continuação do [smoke autenticado](consultation-authenticated-local-smoke-2026-10-05.md).
Base `d5120cff`; alterações anteriores e checklist preservados.

## Preparação permanente

- A ligação de `node_modules` ao checkout principal foi movida para um backup
  ignorado. `npm run dev:setup` instalou 1.214 pacotes próprios por `npm ci`.
- Os patches de `decode-uri-component`, `image-size` e `yoga-layout` foram
  aplicados e seus checks passaram. `package.json` e lockfile não mudaram.
- `expo-router`, Expo e Babel agora resolvem fisicamente dentro deste worktree;
  o Metro usa a configuração normal do repositório.
- `.env.local` foi criado somente se ausente, usando a configuração pública da
  stack Supabase **local existente** em `127.0.0.1:54321`. Valores não foram
  exibidos; nenhuma chave privilegiada foi escrita no frontend.
- `npm run dev:doctor` passou: dependências e configuração local disponíveis.
  O arquivo de ambiente, dependências e backup permanecem ignorados pelo Git.
- Lockfile, contexto do Expo Router e arquivo do Yoga no checkout principal
  foram conferidos por hash e preservados. A stack e seu banco não receberam
  reset, migration ou dados de teste nesta preparação.

A stack compartilhada está em `20260921205434`; três migrations posteriores
existem no checkout. Elas foram usadas somente nos bancos descartáveis dos
smokes. `dev:doctor` confirma pré-requisitos, não paridade de schema, autenticação
ou operação de todos os módulos contra o banco compartilhado.

## Validação após a instalação

- Nova execução dos 11 grupos focados: **118 testes aprovados**.
- `npm run typecheck:app` e `npm run check:org-scope` aprovados.
- Runtime isolado validado com dependências próprias e Metro padrão, sem o
  resolver temporário anterior. Login real, salvamento de perfil em quatro dias,
  rejeição de tentativa de cinco dias com 403 e recuperação dos quatro dias do
  servidor passaram no navegador. Outra organização não leu o perfil na API real.
- Handler de regulamentos e vínculo próprio do atleta passaram novamente no
  Edge Runtime/Auth/PostgREST reais. Esta rodada focal confirmou o ambiente novo;
  o smoke completo anterior continua registrado em seu relatório.
- A sessão de teste foi encerrada na interface; banco, containers e Metro 8082
  de QA foram removidos/encerrados. O `metro.config.js` não mudou nesta rodada.
- `npm run build -- --max-workers 2` aprovado: 117 rotas estáticas exportadas
  usando a configuração local. O export não é um artefato de produção configurado.
- ESLint dos arquivos TS/TSX do app alterados, arquitetura strict, encoding,
  marca pública e `git diff --check` aprovados. Conferência documental: 23 guias,
  496 links locais sem destino ausente, IDs/títulos anteriores e template mantidos.

## Uso diário e sincronização

`npm run dev:doctor` confere o setup. O comando padrão `npm run dev:web` usa 8081;
o processo já existente nessa porta foi preservado. Enquanto ele estiver ativo,
inicie este worktree em 8082:

```powershell
node node_modules/expo/bin/cli start --web --port 8082 --max-workers 2
```

Essa inicialização usa a stack local configurada. O app pode escrever nesse banco
quando alguém interage autenticado; os testes deste pacote usam banco separado.

`origin/main` foi consultada em 05/10 e apontava para `d5120cff`, a base deste
worktree. Após a revisão, o usuário autorizou commit e push dos 47 arquivos para
`codex/contexto-tecnico-consultoria`. A branch foi criada nessa base. O registro
do commit e a igualdade com o SHA remoto são a confirmação de envio; main e
produção permanecem fora dessa autorização.

Pacote local preparado para revisão: 47 arquivos de contexto, instruções,
consultoria, notificações, handler e testes. Manifesto de hashes e patch ficam
em `.tmp/worktree-setup-20261005/`, ignorado. Nenhum arquivo de ambiente,
dependência, sessão ou artefato de QA integra o pacote. A confirmação final de
publicação usa `npm run build:verified`, sem alterar arquivos durante os checks.
Os recibos e logs locais são produzidos pelo executor; o histórico do commit
registra o resultado usado no envio, sem fabricar ou transferir aprovação de CI.

O Core CI atual roda em PR/manual/workflow; o push desta branch não o aciona por
si. EAS Update está limitado a main/master. Vercel pode criar preview automático
da branch; aceite de push não comprova conclusão de preview ou produção.

O checklist registra 371 itens e mantém os 359 IDs/títulos originais. A preparação
local passou para evidência registrada; a diferença de schema do banco local
compartilhado ficou pendente, sem aplicar mudanças para fechar esse item.
