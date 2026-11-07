# Modo ao vivo local do Go Atleta

O celular grava no próprio navegador, envia a prévia e, ao encerrar, copia o vídeo
original para o navegador do notebook por WebRTC.
O companion troca somente sinais de conexão; vídeo e pontos não passam por ele.
A coleta em Registrar mantém o fluxo oficial existente; seus vínculos temporais
e o replay ao vivo ficam em bases locais separadas. A câmera não reescreve
análises anteriores ou os 99 vínculos revisados.

## Preparar e iniciar

No notebook, identifique seu IPv4 privado na mesma rede Wi-Fi do celular:

```powershell
npm run dev:scouting-live:setup -- --host 192.168.1.20
npm run dev:scouting-live
```

Substitua o IP pelo endereço real do notebook na mesma rede Wi-Fi. A preparação
cria certificados em `%USERPROFILE%/.config/goatleta/scouting-live`, fora do Git;
não instala confiança nem altera o firewall. O início lê `local-config.json`
dessa pasta sem imprimir chaves. Arquivos incompatíveis ou expirados são
preservados: use outra pasta com `--directory` e inicie com `--config ARQUIVO`.

Um companion reconhecido na porta 8096 é reutilizado sem reiniciar conexões ou
Metro. Porta ocupada por outro serviço ou sem resposta bloqueia o início.
Configuração nova só é aplicada em uma nova inicialização, fora da gravação.

Notebook: HTTP no loopback `127.0.0.1:8096`. Celular: HTTPS no IP do notebook,
porta 8097. Se necessário, liberar a porta na rede privada é uma ação manual.
Não exponha o companion na internet nem publique arquivos `.key`.

Para testar duas abas no próprio notebook sem configurar o celular:

```powershell
npm run dev:scouting-live -- --loopback-only
```

Esse teste usa `localhost`; não habilita QR de Wi-Fi nem valida o celular.

## Conectar o Android

No Go Atleta em `http://localhost:8081`, abra **Estúdio → botão da câmera no cabeçalho** e crie a conexão. O
celular precisa alcançar o IP do notebook; redes de convidados podem isolar os
aparelhos.

O Android precisa reconhecer a CA local. **Baixar certificado local** entrega
somente a CA pública no notebook. Transfira-a ao celular e confira a impressão
digital da preparação. Instalar como certificado CA nas configurações do Android
é um passo manual de confiança; os menus variam. O helper não instala confiança
nem aceita avisos do navegador.

Abra o QR no navegador e permita a câmera. **Preparar câmera** abre a prévia e
conecta ao notebook, sem gravar. **Gravar** inicia a captura; o estado Gravando
só aparece no `onstart` real do gravador. Mantenha a página aberta: bloqueio ou
segundo plano podem suspender a captura. Qualidade e codecs dependem do aparelho,
sem garantia de 1080p/60 nesta versão.

O QR autoriza uma câmera, sem acesso aos dados da turma ou administração.
Encerrar ou expirar a conexão revoga essa autorização. Não compartilhe o link.

## Registrar e rever durante a gravação — integração local de 04/11/2026

Selecione a análise no Estúdio, conecte a câmera e inicie a gravação. Em
**Registrar**, colete os contatos/pontos pelo fluxo existente. Após a confirmação
da coleta, o vínculo com a gravação e os recortes são salvos no notebook por
usuário, organização, turma, análise e gravação. Repetir a sincronização mantém
os IDs confirmados; reabrir/desfazer ajusta o vínculo local. Falha nessa etapa
informa que o scouting foi salvo e permite tentar sincronizar novamente.

Em **Vídeo**, os lances vinculados podem ser assistidos e baixados enquanto a
câmera continua gravando. O notebook grava uma cópia de apoio do stream recebido
por WebRTC, em trechos de cerca de um segundo e até 4 GiB por gravação. Essa
cópia é reencodificada e depende da qualidade recebida; não representa a qualidade
do original do celular. Pausa, desconexão ou troca de segmento/peer separa os
trechos. Depois de encerrar e concluir a cópia automática do original, Vídeo
prioriza o original pronto para reprodução e download.

O tempo de captura usa relógio/calibração frescos e mantém casas decimais,
independente da prévia visível. Continua sendo uma estimativa com incerteza.
Sem sincronização, os registros ficam preservados sem inventar continuidade ou
horário para lacunas. Ocultar Câmera pausa só sua prévia, sem parar a captura.
Os sidecars de vínculo/replay não criam RPC, alteram autorização ou substituem
o documento do editor de vídeo tradicional. Quota/limpeza do navegador pode
afetar essas cópias locais; o original do celular permanece independente.

### Rallies no estúdio existente — integração local de 04/11/2026

A gravação da câmera usa o mesmo player, galeria de **Rallies**, timeline,
inspetor e exportação do Estúdio. **Outros vídeos** conserva o editor e os
rascunhos anteriores; alternar a fonte mantém as duas áreas montadas e respeita
a guarda de edição. Registrar e Câmera continuam disponíveis durante o replay.

O adaptador local mantém os limites individuais de cada recorte, incluindo
sobreposição e intervalos entre lances. Contatos oficiais dos nove fundamentos
são apresentados com seus nomes/resultados originais, separados das anotações
manuais do editor. Um registro sem tempo confiável permanece pendente, sem
criar um rally em zero ou fingir sincronização.

Recortes ajustados, anotações e histórico desta gravação são salvos apenas no
notebook, por conta/organização/turma/análise/sala/gravação, em namespace distinto
do rascunho tradicional. Não há sincronização remota ou compartilhamento desta
revisão. Atualizações do DVR acrescentam novos lances sem substituir edições
humanas; a mídia não muda durante reprodução/exportação. A prévia oculta deixa
de reler os blobs a cada atualização, sem suspender a captura.

Validação desta integração: 174 testes focados em 11 suítes, tipos, escopo,
arquitetura estrita, perf e lint aprovados. No app autenticado, original físico e
rally existente abriram na galeria canônica, com seek/replay e contato original;
nenhuma nova escrita de scouting foi executada no backend real.

Fixture isolada com APIs cloud bloqueadas e fonte canvas/RTC/IDB reais confirmou
replay durante captura, contato oficial separado da anotação manual, ajuste de
recorte e desfazer/refazer. A cópia original concluiu 100%/8.450 partes,
69.215.497 bytes, sem erro de transferência. Download H.264 1280×720/86,297033 s
teve SHA-256 idêntico à fonte. Recorte WebM/VP9 1280×720 de 1.699.928 bytes
exportado pelo editor; janela editada 24,750–31,354 s, último pacote em 5,822 s.
Exportação por captura em tempo real não certifica corte exato por quadro.
Envelope local exportado conservou faixa, uma anotação e duas alterações no
histórico. Após reload com o bundle final, o rally reabriu em 24,750 s e manteve
as anotações; contadores de API cloud/requisições externas permaneceram em zero.
O backend fictício reinicia em memória no reload, sem representar persistência
de scouting remoto. No app real, análise oficial continuou em andamento com o
mesmo ponto sem atleta; somente leitura nesta rodada.

UI inspecionada no app autenticado em 1594×884 e em viewport de iframe de mesma
origem de 390×844, sem escala e sem overflow horizontal (largura/scrollWidth 390).
Galeria, player, timeline e navegação mobile conferidos; o seletor de gravação
fica oculto quando há uma única fonte. Não houve novo teste físico de celular,
nova RPC real ou publicação nesta correção.

## Operar a câmera

### Controles e pareamento contínuo — ajuste local de 03/11/2026

O QR pareia a página do celular com uma sala temporária. O IP é apenas o
endereço do serviço; a sala mantém a autorização da câmera. Agora o mesmo
pareamento permite vários vídeos separados, sem escanear entre gravações.
A sala conserva a expiração atual de duas horas; fechar/expirar a conexão ou
recarregar o estúdio pode exigir outro QR. Não há pareamento permanente por IP.

- **Ligar/Desligar câmera** controla a prévia fora de uma captura; desligar libera
  microfone/câmera sem revogar a sala. O primeiro preparo e as permissões continuam
  no celular. Se o navegador pedir permissão novamente, conclua no aparelho.
- **Iniciar gravação** começa na prévia preparada e espera o onstart real.
- **Pausar/Continuar** mantém o recordingId e o mesmo vídeo; contador e pontos
  ficam suspensos, e o intervalo pausado não entra no tempo de vídeo. O relógio
  usa tempo real para sincronização e desconto explícito das pausas. Após retomar,
  um quadro anterior à retomada não pode gerar marcação.
- **Parar** funciona também pausado, aguarda trechos/commit e libera a captura.
- **Nova gravação** prepara a próxima na mesma sala, pelo celular ou computador.
  O computador autoriza a troca somente após o término salvo e a entrega das
  cópias de pontos pendentes. Os registros anteriores ficam no histórico e o
  vídeo no celular; mensagens atrasadas não reabrem uma gravação anterior.

Pedidos são restritos à sala/recordingId e aguardam confirmação. Falhas de
finalização bloqueiam nova captura. Timeout de comando/início (15s) ou parada
(30s) orienta conferir o aparelho sem inventar sucesso. Fechar a conexão no
computador continua sendo uma ação separada: pode deixar a captura no celular
em andamento e exige atenção à mensagem de saída.

Para carregar esta versão, finalize e exporte qualquer captura anterior antes
de atualizar as páginas. A aba do celular é estática e não recebe código por
hot reload. Não reiniciar o companion durante uma captura. Os controles novos
exigem a versão atual no computador e no celular.

