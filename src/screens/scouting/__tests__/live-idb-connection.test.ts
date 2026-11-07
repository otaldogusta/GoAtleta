import {createLiveDatabaseConnection} from '../live/live-idb-connection';

function factory(){
    const databases:any[]=[],state={openError:false,transactionError:null as string|null,transactionFailures:0};
    const api={open:jest.fn(()=>{
        const db:any={closed:false,close:jest.fn(()=>{db.closed=true;}),transaction:jest.fn(()=>{
            if(state.transactionError||db.closed){state.transactionFailures++;const error=new Error('Transaction unavailable');error.name=state.transactionError??'InvalidStateError';throw error;}
            return {database:db};
        })};databases.push(db);
        const request:any={result:db};queueMicrotask(()=>{if(state.openError){request.error=new Error('Open failed');request.onerror?.();}else{if(databases.length===1)request.onupgradeneeded?.();request.onsuccess?.();}});return request;
    })};
    return {api,state,databases};
}
const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
let memory:ReturnType<typeof factory>;
beforeEach(()=>{memory=factory();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:memory.api});});
afterEach(()=>{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');});

test('a connection is shared across concurrent callers while each operation gets its own transaction',async()=>{
    const upgrade=jest.fn(),connection=createLiveDatabaseConnection('live-test',upgrade);
    const values=await Promise.all([connection.transaction('records','readonly'),connection.transaction('records','readonly'),connection.transaction('records','readwrite')]);
    expect(memory.api.open).toHaveBeenCalledTimes(1);expect(memory.api.open).toHaveBeenCalledWith('live-test',1);expect(upgrade).toHaveBeenCalledTimes(1);
    expect(memory.databases[0].transaction).toHaveBeenCalledTimes(3);expect(new Set(values).size).toBe(3);expect(memory.databases[0].close).not.toHaveBeenCalled();
});

test('versionchange and unexpected close invalidate the connection without retaining stale handles',async()=>{
    const connection=createLiveDatabaseConnection('live-test',()=>{});await connection.transaction('records','readonly');
    memory.databases[0].onversionchange();expect(memory.databases[0].close).toHaveBeenCalledTimes(1);
    await connection.transaction('records','readonly');expect(memory.api.open).toHaveBeenCalledTimes(2);
    memory.databases[1].onclose();await connection.transaction('records','readonly');expect(memory.api.open).toHaveBeenCalledTimes(3);
    // A delayed event from the old connection cannot evict the replacement.
    memory.databases[0].onclose();await connection.transaction('records','readonly');expect(memory.api.open).toHaveBeenCalledTimes(3);
});

test('different IDBFactory identities never reuse the other factory connection',async()=>{
    const connection=createLiveDatabaseConnection('live-test',()=>{});await connection.transaction('records','readonly');
    const other=factory();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:other.api});
    await connection.transaction('records','readonly');expect(memory.api.open).toHaveBeenCalledTimes(1);expect(other.api.open).toHaveBeenCalledTimes(1);
});

test('a closed connection retries transaction creation once, before any work is scheduled',async()=>{
    const connection=createLiveDatabaseConnection('live-test',()=>{});await connection.transaction('records','readonly');memory.databases[0].closed=true;
    await connection.transaction('records','readwrite');expect(memory.api.open).toHaveBeenCalledTimes(2);expect(memory.state.transactionFailures).toBe(1);
    memory.state.transactionError='InvalidStateError';await expect(connection.transaction('records','readwrite')).rejects.toThrow('Transaction unavailable');
    expect(memory.api.open).toHaveBeenCalledTimes(3);expect(memory.state.transactionFailures).toBe(3);
});

test('other transaction errors do not retry and an opening failure does not poison later requests',async()=>{
    const connection=createLiveDatabaseConnection('live-test',()=>{});memory.state.openError=true;
    await expect(connection.transaction('records','readonly')).rejects.toThrow('Open failed');memory.state.openError=false;
    await connection.transaction('records','readonly');expect(memory.api.open).toHaveBeenCalledTimes(2);
    memory.state.transactionError='NotFoundError';await expect(connection.transaction('wrong','readonly')).rejects.toThrow('Transaction unavailable');
    expect(memory.api.open).toHaveBeenCalledTimes(2);expect(memory.state.transactionFailures).toBe(1);
});
