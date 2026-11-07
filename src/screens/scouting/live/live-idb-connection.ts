type Connection={promise:Promise<IDBDatabase>;db?:IDBDatabase};
/** Cache only this database connection. Every caller still opens a fresh scoped transaction. */
export function createLiveDatabaseConnection(name:string,upgrade:(db:IDBDatabase)=>void){
    const connections=new WeakMap<IDBFactory,Connection>();
    const invalidate=(factory:IDBFactory,connection:Connection)=>{
        if(connections.get(factory)===connection)connections.delete(factory);
        try{connection.db?.close();}catch{/* A forced browser close already invalidated it. */}
    };
    const connect=(factory:IDBFactory):Connection=>{
        const cached=connections.get(factory);if(cached)return cached;
        const connection={} as Connection;
        connections.set(factory,connection);
        connection.promise=new Promise<IDBDatabase>((resolve,reject)=>{
            let settled=false;
            const fail=(error:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);invalidate(factory,connection);reject(error instanceof Error?error:new Error('Armazenamento local indisponível.'));};
            const timer=setTimeout(()=>fail(new Error('Tempo esgotado ao abrir o armazenamento local.')),10000);
            let request:IDBOpenDBRequest;
            try{request=factory.open(name,1);}catch(error){fail(error);return;}
            request.onerror=()=>fail(request.error);
            request.onblocked=()=>fail(new Error('Armazenamento local bloqueado por outra aba.'));
            request.onupgradeneeded=()=>{try{upgrade(request.result);}catch(error){try{request.transaction?.abort();}catch{}fail(error);}};
            request.onsuccess=()=>{
                const db=request.result;if(settled){db.close();return;}
                settled=true;clearTimeout(timer);connection.db=db;
                db.onversionchange=db.onclose=()=>invalidate(factory,connection);
                resolve(db);
            };
        });
        return connection;
    };
    return {
        async transaction(stores:string|string[],mode:IDBTransactionMode):Promise<IDBTransaction>{
            if(typeof indexedDB==='undefined')throw new Error('Armazenamento local indisponível neste navegador.');
            const factory=indexedDB;
            for(let attempt=0;attempt<2;attempt++){
                const connection=connect(factory),db=await connection.promise;
                try{return db.transaction(stores,mode);}
                catch(error){
                    // No operation exists yet: retry only opening a transaction on a stale connection.
                    if(error&&typeof error==='object'&&'name' in error&&error.name==='InvalidStateError'){
                        invalidate(factory,connection);if(attempt===0)continue;
                    }
                    throw error;
                }
            }
            throw new Error('Não foi possível abrir a transação local.');
        },
    };
}