Alteração somente local. Testes cobrem pausas, retomada, relógio/quadro novo,
parada pausada, repetição na mesma sala, isolamento de IDs, filas e falhas;
validação física no Android permanece pendente. Nenhum deploy ou migração.
Validação desta rodada: 62 testes Jest (relógio, host, UI e armazenamento), 50
Node (câmera, serviço, TLS e início), typecheck:app, lint, check:org-scope,
perf-hygiene dos arquivos alterados e diff check aprovados. Smoke autenticado
abriu Estúdio/Câmera em localhost:8081, preservou o histórico e preparou o
pareamento; a página estática da câmera exibiu Ligar câmera e seus controles
iniciais. Sem acesso à câmera física ou gravação real neste smoke.

Na versão atual, a orientação acompanha o giro físico do celular, sem preset
Horizontal/Vertical. A prévia ocupa o viewport, com HUD e ações compactas. Tela
cheia apenas expande a imagem, sem travar orientação ou girar por CSS/canvas.
No notebook há uma entrada central de conexão e QR na lateral. No celular,
uma barra inferior reúne gravar/pausar/continuar/parar, tempo, guias, alternância
de câmera, Configurações e gravações. Preparar/Reconectar aparece no centro da
imagem conforme o estado.

### Gravações salvas e lente — ajuste local de 03/11/2026

A lista do notebook usa linhas compactas com miniatura, horário, duração e pontos.
Clicar na prévia abre a revisão existente; download baixa o **vídeo** quando a
cópia está pronta, e o X mantém a confirmação/lixeira reversível. As marcações
JSON continuam disponíveis no cabeçalho da revisão. Registros antigos sem imagem
usam um ícone de vídeo, sem imagem fictícia.
Novas gravações guardam um pequeno JPEG do primeiro quadro recebido (até
320×180 e 80 mil caracteres), isolado no mesmo manifesto local por usuário,
organização, turma e gravação. A imagem não acompanha o JSON portátil, não é
enviada a servidor e falhar ao capturá-la não interrompe vídeo ou pontos.
Ao escolher o arquivo local de uma gravação antiga, a revisão também salva uma
miniatura após validar identidade/duração; a atualização transacional muda só
a imagem, preservando os pontos e recibos mais recentes.

Nas configurações do celular, **Câmera / lente** lista os dispositivos expostos
pelo navegador após permissão. Há preferência pelos rótulos de traseira principal,
normal ou wide, evitando ultrawide/tele/frontal identificadas. Rótulos podem faltar;
seleção manual fica disponível fora da captura e falhar na troca preserva a fonte
anterior. Zoom 1 é solicitado somente se suportado pelo track; não prova lente
óptica 1× e não simula recorte para fingir câmera principal. Resolução, FPS,
rótulo e zoom reais são exibidos; rótulo/zoom ficam também no manifesto do celular.
A escolha física/qualidade no Android permanece pendente de conferência.
Validação técnica desta extensão: 73 testes Jest (miniaturas, host, armazenamento,
lista e revisão) e 34 testes da câmera, tipos, lint, escopo e perf-hygiene passaram.
QA autenticado no localhost em 1197×884 e 390×844 confirmou organização da lista,
abertura/cancelamento do X e ausência de overflow horizontal. Corrigida a linha
do player que encolhia no grid mobile e sobrepunha o painel; medição DOM final
confirmou painel abaixo do player. Nenhuma exclusão ou captura real executada.

### Vídeo também no computador — ajuste local de 03/11/2026

Após finalizar e salvar a captura no celular, o arquivo original é copiado
automaticamente pela conexão WebRTC para IndexedDB no computador. Não há
recodificação nem envio de mídia ao companion, Supabase ou Vercel. Mantenha as
duas páginas abertas até aparecer **Salvo neste computador**. A lista e a câmera
mostram o progresso; só a cópia completa habilita baixar o vídeo.

Partes de 8 KiB têm SHA-256 conferido antes do commit local e de cada confirmação.
Interrupção preserva o prefixo confirmado para retomada ao reconectar; falha de
integridade, falta de espaço ou fonte ausente não confirma sucesso. O limite
atual é 4 GiB por vídeo, sujeito à quota disponível no navegador. A próxima
captura pode começar na mesma sala; seu início suspende o envio do vídeo anterior,
que retoma depois da captura. Excluir a fonte no celular fica bloqueado durante
seu envio ou enquanto estiver na fila.

**Rever vídeo** abre a cópia completa do computador automaticamente, inclusive após
recarregar a página, sem selecionar arquivo e sem o celular conectado. O ícone
de download baixa esse mesmo arquivo original. Para gravações anteriores, o
ícone **Receber vídeo** solicita a cópia ao celular ainda pareado à mesma sala;
também é possível escolher o arquivo uma vez na revisão, que o valida e guarda
localmente para as próximas aberturas. A revisão de uma sessão encerrada pode
abrir sem vídeo pronto para consultar marcações ou escolher o original; somente
a reprodução da cópia e o download do vídeo completo exigem o estado pronto.

Os vídeos ficam em `goatleta-scouting-live-videos-v1`, isolados por usuário,
organização, turma, sessão e recordingId. É armazenamento deste navegador e
origem, sujeito a limpeza/evicção; não equivale a um arquivo já salvo na pasta
Downloads. O pedido de persistência é best-effort. Use **Baixar vídeo** para
manter um arquivo independente. A lixeira do notebook conserva a cópia para
restauração, sem apagar a fonte do celular.

Validação desta extensão: 88 testes Jest de armazenamento, transferência,
hooks, host, lista e revisão, mais 43 testes Node da câmera. O teste integrado
sender/receiver conferiu bytes originais, limites entre trechos e retomada.
Tipos, lint, org-scope, perf-hygiene e diff check aprovados. Smoke autenticado
no localhost conferiu lista, estados antigos sem cópia e abertura da revisão.
Essa rodada não incluiu transferência física Android/Wi-Fi; a conferência real
posterior está registrada abaixo. Sem commit, push, deploy ou alteração remota.

### Conferência real de gravação, revisão e download — 03/11/2026

Teste autorizado com o celular conectado: iniciar/parar pelo computador gerou
18,238813 s de MP4 H.264/AAC, 1920×1080, 14.848.001 bytes, com fonte informada
como `camera 0, facing back`. Sem marcar pontos nem escolher arquivo do celular,
a cópia chegou a **Vídeo salvo neste computador**, a revisão abriu automaticamente
e a reprodução avançou. **Baixar vídeo** entregou o MP4 em Downloads, conferido
por ffprobe. A revisão foi fechada/reaberta e, depois de recarregar o aplicativo,
o mesmo vídeo voltou a abrir e reproduzir com o celular desconectado.

O arquivo de teste é `go-atleta-2876b9e6-4858-4bc7-84d9-9a38c9ff9e54.mp4`,
mostrado às 14:13 no histórico local. SHA-256 do download:
`b86e064dbc7b0450508b07b8c8edcf170bd3ee67d2fec82403e1de51692c1106`.

A primeira cópia foi lenta: 24% às 17:15:23 UTC e 43% às 17:16:28 UTC, cerca
de 43,4 KB/s nessa amostra. Depois do teste foi aplicado reuso das conexões
IndexedDB do vídeo e das leituras de autorização, sem cache de valores,
mantendo transações novas, tombstone/escopo e SHA/commit antes de cada ACK.
Versionchange/close invalida a conexão; retry único somente antes de criar a
transação. Ganho de velocidade com essa versão ainda precisa de medição real.

A troca de lente passou a liberar os tracks antes de pedir outro dispositivo,
reabrindo o `deviceId` real anterior em falha. Não há equivalência presumida entre
o número da câmera e lente óptica 1×. Após carregar essa correção, o usuário
relatou **could not start video source ao Ligar câmera**, antes da troca.
A abertura inicial agora enumera as câmeras antes de abrir a prévia, permitindo
seleção manual com a permissão já concedida, e tenta recuperar NotReadable,
Abort e TrackStart em até três chamadas, com 250/500 ms de espera. A última
tentativa relaxa somente preferências de vídeo, mantendo a fonte explícita e
áudio; a política anterior para Overconstrained/NotFound permanece separada.
Permissão negada não recebe retry. Aba oculta impede nova tentativa e encerra
stream que chegue atrasado. Falhas têm orientação em português; não se afirma
que outra aba/app seja a causa sem confirmação. A mesma aba do celular precisa
atualizar o script; não exige novo QR nesta sala.

Após aplicar: 80 testes Jest de armazenamento, conexão, transferência, hooks e
revisão, mais 49 testes Node da câmera, tipos, lint, org-scope e diff check
aprovados. Após atualizar a mesma aba, o usuário confirmou que a câmera ligou.
O estúdio recebeu `camera 0, facing back · 1920 × 1080 · 30 fps · zoom 1×`,
com prévia ativa e Iniciar gravação habilitado. A câmera 0 foi mantida ligada,
conforme pedido; não foi iniciada outra captura. Isso confirma a abertura com
seleção prévia no aparelho; a sequência física de troca entre duas lentes com a
prévia ligada não foi repetida pelo agente. Nenhuma publicação ou exclusão de
gravação nesta rodada. Medição de velocidade após o reuso de conexões permanece
pendente, sem afirmar ganho com base apenas nos testes.

Se a conexão cair durante a captura, mantenha a tela aberta e use **Reconectar**:
o gravador e seu recordingId continuam. Não gere outro QR automaticamente durante
a gravação. Depois de encerrar, use Nova gravação na mesma sala. Metadados e
pareamento são guardados localmente em IndexedDB/sessionStorage.

**Encerrar gravação** mostra Finalizando e aguarda o evento final do gravador,
todos os trechos e o commit dos metadados. Depois libera áudio/vídeo e mostra o
estado encerrado. Exportar e excluir ficam bloqueados durante captura,
finalização ou outra operação em curso.

