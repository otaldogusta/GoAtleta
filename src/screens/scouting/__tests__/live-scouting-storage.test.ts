import type { ScoutingContact } from '../../../core/models';
import type { LiveCaptureStamp } from '../../../core/scouting-live';
import { getScoutingResultOptions } from '../../../core/scouting';
import type { CaptureAppliedEvent, CaptureTimingDraft } from '../live/live-scouting-contract';
import { applyLiveScoutingEvent, liveScoutingTimelineKey, loadLiveScoutingTimeline, parseLiveScoutingTimeline, projectLiveScoutingEvent, timelineRecordings, type LiveScoutingTimeline } from '../live/live-scouting-storage';
import { createMemoryIdb } from './fixtures/memory-idb';

const scope = { userId: 'user', org: 'org', classId: 'class' }, analysisSessionId = 'analysis';
const database = 'goatleta-scouting-live-timelines-v1', store = 'timelines';
const reference = { hostSessionId: 'host-session', recordingId: 'recording' };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const contact: ScoutingContact = { fundamental: 'recepcao', resultKey: 'b_medio', phase: 'side_out', studentId: 'student', athleteName: 'Atleta' };
const stamp = (timeMs: number, patch: Partial<LiveCaptureStamp> = {}): LiveCaptureStamp => ({ scope, ...reference, segmentId: 'segment-1', epoch: 1, peerGeneration: 2, timeMs, uncertaintyMs: 500, mode: 'estimated', ...patch });
const empty = (): LiveScoutingTimeline => ({ version: 1, scope, analysisSessionId, revision: 0, clips: [], receipts: [] });
function event(requestId = 'request-0001', kind: 'point' | 'action' = 'point'): CaptureAppliedEvent {
    const before = { captureReady: true, captureVersion: 3, actions: [], rallies: [], session: { id: analysisSessionId, organizationId: scope.org, classId: scope.classId, type: kind === 'point' ? 'jogo' : 'treino', status: 'em_andamento', date: '2026-11-04', title: 'Análise', createdAt: '2026-11-04T12:00:00Z', updatedAt: '2026-11-04T12:00:00Z', revision: 1, matchState: { setNumber: 1, scoreUs: 0, scoreThem: 0, serve: 'them', rotation: null, recoveredDraft: [] } } } as CaptureAppliedEvent['before'];
    const rallyId = `sr_${requestId}`, actionId = `sa_${requestId}_0`;
    const saved = { ...clone(before), session: { ...before.session, revision: 2, updatedAt: '2026-11-04T15:00:00Z' }, actions: [{ ...contact, id: actionId, sessionId: analysisSessionId, organizationId: scope.org, classId: scope.classId, resultLabel: 'Boa', resultLevel: 1, createdAt: '2026-11-04T15:00:00Z', ...(kind === 'point' ? { rallyId, contactIndex: 0 } : {}) }], rallies: kind === 'point' ? [{ id: rallyId, sessionId: analysisSessionId, setNumber: 1, number: 1, won: true, serve: 'them', rotation: null, scoreUs: 1, scoreThem: 0, contacts: [contact], createdAt: '2026-11-04T15:00:00Z' }] : [] } as CaptureAppliedEvent['saved'];
    return { userId: scope.userId, org: scope.org, sessionId: analysisSessionId, before, saved, pending: { requestId, revision: 1, command: kind === 'point' ? { name: 'point', payload: { contacts: [contact], winner: 'us' } } : { name: 'action', payload: { contacts: [contact] } } }, timing: { reference, contacts: [{ id: `contact_${requestId}`, stamp: stamp(10000.125) }], pointStamp: kind === 'point' ? stamp(14000.5) : null } };
}
const originalIdb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
let memory: ReturnType<typeof createMemoryIdb>;
beforeEach(() => { memory = createMemoryIdb(); Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: memory.factory }); });
afterEach(() => { jest.useRealTimers(); if (originalIdb) Object.defineProperty(globalThis, 'indexedDB', originalIdb); else Reflect.deleteProperty(globalThis, 'indexedDB'); });
const flush = async () => { for (let n = 0; n < 40; n++) await Promise.resolve(); };

