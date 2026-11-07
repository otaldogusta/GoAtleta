// Development-only WebRTC signaling. Media, recordings and scouting never pass through this service.
import http from 'node:http';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID, createHash, timingSafeEqual, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const LIVE_HOST_PORT = 8096;
export const LIVE_CAMERA_PORT = 8097;
export const LIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const CAMERA_LEASE_MS = 45000;
const MAX_ROOMS = 8, MAX_SIGNALS = 256, MAX_SIGNAL_BYTES = 512 * 1024, MAX_BODY = 96 * 1024;
const HOST_ORIGINS = new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(value).digest();
const error = (status, message) => Object.assign(new Error(message), { status });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const only = (value, fields) => object(value) && Object.keys(value).every(key => fields.includes(key));
const empty = value => only(value, []) && Object.keys(value).length === 0;
const ANDROID_PROBE_NAME = 'go-atleta-camera-probe.apk';
const ANDROID_PROBE_PATH = `/android/${ANDROID_PROBE_NAME}`;
const MAX_ANDROID_PROBE_BYTES = 64 * 1024 * 1024;
const NATIVE_CAMERA_ASSETS = new Map([['/native-camera','native-camera.html'], ['/native-camera.js','native-camera.js']]);
const NATIVE_CAMERA_ASSET_ROOT = fileURLToPath(new URL('./validation/android-camera-probe/web/',import.meta.url));
const samePath = (left, right) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;

/** Only the fixed local probe is downloadable; no request value becomes a filesystem path. */
async function sendAndroidProbe(req, res, directory) {
  let file, source;
  try {
    const root = resolve(directory), directoryInfo = await lstat(root), canonicalRoot = await realpath(root);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || !samePath(root,canonicalRoot)) throw new Error();
    const target = resolve(canonicalRoot,ANDROID_PROBE_NAME), before = await lstat(target,{bigint:true});
    if (!before.isFile() || before.isSymbolicLink() || !samePath(await realpath(target),target)) throw new Error();
    file = await open(target,'r');
    const info = await file.stat({bigint:true}), current = await lstat(target,{bigint:true});
    if (!info.isFile() || info.size <= 0n || info.size > BigInt(MAX_ANDROID_PROBE_BYTES)
        || info.dev !== before.dev || info.ino !== before.ino || current.dev !== info.dev || current.ino !== info.ino
        || current.isSymbolicLink() || !samePath(await realpath(root),root) || !samePath(await realpath(target),target)) throw new Error();
    if (req.aborted || res.destroyed) return;
    const length = Number(info.size);
    res.writeHead(200, {
      'Content-Type':'application/vnd.android.package-archive',
      'Content-Disposition':`attachment; filename="${ANDROID_PROBE_NAME}"`,
      'Content-Length':length, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
    });
    if (req.method === 'HEAD') { res.end(); return; }
    source = file.createReadStream({autoClose:false,start:0,end:length-1});
    await pipeline(source,res);
  } catch {
    if (res.headersSent || res.destroyed) { res.destroy(); return; }
    throw error(404,'Arquivo indisponível.');
  } finally {
    source?.destroy();
    await file?.close().catch(()=>{});
  }
}

export function privateIpv4(value) {
  if (typeof value !== 'string' || isIP(value) !== 4) return false;
  const [a,b] = value.split('.').map(Number);
  return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}