Se um append falhar, o Blob e seu índice permanecem na fila para **Tentar
finalizar**, antes dos trechos seguintes. Até o commit, o trecho pendente fica
em RAM: mantenha essa tela aberta até o retry concluir. O retry não reinicia a
captura nem descarta o trecho final; falha definitiva continua indicada.

### Cópia parcial sem fonte disponível — registro local de 03/11/2026

A gravação de cerca de 15 s, das 14:44, permanece com 13% recebidos no computador.
O usuário relatou lista de gravações vazia no Chrome em
`https://IP_DO_NOTEBOOK:8097/camera`, sem a aba original e sem arquivo localizado em
Downloads. O prefixo recebido foi preservado. A ausência da fonte não demonstra
sua causa: não há confirmação de exclusão nem de vídeo completo disponível.
Sem o original, os bytes que faltam não podem ser reconstruídos pelo fluxo atual.

A correção local apresenta uma cópia WebRTC que deixou de receber como
**Cópia pausada**, preservando percentual e trechos confirmados. A resposta de
fonte indisponível também mantém esse progresso. Fechar/substituir o canal encerra
o receptor anterior, sem apagar o prefixo; uma importação local ativa continua
independente da conexão com o celular. **Retomar** só envia o pedido quando
conectado, e a fonte precisa existir no celular pareado à mesma sala temporária.
HMR/recarga do estúdio não recupera a autorização antiga por meio de um QR novo;
não há retomada entre salas. Se o original aparecer depois, a seleção/importação
manual validada na revisão continua sendo a alternativa existente.

Validação desta correção: 89 testes focados, tipos, org-scope e lint aprovados.
O Metro apresentou EMFILE; a recuperação reiniciou somente o processo Expo
verificado, com Node 24, sem limpar storage/cache e sem reiniciar o companion.
O Go Atleta autenticado voltou em `localhost:8081`, mantendo os 13%. Este caso é
separado do clip de 18,238813 s copiado, reproduzido e baixado por completo.
O usuário classificou o clip de 15 s como teste descartável; a etapa seguinte
não buscou recuperá-lo nem o excluiu.

### Cópia com falhas transitórias — teste de navegador local de 03/11/2026

A câmera passou a distinguir falha HTTP transitória de peer/canal WebRTC
saudáveis. Rejeição de autorização, sala ausente/expirada e fechamento continuam
desconectando. No host, poll autorizado bem-sucedido ou evento do peer atual
restaura o estado somente com a sala/controller atuais, peer conectado e canal
aberto. Respostas tardias após abort, encerramento ou substituição são ignoradas;
a recuperação não apaga erro posterior de gravação/armazenamento.

O agente exercitou o fluxo real do navegador com fixture temporária ignorada em
loopback `8098`: boot/store da câmera reais, MediaRecorder/WebRTC nativos,
canvas 1280×720 a 15 fps sem áudio e proxy autenticado para o companion `8096`.
O Estúdio `8081` iniciou/parou a gravação; metadados de 20.683,2 ms e MP4 H.264
de 20,793467 s, 17.217.374 bytes. Durante a cópia foram injetadas uma falha de
poll e uma de heartbeat: chegou a 100%, com 2.102 partes/ACKs, uma oferta, um
recibo de salvo e zero erros de transferência, expirações ou falhas do upstream.
A reprodução avançou 8,4223 s. O download pelo Estúdio coincidiu em bytes/SHA-256
com o original da fixture:
`44904fa4cec463f51d9db57a8dd6692d6e59fce8383ff065223de9d0b5e13490`.

Após fechar a aba da fonte e recarregar o Estúdio, o histórico manteve a gravação
das 23:18. Reabrir mostrou 1280×720,
20,793467 s e mídia pronta (`readyState=4`), com reprodução por Space sem fonte.
72 testes Node da câmera e 47 do host, tipos, org-scope, perf, lint e diff check
passaram. Evidência local do agente com fonte sintética; não certifica Wi-Fi
físico, nova câmera ou causa histórica dos 13%. Sem publicação/alteração remota.

### Replay integrado durante a captura — teste nativo local de 04/11/2026

QA do agente com fonte canvas sintética, WebRTC/MediaRecorder/IndexedDB reais e
RPC simulada isolada, sem Supabase. O prefixo MP4 do DVR abriu antes de parar a
fonte: duração 35,9353 s, `readyState=4`, 320×180, janela 26,760–34,287 s.
O lance reproduziu enquanto o contador da fonte avançava de 00:53 a 01:21.
O download do recorte gerou WebM/VP9 de 2.034.338 bytes, último pacote em 7,504 s
para uma janela de 7,527 s. O DVR mantém MP4 como primeira opção com base nesse
teste; suporte de formato sozinho não comprova reprodução de prefixos.

Reabrir/desfazer removeu um recorte; refazer recuperou seus tempos originais,
mantendo dois lances. Pausar/continuar foi exercitado. Ao encerrar, a cópia
automática do original chegou a 100%: 11.964 partes, 98.005.303 bytes, MP4
H.264 de 122,637900 s e 1280×720. Vídeo passou a priorizar esse original, inclusive
no download. SHA-256 da cópia no notebook, idêntico ao da fonte:
`a4a89697583fba606ff46a3607de002f45b51c9e97b5f84e3480fae50cfedfa9`.

A diferença 320×180 no DVR versus 1280×720 no original pertence a essa amostra
local. Não certifica celular/Wi-Fi físicos nem nova escrita RPC no backend real.
Após reload, sidecar com dois lances e original continuaram disponíveis.
O contato pediu 28,760 s e o player respondeu em 28,759799 s; isso confere a
navegação, sem remover a incerteza do relógio estimado. Em nova captura ativa,
clicar no contato pausou o replay em 6,204839 s, descontado o início do segmento
do DVR. Atualizações passivas conservaram essa posição enquanto a fonte
continuava de 00:21 a 00:57; parar a fonte terminou sem erro. QA do player em
390×844, 834×1194 e 1440×1024 passou, com grade/rolagem responsivas e sem
overflow horizontal. Smoke autenticado em `localhost:8081` abriu
Estúdio → Câmera, conferiu serviço disponível, três gravações anteriores
preservadas e zero erros de console. Não havia análise real na visão geral;
nenhuma nova escrita oficial foi exercitada nesse smoke.

Na segunda captura, a cópia original também concluiu a 100%. Exportar o lance
diretamente desse original gerou WebM/VP9 em 1280×720, 1.012.244 bytes e último
pacote em 3,580 s, para a janela de 4,861–8,624 s. A exportação usa reprodução
e reencodificação nativas; esse resultado não certifica corte exato por quadro.
As abas/arquivos públicos temporários da fixture e o servidor 8098 foram
encerrados/removidos; Metro e companion permanecem ativos.

Tipos, escopo organizacional, arquitetura estrita, perf, lint e 256 testes
focados passaram nos fechamentos registrados. Testes anteriores de 18 s, 20 s e o clip
descartável de 15 s/13% continuam separados, sem exclusão ou recuperação nesta
etapa. Nenhum commit, push, deploy ou alteração remota.

### Teste físico e contagem unificada — rodada posterior de 04/11/2026

Com autorização explícita do usuário, foi criada **Teste ao vivo — integração
de vídeo**, jogo 6×6 de 04/11, set em 0×0, saque nosso e rotação não informada.
Um **Saque → Ace → Sem atleta** foi confirmado pela RPC real. Uma aba nova
releu uma ação no histórico; Registrar mostrou um ponto e placar 1×0.
Esta rodada física é distinta das fixtures/RPC simuladas registradas acima.

O celular informou prévia 1×, 1920×1080, e a captura durou cerca de 43 s.
O DVR nativo em 1920×1080 reproduziu enquanto o celular gravava. Exportar o lance
gerou WebM/VP9+Opus de 1.125.368 bytes, último pacote em 3,781 s para a janela
de 5,138–8,905 s. Isso confere esse replay/recorte local, sem garantir corte por
quadro ou qualidade uniforme em outros aparelhos/redes.

A conferência revelou o placar rápido independente em Câmera, ainda em 0×0,
apesar do ponto oficial salvo. A correção de UI usa os lances da análise na
seção **Scouting da gravação**, com **Registrar/Ver lances**. Cartões vinculados
mostram lance(s) e abrem a revisão integrada; download/exclusão permanecem.
Sem integração ou para gravações sem vínculo, o fluxo legado é preservado.
Não duplica estatísticas, gravações ou pontos nem altera protocolo/storage/auth.
39 testes UI/salvos, 30 do Workspace e 20 do hook passaram, com tipos, escopo,
perf e lint. A nova apresentação foi conferida pelo agente após o reload final.

A cópia do original avançou de 37% a 39%. Durante o recebimento, Metro apresentou
EMFILE no cache/graph e overlay de erro; o peer foi observado desconectado.
Os 39% recebidos e o arquivo original persistido no celular foram preservados.
Não se atribui a falha ao aparelho ou à rede física sem evidência.

Após reiniciar somente o Expo com o limite de cache, a aba antiga do Estúdio
foi mantida sem reload. O usuário confirmou **Reconectou** e o notebook voltou
a **Recebendo**, de 39% para 40%, para a mesma gravação/fonte física. No fechamento,
a cópia chegou a **100% / Vídeo salvo neste computador**. O download pelo Estúdio
gerou `go-atleta-dbc9a557-91b9-4f7f-933b-5107a6472c6a.mp4`: 33.509.362 bytes,
43,389917 s, 1920×1080, H.264/AAC, com mídia pronta no navegador (`readyState=4`).
Não foi comparado o hash integral com o arquivo do celular nesta rodada física.
O ffmpeg terminou com exit 0, com avisos de DTS duplicado no null muxer; não se
declara decodificação sem avisos nem corte exato por quadro.

