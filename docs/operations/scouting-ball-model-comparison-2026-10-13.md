# Tracking de bola — comparação técnica em 13/10/2026

## Decisão para o Go Atleta

Manter **VballNetGridV2b como detector padrão** e disponibilizar **VballNetV4c
como alternativa compacta**, com identificação do modelo no resultado. Ambos são
específicos para vôlei, têm pesos ONNX públicos e usam a infraestrutura existente.
O teste local abaixo não mostrou vantagem suficiente para trocar o padrão.
Marcação de bola é uma hipótese do detector: não confirma contato, atleta,
resultado, ponto, velocidade em metros ou posição 3D.

Esta comparação fundamenta a implementação local. Não certifica precisão de
100%, treinamento concluído, execução remota ou desempenho em aparelhos novos.
Nenhum dataset ou vídeo externo foi baixado para este estudo.

## Opções consultadas em fontes primárias

| Opção | Evidência e disponibilidade | Aplicação nesta entrega |
| --- | --- | --- |
| [VballNetGridV2b / V4c / GridV3 / FastV1](https://github.com/asigatchov/fast-volleyball-tracking-inference) | Pesos ONNX públicos, licença MIT. Benchmark do autor em `beach-test-raw`: 3 clipes, 886 frames anotados. F1: V4c 0,902; V2b 0,892; GridV3 0,867; FastV1 0,799. CPU/OpenVINO, somente inferência. | V2b padrão; V4c candidato compacto testado localmente. FastV1 perde qualidade nesse benchmark. GridV3 exige adaptação de dimensões. |
| [VballNetGridV4b e treinamento PyTorch](https://github.com/asigatchov/vball-net-pytorch) | Código MIT de arquitetura/treino/exportação. O autor relata F1 0,9289 em 3 clipes indoor, versus 0,8480 de V2b e 0,8359 de V4c, com limiares próprios. O tree público consultado não contém pesos V4b. | Candidato de pesquisa e treinamento; indisponível como substituição ONNX pronta nesta entrega. |
| [TrackNetV3 oficial](https://github.com/qaz812345/TrackNetV3) | MIT explicitamente para código e checkpoints. Predição temporal, fundo estimado e InpaintNet; F1 publicado 98,56% no dataset de peteca. | Referência de treinamento/oclusão. Exige adaptação a vôlei e conversão; métrica de badminton não compara diretamente com VballNet. |
| [TrackNetV4 oficial](https://github.com/TrackNetV4/TrackNetV4) | MIT, implementação TensorFlow, checkpoints Keras e treino com mapas de movimento. Avaliação em tênis e badminton. | Boa base científica, mas VballNet já oferece especialização e artefatos menores compatíveis com o app. |
| [TrackNetV5 oficial](https://github.com/thaonan/TrackNetV5-SDK) | [Artigo](https://arxiv.org/abs/2512.02789) relata F1 0,9859 no dataset TrackNetV2. SDK proprietário para estudo; checkpoints e dados privados. | Não incorporar código/pesos indisponíveis nem tratar publicação científica como pacote comercial aberto. |
| [WASB](https://github.com/nttcom/WASB-SBDT) | Código MIT, [model zoo](https://github.com/nttcom/WASB-SBDT/blob/main/MODEL_ZOO.md) com checkpoints de vôlei. [Dados](https://github.com/nttcom/WASB-SBDT/blob/main/GET_STARTED.md) incluem anotações da bola. Stack PyTorch/CUDA; não oferece ONNX browser pronto na documentação consultada. | Baseline de avaliação posterior; verificar licença dos dados separadamente da licença do código. |
| [TOTNet](https://github.com/AugustRushG/TOTNet) | MIT, modelo temporal e estudo de oclusão em esportes de raquete. Dataset TTA requer aprovação para pesquisa e proíbe uso comercial/redistribuição. | Referência para avaliação por visibilidade; exige adaptação/exportação e outro teste em vôlei. |
| [BlurBall](https://github.com/cogsys-tuebingen/blurball) | CVPRW 2026, código MIT, pesos e dataset de 64 mil frames de tênis de mesa, incluindo orientação/extensão do borrão. | Referência para anotar bola borrada; não é detector de vôlei pronto. |
| [Ultralytics YOLO26](https://docs.ultralytics.com/models/yolo26/) | Detecção e tracking genéricos, exportação ONNX e treino. [Licença](https://www.ultralytics.com/license) AGPL-3.0/Enterprise também para modelos treinados. | Sem vantagem demonstrada nesta câmera. Requer dados específicos e compatibilidade de licença; não adicionar uma contratação. |
| [SAM 2.1](https://github.com/facebookresearch/sam2) / [SAM 3.1](https://github.com/facebookresearch/sam3) | SAM2.1: Apache 2.0, segmentação por prompts, menor modelo 38,9M parâmetros. SAM3.1: atualização de março de 2026, stack CUDA/PyTorch, acesso solicitado aos pesos e [licença SAM](https://github.com/facebookresearch/sam3/blob/main/LICENSE) própria. | Apoio à anotação pode ser investigado. Sem benchmark publicado diretamente comparável de bola pequena de vôlei; não substituir o detector leve por promessa de precisão. |
| [RAVEL-VB](https://github.com/asigatchov/RAVEL-VB-beachvolleyball-tracking) | Código MIT, ONNX/OpenVINO para jogadores, bola e cabeças. Alguns releases usam encoder YOLO26; a origem dos componentes precisa ser considerada junto à licença do repositório. | Amplia escopo para jogadores/associação. Não é necessário para entregar tracking da bola agora. |

Essas métricas usam dados, tolerâncias e runtimes diferentes. Não constituem um
ranking universal. Os benchmarks publicados por mantenedores foram separados
da execução local reproduzível abaixo.

## Artefatos e formatos verificados

Fonte de inferência fixada em
[`3aad1b98b5b744afb0100418e95892a5b0c23865`](https://github.com/asigatchov/fast-volleyball-tracking-inference/tree/3aad1b98b5b744afb0100418e95892a5b0c23865).
Fonte de treinamento consultada em
[`7d295c53fa733782a58dd85f772685044414f8d3`](https://github.com/asigatchov/vball-net-pytorch/tree/7d295c53fa733782a58dd85f772685044414f8d3).

| Artefato | Bytes | Entrada / saída |
| --- | ---: | --- |
| VballNetGridV2b | 4.707.708 | `[B,9,432,768]` → `[B,36,27,48]`: confiança, offsets x/y e raio por frame |
| VballNetV4c | 987.155 | `[B,9,288,512]` → `[B,18,288,512]`: 9 heatmaps seguidos de 9 mapas de raio |
| VballNetGridV3 | 4.720.178 | [Sidecar](https://github.com/asigatchov/fast-volleyball-tracking-inference/blob/3aad1b98b5b744afb0100418e95892a5b0c23865/models/VballNetGridV3_seq9_grayscale_20260908_225156.json): `[1,9,576,1024]` → `[1,36,36,64]`; não reutilizar as dimensões de V2b |

V2b SHA-256:
`59529e8f40891eb689e103b97713c4c2c6eaa674fd625618e73c4354c7a8dc27`.

V4c SHA-256:
`8eea11cc5c881fa008ec55b0f5732ab79f2e0e1833d7f586e680f3aaa98e4b8c`.
O [peso V4c pinado](https://raw.githubusercontent.com/asigatchov/fast-volleyball-tracking-inference/3aad1b98b5b744afb0100418e95892a5b0c23865/models/VballNetV4c_seq9_grayscale_20260908_213829.onnx)
foi baixado como dados para a pasta ignorada de avaliação. Não foram executados
helpers remotos. Normalização: cinza, resize para a entrada, float32 dividido
por 255. Grid: maior confiança e offsets; heatmap: centroide do maior componente
acima do limiar. Sem interpolação das posições ausentes.

O decoder do navegador valida os formatos e usa centroide dos pixels da maior
região 8-conectada (mínimo de quatro pixels), com score da região escolhida.
O benchmark Python usa centroide do contorno OpenCV e score máximo do heatmap;
essas diferenças de pós-processamento impedem tratar os resultados CPU como
medida de precisão da implementação browser.

## Comparação executada no original local

Executor próprio: `scripts/validation/scouting-ball-model-benchmark.py`.
Ambiente já disponível: `.expo/video-venv`, ONNX Runtime 1.31.0,
`CPUExecutionProvider`, 2 threads, limiar 0,5. Entrada: original local de 30 fps
do amistoso El Cartel × Regenerados. Foram avaliados 450 frames, sem upload.

| Trecho | Frames | V2b com marcação | V4c com marcação | V2b fps | V4c fps |
| --- | ---: | ---: | ---: | ---: | ---: |
| 00:20–00:26 | 180 | 148 | 144 | 43,5 | 38,9 |
| 01:13–01:17 | 120 | 94 | 88 | 38,7 | 36,7 |
| 14:40–14:45 | 150 | 51 | 58 | 42,4 | 40,7 |

FPS inclui preparação, inferência e pós-processamento; exclui decode do vídeo,
carga/warmup do modelo e geração de imagens. Não equivale ao runtime WebGPU/WASM.
**Cobertura não é precisão nem recall.** Não há ground truth de cada frame.

Todos os oito mosaicos pareados foram inspecionados. Os modelos apontam posições
semelhantes em boa parte das bolas visíveis. V4c recuperou a bola nos exemplos
75,0s e 881,5s onde V2b omitiu; V4c também omitiu 25,0s onde V2b apontou perto de
um contato/oclusão. Ambos omitiram vários frames no trecho final. Isso sustenta
uma alternativa compacta; não sustenta substituir todas as posições do rascunho
existente nem fundir scores como probabilidades calibradas.

Evidências privadas e ignoradas: `.tmp/scouting-model-research/evaluation/` contém
`report.json`, coordenadas por modelo e `paired-*.jpg`. Elas não integram assets
públicos nem a publicação do repositório.

## Dados e caminho de treinamento assistido

Fontes candidatas com licença declarada pelo autor:

- [Aivolleyballref](https://universe.roboflow.com/aivolleyballref/volleyball_detection):
  1.091 imagens, bola, CC BY 4.0, duas versões; guardar versão e atribuição.
- [primaryws](https://universe.roboflow.com/primaryws/volleyball_ball_object_detection_dataset):
  548 imagens, versões RGB/cinza, CC BY 4.0. Imagens isoladas ajudam um detector
  espacial, mas não recompõem sequências temporais de nove quadros.
- WASB fornece uma fonte de avaliação com anotações de bola em vôlei; verificar
  termos dos vídeos originais e das anotações antes de uso comercial.
- [SportsMOT oficial](https://huggingface.co/datasets/MCG-NJU/SportsMOT) tem
  CC BY-NC 4.0 e anota jogadores. Não é um dataset de bola para treinamento
  comercial. Não trocar sua licença pela descrição de um espelho.
- Priorizar vídeos próprios/cedidos com sequências, iluminação e câmeras variadas.
  Um link público não fornece licença automática para formar esse conjunto.

Fluxo proposto para o próximo treinamento, ainda não executado:

1. Registrar origem, permissão, hash, fps e cortes de cada vídeo autorizado.
   Separar treino/validação/teste por jogo e câmera antes de produzir rótulos;
   manter teste inteiramente revisado e fora dos pseudo-rótulos de treino.
2. Executar detector temporal nos dados de treino. Concordância entre modelos,
   continuidade, mudança de cena e score ajudam a selecionar exemplos; não
   tornam a coordenada verdadeira. Revisar discordâncias e uma amostra dos
   exemplos concordantes. Incluir ausência, fora do quadro, borrão e oclusão.
3. Guardar candidato e correção humana com proveniência. Nunca transformar
   interpolação em bola visível confirmada, nem converter rallies/contatos em
   coordenadas de bola por suposição.
4. Usar arquitetura e checkpoint treinável correspondentes. Um ONNX de inferência
   público não significa que exista o checkpoint PyTorch/Keras correspondente
   para fine-tuning. Conferir disponibilidade antes de definir esse treinamento.
5. Avaliar distância normalizada em resolução comum, precision/recall/F1 por
   visibilidade, falsos positivos em ausência, quebras de trajetória, runtime
   completo e memória. Ajustar limiar só em validação. Teste decide promoção do
   modelo; nunca substituir o detector apenas pelo nome mais recente.

## Relação com novos links do YouTube

Treinar melhora o detector, mas ele continua precisando dos frames. A integração
de reprodução por link deve receber o tracking produzido a partir de uma fonte
de pixels acessível, sincronizado e vinculado ao ID/versão do vídeo. A decisão de
acesso e a UI ficam no fluxo de YouTube do mesmo estúdio; esta pesquisa não
executou extração de stream, downloads de jogos de terceiros ou uploads.

## Comparação com referência independente — 14/10

WASB Volleyball Step3 e GridV3 executados localmente no trecho 20–40 s,
600 quadros, com referência visual independente (14 posições observáveis e seis
incertas, sem ajuste de parâmetros). Os quatro modelos acertaram 10/14 até
15 px; WASB teve erro de 222,85 px e foi cerca de dez vezes mais lento que
GridV2b na CPU. GridV3 teve erro de 195,80 px. Não houve promoção, aplicação de
posições, upload ou nova chamada Gemini. GridV2b padrão e opção V4c preservados.
Ver [método, resultados e artefatos](scouting-wasb-evaluation-2026-10-14.md).
O teste local não resolve acesso a frames apenas por link do YouTube.
