# Salvamento automático da quadra — Go Atleta

Implementação local de 28/10/2026. Edições autorais, desfazer e refazer armam uma
gravação após 800 ms sem novas alterações. Abrir um modelo/rascunho, selecionar
etapa, girar a câmera ou reproduzir a jogada não inicia uma gravação.

O editor reutiliza `saveTechnicalVisual` e os limites de turma/organização. Há
uma solicitação por vez; alterações durante a gravação aguardam uma próxima
tentativa com o mesmo ID. O salvamento automático exige confirmação remota;
falhas preservam o rascunho local e não entram em repetição contínua. Reconexão,
retorno à tela ou o indicador de tentativa podem retomar uma edição pendente.
Rascunhos recuperados não são enviados no bootstrap sem edição ou tentativa
explícita. O atalho de salvamento manual permanece disponível.

O cabeçalho mostra um indicador pequeno, sem botão verde: progresso, confirmação
ou tentativa após falha. O indicador distingue rascunho local de confirmação
remota. Sucessos automáticos não geram toasts. A gravação não bloqueia arrastes
ou a câmera; o rascunho continua protegido ao sair.

Prévia e link de leitura não mostram o indicador nem usam persistência. Abrir
o compartilhamento pausa novos autosaves do editor e fixa a cópia visualizada,
inclusive se uma solicitação anterior terminar e atribuir um ID ao documento.
Trocas de sessão/organização invalidam operações pendentes antes de novos writes.

Validação: testes automatizados do hook, rascunho, concorrência, retry, contexto,
fronteira DB, indicador e leitura; tipos e escopo por organização aprovados.
Testes de rede/armazenamento usam mocks. Não houve alteração de schema ou RLS.
Validação inicial: 81 casos focados aprovados (12 autosave, 36 persistência, 18 DB, 6 indicador,
7 leitura e 2 snapshot do compartilhamento), lint focado e diff check.
8081 sincronizada: rascunho recuperado indicado como local, troca 2D/3D sem
iniciar gravação e prévia sem botão/indicador de salvamento. O smoke autenticado
não alterou a jogada no backend. Agenda preservada; sem commit/push/deploy.

## Falhas transitórias e confirmação remota

Correção local após timeout real em 28/10. A primeira reprodução capturada fez
GET e PATCH, e a tentativa manual terminou com 204. O autosave agora usa um único
POST upsert com retorno da linha gravada; resposta vazia não é confirmação.
O body omite created_at para preservar a data original no conflito. Guardas de
sessão, organização e ID continuam obrigatórias.

Uma falha transitória de rede/timeout agenda uma única tentativa extra após
1,5 s, com o último snapshot e mesmo ID. Duas falhas encerram a rodada; voltar à
aba não reinicia um erro final. Nova edição, reconexão ou retry explícito podem
abrir outra rodada. Auth/permissão/validação não repetem automaticamente.

Validação atual: 97 casos focados (22 autosave, 36 persistência, 24 DB,
6 indicador, 7 leitura, 2 snapshot), tipos, escopo e lint aprovados. Na 8081,
interrupção controlada da pré-verificação de rede produziu duas expirações,
separadas por aproximadamente 1,55 s, e parada sem loop. Após liberar a rede,
a restauração do título disparou o autosave sem clicar Salvar: um POST 200,
linha recebida correspondente ao payload, conteúdo original e created_at
preservados. A requisição observada levou cerca de 1,72 s; não é um benchmark.
Intercepção de teste encerrada, título restaurado, agenda preservada, sem
publicação ou alteração do link compartilhado.

## Identidade dos novos documentos e revisão para publicação

Novas quadras e importações recebem uma identidade local própria, persistida
antes do primeiro envio. O destino remoto deriva dessa identidade e do escopo,
não do título. Assim, nomes iguais não substituem outro arquivo e um retry após
reabrir o rascunho conserva seu destino. IDs remotos e modelo canônico mantêm sua
identidade. Desfazer até o baseline de um rascunho local continua mostrando local,
sem afirmar confirmação remota.

Revisão focada: 67 casos do hook/persistência, 24 DB, 6 indicador, 7 leitura e
2 snapshot (106 casos), mais 13 casos do perfil pequeno de publicação. Novos
arquivos/colisões foram exercitados em mocks; o smoke real descrito acima usou
um documento existente e restaurou seu conteúdo. Fechamento completo de release
em preparação; autorização para commit, push apenas em main e deploy recebida.

## Fechamento do pacote para publicação

Build verificado completo aprovado: 702 suítes/4840 testes Jest, lint,
tipos, SQL isolado, runtime da quadra, escopo, arquitetura, performance e export
web. Inclui o perfil conservador de release pequeno, sem alterar os gates do CI.
A 8081 está sincronizada e os 35 arquivos concorrentes da agenda permanecem
intactos. Publicação autorizada somente via main; CI/EAS/Vercel dependem de
confirmação remota separada. Sem nova migration ou Edge Function neste pacote.
