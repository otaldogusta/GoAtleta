# Scouting: visão geral e Estúdio unificado

Frontend local em 02/11/2026, sem deploy. Migração de desfechos aplicada no banco
remoto após autorização explícita; detalhes abaixo.

## Organização

A página Scouting apresenta rendimento da turma e histórico. O cabeçalho tem
uma entrada **Estúdio**, sem portas independentes para coleta, vídeo e ao vivo.
Análises do histórico abrem o mesmo workspace na área Registrar; jogos concluídos
oferecem revisão de pontos/contatos somente para leitura, sem exigir vídeo.
A coleta ativa continua disponível nas análises em andamento. A entrada principal
e a continuação da revisão abrem Vídeo. Nova análise fica no cabeçalho e usa o
formulário existente.

No web, o Estúdio reúne três áreas:

- **Registrar:** coletor embutido, placar e ações na área de trabalho. Configuração
  inicial curta acompanha o conteúdo; a coleta operacional usa o espaço disponível.
- **Vídeo:** player, recortes e revisão do scouting. Abre em Pontos do jogo;
  contatos do vídeo ficam no mesmo painel. Sincronização, formato, lados e
  conferência automática permanecem recolhidos até serem necessários.
- **Câmera:** captura pelo celular, com a conexão e gravações locais existentes.
  Continua restrita ao desenvolvimento local. É uma nova captura; não adiciona
  pontos automaticamente às análises oficiais selecionadas na área Vídeo.

O cabeçalho é único, fixo e permanece montado nas três áreas. As ações próprias
do vídeo ocupam um slot retido do cabeçalho do workspace. Portal, bloqueio do
fundo, retorno de foco e guarda de navegação têm um único dono. Modais permanecem
para configuração ou confirmação pontual.

## Estado e dados

Cada ferramenta monta na primeira visita e permanece montada ao alternar áreas.
Ocultar usa `hidden` e `inert`, sem trocar IDs ou recriar hooks. No vídeo,
`visible` controla reprodução/atalhos; `active` continua significando foco da
rota, para não cancelar processamento ao alternar ferramentas. A câmera mantém
peer e DataChannel; o coletor conserva contato em edição e histórico em RAM.

A saída real encadeia as guardas de coleta, vídeo e câmera. Operações da coleta
em voo bloqueiam saída/troca de análise. Falha ao encerrar a sala da câmera
preserva conexão, sessão e confirmação aberta.

O workspace mantém `videoSessionId` e `manualSessionId` separados. Trocar o set
em Registrar passa pela guarda da coleta e recria somente o coletor; vídeo e
câmera permanecem montados, com processamento e conexão preservados. Trocar a
análise do vídeo passa pelas guardas do conteúdo e mantém a câmera independente.

A lista de sets em Registrar recebe as fontes efetivamente vinculadas ao vídeo,
carregadas pela revisão dentro do escopo autorizado. Não é inferida pelos títulos
nem pela ordem do histórico. Ao abrir um documento de revisão que não é um set,
o registro limpo e sem operação em voo adota o primeiro set vinculado; se a
análise aberta pelo histórico já pertence às fontes, sua seleção é preservada.
Uma escolha manual explícita não é substituída por atualizações da revisão.

Os callbacks de edição e operação em voo atualizam referências síncronas antes
do próximo render. Assim, uma lista de fontes recebida no mesmo lote de eventos
não remapeia um coletor que acabou de ficar em edição ou ocupado. Atualizações
tardias de outro vídeo também são ignoradas. Os testes focados de workspace
(13 casos) e revisão do scouting no vídeo (29 casos) cobrem esse fluxo e o
callback de fontes.

Nenhum contrato de persistência foi substituído. Organização, usuário, turma,
sessionId, fingerprint, chaves de rascunho e sidecars dos vínculos permanecem
iguais. A reorganização não reescreve os registros feitos durante o jogo.
O coletor nativo mantém sua apresentação modal padrão.

## Rendimento

O panorama usa apenas análises concluídas, com totais de análises, ações observadas
e pontos registrados. Não chama sets de jogos. Contextos como 6 × 6 e Outro são
separados antes de calcular indicadores; os critérios existentes de recepção,
ataque e saque são reutilizados. Eficiência negativa continua visível; ausência
de observações é indicada por traço, sem fabricar zero.

A evolução de recepção usa duas ou mais análises com amostra no mesmo contexto.
Detalhar fundamentos revela distribuição, critérios e pontos recebendo/sacando.
A coleta parcial permanece explícita, sem tratar ausência de contato como erro.

## Coleta v3

O coletor reconhece `captureVersion: 3` retornado pelo backend para habilitar
desfechos explícitos de ace/falta e os novos resultados de continuidade. Sem
essa capacidade, mantém a coleta v2; a interface não presume a migração aplicada.
Falta da equipe é separada dos contatos técnicos e não inventa erro de recepção.
Bola de graça devolvida fica fora da eficiência de ataque; bloqueio com
continuidade não encerra o ponto.

A migração aditiva preparada em `20261102163000_scouting_rally_outcomes.sql`
foi **aplicada remotamente com autorização explícita**, no projeto ativo
verificado. O pós-cheque confirmou coluna/constraint de `outcome` e capacidade
`captureVersion: 3`. Sem backfill: os históricos permanecem sem desfechos
inferidos. O pacote não reescreve a coleta original nem os 99 vínculos com vídeo
revisados. O esquema 5 × 1 do mockup continua ilustrativo, sem afirmar um motor
completo de rodízio. O frontend permanece somente no localhost, sem deploy.

## Mockups

[Proposta interativa](mockups/scouting-unified-2026-11-02.html) com estados de
visão geral, registro, vídeo e câmera. Dados ilustrativos são sinalizados
permanentemente; o SVG da quadra não é vídeo real nem resultado do detector.
[Notas e tokens](mockups/scouting-unified-2026-11-02.md).

A [proposta v2](mockups/scouting-unified-2026-11-02-v2.html) preserva as áreas
Registrar/Vídeo/Câmera, abas Recortes/Scouting/Informações e transporte/timeline
reais como referência. Explora registro compacto e 5 × 1 ilustrativo, começando
em Sem atleta. [Estados e limites](mockups/scouting-unified-2026-11-02-v2.md).
A [pesquisa comparada de seis produtos](SCOUTING_PESQUISA_COMPARADA_2026-11-02.md)
separa funcionalidades documentadas, decisões propostas e limites da automação.

## Validação local

