# Processamento local de scouting

Modelo VballNetGridV2b_seq9_grayscale_20260909_001145.onnx, preservado como
`model.onnx`. SHA-256:
`59529e8f40891eb689e103b97713c4c2c6eaa674fd625618e73c4354c7a8dc27`.
Licença dos artefatos originais: `MODEL-LICENSE.txt` (MIT, Alexander Sigatchov).
Origem registrada do teste local: commit 3aad1b98b5b744afb0100418e95892a5b0c23865.

O worker executa o modelo somente após ação explícita no estúdio. Runtime
ONNX 1.30.0 copiado de node_modules por `npm run prepare:scouting`, também
executado antes de start/dev:web/web/build. Os binários gerados de runtime
ficam fora do Git e são servidos pela mesma origem, sem CDN em execução.
Modelo e runtime são recursos públicos; nenhum vídeo fica nesta pasta.

GPU preferencial, CPU como fallback na inicialização. O worker é encerrado
em cancelamento, conclusão, erro ou desmontagem. Não há upload de imagens.
As coordenadas são candidatas, não probabilidades calibradas de acerto.