export function validateLiveSignal(value, role) {
  if (!object(value)) throw error(400, 'Sinal inválido.');
  if (value.type === 'offer' || value.type === 'answer') {
    const offering = value.type === 'offer';
    if (!only(value, offering ? ['type','sdp'] : ['type','sdp','generation']) || (offering ? role !== 'camera' : role !== 'host')
        || typeof value.sdp !== 'string' || value.sdp.length > 65536 || !value.sdp.startsWith('v=0') || value.sdp.includes('\0')
        || !offering && (!Number.isSafeInteger(value.generation) || value.generation < 1)) throw error(400, 'Descrição de conexão inválida.');
    return offering ? { type:'offer', sdp:value.sdp } : { type:'answer', sdp:value.sdp, generation:value.generation };
  }
  if (value.type === 'ice') {
    if (!only(value, ['type','candidate','generation']) || !Number.isSafeInteger(value.generation) || value.generation < 1) throw error(400, 'Candidato de conexão inválido.');
    const c = value.candidate;
    if (c === null) return { type:'ice', candidate:null, generation:value.generation };
    if (!only(c, ['candidate','sdpMid','sdpMLineIndex','usernameFragment']) || typeof c.candidate !== 'string' || c.candidate.length > 4096
        || c.candidate !== '' && !c.candidate.startsWith('candidate:') || c.candidate.includes('\0')
        || c.sdpMid !== undefined && c.sdpMid !== null && (typeof c.sdpMid !== 'string' || c.sdpMid.length > 256)
        || c.sdpMLineIndex !== undefined && c.sdpMLineIndex !== null && (!Number.isSafeInteger(c.sdpMLineIndex) || c.sdpMLineIndex < 0 || c.sdpMLineIndex > 65535)
        || c.usernameFragment !== undefined && c.usernameFragment !== null && (typeof c.usernameFragment !== 'string' || c.usernameFragment.length > 256)) throw error(400, 'Candidato de conexão inválido.');
    return { type:'ice', generation:value.generation, candidate:{ candidate:c.candidate, sdpMid:c.sdpMid ?? null, sdpMLineIndex:c.sdpMLineIndex ?? null, ...(c.usernameFragment !== undefined ? {usernameFragment:c.usernameFragment} : {}) } };
  }
  throw error(400, 'Somente sinais de conexão são aceitos.');
}

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw error(415, 'Envie JSON.');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY) throw error(413, 'Solicitação grande demais.');
  }
  try { return JSON.parse(raw); } catch { throw error(400, 'JSON inválido.'); }
}

