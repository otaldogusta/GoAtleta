import { parseLivePoint, type LivePoint } from '../../../core/scouting-live';

export type LiveHostScope = { userId: string; org: string; classId: string };
export type LiveCameraOperation = {kind:'point';point:LivePoint} | {kind:'undo-point';id:string;recordingId:string};
export type LiveCameraDelivery = {pending:LiveCameraOperation[];acknowledged:{kind:'point'|'undo-point';id:string}[]};
export type LiveHostSession = {
    version: 1; id: string; scope: LiveHostScope; recordingId: string; createdAt: string; updatedAt: string;
    setNumber: number; className: string; points: LivePoint[]; gaps: { startHostEpochMs: number; endHostEpochMs?: number }[];
    mimeType: string; ended: boolean;
    durationMs?:number; recordingState?:'stopped'|'error'; deletedAt?:string;
    delivery?:LiveCameraDelivery;
};
const DB = 'goatleta-scouting-live-host-v1', STORE = 'host-sessions';
const queues = new Map<string, Promise<void>>();
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 300;
const same = (a: LiveHostScope,b: LiveHostScope) => a.userId === b.userId && a.org === b.org && a.classId === b.classId;
export function liveHostSessionKey(scope: LiveHostScope, session: string) {
    if (![scope.userId,scope.org,scope.classId,session].every(id)) throw new Error('Escopo do modo ao vivo incompleto.');
    return ['goatleta:scouting-live:v1',scope.userId,scope.org,scope.classId,session].map(encodeURIComponent).join(':');
}
export function parseLiveHostSession(value: unknown, scope: LiveHostScope): LiveHostSession {
    const v = value as LiveHostSession;
    if (!v || v.version !== 1 || !id(v.id) || !id(v.recordingId) || !v.scope || !same(v.scope,scope) || !Array.isArray(v.points) || v.points.length > 2000
        || !Number.isSafeInteger(v.setNumber) || v.setNumber < 1 || v.setNumber > 99 || typeof v.mimeType !== 'string' || typeof v.className !== 'string' || typeof v.ended !== 'boolean'
        || !Array.isArray(v.gaps) || v.gaps.length > 1000 || !Number.isFinite(Date.parse(v.createdAt)) || !Number.isFinite(Date.parse(v.updatedAt))) throw new Error('Gravação ao vivo inválida para esta turma.');
    if(v.durationMs!==undefined&&(!Number.isFinite(v.durationMs)||v.durationMs<0||v.durationMs>86400000)
        ||v.recordingState!==undefined&&(!v.ended||!['stopped','error'].includes(v.recordingState))
        ||v.deletedAt!==undefined&&(!v.ended||typeof v.deletedAt!=='string'||!Number.isFinite(Date.parse(v.deletedAt))))throw new Error('Estado final da gravação inválido.');
    const points = v.points.map(parseLivePoint);
    if (points.some(point => point.recordingId !== v.recordingId) || new Set(points.map(point=>point.id)).size !== points.length) throw new Error('Pontos de outra gravação.');
    if (v.gaps.some(gap=>!Number.isFinite(gap.startHostEpochMs) || gap.endHostEpochMs !== undefined && (!Number.isFinite(gap.endHostEpochMs) || gap.endHostEpochMs < gap.startHostEpochMs))) throw new Error('Interrupções de gravação inválidas.');
    // Legacy local captures have no receipts: retry their active markers idempotently,
    // only after the same recording identifies itself again. Never infer a camera ACK.
    const rawDelivery=v.delivery??{pending:points.map(point=>({kind:'point' as const,point})),acknowledged:[]};
    if(!Array.isArray(rawDelivery.pending)||rawDelivery.pending.length>4000||!Array.isArray(rawDelivery.acknowledged)||rawDelivery.acknowledged.length>4000)throw new Error('Fila de cópia da gravação inválida.');
    const delivery:LiveCameraDelivery={pending:rawDelivery.pending.map(operation=>{
        if(operation?.kind==='point'){
            const point=parseLivePoint(operation.point);
            if(point.recordingId!==v.recordingId||!points.some(saved=>JSON.stringify(saved)===JSON.stringify(point)))throw new Error('Marcação pendente de outra gravação.');
            return{kind:'point',point};
        }
        if(operation?.kind!=='undo-point'||operation.recordingId!==v.recordingId||typeof operation.id!=='string'||!/^[-\w]{1,128}$/.test(operation.id))throw new Error('Correção pendente de outra gravação.');
        return{kind:'undo-point',id:operation.id,recordingId:operation.recordingId};
    }),acknowledged:rawDelivery.acknowledged.map(receipt=>{
        if(!receipt||!['point','undo-point'].includes(receipt.kind)||typeof receipt.id!=='string'||!/^[-\w]{1,128}$/.test(receipt.id))throw new Error('Confirmação de cópia inválida.');
        return{kind:receipt.kind,id:receipt.id};
    })};
    if(new Set(delivery.pending.map(operation=>operation.kind==='point'?operation.point.id:operation.id)).size!==delivery.pending.length
        ||new Set(delivery.acknowledged.map(receipt=>`${receipt.kind}:${receipt.id}`)).size!==delivery.acknowledged.length)throw new Error('Fila de cópia duplicada.');
    return { version:1,id:v.id,scope:{...scope},recordingId:v.recordingId,createdAt:v.createdAt,updatedAt:v.updatedAt,setNumber:v.setNumber,className:v.className.slice(0,200),points,gaps:v.gaps.map(gap=>({...gap})),mimeType:v.mimeType.slice(0,120),ended:v.ended,delivery,
        ...(v.durationMs!==undefined?{durationMs:v.durationMs}:{}),...(v.recordingState?{recordingState:v.recordingState}:{}),...(v.deletedAt?{deletedAt:v.deletedAt}:{}) };
}
function open(): Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
        let settled=false;
        const fail=(message:string)=>{if(settled)return;settled=true;clearTimeout(timeout);reject(new Error(message));};
        const timeout=setTimeout(()=>fail('Tempo esgotado ao abrir o armazenamento do modo ao vivo.'),10000);
        const req = indexedDB.open(DB,1);
        req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE); };
        req.onerror=()=>fail('Não foi possível abrir o armazenamento do modo ao vivo.');
        req.onblocked=()=>fail('Armazenamento do modo ao vivo bloqueado por outra aba.');
        req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;clearTimeout(timeout);resolve(req.result);};
    });
}
async function transaction<T>(mode: IDBTransactionMode, operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
    const db = await open();
    return new Promise((resolve,reject)=>{
        let settled=false, result:T;
        const tx=db.transaction(STORE,mode), timeout=setTimeout(()=>{try{tx.abort();}catch{}},10000);
        const finish=(failure?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);db.close();if(failure)reject(failure);else resolve(result);};
        tx.onabort=()=>finish(new Error('Gravação local cancelada. Seus pontos anteriores foram preservados.'));
        tx.onerror=()=>finish(new Error('Não foi possível salvar os pontos neste notebook.'));
        tx.oncomplete=()=>finish();
        try { const req=operation(tx.objectStore(STORE));req.onsuccess=()=>{result=req.result;};req.onerror=()=>finish(new Error('Armazenamento local indisponível.')); }
        catch {try{tx.abort();}catch{} finish(new Error('Armazenamento local indisponível.'));}
    });
}
async function changeSession(scope:LiveHostScope,sessionId:string,recipe:(current:LiveHostSession|null)=>LiveHostSession):Promise<LiveHostSession>{
    const key=liveHostSessionKey(scope,sessionId),previous=queues.get(key)??Promise.resolve();
    const operation=previous.catch(()=>undefined).then(async()=>{
        const db=await open();
        return new Promise<LiveHostSession>((resolve,reject)=>{
            let next:LiveHostSession,failure:Error|undefined,settled=false;
            const tx=db.transaction(STORE,'readwrite'),timeout=setTimeout(()=>{failure=new Error('Tempo esgotado ao atualizar a gravação.');tx.abort();},10000);
            const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);db.close();if(error)reject(error);else resolve(next);};
            const abort=(error:unknown)=>{failure=error instanceof Error?error:new Error('Não foi possível atualizar a gravação.');try{tx.abort();}catch{finish(failure);}};
            tx.onabort=()=>finish(failure??new Error('Alteração cancelada. Os registros anteriores foram preservados.'));
            tx.onerror=()=>abort(new Error('Não foi possível atualizar os registros neste notebook.'));
            tx.oncomplete=()=>finish();
            try{
                const store=tx.objectStore(STORE),read=store.get(key);
                read.onerror=()=>abort(new Error('Armazenamento local indisponível.'));
                read.onsuccess=()=>{try{next=parseLiveHostSession(recipe(read.result===undefined?null:parseLiveHostSession(read.result,scope)),scope);if(next.id!==sessionId)throw new Error('Identidade da gravação inválida.');const write=store.put(next,key);write.onerror=()=>abort(new Error('Não foi possível atualizar os registros neste notebook.'));}catch(error){abort(error);}};
            }catch(error){abort(error);}
        });
    });
    const queued=operation.then(()=>undefined,()=>undefined);queues.set(key,queued);
    try{return await operation;}finally{if(queues.get(key)===queued)queues.delete(key);}
}
export async function saveLiveHostSession(session:LiveHostSession, scope:LiveHostScope) {
    const clean=parseLiveHostSession(session,scope);
    if(clean.deletedAt)throw new Error('Use a exclusão confirmada para mover registros para a lixeira.');
    await changeSession(scope,clean.id,current=>{if(current?.deletedAt)throw new Error('Esta gravação foi excluída neste notebook. Restaure-a antes de editar.');if(current&&current.recordingId!==clean.recordingId)throw new Error('Esta cópia pertence a outra gravação.');return clean;});
}
/** Move only this notebook manifest to a recoverable tombstone; never contact the phone. */
export async function deleteLiveHostSession(scope:LiveHostScope,sessionId:string,recordingId:string){
    return changeSession(scope,sessionId,current=>{
        if(!current||current.recordingId!==recordingId)throw new Error('Gravação não encontrada nesta turma.');
        if(!current.ended)throw new Error('A gravação precisa estar encerrada.');
        if(current.delivery?.pending.length)throw new Error('Aguarde as cópias pendentes antes de excluir.');
        return {...current,deletedAt:current.deletedAt??new Date().toISOString()};
    });
}
export async function restoreLiveHostSession(scope:LiveHostScope,sessionId:string,recordingId:string){
    return changeSession(scope,sessionId,current=>{
        if(!current?.deletedAt||current.recordingId!==recordingId)throw new Error('Gravação excluída não encontrada nesta turma.');
        const {deletedAt:_,...restored}=current;return restored;
    });
}
export async function loadLiveHostSessions(scope:LiveHostScope,includeDeleted=false):Promise<LiveHostSession[]> {
    const values=await transaction<unknown[]>('readonly',store=>store.getAll());
    return values.flatMap(value=>{
        const v=value as LiveHostSession;if(!v?.scope||!same(v.scope,scope))return[];
        const clean=parseLiveHostSession(v,scope);return clean.deletedAt&&!includeDeleted?[]:[clean];
    }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