Testes focados cobrem retenção entre áreas, carregamento sob demanda, guardas,
escopo, captura em painel, contexto dos indicadores e toolbar no cabeçalho.
Tipos, org-scope, arquitetura e perf-hygiene passaram. Smoke no localhost
confirmou o workspace e a retenção de um campo em edição entre Registrar/Vídeo,
sem enviar o formulário. A troca real de Set 3 para Set 2 conservou o mesmo
iframe do vídeo. Câmera, formulário de nova análise (aberto e cancelado),
detalhes dos fundamentos, histórico e retorno de foco foram conferidos.

Inspeção visual em 390 × 844, 834 × 1194 e 1440 × 1024: reflow de vídeo e
inspetor, áreas do Estúdio acessíveis e sem overflow horizontal da página.
As capturas reais e os mockups são evidências distintas; o mockup usa dados
ilustrativos e não certifica hardware ou processamento.

Hashes do documento e dos vínculos do jogo permaneceram iguais ao baseline:
118 recortes, 51.233 posições e 100 referências (99 com vídeo e uma sem imagem).
Export web local concluído: 124 rotas e chunks separados de Workspace,
Vídeo e Câmera gerados em `dist`. O cache precisou de nova varredura; os avisos
de exports de dependências tiveram fallback e não impediram a compilação.
Esse export não representa publicação nem validação remota.

Na extensão local da coleta v3, 126 casos focados passaram: 43 do núcleo de
rallies, 54 de frontend e 29 da revisão em vídeo. SQL foi validado em banco em
memória, com fixtures limpas e cenário sintético de compatibilidade do schema
hospedado. Tipos, org-scope, arquitetura e perf-hygiene passaram. A migração
remota autorizada teve pós-cheque separado: snapshot de 118 rallies, 159 ações
e 12 sessões com contagens/hashes idênticos antes/depois e zero desfechos
históricos preenchidos. IDs e valores originais foram preservados.

Conferência real desta extensão concluída em 1063 × 704 e 390 × 844, sem
overflow. Recortes/Scouting/Informações conservaram o mesmo iframe, player e
timeline; hashes do sidecar e dos 118 recortes iguais ao baseline, com os 99
vínculos preservados. Não foi criado ponto artificial no jogo: essa conferência
não valida uma nova escrita RPC pela interface. [Contrato da coleta v3](SCOUTING_COLETA_V3_2026-11-02.md).

O rascunho local preservado ainda pode informar sincronização remota pendente
quando a análise recebida não corresponde ao vídeo. A reorganização não aceita
essa versão remota nem esconde o aviso. Os novos controles físicos e a ativação
pública do modo câmera continuam pendentes conforme a
[operação local](../operations/scouting-live-local.md); o funcionamento básico
Android/Wi-Fi foi relatado pelo usuário, sem medição de latência.

## Correção posterior de UI e reprodução — 02/11/2026

As ações do cabeçalho revelam a área Vídeo antes de abrir seus diálogos,
mesmo quando acionadas de Registrar/Câmera. Câmera usa a mesma grade, largura
lateral e início vertical das outras áreas;
conexão fica inline, instruções de certificado recolhidas e ações de ponto
ocultas antes de existir sessão. Em Registrar, `ScoutingRecordedReview` navega
pontos e contatos concluídos em leitura. No Vídeo, navegação de revisão mantém
respiro de 12 px/gap de 8 px, sem repetir o adversário no resultado do ponto.

O player usa busca absoluta e preserva o pedido de reprodução enquanto aguarda
ready/fonte, inclusive no estado BUFFERING. O normalizador SQL que aceita o
primeiro recorte em 00:47.640 foi aplicado com autorização explícita: preflight
conferiu alteração restrita à guarda do primeiro início, hashes e ACLs. A
migração não editou dados existentes. Avisos de sincronização ficam compactos,
com detalhes, exportação e retry; rejeição do servidor é distinta de divergência
entre documento e vídeo, sem repetição de avisos.

Suítes focadas de reprodução, revisão, sincronização, workspace/câmera e leitura
dos registros passaram, assim como SQL, tipos e org-scope. QA real em 1063 × 704
e 390 × 844 confirmou navegação dos pontos/contatos, margens e início vertical
consistentes, cabeçalho retido e ausência de overflow horizontal. Assistir lance
abriu em 01:02 e avançou com imagem; não houve tela preta nos saltos conferidos.
Isso não certifica todas as falhas intermitentes do provedor YouTube.

Nova análise usa a camada acima do Estúdio e altura ajustada ao formulário;
abertura e fechamento foram conferidos sem criar sessão. Após a correção do
normalizador, a interface informa Sincronizado, sem o alerta antigo. Hashes do
documento e do sidecar iguais ao baseline: 118 recortes e 99 vínculos com vídeo.
A migração não reescreveu registros; nenhuma pontuação/vínculo foi editado nem
ponto artificial criado. Frontend somente localhost, sem deploy.

## Câmera: captura, término e exclusão — 02/11/2026

Preparar abre prévia/RTC sem gravar; Gravar aguarda onstart real. Finalizando
aguarda evento final, fila de trechos e commit antes de liberar áudio/vídeo.
Append falho retém Blob/índice em RAM para retry com a tela aberta; exportação
e exclusão ficam bloqueadas até concluir. Reconectar na tela aberta preserva
captura, sem novo QR durante a gravação; captura encerrada exige novo QR.

Horizontal é o padrão, com Vertical antes da captura. Uma barra inferior reúne
gravar/parar, tempo, armazenamento, formato, tela cheia e gravações; preparo e
reconexão ficam no centro da imagem, com QR lateral no notebook.
Tela cheia/orientação são best-effort, sem rotação por CSS/canvas.
Celular confirma exclusão definitiva do recordingId e seus trechos/eventos;
notebook confirma lixeira durável/restaurável escopada, bloqueando ativos e
cópias pendentes, sem ressuscitar gravação excluída. A identificação inclui HH:mm.
Nenhum desses caminhos grava nas análises ou vínculos anteriores.

21 casos da câmera e suítes focadas de host/armazenamento/UI passaram, além de
tipos, org-scope e perf. Interface conferida em 1055×487 e 390×844 sem overflow,
incluindo formato, painel de gravações e cancelamento da exclusão no notebook.
Hashes dos 118 recortes e 99 vínculos revisados idênticos ao baseline.
Novos controles no Android ainda não foram validados fisicamente. Uma aba já
aberta precisa de atualização manual após finalizar/exportar; sem reiniciar o
companion ou publicar. [Fluxo, recuperação e limites](../operations/scouting-live-local.md).

## Hover das abas sublinhadas — ajuste local de 03/11/2026