Depois do reload da aba proprietária, o pareamento anterior foi encerrado e não
foi criada outra conexão. **Estúdio → Vídeo** reabriu o original pronto com um
lance preservado. A reprodução avançou 5,337335 s; clicar no contato de 7,138 s
posicionou/pausou em 7,1382 s. Em Câmera, quatro gravações apareceram no histórico;
o cartão de 04/11 às 22:07 mostrou **1 lance**, e seu clique abriu a mesma revisão
integrada. Essa conferência valida a navegação reportada, mantendo a incerteza do
relógio estimado. A análise de teste ficou **em andamento**, com um ponto sem
atleta; o jogo não foi concluído. Originais e o teste antigo de 15 s/13% preservados.
Devtools manteve sete erros históricos anteriores ao reinício; não houve novos
erros nesse smoke após restart, reload, bundle novo e replay. Isso não é garantia
global de ausência de erros ou estabilidade prolongada de HMR.

O Expo foi encerrado de forma controlada; o companion foi mantido. O helper
local do Metro limita get/set de cache a oito slots em FIFO e retenta somente
EMFILE/ENFILE em 50/150/350 ms, sem limpar dados ou alterar `clear` síncrono.
Nove testes, carregamento da configuração e lint passaram. O export web local
terminou com exit 0 em 119,101 s: 3.140 módulos cliente, 3.191 servidor e
32 bundles, em `.tmp/work/scouting-live-validation-build-20261104-physical`.
Expo reiniciado, companion preservado. Fechamento desta correção: 98 testes
focados (9 cache, 39 UI/salvos, 30 Workspace, 20 hook), tipos, escopo, perf, lint
e arquitetura estrita aprovados. Export não comprova publicação. O limite cobre
I/O dos cache stores, não todos os handles do Metro; não houve ensaio prolongado
de HMR. Nenhum commit, push, deploy ou exclusão nesta rodada.
[Preparação desta máquina](workstations.md#windows-local-node-e-cache-do-metro--04112026).

### Conexão, navegação e registros interrompidos — ajuste local de 03/11/2026

**Verificar serviço** exibe Verificando, bloqueia repetição e informa o resultado
do serviço local. Falha aparece uma vez, e tempo esgotado permite tentar de novo.
Serviço disponível não significa que o celular já está pareado; **Conectar câmera**
continua sendo a ação que cria a sala e apresenta o QR.

O estúdio passa a ocupar a área da rota, com margens responsivas e a navegação
principal do aplicativo acessível. Trocar as ferramentas mantém suas instâncias;
sair pela navegação respeita as guardas de coleta, vídeo e câmera. A composição
reorganiza player e painel pelo espaço disponível, sem cobrir a barra lateral.

Uma gravação histórica não finalizada também tem X quando está fora da captura
pareada atual e sem vídeo recebendo. A confirmação move o registro para a lixeira
e conserva seus pontos, fila pendente e estado original para restauração; não
inventa término de gravação e não apaga o vídeo do celular. A captura atual
permanece protegida. Nenhum registro antigo é removido automaticamente.

Validação desta rodada: 107 testes focados (host/armazenamento, interface ao vivo,
workspace e perfil da sidebar), tipos, lint, org-scope, perf-hygiene e diff check
aprovados. Sucesso do serviço e abertura/cancelamento da confirmação conferidos
no localhost autenticado; falha/timeout/cancelamento também cobertos em testes
isolados. QA em 1197×884, 1440×1024, 834×1194 e 390×844 sem overflow horizontal
ou sobreposição entre player e painel. Sidebar real expandiu; no mobile, o botão
do cabeçalho abriu o mesmo menu e fechou mantendo a câmera conectada. O viewport
original foi restaurado. Nenhuma exclusão foi confirmada, captura iniciada pelo
agente ou publicação feita.

### Painel de conexão compacto — ajuste local de 03/11/2026

Com a sala criada, **Conexão da câmera** apresenta o QR e a frase **Leia o QR no celular.**
Copiar link, testar neste computador e ajuda usam ícones com rótulos acessíveis;
os nomes aparecem também em balões ao passar o mouse ou receber foco. Copiar
mostra seu resultado na própria interface, inclusive quando falha.

A ajuda abre um balão interativo com `AnchoredDropdown`: reúne Wi-Fi, preparo,
reconexão, continuidade do pareamento e acesso ao certificado público do Android.
Links podem ser acionados dentro do balão; o botão Fechar e Escape retornam o
foco à ajuda. Avisos críticos, como não recarregar o celular durante uma gravação
com conexão interrompida, continuam visíveis fora da ajuda.

É uma mudança de apresentação, sem alterar protocolo, autorização, dados ou
regras do pareamento. Validação registrada: 40 testes Jest (27 da interface ao
vivo e 13 do painel), `typecheck:app`, lint dos quatro arquivos e diff check
aprovados.

QA feito pelo agente no navegador em 1589×884 e 390×844 conferiu QR/três ícones,
ajuda com a fonte canônica Inter sem recorte, Escape fechando e foco de volta ao
botão. No mobile, o balão ficou dentro do viewport e a largura do documento
permaneceu 390, sem overflow horizontal. O link do certificado permaneceu na
ajuda. Não foi iniciada gravação/mídia real nem baixado certificado nesta rodada;
o teste de copiar usou mock, sem manipular o clipboard real. O preparo com
**Ligar câmera** continua nos passos da ajuda.

### Enquadramento e controles da câmera — ajuste local de 03/11/2026

O estúdio apresenta **Câmera traseira/frontal**, com zoom quando informado, no
lugar do rótulo técnico do navegador. Qualidade e quadros por segundo ficam em
Informações da câmera, recolhido. No celular, nomes amigáveis ficam no seletor;
os rótulos originais continuam internos, sem presumir lente principal por índice.

A prévia tem guias de terços e referência central, ligadas por padrão e com
botão para ocultar. O SVG acompanha as dimensões reais com `meet`, sem linhas nas
faixas pretas, sem canvas/recorte da captura e sem entrar no arquivo gravado.
As linhas auxiliam o enquadramento; não medem automaticamente nível ou quadra.
Somem quando não há imagem ativa e podem ser alternadas durante a captura.

**Alternar câmera** usa duas setas e troca entre frontal e traseira fora da
captura; não escolhe Horizontal/Vertical. Configurações mostra **Orientação
automática** e o formato real da imagem, com orientação para girar o celular.
**Tela cheia** fica separada em Configurações e apenas expande a prévia.
O preparo não abre mais tela cheia automaticamente. Cronômetro/estado ficam na
barra; MB, resolução, FPS e opções de câmera ficam em Configurações. Rotinas
repetidas somem; falha e progresso da cópia continuam visíveis. Depois de encerrar,
Nova gravação é a única ação primária, e Ligar câmera permanece secundária.

Validação da rodada anterior de enquadramento: 28 testes Jest de apresentação/interface
e 52 Node da câmera, typecheck:app, lint e diff check aprovados.
QA usou boot/HTML/CSS reais com
vídeo sintético e store/transport em RAM, em servidor temporário só loopback,
sem conectar ou gravar no celular real. Conferidos 844×390, 390×844 e 320×640:
grade limitada ao vídeo, toggle, orientação separada, estado encerrado/envio de 7%,
uma primária, foco e ausência de overflow. A barra de 320 reorganiza ferramentas
em segunda linha durante captura para não sobrepor o cronômetro. Essa rodada
não certifica rotação/tela cheia física no Android. O script estático do celular
exige atualização fora de captura/finalização; preservar o original e concluir
cópias pendentes antes de recarregar. Nenhuma publicação ou exclusão foi feita.

### Alternância de câmera e orientação automática — correção local posterior de 03/11/2026

O botão de duas setas alterna dispositivos de faces reconhecidas; não escolhe
Horizontal/Vertical nem gira a imagem. A troca fica bloqueada durante captura,
pausa, preparação e finalização. Ao voltar à traseira, prioriza o padrão salvo;
sem padrão, pode retomar a última fonte válida dessa face na aba.
Falhar na troca tenta reabrir a fonte anterior;
se a recuperação também falhar, a interface mostra a câmera desligada.

Selecionar uma câmera nas Configurações apenas muda a prévia. Depois de conferir
o enquadramento de uma traseira, **Usar como padrão** valida a fonte ativa e a
imagem antes de gravar a preferência local. O botão só muda para **Câmera padrão**
após reler e conferir o valor salvo; erro de armazenamento aparece sem confirmar
a gravação do padrão. Testar outra traseira ou alternar para frontal não o altera.

A preferência fica no aparelho/navegador em `localStorage`, sob
`goatleta:live-camera-rear-preference:v1`, com deviceId e rótulo limitados, sem
vídeo, pontos ou autorização de pareamento. Na abertura, usa o ID ainda disponível
ou o mesmo rótulo traseiro quando houver correspondência única. **Ligar câmera**
retenta o padrão salvo em vez de reutilizar o último fallback, inclusive quando
o enquadramento anterior era 0,6×. Uma escolha manual feita enquanto a câmera
está desligada vale para a próxima abertura, sem salvar outro padrão por seleção.
Origem diferente ou limpeza dos dados do navegador pode perder a preferência.
Sem escolha salva, a preferência por principal continua limitada aos rótulos
identificáveis; número da câmera e zoom informado não provam lente principal.

Antes de pedir a câmera, o preparo tenta liberar uma trava de orientação anterior.
Não aplica bloqueio durante prévia ou captura, e confirma quadros da nova fonte
antes de anunciar a prévia pronta. As preferências de resolução permanecem nos
eixos primários da captura, sem inverter largura/altura quando o aparelho gira.
Dimensões reais do vídeo decodificado orientam formato exibido, guias, informações
e manifesto; eventos de orientação/resize atualizam o estado enviado ao estúdio.
Durante o giro físico, prévia, transmissão e gravação continuam usando a mesma
fonte, com a orientação nativa dos quadros. Não há rotação ou recorte por
CSS/canvas para simular o resultado no celular ou somente no computador.

Validação da rodada anterior de orientação automática: 61 testes Node, lint,
`typecheck:app` e diff check aprovados. Revisão focada sem bloqueios.
No fixture isolado com HTML/JS reais,
a abertura vertical e o giro para horizontal, bem como o caminho inverso,
atualizaram vídeo, formato e guias mantendo uma única aquisição e tempo contínuo.
Escolha manual da traseira, alternância para frontal e reload restauraram a
traseira padrão no primeiro pedido. A fonte sintética não certifica o sensor
nem a codificação do aparelho real; evidência local ignorada em
`.tmp/work/camera-ux-qa/automatic-orientation-2026-11-03.json`.

Validação do padrão explícito: 67 testes Node, lint e diff check aprovados;
revisão focada sem bloqueios. No fixture com HTML/JS reais e quatro fontes
sintéticas de IDs opacos, confirmar a opção Traseira 4 e testar outra fonte
preservou o padrão ao desligar/ligar, voltar da frontal e recarregar. O reload
abriu o padrão no primeiro pedido; a ação de confirmar funcionou com essa fonte
já selecionada. Testes também cobrem falha de armazenamento/releitura,
preferência conhecida só após a permissão, ID vazio e rótulo sem face.
Evidência ignorada: `.tmp/work/camera-ux-qa/default-lens-2026-11-03.json`.

Em 03/11/2026, o usuário confirmou que o giro físico do celular passou a ser
acompanhado pela imagem no computador. A abertura continuava em 0,6×; ao selecionar
manualmente **Traseira 4**, identificou o enquadramento 1× desejado neste aparelho.
O número dessa opção não identifica uma lente principal universal nem um deviceId
fixo. Após carregar a versão com **Usar como padrão**, o usuário confirmou que
desligar e ligar a câmera reabriu diretamente no enquadramento correto. Esse
retorno confirma a reaplicação física do padrão neste aparelho; reload posterior
à gravação da preferência e retorno da frontal continuam cobertos pela simulação,
sem nova confirmação física desses dois caminhos.
A cópia da gravação de 15 s das 14:44 continua em 13%; a ausência da fonte e os
limites da retomada estão registrados na seção de cópia parcial acima.
A evidência anterior do clip de 18,238813 s permanece separada;
não há nova medição de velocidade. Alterações somente locais.

## Gravação, pontos e recuperação

- No celular, chunks de vídeo e eventos ficam em IndexedDB
  `goatleta-scouting-live-camera-v1`. A listagem de gravações permite **Salvar
  vídeo** e **Salvar marcações**, inclusive para trechos preservados após uma
  interrupção. O manifesto registra trechos, tempos e eventos; um trecho ausente
  impede uma exportação apresentada falsamente como completa.
- No notebook, pontos e interrupções ficam em
  `goatleta-scouting-live-host-v1`, separados por usuário, organização e turma.
  **Baixar marcações** exporta o JSON dessa gravação nova. Marcadores usam a
  referência do vídeo, com indicação aproximada quando o relógio não é preciso.
- A base anterior `goatleta-scouting-video-drafts-v1` e seus vínculos não são o
  destino de escrita do modo ao vivo. O backup dos 99 vínculos não deve ser
  tratado como backup da gravação no celular.

Ao terminar, pare a gravação no celular e exporte vídeo e marcações para outro
local. Limpar dados, trocar origem/perfil ou pouco espaço pode afetar a
recuperação. Reabra a câmera no mesmo aparelho, navegador e origem para encontrar
gravações locais. Reiniciar o companion não apaga esses registros. Os manifestos
ao vivo ainda não são importados automaticamente pelo estúdio de vídeo oficial.

Em **Gravações salvas → Rever vídeo**, a cópia completa do computador abre automaticamente.
Uma sessão encerrada também pode abrir a revisão sem cópia pronta, para consultar
marcações e escolher o original; isso não torna o prefixo um vídeo completo.
Na alternativa de escolher um MP4/WebM antigo, mantenha o nome com o recordingId;
após conferir duração e formato, a revisão guarda o arquivo neste navegador,
sem upload, e cada ponto abre no instante salvo. Trocar o arquivo ou fechar
libera sua URL de reprodução; abrir a revisão não encerra a conexão da câmera.
Esta revisão não converte os registros em estatísticas oficiais.

## Excluir e restaurar

No celular, **Excluir do celular** exige confirmação e apaga definitivamente
metadados, vídeo em trechos e eventos daquele recordingId, numa única transação.
Outra gravação permanece intacta. A ação bloqueia registros ativos, exportação e
finalização; exportar um arquivo não o exclui automaticamente.

No notebook, a confirmação move somente os registros para uma lixeira durável e
restaurável, por usuário/organização/turma, sessionId e recordingId. Não apaga o
vídeo no celular. Identificação inclui horário HH:mm; a captura pareada atual
e o recebimento de vídeo ficam protegidos. Histórico inativo pode ser movido à
lixeira com seus pontos e sua fila pendente preservados. Reconectar um recordingId na lixeira
exige restauração explícita, sem criar uma cópia vazia. Os dados anteriores de
scouting e seus 99 vínculos continuam fora desses caminhos.

## Goatleta.com

Ainda não ativado. O cliente permite o companion apenas no desenvolvimento
local. `goatleta.com` precisa de sinalização autenticada por turma/organização,
HTTPS confiável e conectividade/retransmissão entre redes. Supabase permanece a
fonte de autorização; publicar apenas o cliente não ativa esse contrato.

Smoke local em duas abas passou com câmera sintética: gravação, 3 pontos e um
desfazer (2 ativos), troca de set, confirmação de gravação no IndexedDB da câmera,
exportação MP4/JSON e recuperação após reload com seek decodificado. Não certifica
câmera física, Wi-Fi, confiança do Android, desempenho móvel ou produção.

Interrupção simulada de peer manteve a gravação e o mesmo recordingId; uma
correção feita offline foi confirmada no celular após reconectar, com fila
durável vazia no notebook. A revisão no modal também abriu o ponto em 13,948 s
do MP4 recuperado. Tipos, org-scope, arquitetura, perf-hygiene e export web
aprovados localmente; nenhum deploy realizado.

Na rodada atual, 21 casos do runner da câmera e suítes focadas de host,
armazenamento e UI passaram. A revisão de falhas cobre retenção/retry do trecho
final, commit terminal e exclusão atômica; tipos, org-scope e perf passaram na
rodada técnica. O usuário relatou Android/Wi-Fi funcionando com pequeno atraso
percebido, sem medição de latência. Isso não valida fisicamente os novos controles.

Tipos finais aprovados. QA da interface no navegador em 1055×487 e 390×844:
barra única, preparo central, formato, tela cheia e painel de gravações sem
overflow horizontal. No estúdio, QR lateral e cancelamento da confirmação de
exclusão conferidos; nenhuma exclusão foi confirmada pelo agente. A prévia do
celular apareceu no notebook durante a conferência, sem medição de latência.
Hashes do documento de 118 recortes e do sidecar dos 99 vínculos revisados
permaneceram idênticos ao baseline.
Validação física dos novos controles no Android: **pendente**.

A tela da câmera usa arquivos estáticos; uma aba já aberta no telefone não
recebe essas mudanças automaticamente. Atualize-a manualmente somente após
finalizar e exportar o que desejar preservar. Estes ajustes não exigem reiniciar
o companion. Sem deploy, alteração remota de banco ou exclusão de arquivos do
usuário nesta etapa.

## Fechamento da etapa

Publicação do frontend autorizada em 02/11. Câmera/QR e sidecars continuam
locais; a publicação não ativa infraestrutura pública nem transfere vínculos
entre origens. [Preflight e fluxo do release](scouting-release-2026-11-02.md).

## Reativação local e QR visível — 06/11/2026

O botão Gerar QR code falhava porque o companion não estava em execução;
o frontend em 8081 respondia normalmente. A configuração existente passou pela
validação de cadeia, chave, validade e IP. O IPv4 privado seguia disponível.
O wrapper revisado foi iniciado com Node 24.13.0, Start-Process oculto e logs
privados em `.tmp/work/scouting-live-runtime/`, independente do terminal.
Nenhum certificado, confiança, firewall ou inicialização automática foi alterado.

Probe do serviço confirmou cameraReady=true; a página /camera em HTTPS 8097
respondeu 200 com TLS validado pela CA existente. No estúdio autenticado, o
botão criou uma sala real e o estado mudou para Aguardando celular, sem erro.
Uma seção recolhida ainda escondia o QR: LiveCameraConnection agora abre essa
seção quando recebe um novo código enquanto aguarda/reconecta. Atualizações
comuns respeitam o recolhimento manual; câmera conectada saudável não é forçada
a reabrir a seção. Host e conexão permanecem os mesmos.

16 testes focados e lint passaram; diff sem erros de whitespace. QA em
1346×884, tema escuro, mostrou o QR inteiro dentro do mesmo modal. Captura
privada inspecionada: `.tmp/work/scouting-live-runtime/qr-ready.png`.
Não houve conexão física de celular, captura, novo ponto oficial ou publicação
nesta rodada. O QR ficou aberto para o usuário conectar.

## Retomada de cópia, estabilidade e captura — 06/11/2026

A gravação física de 28 s estava com 3% recebidos e peer desconectado, enquanto
o companion permanecia ativo. O usuário reconectou a mesma aba do celular sem
recarregar; o prefixo confirmado foi preservado e a cópia avançou para 92% e
Original salvo neste computador. O original foi reaberto pelo estúdio com o
celular desconectado, e o download local foi confirmado: MP4, 20.398.116 bytes,
28,349479 s, H.264 Baseline nível 4.0, 1080×1920, AAC. Reprodução no navegador
chegou ao fim sem MediaError. Isso não equivale a prova de decodificação íntegra:
FFmpeg detectou timestamps repetidos e erros de macroblocos H.264; o usuário
confirmou pixelização no próprio original do celular a partir de 10 s.
O arquivo existente foi preservado, sem substituição, transcode ou exclusão.

Correções locais no celular: reconexão automática singleflight com até cinco
tentativas consecutivas (1/2/4/8/15 s), retorno visível retoma a mesma sala e
erros de autorização/expiração interrompem o ciclo. Reconnect após encerrar
mantém o canal de dados sem reabrir captura. Wake lock cobre prévia/captura e
cópia pendente, é readquirido no retorno visível e liberado ao desligar/salvar,
falhar ou esgotar recuperação quando não houver câmera ativa.

Uma corrida reproduzida no sender permitia a leitura antiga de um trecho mover
o cursor usado pela retomada; agora cada leitura usa snapshot local e só publica
o cursor após conferir proprietário/versão. Hash por trecho e ACK após commit,
índices, formato e escopo foram preservados. A existência dessa corrida não
prova que tenha causado os defeitos deste arquivo, também relatados na origem.

Novas gravações priorizam WebM com VP8/Opus quando suportado, seguido de WebM
genérico e MP4 genérico; retirado perfil AVC fixo. É um contorno a validar neste
aparelho, sem atribuir a falha ao nível H.264: o arquivo observado já usa 4.0.
Capacidade declarada não garante recursos suficientes para codificar, conforme
[MediaStream Recording](https://www.w3.org/TR/mediastream-recording/).
Bitrate, timeslice, lente, orientação e persistência não foram alterados.

No computador, queda de conexão mostra Cópia pausada mantendo o percentual,
sem dispor o receiver nem alterar o manifesto; o rótulo volta ao receber.
O seletor CSS do diálogo de revisão foi corrigido para sua posição portaled,
recuperando a largura de 960 px em desktop e o reflow existente no celular.

Validação local: 82 testes estáticos da câmera e 119 testes focados de
host/receiver/hook/painel/biblioteca/revisão passaram; tipos, lint e org-scope
passaram. Jest emitiu o aviso conhecido de handle assíncrono e terminou em 0.
HTTPS serviu o script atualizado com TLS validado e hash igual ao arquivo local.
Snapshot autenticado inspecionado em
`.tmp/work/scouting-copy-completed/review-local.png` (1346×884, escuro), com
arquivo local e download disponíveis. Bytes/hash e detalhes do arquivo ficam
nos artefatos privados/Downloads, sem tokens de sala neste registro.

A aba já aberta do celular ainda requer atualização para carregar o novo JS.
Solicitada uma nova captura física de cerca de 20 s para conferir o trecho
posterior a 10 s, novo formato e conclusão da cópia. Resultado dessa nova
captura permanece pendente; não afirmar que VP8 resolveu a pixelização nem
que reconexão automática foi exercitada no aparelho com a versão nova.
Sem commit, deploy, alterações de confiança/firewall ou escrita oficial.

Limite de desenvolvimento encontrado na leitura: o cleanup de use-live-host
fecha peer/canal e aborta polling, conservando a referência de sala. Um Fast
Refresh que reexecute esse efeito pode exigir rearmar o transporte da mesma
sala; só reconectar o telefone não restaura polling abortado. Isso não prova
a causa da queda observada. Hooks/host não foram editados nesta correção para
preservar o pareamento físico; eventual rearmamento precisa de tarefa/teste
dedicado, sem zerar a sala ou apagar dados para contornar a falha.

## Preferência por 1080p e 60 fps — 06/11/2026

O código anterior pedia frameRate ideal=30 e max=30, limitando a fonte mesmo
quando o aparelho pudesse oferecer mais. Agora pede dimensões ideais de
1920×1080 e frameRate ideal=60/max=60, preservando os eixos do sensor, lente
selecionada e áudio. Não usa min/exact=60: uma fonte que só fornece 30 pode
continuar funcionando, com os fallbacks existentes preservados.

Full HD no estúdio já representa 1920×1080 (ou 1080×1920 em retrato).
O detalhe continua vindo de getSettings, sem substituir 30 pelo desejo de 60.
Esse valor é a configuração informada pela fonte e pode diferir da cadência
efetiva do arquivo; a especificação diferencia essas condições em
[Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/#dom-constrainablepattern-getsettings).

83 testes estáticos da câmera, 2 testes de apresentação e lint passaram.
Fixtures exercitam pedido de 60 com fonte entregue em 29,97 e 59,94, detalhes
30/60 e metadados sem arredondamento; não certificam entrega física de 60 fps.
Aplicação no celular requer atualizar a mesma aba e desligar/ligar a câmera
fora de gravação; o stream já aberto não recebe novas constraints por esse patch.
Nenhum comando de captura, restart do companion, novo QR ou deploy foi feito.

## Revisão de conexão e interface — 06/11/2026

A revisão local corrigiu foco em ticks, prévia desconectada cobrindo CTA, ações
por capacidade, QR secundário após pareamento, retomada de efeito na mesma sala
e binding de novo nó de vídeo. Commits pendentes são aguardados antes de
reidratar sessão/entregas; replay não cria nem encerra gravação. Reload completo
ou mudança de assinatura dos hooks ainda é novo mount.

No celular, sinalização tem deadline/cancelamento; biblioteca nativa mantém
erros/progresso visíveis e mostra mais de 20 itens; restauração parada permite
reconectar só dados. Inter 400/600/700 e licença foram incluídas localmente com
whitelist de três URLs, font/ttf e font-src self, mantendo cap/origem/nosniff.
Companion reiniciado isoladamente sem captura/cópia ativa; HTTPS da fonte
retornou 200, TLS autorizado e bytes idênticos. Salas temporárias do serviço
anterior expiraram; persistência local não foi limpa.

96 testes câmera, 14 companion, 66 UI, 65 host e 22 receiver/transfer passaram,
além das suítes da bancada/revisão, tipos e guardrails. Originais antigos e
marcadores não foram sobrescritos. Nova captura física/encoder/1080p60 e retomada
no Wi-Fi continuam pendentes. [Auditoria e QA](../ui/SCOUTING_REVISAO_UI_UX_2026-11-06.md).

### Recuperação posterior do Metro — módulo 3349

O usuário encontrou erro de módulo desconhecido ao tentar continuar o teste.
Imports/dependências estavam presentes; o Metro foi reiniciado com cache de
compilação limpo e o cliente recarregado. O companion permaneceu no mesmo
processo, sem limpar dados ou trocar TLS. Smoke autenticado de preparação e
`LiveScoutingVideo` com vídeo de 43 s/rally passou sem novo erro de módulo;
nove testes do adaptador de cache passaram. A captura física de 20 s continua
pendente. [Procedimento](workstations.md#módulo-numérico-desconhecido-no-metro--recuperação-local-de-06112026).


### Início, prévia e negociação — teste físico de 06/11/2026

Após a recuperação do Metro, o comando do computador iniciou e encerrou uma
nova gravação sem repetir o módulo 3349. O clique monta pela primeira vez o
chunk lazy do replay; não foi encontrado import ausente no comando de início.

A primeira captura terminou o envio após pausar em 54% e reconectar. O download
pelo estúdio produziu WebM VP8/Opus, 1080×1920, 5.209.437 bytes, 526 quadros,
último PTS de 29,005 s, SHA-256
`A333F60604A8F574F95189101CAEE28E62570323D6D14E3B5C3844166C3128C3`.
FFmpeg com `-xerror` decodificou o vídeo sem erros; blackdetect apontou imagem
preta de 0,032 a 29,005 s. A taxa observada foi aproximadamente 18,12 fps,
embora getSettings informasse 60. Portanto, envio e leitura foram comprovados,
mas essa captura não validou imagem útil nem 60 fps. Não se atribuiu a causa
somente ao transporte nem se sobrescreveu o original.

A inspeção encontrou e corrigiu quatro falhas locais:

- A prévia portaled tinha altura de conteúdo zero dentro de details. O conteúdo
  agora ocupa o stage; no stream físico passou de 0 a 757 px em 1346×884.
- O callback de ref sobrescrevia o MediaStream atual com o anterior. Removida
  essa escrita; playing limpa apenas o aviso da prévia e rejeições antigas ou
  AbortError não criam alerta falso. Autoplay bloqueado tem ação Iniciar prévia.
- HTTP saudável podia deixar uma negociação RTC indefinida. Prazo de 20 s por
  peer libera o backoff existente; abertura/cancelamento invalida timers antigos.
- Iniciar não verificava aba oculta ou fonte indisponível. A guarda agora valida
  antes de criar a gravação e novamente antes de recorder.start após o IndexedDB;
  o host só aceita razões enumeradas da sala cujo comando está pendente.

Os rótulos passaram de Cópia/Copiando para Salvando no computador/Envio pausado.
A guarda não examina brilho dos pixels nem pausa/retima captura já iniciada.
Atualização dos módulos de desenvolvimento reabriu a visão geral mesmo sem
mudança de ordem dos hooks; o arquivo já estava 100% salvo. Novo pareamento foi
feito depois das alterações; o usuário confirmou imagem nos dois aparelhos e
ela foi observada também no browser do computador. Nova captura de cerca de
20 s foi iniciada/encerrada pelo computador; verificação do arquivo final abaixo.

Validação focada: 111 testes da câmera, 71 host e 53 UI passaram; tipos, lint e
diff foram conferidos no fechamento. Sem produção, limpeza de dados ou troca
configurada de lente. A estabilidade de sessões longas e 1080p60 efetivos não
foi certificada por esses testes.


#### Resultado da captura com imagem visível

O teste seguinte manteve a aba da câmera visível; a imagem foi confirmada pelo
usuário nos dois aparelhos e observada no computador. Início/fim ocorreram no
PC sem erro de módulo e o envio avançou de 0 a 100% sem interrupção observada.
O botão do painel baixou `go-atleta-a8c839b5-9dc4-4d13-be70-ece506a5316d.webm`:
19.024.408 bytes, VP8/Opus, 1920×1080, SHA-256
`207F4CB72D4BC2B0EE3AC17C469EFFA81981F08607E8F50E30843C71ABE2BF46`.
O browser abriu a cópia persistida com duração 28,98 s e sem MediaError; reprodução
foi conferida por seek em 17,10 s e até o final, com imagem presente. FFmpeg
`-xerror` decodificou todos os 683 quadros sem erros e blackdetect não encontrou
intervalo preto contínuo de pelo menos 0,5 s. O teste não registrou pontos oficiais.

GetSettings informou fonte em 60 fps, mas o arquivo entregou aproximadamente
23,58 fps observados (PTS 0,043–28,970 s). Full HD foi validado; 1080p60 efetivos
não. Esta captura bem-sucedida não prova a causa da anterior preta nem certifica
sessões longas, rotação durante captura ou retomada após bloquear o celular.

O envio continua lento. Inspeção do protocolo confirmou partes de 8 KiB e janela
unitária: cada ACK aguarda hash, verificações de sessão e persistência IndexedDB.
Um ciclo total de 100 ms limita o útil a aproximadamente 80 KiB/s; isso é um
limite calculado do desenho, não medição da rede/disco/aparelho neste teste.
Não foi alterado o protocolo durante o envio. Otimização requer medir e preservar
a autorização, idempotência, hashes, cursor e retomada já existentes.


## Envio em lotes e captura 1080p60 — 06/11/2026

Implementação local posterior à medição de ~23,58 fps no S25. Os originais e o
layout IndexedDB v1 foram preservados. A oferta mantém partes de 8 KiB e o teto
de 4 GiB. Receiver novo negocia `partsPerMessage=4` e `maxInFlight=8`; sender
antigo ou host sem esses campos continua unitário. Pacotes `video-parts` ficam
em até 48 KiB de JSON / 32 KiB brutos e diminuem conforme o `maxMessageSize`
SCTP. Outros pacotes do host continuam no limite de 16 KiB. Fila e bytes em voo
têm limite, sem cache de permissão. Cada lote verifica todos os hashes,
autoriza antes/depois do hash e
após o commit, persiste atomicamente e só então confirma o prefixo. Falhas não
substituem o prefixo; nova tentativa `failed` renova `transferId` para descartar
respostas atrasadas da tentativa anterior, preservando `recordingId` e a
especificação da oferta.

Benchmarks comparáveis, sem representar hardware físico:

- Sender em memória, 1 MiB e ACK durável simulado de 25 ms: 4.000 → 500 ms
  (~8×), 128 → 32 mensagens, até 8 partes pendentes.
- Receiver/storage/SHA reais com I/O IDB simulado (2 ms/read, 3 ms/commit), 4 MiB:
  10.272 → 2.592 ms; autorizações 1.540 → 388; commits 514 → 130. SHA integral
  igual.
- Interop real de sender/receiver/storage com IndexedDB simulado validou lote 4,
  SCTP de 16 KiB, legado, prefixo 3 e rollback/retry. Com 10 ms por direção e
  uma falha de quota na parte 5, erro tardio não derruba a nova tentativa.

Captura pede mínimo 59,94, ideal/máximo 60 fps inclusive nos fallbacks. A prévia
RTC usa parâmetros de envio limitados a 640 px no lado maior, 60 fps e 1,2 Mbps;
não reduz as constraints do track que o MediaRecorder grava. Perfis AVC level 4.2
são considerados para 12 Mbps. Aprovação completa de `encodingInfo` (`record`,
resolução real, 60 fps) tem prioridade; consulta indisponível, erro ou timeout
permite tentativa com MIME aceito, com `capabilityVerified=false`. Qualquer
`false` explícito nessas capacidades exclui o candidato. Prazo total de 1,2 s;
não declara 60 fps
comprovados antes de medir o arquivo.
Não há transcodificação CFR nem duplicação de quadros para inflar contagem.

Diagnósticos locais de fonte e prévia, codec e capacidades usam allowlist,
limites numéricos e descartam tokens/IDs. Logs do host só em desenvolvimento,
para a sala atual. RTC outbound descreve o encoder da prévia; sua implementação
não é evidência do encoder do arquivo. Validação física de FPS usa quadros e
PTS do arquivo final, além de decodificação e revisão após 10 s.

Referências primárias: [Media Capabilities](https://www.w3.org/TR/media-capabilities/),
[MediaStream Recording](https://www.w3.org/TR/mediastream-recording/) e
[parâmetros do sender RTP](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters).
Capacidade prevista e configuração da fonte não comprovam a taxa final.

Validação local: 151 testes Node de câmera/qualidade, 38 de
receiver/storage/performance, 73 de host (incluindo envelopes/diagnósticos),
tipos e checks org-scope,
arquitetura strict e perf-hygiene strict aprovados. O teste integrado de sender
real foi reexecutado após estabilizar captura (27 testes do receiver passaram).
Verificação física da versão nova no S25 fica registrada na continuação abaixo.


### Primeiras provas físicas da otimização

O S25 continuou usando a lente 1× escolhida pelo usuário, apenas no Chrome.
A primeira rodada em VP8 gerou 36.859.998 bytes, 1920 × 1080, 1.418 quadros
e 48,1 s, taxa de ~29,49 fps. O arquivo ficou salvo no PC e foi baixado pelo
estúdio; não validou 60 fps.

A segunda rodada permitiu AVC quando a consulta record falhou. O diagnóstico
confirmou `query-error` para os 3 perfis, enquanto o MIME High 4.2 foi aceito.
O arquivo real saiu H.264 High level 4.0, em vez do level 4.2 solicitado:
63.468.256 bytes, 1920 × 1080, 1.237 quadros únicos em 41,480958 s,
aproximadamente 29,82 fps. Não se interpretou o perfil solicitado como perfil
efetivamente produzido. Hash SHA-256:
`54DD81EF3E51A0ADD56173EFC756DBAB353CB57BBB43037FD16A030BE6D81A50`.
Decodificação com `-fps_mode passthrough -enc_time_base 1:1000000 -f framemd5`
terminou sem erro/stderr e confirmou 1.237 hashes distintos, sem quadros adjacentes
idênticos. Avisos de DTS no muxer null com timebase automática não foram
atribuídos sem evidência ao arquivo original.

Cronômetro no controlador iniciado imediatamente antes do clique Encerrar:
aos 24.927 ms o progresso estava em 76%; aos 38.043 ms o botão de download já
estava visível. Logo a conclusão foi observada entre essas duas amostras;
38,043 s é limite superior de ponta a ponta, não latência exata. O arquivo foi
reaberto e baixado sem transferência manual do celular. Não houve dado oficial
de scouting gravado neste teste.

A velocidade melhorou, mas as amostras RTC de fonte e prévia continuaram em
~30 fps mesmo retirando o teto de 30 fps da transmissão.

### Medição local antes do MediaRecorder

Em `2026-11-07T00:30:33.065Z` (UTC), o telefone ainda estava em `phase=preview`,
antes de iniciar o MediaRecorder. Na mesma câmera 1920 × 1080, com
`requestedFps=60`, foram registrados:

- `sourceFps=32.68` e `previewFps=31.68` nas estatísticas RTC;
- `localFps=32.65` e `localPresentedFps=32.59` no contador da prévia local;
- `localSampleMs=3001`, janela de aproximadamente 3 s.

O contador local é independente das estatísticas RTC, mas a conexão RTC
continuava ativa. O teste mostra cerca de 33 fps apresentados no telefone antes
do Recorder; não isola a captura da adaptação nem da concorrência com a
transmissão. `libvpx`, identificado no diagnóstico, é o encoder da prévia RTC,
não o encoder do arquivo MP4.

No caminho testado, S25 com Chrome, os 60 fps reais não foram entregues: a
prévia local ficou em ~33 fps e o MP4 medido em ~30 fps. A camada responsável
permanece sem confirmação. Não se recomenda alterar exposição ou lente
silenciosamente nem simular 60 fps com quadros duplicados.

### Comparação com o envio de vídeo RTC temporariamente retirado

Na primeira tentativa, o usuário confirmou o retorno da imagem, mas o console
foi limpo na troca de turno. Essa tentativa não foi usada como evidência de FPS.
A segunda repetição ficou salva no artefato local sanitizado
`.tmp/work/scouting-1080p60/comparacao-sem-rtc.json`. Todas as amostras abaixo
são de 07/11/2026, em UTC, ainda em `phase=preview`, com `requestedFps=60`:

- RTC normal, `00:51:41.645Z`, 1080 × 1920: `sourceFps=29.34`,
  `previewFps=28.68`, `localFps=29.32`, `localPresentedFps=29.07`,
  `localSampleMs=3002`.
- Envio de vídeo RTC retirado, `00:51:46.654Z`, 1920 × 1080:
  `previewFps=0`, `localFps=29.78`, `localPresentedFps=29.6`,
  `localSampleMs=5004`. Essa amostra não contém `sourceFps`; ausência não foi
  interpretada como zero.
- RTC restaurado, `00:51:49.657Z`, 1920 × 1080: `sourceFps=30`,
  `previewFps=29.6`, `localFps=29.96`, `localPresentedFps=29.59`,
  `localSampleMs=3004`.

O contador local permaneceu em ~30 fps durante a janela sem envio de vídeo
RTC. Nesse ensaio, retirar a transmissão não elevou a prévia local a 60 fps.
A orientação também mudou entre a primeira e a segunda amostra; o teste não
identifica sozinho a camada responsável nem demonstra uma limitação universal
do Chrome. Tampouco comprova que uma implementação nativa entregaria 60 fps.

A instrumentação temporária foi retirada por patch reverso, sem deixar seus
símbolos no código; os 151 testes Node passaram após a retirada. O texto do
celular e do helper usa “fps configurados” para distinguir a configuração
solicitada da taxa efetivamente medida.

Fontes primárias para a investigação do Chromium:
[consulta record protegida por flag](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/media_capabilities/media_capabilities.cc),
[seleção de faixa FPS](https://raw.githubusercontent.com/chromium/chromium/main/media/capture/video/android/java/src/org/chromium/media/VideoCapture.java) e
[aplicação Camera2](https://raw.githubusercontent.com/chromium/chromium/main/media/capture/video/android/java/src/org/chromium/media/VideoCaptureCamera2.java).
O algoritmo pode favorecer faixas AE de mínimo menor; as faixas reais do S25
não foram extraídas, portanto isso é hipótese explicativa, não causa comprovada.

Próximo experimento proposto, sujeito à autorização específica: comparar a
captura nativa Camera2/CameraX no mesmo S25. Esta etapa registra a proposta;
nenhuma implementação nativa, geração ou instalação de APK foi realizada.


### Fechamento web e prova Android

A revisão final reabriu no estúdio o MP4 de 41,480958 s já persistido e reproduziu
até `ended=true`, sem MediaError, em 1920 × 1080. O botão de download permaneceu
disponível. Uma regressão de apresentação também foi corrigida: importação local
com status `receiving` continua mostrando Salvando no PC mesmo com o celular
desconectado; pausa real vem do status de erro do hook. Progresso, retry por
conexão, bloqueio de exclusão e vínculo com o original foram preservados.
As três suítes de UI, biblioteca e hook passaram (49 testes); lint/diff limpos.

Após a prova sem RTC continuar em ~30 fps, o usuário aceitou testar captura
Android local. O [harness de câmera](../../scripts/validation/android-camera-probe/README.md)
usa CameraX 1.6.0, package próprio `com.goatleta.cameraprobe` e prova por sensor/PTS,
antes da integração ao estúdio. JDK 17 e Gradle 8.13 existentes foram usados;
`assembleDebug lintDebug` passou. O lint registrou zero erros e 19 avisos de
configuração/compatibilidade/apresentação. Os checks JVM de cadência passaram.

O APK revisado tem 15.755.850 bytes, assinatura Android Debug v2 válida e SHA-256
`0081C0C999A40D93BD6BAC8C225FD856CDD31B708C90CC27517046015F1F9ABE`.
O manifest final contém CAMERA e a permissão interna de receiver do AndroidX;
áudio, Internet e permissões gerais de arquivos não foram incluídos. A primeira
abertura real identificou conflito entre range no SessionConfig e alvos nos
UseCases. Removidos os dois alvos dos UseCases, o rebuild passou e a prévia abriu
no S25 SM-S931B, API 37, após instalação por ADB e autorização USB feita pelo usuário.
Zoom 1× configurado não substitui a confirmação visual exigida pelo checkbox.

A prova requer arquivo e sensor em 59–61 fps por pelo menos 8 s, p95 dos
intervalos até 22 ms e lacuna máxima de 50 ms, sem evidência truncada ou inválida.
Amostras fora de ordem são ordenadas por PTS; duplicatas não inflam FPS.
O vídeo fica no MediaStore e o relatório em `Download/GoAtletaTeste`.

Em 06/11, o usuário confirmou o enquadramento 1× e gravou no S25 deitado.
O MP4 de 9,953 s tem 1920 × 1080, H.264 High nível 4.2 e 589 quadros
decodificados distintos. Os PTS do arquivo deram média de 59,17 fps, com p95
de 16,678 ms e maior intervalo de 33,345 ms. O sensor registrou 591 timestamps
a 59,18 fps, com p95 de 16,673 ms e maior intervalo de 33,345 ms.
A decodificação completa terminou sem erro ou trecho preto contínuo detectado.

A cópia por USB autorizado levou 550 ms para 20.919.021 bytes. O original e a
cópia tiveram o mesmo SHA-256
`b4b085d4affe5be5a353d9ff3fa303414179dee4e2dc0c25e4a1e96c990f1912`.
Essa gravação valida o modo nativo de 60 fps isolado no S25. Ainda falta medir a
cadência com a prévia transmitida, confirmar o envio por Wi-Fi e abrir o
original copiado automaticamente no estúdio.

O companion ganhou GET/HEAD HTTPS exatos para
`/android/go-atleta-camera-probe.apk`, um único arquivo de build local, cap de
64 MiB, sem cache e sem aceitar caminho do cliente. Os assets de 512 KiB e as
capacidades/autorização anteriores foram preservados. Testes: 19 passaram e
1 skip de symlink de arquivo sem privilégio Windows; escape por junction,
abort/backpressure e limites foram exercitados. Reinício isolado do companion,
sem captura/cópia ativa conhecida, manteve configuração/TLS existentes. Download
real por HTTPS validou CA/hostname, MIME, comprimento e SHA-256 idênticos ao APK
instalado. Essa rota entrega código de teste; não recebe vídeos.

### Piloto Android com prévia e cópia no Estúdio

O APK debug opcional usa a CA pública já configurada e restrita ao IPv4 privado
do notebook. O link da sala entra por ADB no armazenamento privado do piloto.
A WebView aceita a página HTTPS do companion, os dois scripts permitidos e as
rotas de sinalização daquela sala. O canal de mensagens entrega a prévia
reduzida a partir do mesmo CameraX que grava o MP4. O transporte existente
envia o original finalizado em lotes depois do pedido autorizado do Estúdio.
O piloto opera com duração de 20 s, teto de 30 s e marcações oficiais fora do
ensaio. Após o desligamento, religar a câmera renegocia a prévia na mesma sala.

O build e o lint do Gradle passaram, junto com a verificação JVM da cadência.
As verificações de câmera web, companion e contrato da ponte somaram 180
testes aprovados e um skip de
symlink no Windows. O Expo passou a ignorar a árvore isolada do Gradle após
o watcher do Metro encontrar arquivos transitórios removidos pela compilação.
O Estúdio abriu em `localhost:8081`, gerou o QR e reabriu o original web
de 41 s já persistido, com a ação de download disponível.

No S25, o Estúdio iniciou a captura nativa com prévia RTC de 640 × 360 ativa.
O primeiro original de 19,990 s mede 1920 × 1080, H.264 High nível 4.2 e
59,23 fps no arquivo e no sensor. Os 1.184 quadros decodificados são distintos,
com p95 de 16,678 ms e maior intervalo de 33,345 ms. O primeiro envio ficou em
0% porque o WebView rejeitou a chamada de temporizador com o receptor errado.
O cliente nativo passou a chamar os temporizadores via `window`. Ao recarregar
a página de teste na mesma Activity, a cópia retomou e o download pelo Estúdio
entregou os 49.894.275 bytes do original com o mesmo SHA-256 do S25.
O player abriu o MP4 e reproduziu além dos 10 s em que a captura anterior
apresentava falhas. O build seguinte lê o original em blocos de 256 KiB na
ponte, mantendo o transporte em partes de 8 KiB com confirmação persistida.

A repetição de 19,973 s começou pelo Estúdio em uma sala nova. O arquivo tem
1.181 quadros distintos a 59,13 fps e o sensor também mediu 59,13 fps. A cópia
automática dos 50.332.629 bytes ficou disponível cerca de 54 s após o
encerramento. O download teve o mesmo SHA-256 do arquivo no telefone, e a
rota do S25 usou `wlan0`. O Estúdio desligou e religou a câmera na mesma sala
e recebeu a prévia de volta. A gravação continuou disponível para revisão
depois de fechar a conexão e reabrir o Estúdio. A validação cobre os ensaios
curtos do APK debug. Gravações de jogo inteiro e marcações oficiais com fonte
nativa ficam fora do piloto.

### Continuidade do Estúdio

O código da bancada e os testes ficam na `main`. O Estúdio publicado oferece a
coleta e revisão de vídeo. Pareamento, prévia e cópia da câmera exigem a origem
de desenvolvimento `localhost:8081` e o companion local. Os arquivos WebView
do piloto ficam no [projeto Android de teste](../../scripts/validation/android-camera-probe/README.md)
e são servidos pelo companion. O export web da Vercel não inclui esses arquivos.

Em outra estação, siga a [preparação do workspace](workstations.md) e confira
o [guia do módulo](../context/modules/biblioteca-quadra.md). Os vídeos e vínculos
locais pertencem ao navegador e à origem usados para gravar. APKs, vídeos,
certificados e evidências autenticadas ficam no armazenamento privado da estação.
