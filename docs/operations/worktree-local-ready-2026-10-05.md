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
  Posteriormente, a pedido do usuário, URL e chave pública foram restauradas a
  partir do checkout principal para usar o Supabase hospedado e a conta habitual.
  O arquivo anterior foi preservado em backup ignorado; valores não foram
  exibidos. O app continua local em 8081, mas as interações autenticadas usam o
  backend hospedado. As migrations e smokes locais abaixo não atestam o remoto.
- `npm run dev:doctor` passou: dependências e configuração local disponíveis.
  O arquivo de ambiente, dependências e backup permanecem ignorados pelo Git.
- Lockfile, contexto do Expo Router e arquivo do Yoga no checkout principal
  foram conferidos por hash e preservados. A stack e seu banco não receberam
  reset, migration ou dados de teste nesta preparação.

A stack compartilhada estava em `20260921205434`. Após autorização explícita,
as três migrations posteriores foram aplicadas em 05/10 com
`supabase migration up --local`; o histórico agora está em `20260929025310`.
Um backup completo foi preservado em `.tmp/local-schema-review-20261005/`,
ignorado pelo Git. As duas tabelas do catálogo removido estavam vazias.

A segunda execução não encontrou pendências. Foram conferidos os sete campos
do perfil profissional, as quatro tabelas pedagógicas com RLS habilitada e os
grants: mutação pedagógica exclusiva de `service_role`, leitura do perfil
profissional disponível para `authenticated` e negada a `anon`.
`dev:doctor` passou novamente. Nenhum reset, migration remota ou alteração de
produção foi executado na aplicação.

### Smoke autenticado após aplicação

Auth e PostgREST reais da stack compartilhada (`127.0.0.1:54321`) passaram com
duas contas temporárias e uma organização/turma fictícias, removidas ao final
pelos identificadores exatos. O login usou senha no Auth local, sem sessões
sintéticas. Nenhuma credencial foi exibida ou adicionada ao Git.

- Perfil profissional: RPC salva e recupera os dados próprios; outra conta não
  recebe esse perfil e `anon` não executa a leitura.
- Perfil pedagógico: `authenticated` não executa a mutação exclusiva do serviço;
  `service_role` local grava a versão 1, o profissional autorizado a lê e a outra
  conta recebe lista vazia para essa organização.
- Limpeza confirmou ausência da organização e dos usuários temporários.

Esta rodada valida API/RLS das migrations aplicadas. Não repetiu UI no navegador,
CPF com segredo de criptografia nem todos os fluxos do produto. O smoke anterior
da consultoria no navegador permanece evidência do ambiente isolado. Resultados
e helper revisado ficam em `.tmp/local-schema-review-20261005/`, fora do Git.

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

`npm run dev:doctor` confere o setup. Após autorização para encerrar o processo
anterior, o Metro deste worktree foi iniciado na porta padrão 8081. Para iniciar
novamente quando o servidor estiver desligado:

```powershell
npm run dev:web
```

Essa inicialização usa o Supabase hospedado, conforme restaurado a pedido do
usuário. Interações autenticadas podem escrever nesse backend; os testes locais
registrados neste documento não executaram migrations ou fixtures remotas.

`origin/main` foi consultada em 05/10 e apontava para `d5120cff`, a base deste
worktree. Após a revisão, o usuário autorizou commit e push dos 47 arquivos para
`codex/contexto-tecnico-consultoria`. A branch foi criada nessa base. O registro
do commit e a igualdade com o SHA remoto são a confirmação de envio; main e
produção permanecem fora dessa autorização.

Envio confirmado: commit `e263fef3`, com 47 arquivos, na branch indicada; o SHA
remoto foi conferido novamente ao atualizar este checklist. `main` permanece em
`d5120cff`. `npm run build:verified` passou em 275 segundos, sem reaproveitar gates:
553 suites e 3.100 testes Jest, suites SQL e todos os checks do executor, incluindo
o build. O usuário autorizou também commit/push das três atualizações posteriores
de documentação e checklist na mesma branch; a confirmação de envio fica no
histórico Git e na igualdade com o SHA remoto. A página inicial e o login carregaram em 8081 após
restaurar a conexão pública anterior; isso não é evidência de novo login completo
ou smoke de produção.

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

O checklist registra 373 itens e mantém os 371 IDs/títulos anteriores, incluindo
os 359 originais. A preparação
local passou para evidência registrada; a diferença de schema do banco local
compartilhado foi encerrada após aplicação autorizada e verificação estrutural.
