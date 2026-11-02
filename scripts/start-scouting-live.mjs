// Start/reuse the local companion. Never changes trust, firewall, Metro or an existing process.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_HOST_PORT, LIVE_CAMERA_PORT, privateIpv4 } from './scouting-live-service.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultLiveConfig = join(homedir(), '.config', 'goatleta', 'scouting-live', 'local-config.json');

export function parseLiveLocalConfig(value, configFile = defaultLiveConfig) {
  const allowed = new Set(['host','directory','ca','cert','key','fingerprint','reused','trustInstalled']);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.has(key)) || !privateIpv4(value.host)) throw new Error('Configuração local inválida. Prepare o HTTPS local novamente em uma pasta nova.');
  const directory = dirname(resolve(configFile));
  if (value.directory !== undefined && (typeof value.directory !== 'string' || resolve(value.directory) !== directory)) throw new Error('A configuração deve permanecer junto dos certificados locais.');
  const result = { host:value.host };
  for (const name of ['ca','cert','key']) {
    if (typeof value[name] !== 'string' || !value[name]) throw new Error('Configuração de certificados incompleta.');
    const path = resolve(directory,value[name]), inside = relative(directory,path);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('Os certificados devem permanecer na pasta da configuração.');
    result[name] = path;
  }
  return result;
}

export function readLiveLocalConfig(configFile = defaultLiveConfig) {
  let value;
  try { value = JSON.parse(readFileSync(configFile,'utf8')); }
  catch { throw new Error('Configuração local não encontrada ou inválida. Use npm run dev:scouting-live:setup -- --host IP_DO_NOTEBOOK.'); }
  const config = parseLiveLocalConfig(value,configFile);
  try {
    const authorityBytes = readFileSync(config.ca), certBytes = readFileSync(config.cert);
    if (String(authorityBytes).includes('PRIVATE KEY')) throw new Error('Not a public CA');
    const authority = new X509Certificate(authorityBytes), certificate = new X509Certificate(certBytes), now = Date.now();
    if (!authority.ca || !certificate.checkIP(config.host) || !certificate.verify(authority.publicKey)
        || Date.parse(authority.validFrom) > now || Date.parse(authority.validTo) <= now || Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) <= now
        || !certificate.checkPrivateKey(createPrivateKey(readFileSync(config.key)))) throw new Error('Certificate mismatch');
  } catch { throw new Error('Os certificados locais estão ausentes, incompatíveis ou expirados. Prepare outra pasta; nenhum arquivo foi alterado.'); }
  return config;
}

/** Refuse an occupied/unrecognized service rather than stopping anything already running. */
export function probeLiveService({ port = LIVE_HOST_PORT, timeoutMs = 1500 } = {}) {
  return new Promise((done,fail) => {
    let settled = false;
    const finish = (error,value) => { if(settled)return;settled=true;error?fail(error):done(value); };
    const request = http.request({hostname:'127.0.0.1',port,path:'/config',method:'GET',headers:{Origin:'http://localhost:8081','X-GoAtleta-Live':'1'}},response=>{
      let raw='';response.setEncoding('utf8');
      response.on('data',chunk=>{raw+=chunk;if(raw.length>16384){request.destroy();finish(new Error('A porta local está ocupada por um serviço não reconhecido. Nenhum processo foi alterado.'));}});
      response.on('error',()=>finish(new Error('O serviço local não respondeu. A conexão existente foi preservada.')));
      response.on('end',()=>{
        try {
          const config=JSON.parse(raw);
          if(response.statusCode!==200 || typeof config.cameraReady!=='boolean' || config.localCameraOrigin!==`http://localhost:${port}` || !Number.isSafeInteger(config.roomTtlMs) || config.roomTtlMs<1000 || config.roomTtlMs>7200000) throw new Error();
          if(config.cameraReady){const url=new URL(config.cameraOrigin);if(url.protocol!=='https:'||!privateIpv4(url.hostname)||url.port!==String(LIVE_CAMERA_PORT)||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new Error();}
          else if(config.cameraOrigin!==null)throw new Error();
          finish(null,config);
        } catch {finish(new Error('A porta local está ocupada por um serviço não reconhecido. Nenhum processo foi alterado.'));}
      });
    });
    request.setTimeout(timeoutMs,()=>{request.destroy();finish(new Error('O serviço local demorou para responder. Nenhum processo foi alterado.'));});
    request.on('error',error=>finish(error.code==='ECONNREFUSED'?null:new Error('Não foi possível conferir o serviço local. Nenhum processo foi alterado.'),null));
    request.end();
  });
}

export async function startOrReuseLiveService({ configFile = defaultLiveConfig, loopbackOnly = false, probe = probeLiveService, readConfig = readLiveLocalConfig, spawnProcess = spawn } = {}) {
  const existing = await probe();
  if(existing)return {reused:true,cameraReady:existing.cameraReady,child:null};
  const args=[join(root,'scripts','scouting-live-service.mjs'),'--assets',join(root,'public','scouting-live')];
  if(!loopbackOnly){const config=readConfig(configFile);args.push('--public-host',config.host,'--cert',config.cert,'--key',config.key,'--ca',config.ca);}
  const child=spawnProcess(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true,shell:false});
  return {reused:false,cameraReady:!loopbackOnly,child};
}

export function liveStartOptions(args) {
  const options={};
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--loopback-only'&&!options.loopbackOnly)options.loopbackOnly=true;
    else if(args[i]==='--config'&&!options.configFile&&args[i+1]&&!args[i+1].startsWith('--'))options.configFile=resolve(args[++i]);
    else throw new Error('Use --config ARQUIVO ou --loopback-only.');
  }
  return options;
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    const result=await startOrReuseLiveService(liveStartOptions(process.argv.slice(2)));
    if(result.reused)console.log('Serviço ao vivo já ativo; conexão atual preservada. A configuração em disco só será aplicada em uma nova inicialização.');
    else if(result.child){await new Promise((done,fail)=>{result.child.once('error',()=>fail(new Error('Não foi possível iniciar o serviço local.')));result.child.once('exit',code=>code===0?done():fail(new Error('O serviço local terminou. Confira a configuração e se as portas estão disponíveis.')));});}
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
