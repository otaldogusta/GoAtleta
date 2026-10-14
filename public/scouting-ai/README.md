# Processamento local de scouting

Modelo VballNetGridV2b_seq9_grayscale_20260909_001145.onnx, preservado como
`model.onnx`. SHA-256:
`59529e8f40891eb689e103b97713c4c2c6eaa674fd625618e73c4354c7a8dc27`.
Licença dos artefatos originais: `MODEL-LICENSE.txt` (MIT, Alexander Sigatchov).
Origem registrada do teste local: commit 3aad1b98b5b744afb0100418e95892a5b0c23865.

Alternativa explícita de comparação: VballNetV4c_seq9_grayscale_20260908_213829.onnx,
preservado como `model-v4c.onnx` (987.155 bytes), da mesma origem e licença MIT.
SHA-256: `8eea11cc5c881fa008ec55b0f5732ab79f2e0e1833d7f586e680f3aaa98e4b8c`.
V2b permanece padrão. O worker aceita somente `v2b` e `v4c`, com URLs fixas da
mesma origem; nenhum parâmetro fornece uma URL remota de modelo.

V2b: nove imagens em cinza de 768×432 → grade 36×27×48, quatro planos por frame.
V4c: nove imagens em cinza de 512×288 → 18×288×512, nove heatmaps seguidos de nove
mapas de raio. O decoder usa o centro da maior região conectada acima de 0,5 e
ignora os mapas de raio. Essa saída maior exige medição no navegador; peso menor
não é promessa de processamento mais rápido. Formatos e valores inválidos são
rejeitados ou mantidos sem posição. A seleção temporal não interpola ausências.
Teste offline do decoder: `node --test scripts/validation/scouting-ball-decoder.test.mjs`.

O worker executa o modelo somente após ação explícita no estúdio. Runtime
ONNX 1.30.0 copiado de node_modules por `npm run prepare:scouting`, também
executado antes de start/dev:web/web/build. Os binários gerados de runtime
ficam fora do Git e são servidos pela mesma origem, sem CDN em execução.
Modelo e runtime são recursos públicos; nenhum vídeo fica nesta pasta.

GPU preferencial, CPU como fallback na inicialização. O worker é encerrado
em cancelamento, conclusão, erro ou desmontagem. Não há upload de imagens.
As coordenadas são candidatas, não probabilidades calibradas de acerto.

Comparação primária e benchmark CPU local, com seus limites:
`docs/operations/scouting-ball-model-comparison-2026-10-13.md`.
O resultado CPU não certifica velocidade ou precisão WebGPU/WASM.