No web, as abas sublinhadas mantêm fundo transparente e não recebem escala do
Pressable. O hover clareia o texto e sublinha somente a aba inativa; a selecionada
mantém a borda inferior. A variante segmentada conserva o comportamento anterior.

Conferência no localhost em 1589×884 confirmou hover transparente e sem escala.
Enter abriu Câmera preservando a área do Estúdio. Aparência conferida pelo agente
no localhost, sem alteração dos dados ou publicação.

## Cópia parcial e revisão — ajuste local de 03/11/2026

Uma transferência WebRTC interrompida ou abandonada aparece como **Cópia pausada**
com o percentual recebido, inclusive quando o celular informa fonte indisponível.
O receptor anterior é encerrado ao fechar/trocar o canal; trechos confirmados
permanecem. Importação local ativa continua mesmo sem celular conectado.
**Retomar** exige conexão e a fonte da mesma sala temporária; um QR novo não
autoriza por si só o vídeo antigo.

A revisão de uma sessão encerrada continua disponível para marcações e seleção
do arquivo original. Reprodução automática da cópia e download completo exigem
vídeo pronto. O clip de 15 s das 14:44 segue em 13%, com fonte não localizada
nas verificações relatadas pelo usuário; não é um vídeo completo nem há causa de
exclusão comprovada. [Registro e limites](../operations/scouting-live-local.md#cópia-parcial-sem-fonte-disponível--registro-local-de-03112026).

## Cópias futuras e recuperação da conexão — validação local de 03/11/2026

Falha HTTP transitória não declara a câmera offline enquanto peer/canal atuais
continuam saudáveis. O host recupera o estado após poll autorizado ou evento do
peer atual, com sala/canal válidos; callbacks antigos e erros posteriores de
armazenamento não são sobrescritos.

QA do agente no navegador: fonte sintética 1280×720/15fps, MP4 de 20,793467 s e
17.217.374 bytes, com uma falha de poll e uma de heartbeat durante a cópia.
O Estúdio concluiu 100%, reproduziu e baixou bytes/SHA idênticos; após fechar a
fonte e recarregar, o vídeo continuou pronto e reproduziu pelo histórico.
72 testes Node da câmera/47 do host e tipos/escopo/perf/lint passaram. Sem nova
validação física ou publicação. O clip antigo de 15 s/13% é teste descartável
segundo o usuário e permanece preservado, sem recuperação/exclusão nesta etapa.
[Evidência e limites](../operations/scouting-live-local.md#cópia-com-falhas-transitórias--teste-de-navegador-local-de-03112026).

## Registrar ligado à captura e replay — integração local de 04/11/2026

Registrar mantém a coleta existente. Após confirmar o comando, contatos/pontos
recebem vínculos temporais locais com a gravação selecionada. Sincronização
repetida não duplica o vínculo; reabrir/desfazer ajusta o recorte e refazer
recupera os tempos da jogada reaberta. Falha do sidecar não afirma falha do
scouting já salvo.

Vídeo oferece lances para assistir/baixar durante a captura usando o DVR local
do stream recebido, identificado como prévia local recebida. Sua qualidade pode
diferir do original. Pausa, desconexão ou relógio obsoleto não inventa faixa contínua.
Ocultar Câmera pausa só a prévia. Quando o original chega completo, reprodução
e download o priorizam. Vínculos/replay ficam escopados e separados do documento
tradicional, sem nova RPC ou mudança de autorização.

QA nativo pelo agente: fonte sintética e RPC isolada, mídia/RTC/IDB reais. Prefixo
MP4 320×180 reproduziu antes de encerrar a fonte e exportou recorte WebM/VP9;
reabrir/refazer recuperou os tempos. Pausar/continuar e cópia final automática
do original 1280×720, 122,637900 s/98.005.303 bytes passaram, com SHA idêntico
entre fonte e notebook. Reload preservou dois lances e original; navegação do
contato conferida, inclusive durante captura: o clique pausou/posicionou e
atualizações passivas mantiveram a posição enquanto a fonte continuava gravando.
QA em 390×844, 834×1194 e 1440×1024 passou sem overflow.
Smoke autenticado em leitura abriu Estúdio/Câmera com três gravações preservadas
e zero erros de console, sem executar nova escrita oficial. Tipos, escopo,
arquitetura, perf, lint e 256 testes focados passaram. Não certifica celular/Wi-Fi
físicos ou RPC real. Históricos anteriores permanecem separados, sem
exclusão/recuperação do teste de 15 s/13%.
[Fluxo e limites](../operations/scouting-live-local.md#registrar-e-rever-durante-a-gravação--integração-local-de-04112026).

## Contagem única em Câmera — correção local de 04/11/2026

No Estúdio integrado, Câmera mostra **Scouting da gravação**, contagem de lances
e ações **Registrar/Ver lances**. Os cartões de gravações vinculadas exibem
lance(s) e abrem a mesma revisão; download/exclusão permanecem. O placar rápido,
lista de pontos e revisão independentes continuam disponíveis no modo legado
sem integração. Não há duplicação de estatísticas ou alteração de protocolo/dados.

O teste físico anterior à correção confirmou um saque ace sem atleta na RPC
real, histórico em aba nova e placar oficial 1×0, além de replay/exportação
1920×1080 durante captura. A apresentação paralela em 0×0 motivou esta correção.
Após EMFILE/overlay e peer desconectado, o prefixo de 39% e arquivo no celular
foram preservados. Helper
de cache validado por nove testes e export web local concluído (exit 0).
O usuário confirmou reconexão; recebimento avançou de 39% para 40% e concluiu a
100% antes do reload. Original físico 1920×1080/43,389917 s, 33.509.362 bytes,
baixado no Estúdio e reaberto após reload com um lance preservado. O contato
pausou/posicionou a reprodução e o cartão de 04/11 às 22:07 mostrou **1 lance**,
abrindo a mesma revisão integrada; conferência da nova UI pelo agente.
98 testes focados, tipos/escopo/perf/lint/arquitetura aprovados; zero novos erros
no smoke após restart/reload/bundle novo/replay, com logs anteriores preservados. Sem comparação
de hash integral com o celular, corte exato por quadro ou ensaio prolongado de
HMR. Análise em andamento, um ponto sem atleta, sem concluir jogo/excluir originais.
[Evidência e pendências](../operations/scouting-live-local.md#teste-físico-e-contagem-unificada--rodada-posterior-de-04112026).

## Reuso de Rallies para a câmera — correção local de 04/11/2026

Vídeo usa o Estúdio existente para a gravação do celular: player, galeria de
Rallies, timeline, inspetor e exportação compartilham a mesma composição. A
revisão simplificada paralela foi removida. Rallies abre primeiro nesta fonte;
contatos oficiais conservam os nove fundamentos/resultados de Registrar e não
são convertidos em anotações manuais com outra taxonomia.

Recortes independentes, anotações e desfazer/refazer são persistidos somente
no notebook, por escopo/gravação, separados do rascunho sincronizado. Atualizar
o DVR não substitui edições ou reinicia o player durante reprodução/exportação.
Outros vídeos mantém o editor anterior; navegação entre fontes/análises passa
pela guarda de edição. Nenhum compartilhamento ou salvamento remoto é habilitado
para esta revisão local. QA do agente conferiu a fonte física já salva no app
autenticado em 1594×884 e iframe responsivo de mesma origem em 390×844, sem escala
ou overflow horizontal. Fixture isolada confirmou replay durante captura,
edição/undo/reload e exportação; 174 testes e checks focados passaram. Sem nova
captura/RPC física ou publicação.
[Contrato operacional e validação](../operations/scouting-live-local.md#rallies-no-estúdio-existente--integração-local-de-04112026).


## Registrar / Revisar e câmera persistente — aplicação local de 05/11/2026

Proposta visual v2 aprovada pelo usuário antes da aplicação. O Estúdio web passa
para duas tarefas, **Registrar** e **Revisar**, com câmera no cabeçalho e prévia
junto da coleta quando viewport e container comportam o painel. A entrada antiga
`initialMode: camera` abre os controles sobre Registrar; não cria outra sessão.

- Coletor e host ficam montados entre as áreas. Abrir/fechar popover ou sheet não
  desconecta, não para a captura e não troca identidade. Navegação real conserva
  guardas de rascunho, mídia e conexão; trocar de fonte passa pela guarda da fonte
  anterior, inclusive ao voltar à mesma gravação local.
- O cabeçalho distingue registro oficial, captura e disponibilidade de mídia.
  Erro/pendência não afirma Salvo. Relógio da captura e percentual de outra cópia
  não são concatenados como se fossem o mesmo estado. Fonte abre gravações locais
  ou o editor existente de arquivos/links. A toolbar de vídeo só aparece em Revisar.
- Encerrar análise delega ao coletor e ao ConfirmDialog existente, revalida dono,
  escopo, estado e ausência de edição/envio antes do comando oficial. Não para a
  câmera. A confirmação é global, fora do painel oculto.
- Coleta compacta preserva multi-contato, desfechos, treino por repetição e rubricas.
  Atalhos mostram os primeiros atletas do elenco, sem afirmar posição em quadra.
  Reservas escolhidas permanecem visíveis; camisas só quando cadastradas. Nomes
  longos não mudam a altura do cartão. Elenco e últimos pontos têm rolagem limitada.
- O botão Mais oferece Cobertura, Transição e Comunicação já canônicas. Não cria
  rótulos livres ou converte técnica em fundamento. Voz, interpretação por código
  e técnicas pessoais continuam propostas, sem botões fictícios de IA no produto.
- Revisar reutiliza player, recortes independentes, anotações, timeline e histórico.
  A galeria oferece Miniaturas/Lista e filtros por set/fundamento derivados dos
  dados reais. Vídeo tradicional sem set não recebe um presumido; recorte misto
  não recebe placar/set de uma única origem. Contatos oficiais seguem somente leitura.
- Abas têm estado selecionado explícito, vínculo ao painel e um ponto de entrada
  por teclado; setas/Home/End navegam sem interceptar atalhos do navegador.

Não há migration, alteração de RPC/RLS, protocolo da câmera, deploy ou reescrita
dos vínculos anteriores.

Validação do código atual: 195 testes em 12 suítes, `typecheck:app`, escopo
organizacional, arquitetura, higiene de performance e lint, além de ESLint em
31 arquivos, passaram. QA autenticado em localhost conferiu 1535×884 no desktop,
1024×768 com prévia de 309 px preservada e resultados visíveis, e 390×844 com
prévia recolhível abaixo da coleta e sheet da câmera ajustado ao conteúdo.
No navegador, Escape fechou somente a ajuda interna; o segundo Escape fechou o
painel e devolveu o foco ao chip da câmera. Alternar Registrar/Revisar preservou
o registro existente em 1×0. O original local de 43,39 s foi reproduzido; selecionar
o contato levou a 00:07.138 e a reprodução parou no fim do rally, em 00:08.904.
Miniaturas/Lista e filtros por set e fundamento responderam aos dados desse rally.
Sem nova gravação física ou escrita oficial/remota nesta rodada e sem publicação.

## Bancada integrada — aplicação local de 05/11/2026

O [mockup aprovado](mockups/scouting-bench-2026-11-05.png), inspirado na bancada operacional da referência enviada,
foi aprovado antes da implementação. Esta seção atualiza a composição anterior:
coleta, vídeo, timeline e rallies compartilham a bancada web, sem alterar suas
identidades, fontes ou regras oficiais.

- A composição lateral exige `supportsSplitView` da capacidade compartilhada
  (viewport a partir de 960 px) e pelo menos 800 px úteis no container. Registrar
  e Revisar passam a indicar o foco operacional e o dono dos atalhos; coletor e
  editores permanecem montados. Clique/foco no painel transfere esse contexto,
  sem recriar mídia, captura ou sessão.
- Na composição compacta, Registrar reúne uma prévia curta e a coleta; Revisar
  prioriza player e rallies. O reflow conserva alvos de toque, guardas e rascunhos;
  não reduz a página por zoom ou escala. Vídeo mantém proporção e limita a altura
  disponível para deixar controles e miniaturas alcançáveis.
  No celular, a prévia fica abaixo da coleta e a quadra começa em faixa expansível;
  no tablet, a prévia curta fica acima. Notebook baixo usa placar compacto e mapa
  de 150 × 120 px, com seis alvos em duas fileiras de três, de 44,67 × 52 px.
- Existe um só host da câmera. Apenas a superfície de prévia muda por portal
  para o estágio principal ou PIP durante o replay. Voltar ao vivo pausa a revisão
  e retorna a imagem atual, sem parar o celular. O DVR, a cópia do original e suas
  diferenças de disponibilidade/qualidade seguem o contrato anterior.
- Cabeçalho apresenta o estado real da captura e seus comandos de iniciar,
  pausar, continuar e parar, conforme capacidade e confirmação do celular.
  Encerrar análise conserva a confirmação e revalidação oficiais e não equivale
  a parar a gravação. Conexão, fontes e configurações ficam sob demanda.
- Em quadra é uma seleção manual, salva somente no aparelho por usuário,
  organização, turma e análise. Sem seleção, o app pede definir os atletas;
  ordem do elenco não vira formação. Camisas vêm do vínculo cadastrado. Não há
  motor novo de rotação ou 5 × 1, substituição oficial ou sincronização remota
  dessa escalação. IDs ausentes do elenco atual deixam de ocupar posições.
- Entrada por teclado usa camisa, fundamento e resultado da rubrica canônica
  da captura. Níveis 0–3 e aliases explícitos são resolvidos nas opções atuais;
  camisa repetida/desconhecida ou nota com mais de um significado exige correção
  ou escolha pelos controles. Enter adiciona um contato ao mesmo fluxo existente;
  nunca confirma um ponto automaticamente. Confirmação, multi-contato e desfazer
  continuam separados. Não é importação da rubrica de cinco símbolos da planilha.
- Rallies ficam em faixa de miniaturas, com Lista, filtros reais e download.
  Seleção identifica replay e o placar histórico quando há metadados; não muda o
  placar atual. Contatos temporais continuam navegáveis. Ferramentas, anotações,
  ajustes, informações e histórico abrem em sheet; exportação/importação abrem
  seus próprios diálogos após fechar essa sheet. Guardas e namespaces locais
  de edição permanecem; contatos oficiais não viram anotações editáveis.

Sem nova RPC, rubrica, migration, protocolo ou serviço de mídia. Voz e aprendizado
de técnicas pessoais continuam propostas. Implementação somente local, sem deploy.

Validação: rodada integrada com 259 testes em 15 suítes aprovada, seguida das
suítes diretamente afetadas pelos últimos ajustes (112 testes/4 suítes).
`typecheck:app`, escopo organizacional, arquitetura, higiene de performance,
lint e diff check passaram. O aviso de handle de Jest foi rastreado a um timer
do SDK Sentry importado pela instrumentação; não foi alterado o runtime de
telemetria. A suíte de câmera isolada dessa dependência passou 35/35 sem o aviso.

QA autenticado no localhost em 1568×1003 (mesmas dimensões do mockup), 1024×768,
834×1194 e 390×844, sem overflow horizontal. Conferidos coleta ao lado do replay,
miniaturas, filtros, ferramentas em sheet, troca de fonte/retorno sem diálogo
oculto, escalação local salva/restaurada, código inválido sem ponto e rascunho
preservado entre tarefas. O rally real existente foi reproduzido e baixado pelo
novo player (WebM de 1.177.812 bytes); reload reabriu o original e preservou 1×0.
O erro transitório de componente durante HMR foi resolvido antes do reload limpo;
nenhum novo erro de navegador observado nessa conferência final. Prévia/PIP,
pausa/continuação/parada e bloqueio de callbacks antigos têm validação automatizada;
não houve nova rodada física de gravação no celular, nova RPC oficial ou deploy.
Escopo e comparação visual registrados em [Design QA](../../design-qa.md).

### Fidelidade da quadra e hierarquia — correção local de 06/11/2026

O usuário rejeitou a fidelidade visual da aplicação anterior. O mockup aprovado
continua sendo a referência: quadra horizontal em perspectiva, com rede e linha
de ataque, ocupando toda a largura útil. A representação decorativa da bancada
não altera a Quadra Visual nem o contrato de escalação manual e seleção dos seis
atletas. Não há formação inferida, camisas inventadas ou mudança de dados.

A bancada agora distingue títulos de seção 16/22, controles principais 14/20,
placar 24/30 e metadados 12/18; tempo/legenda da timeline usam 13 px. Essa
composição específica segue o mockup aceito, sem ampliar `CaptureText`, `Button`
ou a escala operacional de outras telas. No cabeçalho compacto da bancada, a
indicação secundária de saque deixa de ocupar uma coluna que a truncava.

Conferência autenticada no localhost: 1568×1003, 1024×768 e 390×844. Quadra
desktop 344,16×212,56 px; notebook 260×160,58, com seis alvos 76,27×57,02 px.
No celular foram conferidos recolher, expandir e rolar até os botões de ponto.
41 testes focados, tipos, lint e diff check; sem nova captura física ou deploy.
O novo aceite visual do usuário permanece separado dessa validação local.

### Cabeçalho, timeline e galeria estável — ajuste local de 06/11/2026

Os rótulos de câmera, salvo e encerramento usam `OperationalText`, a mesma
família dos controles nativos do coletor. A regra genérica que ampliava o
primeiro filho das ações para 16 px foi removida; ações principais ficam em
14/20 e o estado salvo em 12/18, com cor herdada do tema.

Na bancada, a timeline usa uma barra contínua de progresso e cursor circular,
com contatos em pontos desenhados por CSS. Capítulos, labels, prévias, navegação
por teclado, cancelamento e commit do arrasto continuam no fluxo existente.
O progresso acompanha a prévia do arrasto, mesmo com ticks antigos do player.
A área expandida do slider não cria rolagem horizontal no workspace móvel.

No split desktop/notebook, a galeria reserva uma altura responsiva independente
de Miniaturas/Lista. Conteúdo excedente rola na região dos rallies. Em janelas
baixas, o workspace pode rolar para manter controles acessíveis; o fluxo mobile
continua sem altura fixa de galeria.

Smoke autenticado em 1346×884 e 1024×768 mediu posição e tamanho idênticos do
player e galeria antes/depois da troca. Em 1346×884, estágio 877,41×334,33 px;
em 1024×768, 576×193 px. Cabeçalho e revisão móvel conferidos em 390×844.
99 testes focados em timeline, galeria e workspace, tipos, lint e diff check.
Jest manteve o aviso de handle já conhecido da instrumentação, com saída 0.
Sem novas gravações, pontos oficiais, persistência remota ou deploy.

### Densidade de rallies — teste e correção local de 06/11/2026

O teste isolado usou os componentes e estilos reais de timeline/galeria com 80
e 240 rallies simulados, respectivamente 960 e 2.880 contatos oficiais. Nenhuma
fixture foi inserida na análise oficial; a rota temporária foi removida.
Não é um teste de captura, decodificação ou exportação de duas horas de mídia.

A regressão confirmou que oficiais eram renderizados individualmente, com
alvos sobrepostos no vídeo completo e no rally ampliado. Na bancada, contatos
manuais, oficiais e pontos agora compartilham um agrupamento visual por distância
em pixels, com alvos de 44×44 e todos os IDs/tempos originais preservados.
Grupos abrem uma lista; cada item mantém seu callback de revisão/seek/ponto.
O contador visual usa 99+ quando necessário; label e lista mantêm o total exato.
O agrupamento é só de apresentação e não reúne nem reescreve rallies oficiais.

Uma faixa de marcações separada do cursor evita disputa de clique/arrasto e
reserva a mesma altura em estados esparsos e densos. Ativação de grupo direciona
o foco à lista; Esc ou seleção devolve o foco ao marcador. A janela de vídeo
disponível é respeitada também na prévia de um contato oficial isolado.

Validação: 109 testes em timeline, galeria e workspace; tipos e lint aprovados.
Cobertura inclui 480 contatos manuais, clusters mistos com callbacks distintos,
240 rallies/2.880 IDs e preservação de filtros/seleção/download por identidade.
No browser, 2.880 eventos ficaram em 18 grupos sem colisão em 1346×884; intervalo
mínimo entre contadores de 16,53 px. Em 390×844, sete grupos e intervalo 14,63 px,
sem overflow horizontal. Todos os eventos permanecem acessíveis pela lista.

Oito alternâncias Lista/Miniaturas mantiveram o retângulo do player e galeria.
Conferência final desktop: 877,41×347,33, x443,59/y93; alcançar o rally 240 também
preservou a posição. Notebook 1024×768: 566×216, x423/y93, nas duas apresentações
com clique real. O scrollIntoView da automação deslocava o container em 10 px
nesse fixture com overflow; o clique de mouse confirmou ausência de movimento
do produto. Sem mudanças extras de scroll para compensar a ferramenta.

Evidência privada em `.tmp/work/scouting-density-qa/`: capturas, medidas e harness
arquivado. O harness não usa mídia pessoal; não comprova throughput de thumbnails
de uma partida longa. A análise real foi reaberta com um rally, placar 1×0 e
vídeo original preservados; seek e Lista/Miniaturas conferidos novamente.
Sem nova captura física, ponto oficial, alteração remota ou publicação.

### Timeline no eixo da referência — correção local de 06/11/2026

A faixa separada de marcadores e os contadores descritos no teste anterior
foram revistos após comparação com `mockups/scouting-bench-2026-11-05.png`.
A bancada agora usa círculos de 12 px sobre o trilho contínuo de 4 px, cursor
branco vertical e uma linha de legendas. O contexto de rally/placar reaproveita
`StudioRallyMetadata`; não calcula nem altera pontuação oficial. Legendas sem
espaço não são pintadas, mantendo detalhes por hover, foco, clique e teclado.

Grupos seguem a distância mínima de 44 px e preservam todos os IDs/tempos.
Um aro discreto identifica o grupo; a quantidade aparece no balão acessível,
sem 99+ sobre a barra. A lista redundante de contatos abaixo foi removida.
Arrasto que começa em um marcador delega ao scrub existente após limiar de
movimento; clique seleciona normalmente e o arrasto não dispara edição ao
soltar. Cancelamento, mudança de rally e ativação por teclado foram cobertos.

QA visual em 1568×1003 comparou eixo y642 com referência aproximada y645.
Captura final real em 1535×884 confirmou círculos e trilho no eixo y540,328.
Um rally, placar 1×0 e original foram preservados. Fixture local de 240 rallies
e 2.880 contatos manteve os 12 itens do grupo denso acessíveis. Conferidos
1024×768 e 390×844, sem overflow horizontal e alvos de 44×44. Lista/Miniaturas
preservou exatamente o retângulo do player tanto na fixture como na análise real.

84 testes/4 suítes, tipos e lint aprovados. Evidências privadas inspecionadas
em `.tmp/work/scouting-reference-timeline/`; rota temporária removida. O teste
de volume usa dados simulados e não certifica mídia longa. Aceite visual do
usuário pendente; sem alteração remota, ponto oficial novo ou publicação.

Microajuste posterior solicitado: cursor branco circular de 14 px substitui
o traço vertical; contatos mantêm centro de 12 px com aro verde e separação
na cor do painel, com realce em hover/foco. Altura, eixo, grupos, labels e alvos
de 44 px preservados. Conferidos no localhost em 1535×884 e no arrasto real;
50 testes da timeline aprovados. Captura em
`.tmp/work/scouting-reference-timeline/round-cursor.png`. Apenas local.

Galeria compactada localmente: reserva desktop de 200 px, ou 248 px quando os
filtros quebram de linha, igual nas duas views. Miniaturas de 128 px com legenda
13/18, metadados 12/16 e truncamento controlado; gaps de linhas vazias removidos.
Ícone de download de 14 px sem caixa, preservando alvo de 44×44. Conferidos
1535×884 e 1024×768, sem scroll vertical com um rally e sem deslocar o player ao
alternar Lista/Miniaturas. 11 testes focados aprovados; captura em
`.tmp/work/scouting-reference-timeline/compact-gallery.png`. Sem publicação.


### Transporte na mesma faixa da timeline — 06/11/2026

A revisão solicitada pelo usuário substitui a composição anterior com controles
acima do trilho. Na bancada, play, relógio e eixo agora ficam na mesma linha;
velocidade, download e tela cheia ficam à direita. Em containers até 720 px,
play/relógio permanecem ao lado do eixo, e as ações secundárias passam para a
linha inferior. Um único conjunto de controles preserva os callbacks existentes;
a revisão fora da bancada mantém sua composição. O relógio compacto mostra
segundos, com precisão de milissegundos preservada em title e na timeline.

Conferência autenticada no localhost em 1346×884, 1024×768 e 390×844, tema claro:
play/relógio/eixo alinhados (no celular, centro y352,25), sem overflow horizontal.
Play/pausa e avanço pelo teclado funcionaram no original salvo. Alternar
Lista/Miniaturas preservou exatamente vídeo 877,406×471 em x443,594/y90 e
painel de rallies de 200 px em 1346×884. Nenhum novo ponto oficial ou gravação.
73 testes existentes em três suítes, tipos e lint passaram. Screenshots privados
inspecionados em `.tmp/work/scouting-inline-transport/`. O ensaio desta rodada
usou um rally real; o stress anterior com dados simulados continua registrado
acima. Sem publicação; aceite visual do usuário continua pendente.


Ajuste subsequente da mesma rodada: removido o contorno de foco em toda a barra
e o focus-within verde do trecho após clique. Foco de teclado usa sublinhado
neutro no capítulo e aro discreto no cursor, sem cápsula ao redor do trilho.
Controles de reprodução usam os tokens compactos: ícone de 16 px, face do play
de 32 px dentro do alvo de 44 px e gaps reduzidos. Conferidos no tema escuro em
1535×884 e 390×844; clique, play/pausa e Tab preservados. 60 testes existentes
de timeline/arrasto e lint passaram; screenshot final inspecionado em
`.tmp/work/scouting-inline-transport/compact-final.png`. Somente local.


Microajuste posterior de 06/11: removido o texto visível repetido de rally/placar
sob a timeline. O contexto permanece no selo do vídeo e no cartão do rally;
a região da timeline recebe a descrição acessível, sem reservar espaço para
uma segunda legenda. Legendas dos eventos usam a faixa liberada, mantendo
anticolisão. 50 testes existentes passaram; QA em localhost, tema escuro e
1535×884, confirmou remoção e preservação da miniatura. Screenshot inspecionado:
`.tmp/work/scouting-inline-transport/no-repeated-context.png`. Apenas local.


Microajuste seguinte de 06/11: marcador da bancada volta a usar etiqueta compacta
abaixo do eixo, com ponteiro, fundo neutro e contador +N nos grupos. O ponto no
eixo tem 4 px, sem os aros concêntricos; foco usa indicação neutra, sem contorno
verde de 44 px. Labels continuam sujeitos à anticolisão e todos os eventos seguem
na lista do grupo. Popover detalhado mantém o posicionamento anterior. Clique na
etiqueta abriu os dois eventos e selecionar Saque posicionou em 7,1382 s; play e
pausa preservados. QA em 1535×884, tema escuro; 60 testes existentes e lint
passaram. Captura inspecionada:
`.tmp/work/scouting-inline-transport/marker-bubble.png`. Somente local.


### Etiqueta abreviada, hover e clique direto — 06/11/2026

Etiquetas da bancada usam as letras canônicas dos fundamentos (S/P/L/A/B/D),
Pt para ponto e R01 para rally; nome/avaliação completos continuam no contexto
acessível e no detalhe. Altura visual de 18 px, anticolisão preservada. Clique
leva diretamente ao primeiro instante disponível do grupo, inclusive para
contato manual/ponto, sem abrir editor. Lista mantém os callbacks individuais;
seta para baixo entra nos detalhes pelo teclado e Esc retorna ao marcador.

Causa concreta do piscar: fallback de hover do Pressable aplicava overflow:hidden
e cortava a etiqueta posicionada além dos 44 px do botão. A correção fica nos
marcadores: overflow:visible e sem transform de pressão. Removido title nativo
concorrente, com aria-describedby para o detalhe existente. Geometria do popup
foi medida e coincide com as coordenadas de viewport; não foi necessário portal.

QA real em 1535×884, tema escuro: clique na etiqueta levou a 7,1382 s; com mouse
sobre ela, retângulo 31,266×18 px, overflow visível e hit-test continuou no botão.
ArrowDown abriu os dois eventos e Esc restaurou foco. 61 testes em duas suítes,
tipos e lint passaram. Regressão cobre grupo misto, seek sem abrir edição e
salto sobre fonte ainda indisponível. Nenhuma nova gravação ou escrita oficial.
Captura inspecionada `.tmp/work/scouting-inline-transport/marker-fixed.png`.
Somente local.


### Preparação no padrão da bancada — 06/11/2026

O estado sem matchState usa ScoutingBenchSetup: placar por equipe, quadro com a
mesma hierarquia da coleta, saque inicial curto e opções de set/levantador
recolhidas. Instruções ficam na ajuda flutuante. A quadra existente foi extraída
para ScoutingLineupCourt e é compartilhada com o Pad; na preparação é somente
leitura, mostra a escalação já existente ou zonas vazias, sem inventar atletas,
iniciar set ou salvar escalação. No celular começa em faixa e pode expandir.
CTA de início permanece no rodapé; conteúdo adicional rola dentro do painel.

O comando start_set, validação de placar, regras de próximo set, rascunho,
pendências e encerramento continuam no coletor. Somente confirmar Começar coleta
envia o comando; abrir opções e expandir quadra não gravam dados. A apresentação
fora da bancada mantém o formulário anterior. O vazio de vídeo da bancada agora
usa ícone, título direto e única ação compacta, com superfície do tema; selo de
vídeo só aparece quando há fonte/documento. Importação e câmera preservadas.

64 testes focados (45 coletor/quadra e 19 replay/source), tipos, lint e revisão
React passaram. Regressões cobrem montagem sem comandos, opções recolhidas,
rascunho/placar inválido, payload de set/saque/rotação e quadra somente leitura.
QA autenticado em localhost: 1535×884, 1024×768 e 390×844, tema escuro; opções,
expansão/recolhimento e Registrar/Revisar conferidos, sem overflow horizontal.
Estado vazio manteve a mesma superfície também no Registrar móvel após correção
da cascata. Não foi acionado Começar coleta no backend real; teste de comando
foi simulado. Placar real permaneceu 0–0 e sem set iniciado.

Capturas privadas inspecionadas em `.tmp/work/scouting-initial-bench/`:
`desktop.png`, `notebook.png`, `mobile-register.png`, `mobile-review.png`.
Sem commit, publicação ou alteração remota. Aceite visual do usuário pendente.


### Conexão da câmera no cabeçalho — 06/11/2026

Fora de gravação/finalização/cópia em andamento, o chip usa Conectada ou Não
conectada a partir de status.connected, com bolinha verde ou neutra. Erros e
histórico de arquivos não determinam a conexão nem deixam a bolinha verde quando
o celular está desconectado. Captura ativa mantém rótulo/relógio e cópia ativa
mantém progresso. Erros, estados detalhados e ações do painel foram preservados.

63 testes focados de status/workspace, tipos e lint passaram; Jest manteve aviso
conhecido de handle assíncrono, com saída 0. Testes cobrem conexão true/false,
metadados de gravações anteriores, erro, relógios e abertura sem remontar o host.
Somente local, sem comandos de câmera ou escrita remota.


Conferência autenticada em localhost (1280×720, tema escuro): chip Não conectada
com tom neutro, painel abre e mantém o motivo real da indisponibilidade, fecha
normalmente. Snapshot em `.tmp/work/scouting-camera-connection/status.png`.
O estado Conectada foi validado por fixtures; não houve nova conexão física de
celular nesta rodada. Metro local estava parado e foi reiniciado sem apagar
armazenamento ou iniciar o companion/câmera. A aba de QA foi fechada ao terminar.


### Câmera como fonte em Adicionar vídeo — 06/11/2026

O modal de links/arquivos também oferece Conectar câmera quando o workspace
expõe a capacidade local. Callback opcional onConnectCamera fecha o modal e
abre o painel já existente, sem iniciar câmera/gravação, trocar mídia, alterar
preferLive ou remontar host. Mantém o link digitado e o rascunho; bloqueia ação
durante importação/processamento/Drive e preserva permissões/sincronização.
Contextos sem callback, compartilhados e replay local mantêm o caminho anterior.

Arquivo e câmera compartilham a linha de alternativas, com texto 12/18 e alvos
de 44 px. Em largura estreita a linha pode quebrar sem overflow. 60 testes
focados (source reattach e workspace), tipos e lint passaram. Jest emitiu aviso
conhecido de handle assíncrono e saiu com código 0. Testes cobrem fechamento,
callback único, link preservado, nenhuma gravação de rascunho/fonte e host único;
a opção não aparece sem capacidade de câmera.

QA autenticado no localhost em 1346×884 e 390×844: modal oferece link, arquivo e
câmera; ação abriu o painel de conexão e fechou importação. Serviço permaneceu
desconectado; não houve start_set, câmera/gravação real ou escrita oficial.
No celular, botões medidos em 157×44 px, sem overflow horizontal.
Capturas inspecionadas em `.tmp/work/scouting-source-camera/`. Apenas local.

### Abertura da câmera sem alerta prematuro — 06/11/2026

A descoberta automática do serviço local consulta capacidades sem publicar ou
limpar mensagens de ação. Serviço ausente ou timeout no primeiro carregamento
mantêm a câmera não conectada, sem aviso de falha antes de qualquer tentativa.
Verificar serviço e Conectar câmera continuam mostrando seus erros reais;
falhas de histórico, armazenamento e comandos não são suprimidas.

O mesmo cancelamento por requisição/escopo impede que uma resposta antiga do
probe substitua o resultado da verificação explícita. 80 testes focados de
host/painel, tipos e lint passaram. Jest manteve o aviso conhecido de handle
assíncrono e terminou com código 0. Nenhuma alteração de protocolo, persistência
ou publicação.

QA autenticado em localhost, 1346×884 e tema escuro: abrir o painel sem tentar
conectar não mostrou aviso. Ao acionar Verificar serviço, a indisponibilidade
real apareceu; uma nova abertura após recarregar voltou ao estado neutro.
Captura inspecionada em `.tmp/work/scouting-camera-initial/initial.png`.
Não houve conexão física de câmera, gravação ou novo ponto oficial nesta rodada.

### Conexão dentro do seletor de fontes — 06/11/2026

Substitui o atalho que fechava Adicionar vídeo e abria o popover do cabeçalho.
Conectar câmera agora muda a etapa do mesmo StudioDialog centralizado. Voltar
retorna a link/arquivo, preservando o link digitado e restaurando foco no atalho.
O host continua único; somente seus controles são portaled para o alvo dessa
etapa, sem outro diálogo ou popover. Fechar, voltar e desmontar liberam o alvo.
Painéis do cabeçalho são fechados ao entrar e não reaparecem ao voltar.

A entrada não cria sala nem inicia câmera/gravação. Gerar QR code aciona o
comando já existente; permissões, importação ocupada, sincronização e rascunhos
permanecem protegidos. O início não repete status/relógio vazio dentro da etapa.
Ajuda/tooltips permanecem dentro da top layer do diálogo nativo, inclusive no
desktop, com Escape fechando primeiro a ajuda. Captura ativa mantém controles,
feedback de cópia e status reais no mesmo conteúdo.

85 testes focados (workspace, câmera integrada e seletor), tipos e lint passaram.
Cobrem mesma instância do diálogo ao voltar, limpeza do alvo, link/foco e host
preservados, atualização de pareamento/prévia no alvo e guardas existentes.
As suítes mantêm avisos conhecidos de act assíncrono/handles, com saída 0.

QA autenticado em localhost: 1280×720 e 390×844, seletor no tema claro fornecido
pela aba temporária. Um diálogo aberto, zero popovers externos; link e foco
preservados ao voltar, ajuda dentro do diálogo, Escape fecha ajuda antes da
etapa e fechamento final não deixa painel aberto. No celular, largura 356 px
e corpo sem overflow horizontal. Capturas finais inspecionadas em
`.tmp/work/scouting-source-camera-inline/desktop.png` e `mobile.png`.
O serviço permaneceu indisponível e a verificação explícita mostrou seu erro
dentro da etapa. QR/pareamento atualizado foram exercitados por fixtures, sem
conectar câmera física ou gravar. Aba temporária fechada e viewport restaurado;
comentário da aba original preservado. Sem commit, deploy ou escrita oficial.

### QR direto no modal — 06/11/2026

A etapa Conectar câmera do seletor não usa outra sanfona nem o título repetido
Conexão da câmera: QR, instrução curta e ícones aparecem diretamente. A variante
inline reutiliza o mesmo conteúdo; o painel independente mantém sua composição.
Fechar a ajuda devolve foco ao ícone correspondente também quando conectado,
sem procurar um summary ausente. Portal e host único continuam preservados.

40 testes focados de conexão/painel e lint passaram. QA autenticado local em
1346×884, tema escuro: um modal, nenhum summary interno, QR inteiro visível.
Captura inspecionada em `.tmp/work/scouting-inline-qr/direct-qr.png`.
A sessão existente estava desconectada com cópia em 3%; a conferência preservou
esse estado, sem recarregar, reiniciar serviço ou enviar comandos de captura.
Sem publicação ou nova escrita oficial.

### Cópia pausada e revisão local — 06/11/2026

Enquanto o peer está desconectado, uma cópia recebida parcialmente usa Cópia
pausada com seu percentual no painel e na biblioteca, sem alterar bytes/receiver.
O diálogo de revisão usa seu seletor próprio também no portal (largura desktop
de 960 px), mantendo os controles nativos e o reflow existente. Revisão/download
da captura física de 28 s conferidos no PC; os defeitos também relatados na
origem e a validação do próximo formato estão separados no
[registro operacional](../operations/scouting-live-local.md#retomada-de-cópia-estabilidade-e-captura--06112026).

## Revisão completa do fluxo local — 06/11/2026

Conexão, QR, foco, fontes, cópia, galeria, escalação e composição responsiva
foram reconciliados com a bancada atual. Inter local na câmera e Assistente no
menu eliminam dependência de fonte instalada e sobreposição do launcher.
Contratos, achados, evidência e pendências físicas ficam no
[relatório da rodada](SCOUTING_REVISAO_UI_UX_2026-11-06.md). Sem publicação.
