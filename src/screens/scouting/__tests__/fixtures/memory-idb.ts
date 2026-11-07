type Value=any;
type Stores=Map<string,Map<string,Value>>;
const schedule=(run:()=>void)=>{void Promise.resolve().then(run);};

/** Small transactional IndexedDB fixture: queued transactions, atomic abort and explicit write faults. */
export function createMemoryIdb(){
    const databases=new Map<string,Stores>(),queues=new Map<string,(()=>void)[]>(),held:(()=>void)[]=[];
    const state={pauseWrites:false,failWrite:null as null|((database:string,store:string,key:string,value:Value)=>Error|null),beforeRead:null as null|((database:string,store:string,key:unknown)=>void)};
    const trace:{database:string;store:string;operation:string;key:unknown}[]=[];
    const factory={open:(database:string)=>{
        let stores=databases.get(database);const fresh=!stores;if(!stores){stores=new Map();databases.set(database,stores);}
        let closed=false;
        const db:any={close:()=>{closed=true;},objectStoreNames:{contains:(name:string)=>stores!.has(name)},
            createObjectStore:(name:string)=>{stores!.set(name,new Map());return{createIndex(){}};},
            transaction:(names:string|string[],mode='readonly')=>{
                if(closed){const error=new Error('Closed');error.name='InvalidStateError';throw error;}
                const selected=typeof names==='string'?[names]:names;
                let copies:Stores,active=false,finished=false,outstanding=0;const pending:(()=>void)[]=[];
                const queue=queues.get(database)??[];queues.set(database,queue);
                const release=()=>{queue.shift();schedule(()=>queue[0]?.());};
                const tx:any={error:null,abort:()=>{if(finished)return;finished=true;schedule(()=>{tx.onabort?.();if(active)release();});},objectStore:(store:string)=>{
                    const request=(operation:string,key:unknown,run:(values:Map<string,Value>)=>unknown,write=false)=>{
                        const req:any={};outstanding++;
                        const execute=()=>{if(finished)return;if(write&&state.pauseWrites){held.push(execute);return;}
                            trace.push({database,store,operation,key});
                            try{if(!write)state.beforeRead?.(database,store,key);req.result=run(copies.get(store)!);req.onsuccess?.();}
                            catch(error){req.error=tx.error=error;req.onerror?.();tx.onerror?.();tx.abort();}
                            outstanding--;schedule(()=>{if(finished||outstanding)return;finished=true;if(mode==='readwrite')copies.forEach((values,name)=>stores!.set(name,values));tx.oncomplete?.();release();});
                        };
                        if(active)schedule(execute);else pending.push(execute);return req;
                    };
                    const write=(operation:string,value:Value,key:string)=>request(operation,key,values=>{
                        const failure=state.failWrite?.(database,store,key,value);if(failure)throw failure;
                        if(operation==='add'&&values.has(key)){const error=new Error('Duplicate key');error.name='ConstraintError';throw error;}
                        values.set(key,value);return key;
                    },true);
                    return{get:(key:string)=>request('get',key,values=>values.get(key)),getAll:()=>request('getAll',undefined,values=>[...values.values()]),
                        getAllKeys:()=>request('getAllKeys',undefined,values=>[...values.keys()]),put:(value:Value,key:string)=>write('put',value,key),add:(value:Value,key:string)=>write('add',value,key),
                        delete:(key:string)=>request('delete',key,values=>values.delete(key),true),
                        index:()=>({getAll:(owner:string)=>request('index.getAll',owner,values=>[...values.values()].filter(value=>value.owner===owner)),count:(owner:string)=>request('index.count',owner,values=>[...values.values()].filter(value=>value.owner===owner).length)})};
                }};
                const start=()=>{if(finished){release();return;}active=true;copies=new Map(selected.map(name=>[name,new Map(stores!.get(name))]));pending.splice(0).forEach(run=>schedule(run));};
                queue.push(start);if(queue.length===1)schedule(start);return tx;
            }};
        const request:any={result:db};schedule(()=>{if(fresh)request.onupgradeneeded?.();request.onsuccess?.();});return request;
    }};
    return{factory:factory as unknown as IDBFactory,databases,state,trace,resumeWrites:()=>{state.pauseWrites=false;held.splice(0).forEach(run=>schedule(run));}};
}
