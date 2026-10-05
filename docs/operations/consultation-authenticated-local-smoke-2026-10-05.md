# Consultoria e regulamentos — smoke autenticado local de 05/10/2026

Continuação das [correções locais](consultation-and-rules-sync-local.md), base
`d5120cff` e alterações locais preservadas. Validação nível 3, sem commit, push,
deploy ou alteração remota. Os 118 testes e checks registrados anteriormente
continuam como evidência daquela execução; este registro acrescenta runtime real.

A [preparação permanente posterior](worktree-local-ready-2026-10-05.md) substituiu
a ligação de dependências por instalação própria e configurou o backend local.
Este documento preserva o ambiente e resultados da rodada anterior.

## Ambiente e isolamento

- Frontend deste worktree em `http://localhost:8082`. O processo existente em
  8081, PID 44064, foi preservado.
- Banco descartável `consultation_qa_<sufixo>`: somente schema de Auth, público,
  Storage, funções privadas/extensões e ledger técnico de migrations de Auth.
  Nenhum usuário, registro do app, segredo de Storage/Vault ou dado real foi copiado.
- A stack local estava em `20260921205434`; as três migrations posteriores deste
  checkout foram aplicadas exclusivamente ao banco descartável. Schema/RLS reais.
- Auth GoTrue `v2.187.0`, PostgREST `v14.1`, PostgreSQL `17.6.1.063` e Edge Runtime
  `v1.74.3`, usando imagens locais existentes, sem instalação de dependências.
- Três contas fictícias, duas organizações e dois atletas. O atleta da organização
  A tem vínculo próprio em `students`, sem membership da equipe. Todas as sessões
  usadas no navegador foram obtidas por login real no Auth local.
- Proxy restrito a Auth/PostgREST/`rules-sync-admin` locais; demais funções não
  encaminharam envio externo. A fonte regulamentar de teste estava inativa.
  Dois modos controlados exercitaram erro de rede e resposta HTTP 403 na interface.

## Conferência das fontes carregadas

A ligação de `node_modules` ao checkout principal é suficiente para os testes
focados anteriores, mas fez o Expo Router resolver inicialmente o app daquele
checkout. O caso negativo mostrou a mensagem antiga de sucesso local após 403.
Essas interações iniciais foram descartadas como evidência das correções.

Para esta validação, o contexto de rotas foi vinculado a um arquivo físico dentro
do worktree por um resolver temporário do Metro. O caso de 403 foi repetido com
o código corrigido: erro explícito, consultoria indisponível e valor anterior
recuperado do servidor. O fluxo inteiro abaixo foi repetido nesse contexto.
O `metro.config.js` original foi restaurado ao encerrar, com diff vazio.

Antes de usar este worktree no desenvolvimento diário, preparar dependências
próprias ou uma resolução de workspace comprovada. Não tratar `cwd`, HTTP 200 ou
lockfile idêntico como prova de que o navegador carregou os arquivos editados.

## Resultado no navegador

| Caso exercitado | Resultado observado |
| --- | --- |
| Profissional autentica e salva perfil | Persistência no servidor; frequência de quatro dias recuperada após reload. |
| Gravação recebe 403 controlado | Mensagem de erro e estado indisponível; nenhum sucesso local. Ao recarregar, o servidor continua com quatro dias. |
| Profissional salva e publica treino | Uma prescrição, um exercício e estado publicado no banco local. |
| Atleta sem cargo administrativo | Visualiza seu treino, inicia e conclui com PSE 7, dor 0 e comentário fictício. |
| Profissional revisa a devolutiva | Histórico mostra uma execução e zero devolutivas pendentes; status `reviewed` confirmado no banco. |
| Queda de rede controlada | Alteração de frequência para seis dias fica local, com aviso de gravação remota não confirmada. Servidor permanece em quatro dias; não houve sincronização automática. |
| Troca de conta e organização durante fallback | Organização B vê seu próprio atleta e perfil padrão de três dias. Não recebe atleta, treino, execução nem perfil local de A. |

UI exercitada no viewport padrão do navegador do Codex. Não foi executada matriz
completa de tamanhos, temas ou aparelho nativo. Um estado transitório de contexto
ainda carregando após login foi substituído pelo contexto correto ao carregar a
organização; a conferência aguardou o atleta e dados efetivos antes das ações.

## API e RLS reais

As verificações diretas usaram sessões reais de Auth e PostgREST com as políticas
do banco descartável, sem simulação de autorização:

- O profissional vê um perfil com quatro dias, um treino e uma execução com PSE 7,
  dor 0 e revisão concluída, após as ações da interface.
- Outra organização recebe listas vazias para perfil, treino e execução de A.
- Inserção de perfil por outra organização retorna 403; envio de log para outro
  atleta/organização também retorna 403.
- Após as negações, perfil e quantidade de execuções continuam intactos. Após o
  fallback local, o servidor também permanece em quatro dias.

## Edge Function real

O entrypoint atualizado de `rules-sync-admin` foi montado somente para leitura no
Edge Runtime local, com Auth/PostgREST do banco descartável:

- OPTIONS respondeu com sucesso; GET retornou 405.
- POST sem sessão retornou 401; payload sem `sourceId`, 400.
- Ator de outra organização recebeu 403.
- Ator autorizado recebeu 200/`status: ok` para a fonte inativa, sem download.

Isso confirma inicialização e os caminhos que usavam `req`. Download, parsing,
atualização de fonte ativa, cron, rate limit no runtime, entrega de notificações
e produção não foram certificados por este smoke. Os casos adicionais do handler
permanecem cobertos pelos 12 testes controlados registrados na etapa anterior.

## Evidência e encerramento

Logs, resultados JSON, credenciais fictícias e screenshots ficaram exclusivamente
em `.tmp/consultation-qa-20261005/`, ignorado pelo Git. Não versionar sessões ou
copiar credenciais desses artefatos para documentação. Scripts temporários não
fazem parte de um comando de release ou ferramenta de produção.

Todas as sessões de teste foram encerradas pela interface. Containers de QA, banco
descartável e Metro 8082 foram encerrados/removidos; as portas 55460–55463 foram
liberadas. A stack original, seu banco, o processo 8081 e o trabalho existente
continuam preservados. O armazenamento local fictício não foi apagado em massa;
o legado permaneceu fora de adoção automática.

O `.env.local` permanente do worktree continua sem configuração; o backend deste
smoke foi fornecido apenas ao processo isolado. Validação local concluída não
significa sincronização com GitHub nem publicação das correções.

Fechamento documental: checklist regenerado com 29 módulos, 370 itens e 116 rotas;
os 359 IDs/títulos originais, template e alinhamento permanecem intactos.
Foram conferidos 21 documentos e 491 links locais, sem destino ausente;
`git diff --check` aprovado. HEAD permanece `d5120cff`, sem arquivos staged.
