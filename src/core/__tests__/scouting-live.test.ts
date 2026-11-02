import { calibrateLiveClock, createLivePoint, liveStorageScope, parseLiveClockMessage, parseLivePoint, resolveLiveVideoTime } from '../scouting-live';
import { liveQrSvg } from '../scouting-live-qr';
const clock = { kind:'clock' as const, recordingId:'recording-1', segmentId:'segment-1', startEpochMs:100000, timeMs:10000, senderEpochMs:110000, recording:true };
const calibration = calibrateLiveClock(108980,109020,110000);
const reference = { clock, calibration, hostNowEpochMs:109100,lastFrameHostEpochMs:109080,captureHostEpochMs:109050 };

test('camera and notebook clock offsets preserve the timestamp of the displayed frame',()=>{
    expect(calibration).toEqual({offsetMs:1000,roundTripMs:40,updatedAtHostEpochMs:109020});
    expect(resolveLiveVideoTime(reference)).toEqual({timeMs:10050,uncertaintyMs:54,mode:'frame'});
    const estimated=resolveLiveVideoTime({...reference,captureHostEpochMs:undefined,playoutDelayMs:100});
    expect(estimated?.mode).toBe('estimated'); expect(estimated!.uncertaintyMs).toBeGreaterThanOrEqual(500);
});

test('stale camera, stale frames, reconnection and pre-recording images cannot silently become points',()=>{
    for(const changed of [{clock:null},{clock:{...clock,recording:false}},{lastFrameHostEpochMs:106000},{hostNowEpochMs:120000},{captureHostEpochMs:98000,lastFrameHostEpochMs:109080,clock:{...clock,timeMs:100,senderEpochMs:100100},hostNowEpochMs:99100}]) expect(resolveLiveVideoTime({...reference,...changed})).toBeNull();
    expect(()=>calibrateLiveClock(10,5,8)).toThrow(); expect(()=>calibrateLiveClock(0,10000,5000)).toThrow();
});

test('new live points are independent, immutable, scoped to recording/set and reject duplicate or reversed marks',()=>{
    const stamp=resolveLiveVideoTime(reference)!;
    const points=Object.freeze([]);
    const first=createLivePoint({id:'p1',clock,stamp,won:true,setNumber:1,points,hostNowEpochMs:109100});
    const second=createLivePoint({id:'p2',clock,stamp:{...stamp,timeMs:12000},won:false,setNumber:1,points:[first],hostNowEpochMs:111100});
    expect([second.scoreUs,second.scoreThem]).toEqual([1,1]);
    const nextSet=createLivePoint({id:'p3',clock,stamp:{...stamp,timeMs:13000},won:true,setNumber:2,points:[first,second],hostNowEpochMs:112100});
    expect([nextSet.scoreUs,nextSet.scoreThem]).toEqual([1,0]);
    expect(()=>createLivePoint({id:'p1',clock,stamp,won:true,setNumber:1,points:[first],hostNowEpochMs:109100})).toThrow();
    expect(()=>createLivePoint({id:'p4',clock,stamp:{...stamp,timeMs:1},won:true,setNumber:1,points:[first],hostNowEpochMs:109100})).toThrow();
    expect(points).toHaveLength(0); expect(parseLivePoint(first)).toEqual(first);
});

test('untrusted clock and point messages cannot invent foreign fields or non-finite references',()=>{
    expect(parseLiveClockMessage(clock)).toEqual(clock);
    expect(()=>parseLiveClockMessage({...clock,timeMs:NaN})).toThrow();
    expect(()=>parseLiveClockMessage({...clock,senderEpochMs:100})).toThrow();
    expect(()=>parseLivePoint({id:'x',recordingId:'y',timeMs:NaN})).toThrow();
    expect(liveStorageScope('user','org','class')).not.toBe(liveStorageScope('other','org','class'));
    expect(()=>liveStorageScope('','org','class')).toThrow();
});

test('pairing QR is generated locally and rejects insecure non-loopback camera links',()=>{
    const svg=liveQrSvg('https://192.168.0.10:8097/camera#room=test&token=secret');
    expect(svg).toContain('<svg'); expect(svg).not.toContain('secret');
    expect(()=>liveQrSvg('http://192.168.0.10/camera#room=test')).toThrow();
    expect(()=>liveQrSvg('javascript:alert(1)#x')).toThrow();
});