test('confirmed gestures create exact fractional media ranges with bounded padding and stable backend identities', () => {
    const input = event(), result = projectLiveScoutingEvent(empty(), input), clip = result.next.clips[0];
    expect(clip).toMatchObject({ id: 'capture_request-0001', rallyId: 'sr_request-0001', startMs: 8000.125, endMs: 15500.5, won: true, active: true, uncertaintyMs: 500 });
    expect(clip.contacts[0]).toMatchObject({ id: 'contact_request-0001', actionId: 'sa_request-0001_0', contact, stamp: stamp(10000.125) });
    expect(input.timing.contacts[0].stamp?.timeMs).toBe(10000.125);
    expect(projectLiveScoutingEvent(result.next, clone(input)).next).toEqual(result.next);
    const changed = clone(input); changed.timing.pointStamp!.timeMs += 1;
    expect(() => projectLiveScoutingEvent(result.next, changed)).toThrow(/outros tempos/);
});

test('a training action gets a recut around its contact gesture without fabricating a point timestamp', () => {
    const result = projectLiveScoutingEvent(empty(), event('training-request', 'action')).next.clips[0];
    expect(result).toMatchObject({ kind: 'action', startMs: 8000.125, endMs: 11500.125, pointStamp: null });
});

test.each(['cobertura', 'transicao', 'comunicacao'] as const)('%s remains the original registered fundamental in the local sidecar', fundamental => {
    const input = event(), observed = { ...contact, fundamental, resultKey: getScoutingResultOptions(fundamental)[1].key };
    if (input.pending.command.name !== 'point') throw new Error('Expected point fixture');
    input.pending.command.payload.contacts = [observed]; input.saved.rallies[0].contacts = [observed]; Object.assign(input.saved.actions[0], observed);
    expect(projectLiveScoutingEvent(empty(), input).next.clips[0].contacts[0].contact).toEqual(observed);
});

test.each(['recordingId', 'hostSessionId', 'segmentId', 'epoch', 'peerGeneration'] as const)('mixed %s preserves intent but never invents a continuous rally range', key => {
    const input = event(); input.timing.pointStamp = { ...input.timing.pointStamp!, [key]: typeof input.timing.pointStamp![key] === 'number' ? 99 : 'another-source' };
    const result = projectLiveScoutingEvent(empty(), input).next;
    expect(result.clips[0].startMs).toBeNull(); expect(result.clips[0].endMs).toBeNull();
    expect(JSON.parse(result.receipts[0].intent).timing.pointStamp[key]).toEqual(input.timing.pointStamp[key]);
    if (key === 'recordingId' || key === 'hostSessionId') expect(result.clips[0].pointStamp).toBeNull();
});

test('unsynchronized marks retain a recording association with no cut and references cannot smuggle foreign timestamps', () => {
    const input = event(); input.timing.contacts[0].stamp = null; input.timing.pointStamp = null;
    const result = projectLiveScoutingEvent(empty(), input).next;
    expect(result.clips[0]).toMatchObject({ ...reference, startMs: null, endMs: null });
    const bad = event(); bad.timing.contacts[0].stamp!.scope = { ...scope, org: 'foreign' };
    expect(() => projectLiveScoutingEvent(empty(), bad)).toThrow();
});

test('only authoritative matching rally and action IDs can create a projected clip', () => {
    const missingPoint = event(); missingPoint.saved.rallies = [];
    expect(() => projectLiveScoutingEvent(empty(), missingPoint)).toThrow();
    const missingAction = event('training-request', 'action'); missingAction.saved.actions = [];
    expect(() => projectLiveScoutingEvent(empty(), missingAction)).toThrow();
    const differentContact = event(); differentContact.saved.rallies[0].contacts = [{ ...contact, resultKey: 'a_alto' }];
    expect(() => projectLiveScoutingEvent(empty(), differentContact)).toThrow();
});

