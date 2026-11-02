import {createLiveRoom,getLiveServiceConfig,pollLiveSignals,sendLiveSignal,type LiveRoom} from '../live/live-api';
const originalFetch=global.fetch, originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
const room:LiveRoom={roomId:'11111111-1111-4111-8111-111111111111',hostToken:'a'.repeat(64),cameraToken:'b'.repeat(64),cameraUrl:null,localCameraUrl:`http://localhost:8096/camera#room=11111111-1111-4111-8111-111111111111&token=${'b'.repeat(64)}`,expiresAt:Date.now()+7200000};
beforeEach(()=>{Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{origin:'http://localhost:8081'}}});global.fetch=jest.fn();});
afterEach(()=>{global.fetch=originalFetch;if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');});
const ok=(value:unknown)=>({ok:true,json:async()=>value});
test('creates an anonymous room and never places host capability in a URL',async()=>{
    (global.fetch as jest.Mock).mockResolvedValue(ok(room));
    expect(await createLiveRoom(new AbortController().signal)).toEqual(room);
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:8096/rooms',expect.objectContaining({body:'{}',headers:expect.objectContaining({'X-GoAtleta-Live':'1'})}));
    expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain(room.hostToken);
});
test('signaling capabilities stay in role-specific headers, including the negotiation generation',async()=>{
    (global.fetch as jest.Mock).mockResolvedValue(ok({cursor:2,signals:[]}));
    await pollLiveSignals(room,2,new AbortController().signal);
    await sendLiveSignal(room,{type:'answer',sdp:'v=0',generation:3},new AbortController().signal);
    expect(global.fetch).toHaveBeenLastCalledWith(`http://127.0.0.1:8096/rooms/${room.roomId}/signals`,expect.objectContaining({headers:expect.objectContaining({'X-GoAtleta-Live-Role':'host','X-GoAtleta-Live-Token':room.hostToken}),body:JSON.stringify({type:'answer',sdp:'v=0',generation:3})}));
    expect((global.fetch as jest.Mock).mock.calls.every(([url])=>!url.includes(room.hostToken))).toBe(true);
});
test('production cannot silently connect to a developer loopback service',async()=>{
    Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{origin:'https://goatleta.com'}}});
    await expect(getLiveServiceConfig(new AbortController().signal)).rejects.toThrow('desenvolvimento');
    expect(global.fetch).not.toHaveBeenCalled();
});
test('rejects camera addresses carrying a different room or query capabilities',async()=>{
    for(const changed of [{...room,localCameraUrl:room.localCameraUrl.replace('/camera#','/camera?token=private#')},{...room,cameraUrl:'https://camera.example/camera#room=foreign&token='+room.cameraToken}]){
        (global.fetch as jest.Mock).mockResolvedValueOnce(ok(changed));
        await expect(createLiveRoom(new AbortController().signal)).rejects.toThrow('inválido');
    }
});
