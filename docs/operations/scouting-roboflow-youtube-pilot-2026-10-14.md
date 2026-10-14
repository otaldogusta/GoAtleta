# Go Atleta — teste de entrada YouTube no Roboflow

Em 14/10/2026, o link `https://www.youtube.com/watch?v=mdfgd1K3HTc` foi testado
na interface autenticada do Roboflow. **O fluxo exercitado não conseguiu ingerir
o link nem produzir uma trajetória importável.** A tentativa em Stream foi
rejeitada por protocolo antes de fornecer frames ou previsões. Isso não é um
benchmark de precisão do detector.

## Teste executado

O usuário conectou a conta e concluiu a confirmação dos termos. O onboarding
recebeu o objetivo real, a URL e a preferência por um piloto em 20–40 s,
sem arquivo local, treinamento, jobs pagos, webhooks ou escrita no Go Atleta.
O diagnóstico do Agent indicou ausência de um caminho de ingestão YouTube;
essa resposta foi complementada por uma tentativa direta na interface.

Foi preparado e salvo somente o draft **Go Atleta YouTube ball pilot**, sem
publicação. Especificação conferida na UI:

- Modelo público `volleyball_v2/3`, classe `volleyball`, limiar 0,5, active learning
  desabilitado. [Página do modelo](https://universe.roboflow.com/shukur-sabzaliev1/volleyball_v2).
- ByteTrack e saídas JSON `predictions` e `video_frame_metadata`.
- Bloco customizado de metadados revisado como texto antes da tentativa: lê
  `image.video_metadata`, normaliza valores e sinaliza metadados ausentes; sem
  rede, acesso a arquivos, comandos ou geração de timestamps presumidos.
- Sinks desabilitados, nenhum bloco de integração externa. GPU Small/US,
  0,75 crédito/hora e timeout mínimo disponível de 10 minutos. Revisão por quadro
  habilitada. A tentativa terminou imediatamente com erro de protocolo.

O painel File ofereceu arquivos PNG/JPG/WEBP/MP4/MOV, Asset Library e Image URL;
não foi oferecida uma entrada YouTube. Em **Stream → Use a Stream URL**, foi
informada a URL exata e acionado **Run Workflow** uma vez. Resultado real:

> Invalid protocol "https://". Only rtsp:// or rtsps:// are supported.

O painel permaneceu sem frames, previsões ou sessão de processamento ativa.
Logo, o intervalo pretendido 20–40 s não chegou a ser analisado, o modelo não
teve precisão avaliada e não há JSON de trajetória desse vídeo. Não confundir
essa rejeição de entrada com reprovação da qualidade do modelo.

## Conferência da biblioteca e da documentação

Asset Library estava vazia. **Import** abriu Datasources: AWS S3, Google Cloud
Storage, Azure Blob Storage e opções como FTP/SFTP, Dropbox, OneDrive, SharePoint,
Google Drive, Box e outros armazenamentos. Nenhuma origem YouTube apareceu.
O formulário foi cancelado sem criar credenciais, conexões ou automações.

A [API atual de streaming](https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api/serverless-video-streaming-api)
documenta webcam, RTSP e arquivo enviado pelo data channel. O
[SDK WebRTC](https://docs.roboflow.com/reference/inference/inference-sdk/webrtc)
fornece previsões e metadados, incluindo `pts` e `time_base`, quando existem
frames. `VideoFileSource` HTTP(S) faz download na máquina do cliente antes do
envio, conforme o [código oficial fixado](https://github.com/roboflow/inference/blob/fb9c8dc816b3f23551dea638deccbb2273c85de2/inference_sdk/webrtc/sources.py#L389).
Esse cliente local não atende ao requisito de evitar baixar o original.

A indicação anterior baseada no
[artigo de YOLOv8](https://roboflow.com/blog/how-to-train-yolov8-on-a-custom-dataset)
foi otimista: a menção a teste de YouTube na demo não comprova ingestão atual
no servidor com exportação de uma sequência. O método legado `predict_video`
repassa URLs HTTP(S) ao servidor, mas sua sintaxe não comprova suporte a uma
watch URL. Esse endpoint não foi executado neste piloto. O resultado se limita
ao caminho atual documentado e à interface efetivamente exercitada; não afirma
que todas as APIs históricas do Roboflow rejeitem YouTube.

Também há uma divergência documental sobre planos: o guia de Batch cita
Growth/Enterprise, enquanto a página atual de preços inclui Batch em Core.
Não houve upgrade nem contratação para resolver isso.

## Importação no estúdio

As caixas e timestamps do Roboflow poderiam ser convertidos para posições
normalizadas, caso a ingestão e a precisão fossem validadas. Essa conversão não
foi implementada ou aplicada com dados fictícios. O contrato atual de
`src/core/scouting-video.ts` admite somente os IDs VballNet existentes e
`sampledFps: 30`; não é correto identificar outro detector como VballNet.

Uma futura integração precisa:

1. Registrar provider/modelo, ID YouTube, edição, dimensões e intervalo de origem,
   sem tokens ou URLs assinadas. Normalizar o centro da caixa pelas dimensões
   efetivamente processadas, desfazendo crop/letterbox quando houver.
2. Usar o timestamp do vídeo (`pts * time_base` quando aplicável), somar início
   de recorte uma única vez e manter lacunas/ambiguidade sem interpolação.
3. Representar a frequência real. O renderer atual usa tolerância próxima de
   32 ms e quebra trilhas acima de 50 ms; saída a 5/10 fps não pode ser declarada
   como 30 fps nem importada sem adaptar esse comportamento.
4. Aplicar somente `analysis` e proveniência, preservando literalmente rallies,
   contatos, correções e histórico. A importação de documento completo pode
   substituir marcações e não serve para adicionar apenas a trajetória.

Nenhuma escrita foi feita no estúdio ou em seus rascunhos. Não houve download
do vídeo, upload de original/frames, treinamento, assinatura, compra, criação de
chave ou publicação do workflow. Somente o link e instruções do teste foram
enviados ao Roboflow. O draft de avaliação permaneceu no workspace conectado.

## Evidências e consumo

Arquivos privados, ignorados pelo Git, em
`.tmp/scouting-roboflow-youtube-pilot/`:

- `stream-rejected.jpg` e `stream-rejected.txt`: URL, erro, limites, sinks
  desabilitados e confirmação de draft salvo sem publicação.
- `datasource-origins.txt`: opções de armazenamento sem YouTube.
- `usage-after-attempt.txt`: painel mostrou zero invocações elegíveis de
  modelo-imagem no período e 0,25 Deploy Credits nos últimos 30 dias. O próprio
  painel informa atraso de até uma hora; sem uma baseline anterior, esse total
  não é atribuível ao piloto e não certifica custo incremental zero.

Validação: tentativa autenticada real de entrada, revisão da especificação e
das origens, documentação/código oficial e inspeção da imagem do erro. Não houve
inferência de bola nem teste de importação com resultados reais. Mudanças no
repositório são documentais: referências, checklist gerado e diff conferidos;
nenhum gate do app foi repetido para essa alteração.

**Próximo caminho possível sem download manual:** disponibilizar o original em
armazenamento acessível na nuvem, em paralelo à publicação no YouTube, e avaliar
o processamento a partir dessa origem. Isso exige outro teste; conexão de
armazenamento, envio da mídia e importação continuam pendentes. Não é uma
solução validada apenas pela URL do YouTube.
