import * as ort from './runtime/ort.all.bundle.min.mjs';
import { trackingModel, decodeTrackingOutput } from './decoder.js';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('./runtime/', import.meta.url).href;
let session, model = 'v2b';
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const started = performance.now();
      model = data.model ?? 'v2b';
      const config = trackingModel(model);
      if (session) { await session.release(); session = undefined; }
      let backend = 'webgpu';
      const modelUrl = new URL(config.file, import.meta.url).href;
      try { session = await ort.InferenceSession.create(modelUrl, {executionProviders:['webgpu']}); }
      catch { backend = 'wasm'; session = await ort.InferenceSession.create(modelUrl, {executionProviders:['wasm']}); }
      postMessage({type:'ready', backend, model, width:config.width, height:config.height, frames:config.frames, ms:performance.now()-started});
    } else if (data.type === 'run') {
      const config = trackingModel(model);
      if (!session) throw new Error('Inicialize o modelo antes de rastrear a bola.');
      if (!(data.input instanceof Float32Array) || data.input.length !== config.frames * config.width * config.height) throw new Error('Lote de tracking inválido.');
      const input = new ort.Tensor('float32', data.input, [1,config.frames,config.height,config.width]);
      const started = performance.now();
      let output;
      try {
        output = await session.run({[session.inputNames[0]]:input});
        const tensor=output[session.outputNames[0]], values=await tensor.getData();
        const predictions=decodeTrackingOutput(model, values, tensor.dims);
        postMessage({type:'result',ms:performance.now()-started,predictions});
      } finally {
        if (output) for(const value of Object.values(output)) value.dispose();
        input.dispose();
      }
    } else throw new Error('Operação de tracking inválida.');
  } catch(e) { postMessage({type:'error',error:String(e)}); }
};