test('reopen deactivates only its official rally, archives exact timing and redo keeps original contact IDs', () => {
    const first = event(), second = event('request-0002');
    const confirmed = projectLiveScoutingEvent(projectLiveScoutingEvent(empty(), first).next, second).next;
    const reopened = event('reopen-0001'); reopened.before = clone(first.saved); reopened.saved = clone(first.before);
    reopened.pending.command = { name: 'reopen_point', payload: { rallyId: 'sr_request-0001' } }; reopened.timing = { contacts: [], pointStamp: null };
    const result = projectLiveScoutingEvent(confirmed, reopened);
    expect(result.next.clips.map(clip => clip.active)).toEqual([false, true]);
    expect(result.recoveredTiming).toEqual(first.timing);
    expect(projectLiveScoutingEvent(result.next, reopened).recoveredTiming).toEqual(first.timing);
    const redo = event('redo-0001'); redo.timing = result.recoveredTiming!;
    const redone = projectLiveScoutingEvent(result.next, redo).next;
    expect(redone.clips[2].contacts[0].id).toBe(first.timing.contacts[0].id);
    expect(redone.clips[2].contacts[0].stamp).toEqual(first.timing.contacts[0].stamp);
    expect(redone.clips[0].active).toBe(false); expect(timelineRecordings(redone)[0].clips).toHaveLength(2);
});

test('undoing an action cannot remove a contact from a rally and removes only the confirmed standalone action', () => {
    const point = event(), action = event('training-request', 'action');
    const confirmed = projectLiveScoutingEvent(projectLiveScoutingEvent(empty(), point).next, action).next;
    const undo = event('undo-request'); undo.before = clone(action.saved); undo.saved = clone(action.before);
    undo.pending.command = { name: 'undo_action', payload: { actionId: 'sa_training-request_0' } }; undo.timing = { contacts: [], pointStamp: null };
    const result = projectLiveScoutingEvent(confirmed, undo).next;
    expect(result.clips.map(clip => clip.active)).toEqual([true, false]);
    const wrong = clone(undo); wrong.pending.requestId = 'wrong-undo'; wrong.before = clone(point.saved); wrong.pending.command = { name: 'undo_action', payload: { actionId: 'sa_request-0001_0' } };
    expect(() => projectLiveScoutingEvent(confirmed, wrong)).toThrow();
});

test('the parser validates recovered receipts deeply and returns detached whitelisted values', () => {
    const input = event(), projected = projectLiveScoutingEvent(empty(), input).next;
    const reopened = event('reopen-parser'); reopened.before = clone(input.saved); reopened.saved = clone(input.before);
    reopened.pending.command = { name: 'reopen_point', payload: { rallyId: 'sr_request-0001' } }; reopened.timing = { contacts: [], pointStamp: null };
    const valid = projectLiveScoutingEvent(projected, reopened).next, malformed = clone(valid);
    const timing: CaptureTimingDraft = clone(input.timing);
    malformed.receipts[1].recoveredTiming = { ...timing, contacts: [{ id: 'bad-contact', stamp: { ...stamp(12), scope: { ...scope, userId: 'foreign' } } }] };
    expect(() => parseLiveScoutingTimeline(malformed, scope, analysisSessionId)).toThrow();
    const clean = parseLiveScoutingTimeline(valid, scope, analysisSessionId); clean.receipts[1].recoveredTiming!.contacts[0].stamp!.timeMs = 999;
    expect(valid.receipts[1].recoveredTiming!.contacts[0].stamp!.timeMs).toBe(10000.125);
    const invalidRange = clone(projected); invalidRange.clips[0].contacts[0].stamp = null;
    expect(() => parseLiveScoutingTimeline(invalidRange, scope, analysisSessionId)).toThrow();
    Object.assign(valid.clips[0], { unexpected: { privateUrl: 'discard-this' } }); Object.assign(valid.clips[0].contacts[0].contact, { privateMetadata: { anything: true } });
    const safe = parseLiveScoutingTimeline(valid, scope, analysisSessionId);
    expect(safe.clips[0]).not.toHaveProperty('unexpected'); expect(safe.clips[0].contacts[0].contact).not.toHaveProperty('privateMetadata');
});

test.each([-1, NaN, Infinity, 7200000.01])('invalid gesture time %p is rejected without changing its input', timeMs => {
    const input = event(); input.timing.contacts[0].stamp!.timeMs = timeMs;
    expect(() => projectLiveScoutingEvent(empty(), input)).toThrow(); expect(input.timing.contacts[0].stamp!.timeMs).toBe(timeMs);
});

test('the time range clamps the first padding at zero and an inverted contact sequence stays unsynchronized', () => {
    const early = event(); early.timing.contacts[0].stamp = stamp(.125); early.timing.pointStamp = stamp(1000.5);
    expect(projectLiveScoutingEvent(empty(), early).next.clips[0]).toMatchObject({ startMs: 0, endMs: 2500.5 });
    const inverted = event(); inverted.timing.pointStamp = stamp(8000);
    expect(projectLiveScoutingEvent(empty(), inverted).next.clips[0]).toMatchObject({ startMs: null, endMs: null });
});

