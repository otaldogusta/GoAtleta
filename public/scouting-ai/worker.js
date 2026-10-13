import * as ort from './runtime/ort.all.bundle.min.mjs';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('./runtime/', import.meta.url).href;
let session;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const started = performance.now();
      let backend = 'webgpu';
      try { session = await ort.InferenceSession.create(new URL('./model.onnx', import.meta.url).href, {executionProviders:['webgpu']}); }
      catch { backend = 'wasm'; session = await ort.InferenceSession.create(new URL('./model.onnx', import.meta.url).href, {executionProviders:['wasm']}); }
      postMessage({type:'ready', backend, ms:performance.now()-started});
    } else {
      const input = new ort.Tensor('float32', data.input, [1,9,432,768]);
      const started = performance.now();
      const output = await session.run({[session.inputNames[0]]:input});
      const tensor=output[session.outputNames[0]], values=await tensor.getData();
      const predictions=[];
      for(let f=0;f<9;f++) {
        const offset=f*4*27*48; let best=0;
        for(let i=1;i<27*48;i++) if(values[offset+i]>values[offset+best]) best=i;
        predictions.push({score:values[offset+best], x:(best%48+values[offset+1296+best])/48, y:(Math.floor(best/48)+values[offset+2592+best])/27});
      }
      for(const value of Object.values(output)) value.dispose();
      input.dispose();
      postMessage({type:'result',ms:performance.now()-started,predictions});
    }
  } catch(e) { postMessage({type:'error',error:String(e)}); }
};
