import { calibrateLiveClock, createLivePoint, liveStorageScope, parseLiveCaptureStamp, parseLiveClockMessage, parseLivePoint, resolveLiveCaptureTime, resolveLiveVideoTime } from '../scouting-live';
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

test('court-side timing is fresh, fractional and independent of preview frames or playout delay',()=>{
    expect(resolveLiveCaptureTime({...reference,hostNowEpochMs:109100.125})).toEqual({timeMs:10100.125,uncertaintyMs:500,mode:'estimated'});
    expect(resolveLiveCaptureTime({...reference,hostNowEpochMs:109150.875})?.timeMs).toBe(10150.875);
    expect(resolveLiveVideoTime({...reference,lastFrameHostEpochMs:100000})).toBeNull();
    expect(resolveLiveCaptureTime({...reference,lastFrameHostEpochMs:100000} as typeof reference)?.timeMs).toBe(10100);
});

test('capture timing follows pause-aware camera elapsed time, not elapsed wall time',()=>{
    const resumed=parseLiveClockMessage({...clock,timeMs:10000.375,senderEpochMs:120000,pausedMs:10000,activeSinceEpochMs:119000});
    const context={clock:resumed,calibration:{...calibration,updatedAtHostEpochMs:119020},hostNowEpochMs:119100.125};
    expect(resolveLiveCaptureTime(context)?.timeMs).toBe(10100.5);
    expect(resolveLiveCaptureTime({...context,clock:{...resumed,recording:false}})).toBeNull();
    expect(resolveLiveCaptureTime({...context,hostNowEpochMs:117999})).toBeNull();
});

test('capture timing rejects stale, future, invalid and out-of-range clocks or calibrations',()=>{
    const context={clock,calibration,hostNowEpochMs:109100};
    for(const changed of [{clock:null},{calibration:null},{clock:{...clock,recording:false}},{hostNowEpochMs:112001},{hostNowEpochMs:107999},
        {calibration:{...calibration,updatedAtHostEpochMs:90000}},{calibration:{...calibration,updatedAtHostEpochMs:111000}},
        {calibration:{...calibration,offsetMs:NaN}},{calibration:{...calibration,roundTripMs:3001}},{clock:{...clock,timeMs:Infinity}},
        {clock:{...clock,timeMs:7200000,senderEpochMs:7300000},hostNowEpochMs:7299001,calibration:{...calibration,updatedAtHostEpochMs:7299000}}])
        expect(resolveLiveCaptureTime({...context,...changed})).toBeNull();
    expect(resolveLiveCaptureTime({...context,calibration:{...calibration,roundTripMs:900}})?.uncertaintyMs).toBe(1150);
});

test('capture stamp parsing keeps fractional timing and complete local identity without foreign fields',()=>{
    const scope={userId:'user',org:'org',classId:'class'};
    const stamp={scope,hostSessionId:'host-1',recordingId:'recording-1',segmentId:'segment-2',epoch:1,peerGeneration:2,timeMs:12345.625,uncertaintyMs:500,mode:'estimated' as const};
    const parsed=parseLiveCaptureStamp({...stamp,secret:'discard'});expect(parsed).toEqual(stamp);expect(parsed.scope).not.toBe(scope);
    for(const changed of [{scope:null},{scope:{...scope,org:''}},{hostSessionId:''},{recordingId:'other/id'},{segmentId:''},{epoch:-1},{epoch:0.5},
        {peerGeneration:NaN},{timeMs:Infinity},{timeMs:7200001},{uncertaintyMs:60001},{mode:'frame'}])expect(()=>parseLiveCaptureStamp({...stamp,...changed})).toThrow();
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

test('pauses freeze video time and resumed frames exclude wall time spent paused',()=>{
    const resumed=parseLiveClockMessage({...clock,senderEpochMs:120000,pausedMs:10000,activeSinceEpochMs:119000});
    const current={...reference,clock:resumed,calibration:{...calibration,updatedAtHostEpochMs:119020},hostNowEpochMs:119100,lastFrameHostEpochMs:119080,captureHostEpochMs:119050};
    expect(resolveLiveVideoTime(current)?.timeMs).toBe(10050);
    expect(resolveLiveVideoTime({...current,clock:{...resumed,recording:false}})).toBeNull();
    expect(resolveLiveVideoTime({...current,captureHostEpochMs:117900})).toBeNull();
    expect(()=>parseLiveClockMessage({...resumed,pausedMs:-1})).toThrow();
    expect(()=>parseLiveClockMessage({...resumed,pausedMs:0})).toThrow();
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