test('unknown reference identities and malformed receipts cannot enter local timeline storage', () => {
    const input = event(); input.timing.contacts[0].stamp = null; input.timing.pointStamp = null; input.timing.reference = { ...reference, recordingId: '../foreign' };
    expect(() => projectLiveScoutingEvent(empty(), input)).toThrow();
    for (const mutate of [
        (value: LiveScoutingTimeline) => { value.receipts[0].intent = '{}'; },
        (value: LiveScoutingTimeline) => { value.receipts[0].id = 'another-request'; },
        (value: LiveScoutingTimeline) => { value.clips[0].contacts[0].contact.phase = 'unknown' as ScoutingContact['phase']; },
        (value: LiveScoutingTimeline) => { Object.assign(value.clips[0].contacts[0].contact, { fundamental: 'unknown', resultKey: 'boa' }); },
        (value: LiveScoutingTimeline) => { value.clips[0].endMs = 7201500.01; },
    ]) { const value = projectLiveScoutingEvent(empty(), event()).next; mutate(value); expect(() => parseLiveScoutingTimeline(value, scope, analysisSessionId)).toThrow(); }
});

test.each([{ userId: 'other' }, { org: 'other' }, { classId: 'other' }])('local persistence and parsing preserve exact scope %p', async change => {
    await applyLiveScoutingEvent(scope, event()); const foreign = { ...scope, ...change };
    expect((await loadLiveScoutingTimeline(foreign, analysisSessionId)).clips).toEqual([]);
    expect(() => parseLiveScoutingTimeline(projectLiveScoutingEvent(empty(), event()).next, foreign, analysisSessionId)).toThrow();
    expect(() => parseLiveScoutingTimeline(projectLiveScoutingEvent(empty(), event()).next, scope, 'another-analysis')).toThrow();
});

test('concurrent applies, duplicate retries and a new connection preserve one atomic history across reload', async () => {
    const first = event(), second = event('request-0002');
    await Promise.all([applyLiveScoutingEvent(scope, first), applyLiveScoutingEvent(scope, second), applyLiveScoutingEvent(scope, first)]);
    const read = await loadLiveScoutingTimeline(scope, analysisSessionId);
    expect(read.clips).toHaveLength(2); expect(read.receipts).toHaveLength(2); expect(read.revision).toBe(2);
    let reload!: typeof loadLiveScoutingTimeline;
    jest.isolateModules(() => { reload = jest.requireActual<typeof import('../live/live-scouting-storage')>('../live/live-scouting-storage').loadLiveScoutingTimeline; });
    expect(await reload(scope, analysisSessionId)).toEqual(read);
});

test('quota failure preserves the exact committed row and retry adds the new clip only once', async () => {
    await applyLiveScoutingEvent(scope, event()); const before = clone(memory.databases.get(database)!.get(store)!.get(liveScoutingTimelineKey(scope, analysisSessionId)));
    memory.state.failWrite = () => Object.assign(new Error('Quota full'), { name: 'QuotaExceededError' });
    await expect(applyLiveScoutingEvent(scope, event('request-0002'))).rejects.toThrow();
    expect(memory.databases.get(database)!.get(store)!.get(liveScoutingTimelineKey(scope, analysisSessionId))).toEqual(before);
    memory.state.failWrite = null; await applyLiveScoutingEvent(scope, event('request-0002')); await applyLiveScoutingEvent(scope, event('request-0002'));
    expect((await loadLiveScoutingTimeline(scope, analysisSessionId)).clips).toHaveLength(2);
});

test('a transaction timeout aborts its uncommitted receipt and leaves the previous clip usable', async () => {
    await applyLiveScoutingEvent(scope, event()); jest.useFakeTimers(); memory.state.pauseWrites = true;
    const task = applyLiveScoutingEvent(scope, event('request-0002')), failure = expect(task).rejects.toThrow(/Tempo esgotado/);
    await flush(); jest.advanceTimersByTime(10001); await failure; memory.resumeWrites(); await flush();
    expect((await loadLiveScoutingTimeline(scope, analysisSessionId)).receipts.map(receipt => receipt.id)).toEqual(['request-0001']);
});
