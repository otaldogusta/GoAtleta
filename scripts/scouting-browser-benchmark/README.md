# Teste local de VballNet no navegador

Prova de viabilidade isolada, sem alterar o estúdio ou enviar mídia. Não é um
serviço de processamento, nem validação de precisão do modelo.

1. Obter `onnxruntime-web@1.30.0` do npm com `npm pack` e extrair o pacote em
   uma pasta temporária. Não exige mudar as dependências do aplicativo.
2. Criar `public/scouting-onnx-benchmark/` e copiar `index.html` e `worker.js`.
3. Copiar de `package/dist/`: `ort.all.bundle.min.mjs`,
   `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm`,
   `ort-wasm-simd-threaded.jsep.mjs`, `ort-wasm-simd-threaded.jsep.wasm`.
4. Colocar o modelo como `model.onnx` e um clipe local de 30 fps como
   `sample.mp4`. O teste lê somente os primeiros 90 quadros por busca temporal.
   Não usar esta estratégia como extração exata para vídeos de taxa variável.
5. Abrir `http://localhost:8081/scouting-onnx-benchmark/index.html` e executar
   CPU e GPU. O Worker é encerrado ao concluir ou cancelar. Fechar a aba
   também encerra o processamento.
6. Remover a pasta temporária de `public` antes de qualquer publicação.
   Vídeo, pesos e runtime não devem entrar no pacote do app por este teste.

Modelo: VballNetGridV2b_seq9_grayscale_20260909_001145.onnx, SHA-256
`59529e8f40891eb689e103b97713c4c2c6eaa674fd625618e73c4354c7a8dc27`.
Licença disponível junto aos artefatos originais: MIT, preservada em
`MODEL-LICENSE.txt`. O Worker reproduz a decodificação conf/x_offset/y_offset
do script local do detector, sem filtros de cor específicos do amistoso.

Memória: `performance.memory` é uma leitura aproximada do heap da página,
não mede a memória total do Worker, WebAssembly, decodificador ou GPU.
O limite total de memória ainda precisa ser medido antes da integração.

Referência de distribuição do runtime:
https://onnxruntime.ai/docs/tutorials/web/deploy.html