/** No listeners or certificates are created by this factory. Tests bind loopback ephemeral ports only. */
export function createLiveService({ cameraOrigin = null, assetsDirectory = resolve('public/scouting-live'), nativeAssetsDirectory = NATIVE_CAMERA_ASSET_ROOT, androidProbeDirectory = resolve('.tmp/work/scouting-native-camera'), ttlMs = LIVE_ROOM_TTL_MS,
  now = Date.now, cameraLeaseMs = CAMERA_LEASE_MS, certificate = null } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > LIVE_ROOM_TTL_MS || !Number.isSafeInteger(cameraLeaseMs) || cameraLeaseMs < 1000) throw new Error('Limites de sessão inválidos.');
  let publicOrigin = null;
  if (cameraOrigin) {
    const parsed = new URL(cameraOrigin);
    if (parsed.protocol !== 'https:' || !privateIpv4(parsed.hostname) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('A câmera deve usar HTTPS em um IPv4 privado explícito.');
    publicOrigin = parsed.origin;
  }
  let certificateBytes = null;
  if (certificate) {
    if (String(certificate).includes('PRIVATE KEY')) throw new Error('Forneça somente o certificado público da autoridade local.');
    const parsed = new X509Certificate(certificate);
    if (!parsed.ca) throw new Error('Forneça o certificado público da autoridade local.');
    certificateBytes = parsed.raw;
  }
  const assets = new Map([
    ['/camera','camera.html'], ['/camera.html','camera.html'], ['/camera.js','camera.js'], ['/camera.css','camera.css'],
    ['/fonts/Inter-Regular.ttf','fonts/Inter-Regular.ttf'],
    ['/fonts/Inter-SemiBold.ttf','fonts/Inter-SemiBold.ttf'],
    ['/fonts/Inter-Bold.ttf','fonts/Inter-Bold.ttf'],
  ]);
  const assetsRoot = resolve(assetsDirectory), nativeAssetsRoot = resolve(nativeAssetsDirectory), rooms = new Map(), rates = new Map();
  const prune = () => {
    const stamp = now();
    for (const [id,room] of rooms) if (room.expiresAt <= stamp) rooms.delete(id);
    for (const [id,rate] of rates) if (stamp-rate.start >= 60000) rates.delete(id);
  };
  const limited = (req, category, limit) => {
    prune();
    const id = `${req.socket.remoteAddress}:${category}`, stamp = now();
    if (!rates.has(id) && rates.size >= 1024) throw error(429, 'Muitas solicitações. Aguarde um minuto.');
    const rate = rates.get(id) ?? { start:stamp, count:0 };
    rate.count++; rates.set(id,rate);
    if (rates.size > 1024 || rate.count > limit) throw error(429, 'Muitas solicitações. Aguarde um minuto.');
  };
  const localOrigin = req => `http://localhost:${req.socket.localPort}`;
  const ownHttpOrigin = req => new Set([localOrigin(req), `http://127.0.0.1:${req.socket.localPort}`]);
  const status = room => ({ expiresAt:room.expiresAt, cameraConnected:!!room.cameraClientId && now()-room.cameraSeen < cameraLeaseMs,
    cameraClientId:room.cameraClientId, generation:room.generation, closed:false });
  const authorized = (req, room, role) => {
    const token = req.headers['x-goatleta-live-token'];
    if (typeof token !== 'string' || !TOKEN.test(token) || !timingSafeEqual(hash(token), role === 'host' ? room.hostHash : room.cameraHash)) throw error(401, 'Conexão não autorizada.');
    if (role === 'camera' && req.method !== 'OPTIONS' && !req.url?.endsWith('/join')) {
      const client = req.headers['x-goatleta-live-client'];
      if (typeof client !== 'string' || client !== room.cameraClientId) throw error(401, 'Esta câmera não está conectada.');
      if (now()-room.cameraSeen >= cameraLeaseMs) throw error(409, 'Reconecte a câmera para continuar.');
      room.cameraSeen = now();
    }
  };
  const makeHandler = transport => async (req,res) => {
    const origin = req.headers.origin;
    const cameraLocalOrigins = ownHttpOrigin(req);
    const role = req.headers['x-goatleta-live-role'];
    const setSecurityHeaders = () => {
      res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Vary','Origin');
      res.setHeader('Cross-Origin-Resource-Policy','same-origin');
      if (typeof origin === 'string' && (transport === 'http' && HOST_ORIGINS.has(origin) || transport === 'https' && origin === publicOrigin || transport === 'http' && cameraLocalOrigins.has(origin))) res.setHeader('Access-Control-Allow-Origin',origin);
    };
    setSecurityHeaders();
    const send = (code,value) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
    try {
      const authority = req.headers.host?.toLowerCase();
      if (transport === 'http' ? !new Set([`localhost:${req.socket.localPort}`,`127.0.0.1:${req.socket.localPort}`]).has(authority) : !publicOrigin || authority !== new URL(publicOrigin).host.toLowerCase()) throw error(403, 'Endereço não autorizado.');
      const rawUrl = req.url ?? '';
      let probePath = rawUrl.split('?')[0];try { probePath = decodeURIComponent(probePath); } catch {}
      if (probePath.replace(/^\/+/, '/').toLowerCase().startsWith('/android')) {
        if (transport !== 'https' || !['GET','HEAD'].includes(req.method) || rawUrl !== ANDROID_PROBE_PATH) throw error(404,'Arquivo indisponível.');
        limited(req,'android-probe',30);
        await sendAndroidProbe(req,res,androidProbeDirectory);return;
      }
      if (rawUrl.length > 512 || rawUrl.includes('..') || rawUrl.includes('\\') || /%2e|%2f|%5c/i.test(rawUrl)) throw error(400, 'Caminho inválido.');
      const url = new URL(rawUrl,'http://local.invalid');
      const nativeAsset = NATIVE_CAMERA_ASSETS.get(url.pathname);
      const asset = nativeAsset ?? assets.get(url.pathname);
      if (req.method === 'GET' && asset) {
        if (nativeAsset && transport !== 'https') throw error(404,'Página da câmera indisponível.');
        if (url.search || nativeAsset && rawUrl !== url.pathname) throw error(400,'O código de conexão deve permanecer no fragmento do link.');
        limited(req,'asset',240);
        let data; try { data = readFileSync(resolve(nativeAsset ? nativeAssetsRoot : assetsRoot,asset)); } catch { throw error(404,'Página da câmera indisponível.'); }
        if (data.length > 512*1024) throw error(503,'Página da câmera indisponível.');
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
        res.setHeader('Permissions-Policy',nativeAsset?'camera=(), microphone=(), display-capture=()':'camera=(self), microphone=(self), display-capture=()');
        res.writeHead(200,{'Content-Type':asset.endsWith('.ttf')?'font/ttf':asset.endsWith('.html')?'text/html; charset=utf-8':asset.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'}); res.end(data); return;
      }
      if (transport === 'http' && req.method === 'GET' && url.pathname === '/certificate.crt' && !url.search) {
        if (!certificateBytes) throw error(404,'Certificado local não configurado.');
        res.writeHead(200, {'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="go-atleta-local-ca.crt"'}); res.end(certificateBytes); return;
      }
      if (req.method === 'OPTIONS') {
        const allowed = transport === 'http' ? HOST_ORIGINS.has(origin) || cameraLocalOrigins.has(origin) : origin === publicOrigin;
        if (!allowed) throw error(403,'Origem não autorizada.');
        res.writeHead(204, {'Access-Control-Allow-Methods':'GET,POST,DELETE','Access-Control-Allow-Headers':'Content-Type,X-GoAtleta-Live,X-GoAtleta-Live-Role,X-GoAtleta-Live-Token,X-GoAtleta-Live-Client'}); res.end(); return;
      }
      if (req.headers['x-goatleta-live'] !== '1') throw error(403,'Solicitação não autorizada.');
      limited(req,'api',360);
      if (transport === 'http' && req.method === 'GET' && url.pathname === '/config' && !url.search) {
        if (!HOST_ORIGINS.has(origin)) throw error(403,'Origem não autorizada.');
        send(200,{cameraReady:!!publicOrigin,cameraOrigin:publicOrigin,localCameraOrigin:localOrigin(req),roomTtlMs:ttlMs,certificateAvailable:!!certificateBytes,certificateUrl:certificateBytes?`${localOrigin(req)}/certificate.crt`:null}); return;
      }
      if (transport === 'http' && req.method === 'POST' && url.pathname === '/rooms' && !url.search) {
        if (!HOST_ORIGINS.has(origin)) throw error(403,'Origem não autorizada.');
        limited(req,'create',6);
        if (!empty(await body(req))) throw error(400,'A conexão não recebe dados de alunos ou análises.');
        if (rooms.size >= MAX_ROOMS) throw error(429,'Encerre uma conexão antes de criar outra.');
        const roomId = randomUUID(), hostToken = randomBytes(32).toString('hex'), cameraToken = randomBytes(32).toString('hex'), expiresAt = now()+ttlMs;
        rooms.set(roomId,{roomId,hostHash:hash(hostToken),cameraHash:hash(cameraToken),expiresAt,cameraClientId:null,cameraSeen:0,generation:0,sequence:0,messages:[],bytes:0,acks:{host:0,camera:0},offers:[]});
        const suffix = `/camera#room=${roomId}&token=${cameraToken}`;
        send(201,{roomId,hostToken,cameraToken,cameraUrl:publicOrigin?`${publicOrigin}${suffix}`:null,localCameraUrl:`${localOrigin(req)}${suffix}`,expiresAt}); return;
      }
      const match = url.pathname.match(/^\/rooms\/([a-f0-9-]{36})(?:\/(join|signals|heartbeat|status))?$/);
      if (!match || !ID.test(match[1])) throw error(404,'Conexão não encontrada.');
      if (!['host','camera'].includes(role)) throw error(401,'Papel de conexão inválido.');
      const cameraCaller = role === 'camera';
      const callerAllowed = transport === 'https' ? cameraCaller && (!origin || origin === publicOrigin)
        : cameraCaller ? !origin || cameraLocalOrigins.has(origin) : HOST_ORIGINS.has(origin);
      if (!callerAllowed) throw error(403,'Origem não autorizada.');
      if (req.headers['sec-fetch-site'] && !origin && !['same-origin','none'].includes(req.headers['sec-fetch-site'])) throw error(403,'Origem não autorizada.');
      const room = rooms.get(match[1]);
      if (!room || room.expiresAt <= now()) { rooms.delete(match[1]); throw error(410,'Esta conexão expirou ou foi encerrada.'); }
      authorized(req,room,role);
      const action = match[2];
      if (action !== 'signals' && url.search || action === 'signals' && ([...url.searchParams.keys()].some(key=>key!=='after') || url.searchParams.getAll('after').length > 1)) throw error(400,'Parâmetros inválidos.');
      if (req.method === 'POST' && action === 'join' && cameraCaller) {
        if (!empty(await body(req))) throw error(400,'Conexão de câmera inválida.');
        const client = req.headers['x-goatleta-live-client'];
        if (room.cameraClientId && client !== room.cameraClientId && now()-room.cameraSeen < cameraLeaseMs) throw error(409,'Outra câmera já está conectada.');
        if (!room.cameraClientId || client !== room.cameraClientId) room.cameraClientId = randomUUID();
        room.cameraSeen = now();
        send(200,{cameraClientId:room.cameraClientId,generation:room.generation,cursor:room.sequence,expiresAt:room.expiresAt}); return;
      }
      if (req.method === 'GET' && action === 'status') { send(200,status(room)); return; }
      if (req.method === 'POST' && action === 'heartbeat') {
        if (!empty(await body(req))) throw error(400,'Estado inválido.');
        send(200,status(room)); return;
      }
      if (req.method === 'DELETE' && !action && role === 'host') { rooms.delete(room.roomId); send(200,{closed:true}); return; }
      if (action === 'signals' && req.method === 'GET') {
        const rawAfter = url.searchParams.get('after') ?? '0';
        if (!/^\d{1,10}$/.test(rawAfter)) throw error(400,'Posição de sinal inválida.');
        const after = Number(rawAfter);
        if (!Number.isSafeInteger(after) || after > room.sequence) throw error(409,'Atualize a conexão.');
        room.acks[role] = Math.max(room.acks[role],after);
        const signals = room.messages.filter(message=>message.sequence>after && message.from!==role);
        const cursor = room.sequence;
        const acknowledged = Math.min(room.acks.host,room.acks.camera);
        room.messages = room.messages.filter(message=>message.sequence>acknowledged); room.bytes=room.messages.reduce((n,m)=>n+Buffer.byteLength(JSON.stringify(m)),0);
        send(200,{cursor,signals}); return;
      }
      if (action === 'signals' && req.method === 'POST' && !url.search) {
        const signal = validateLiveSignal(await body(req),role);
        if (signal.type === 'offer') {
          room.offers = room.offers.filter(stamp=>now()-stamp<60000);
          if (room.offers.length >= 8) throw error(429,'Aguarde antes de reconectar a câmera.');
          room.offers.push(now()); room.generation++; room.messages=[]; room.bytes=0;
        } else if (!room.generation || signal.generation !== room.generation) throw error(409,'Esta negociação já foi substituída.');
        const message={...signal,sequence:room.sequence+1,from:role,generation:room.generation};
        const size=Buffer.byteLength(JSON.stringify(message));
        if (room.messages.length>=MAX_SIGNALS || room.bytes+size>MAX_SIGNAL_BYTES) throw error(429,'A outra ponta precisa reconectar para continuar.');
        room.sequence++;room.messages.push(message);room.bytes+=size;
        send(200,{sequence:room.sequence,generation:room.generation});return;
      }
      throw error(405,'Ação indisponível para esta conexão.');
    } catch (failure) {
      if (!res.headersSent && !res.destroyed) send(failure.status ?? 500,{error:failure.status ? failure.message : 'Não foi possível concluir a conexão.'});
      else res.destroy();
    }
  };
  const hostServer=http.createServer({maxHeaderSize:8192,requestTimeout:10000,headersTimeout:5000,keepAliveTimeout:3000},makeHandler('http'));
  hostServer.maxRequestsPerSocket=100;
  const cameraHandler=makeHandler('https');
  return {hostServer,cameraHandler,closeAll:()=>rooms.clear(),roomCount:()=>{prune();return rooms.size;}};
}

export function liveCliOptions(args) {
  const allowed=new Set(['--cert','--key','--ca','--public-host','--http-port','--https-port','--assets']);
  const result={httpPort:LIVE_HOST_PORT,httpsPort:LIVE_CAMERA_PORT,assetsDirectory:resolve('public/scouting-live')};
  const names={'--cert':'cert','--key':'key','--ca':'ca','--public-host':'publicHost','--http-port':'httpPort','--https-port':'httpsPort','--assets':'assetsDirectory'};
  const seen=new Set();
  for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||seen.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Argumentos inválidos.');seen.add(args[i]);result[names[args[i]]]=args[i+1];}
  result.httpPort=Number(result.httpPort);result.httpsPort=Number(result.httpsPort);
  if(![result.httpPort,result.httpsPort].every(port=>Number.isInteger(port)&&port>=1024&&port<=65535)||result.httpPort===result.httpsPort)throw new Error('Portas inválidas.');
  if(!!result.cert!==!!result.key || (result.cert || result.publicHost) && (!result.cert || !privateIpv4(result.publicHost)))throw new Error('HTTPS requer --cert, --key e --public-host IPv4 privado.');
  return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const options=liveCliOptions(process.argv.slice(2));
  const tls=options.cert?{cert:readFileSync(options.cert),key:readFileSync(options.key),minVersion:'TLSv1.2'}:null;
  const companion=createLiveService({cameraOrigin:tls?`https://${options.publicHost}:${options.httpsPort}`:null,assetsDirectory:options.assetsDirectory,certificate:options.ca?readFileSync(options.ca):null});
  companion.hostServer.listen(options.httpPort,'127.0.0.1',()=>console.log(`Go Atleta ao vivo: notebook em 127.0.0.1:${options.httpPort}.`));
  if(tls){const camera=https.createServer({...tls,maxHeaderSize:8192,requestTimeout:10000,headersTimeout:5000},companion.cameraHandler);camera.listen(options.httpsPort,'0.0.0.0',()=>console.log(`Câmera HTTPS local configurada na porta ${options.httpsPort}. Certificados e firewall não foram alterados.`));}
  else console.log('Câmera Wi-Fi aguarda HTTPS local. Teste de câmera disponível somente neste computador.');
}
