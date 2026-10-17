import { newVideoDocument, splitVideoRally } from '../scouting-video';
import { reconcileVideoDocuments, videoDocumentSignature } from '../scouting-video-sync';

const media = { fingerprint: 'same-file', name: 'partida.mp4', duration: 60, width: 1280, height: 720 };
const initial = newVideoDocument(media, 'first');
const changed = splitVideoRally(initial, 20, 'second');
const other = splitVideoRally(initial, 30, 'third');
const signature = videoDocumentSignature(initial);
const baseline = { revision: 2, signature };

test('new device restores cloud annotations and an empty session remains empty', () => {
    expect(reconcileVideoDocuments({ local: null, remote: { document: changed, revision: 3 } })).toEqual({ source: 'remote', needsUpload: false, baseline: { revision: 3, signature: videoDocumentSignature(changed) } });
    expect(reconcileVideoDocuments({ local: null, remote: null })).toEqual({ source: 'empty', needsUpload: false, baseline: null });
});

test('legacy local work may upload only after a successful empty cloud read', () => {
    expect(reconcileVideoDocuments({ local: changed, remote: null })).toEqual({ source: 'local', needsUpload: true, baseline: null });
    expect(reconcileVideoDocuments({ local: changed, remote: null, baseline })).toEqual({ source: 'conflict', needsUpload: false, baseline });
});

test('identical local/cloud retains local history while advancing its baseline', () => {
    expect(reconcileVideoDocuments({ local: initial, remote: { document: initial, revision: 4 }, baseline })).toEqual({ source: 'local', needsUpload: false, baseline: { revision: 4, signature } });
});

test('clean local follows a newer remote document and dirty local follows an unchanged remote', () => {
    expect(reconcileVideoDocuments({ local: initial, remote: { document: changed, revision: 3 }, baseline }).source).toBe('remote');
    expect(reconcileVideoDocuments({ local: changed, remote: { document: initial, revision: 2 }, baseline })).toEqual({ source: 'local', needsUpload: true, baseline });
});

test('divergent local and remote changes are preserved for an explicit choice', () => {
    expect(reconcileVideoDocuments({ local: changed, remote: { document: other, revision: 3 }, baseline })).toEqual({ source: 'conflict', needsUpload: false, baseline });
    expect(reconcileVideoDocuments({ local: changed, remote: { document: initial, revision: 2 } })).toEqual({ source: 'conflict', needsUpload: false, baseline: null });
    expect(changed.rallies[1].start).toBe(20);
    expect(other.rallies[1].start).toBe(30);
});

test('media mismatch, regressed revisions and unknown dirty baseline never overwrite local work', () => {
    const remote = { document: { ...initial, media: { ...media, fingerprint: 'different-file' } }, revision: 3 };
    expect(reconcileVideoDocuments({ local: initial, remote, baseline }).source).toBe('conflict');
    expect(reconcileVideoDocuments({ local: initial, remote: { document: changed, revision: 1 }, baseline }).source).toBe('conflict');
    expect(reconcileVideoDocuments({ local: changed, remote: { document: other, revision: 3 }, baseline: { revision: 2, signature: '' } }).source).toBe('conflict');
});

test('signature is canonical and strips imported URLs without altering author data', () => {
    const imported = { ...changed, permission: 'editor', media: { ...media, url: 'https://untrusted.invalid' } };
    expect(videoDocumentSignature(imported)).toBe(videoDocumentSignature(changed));
    expect(videoDocumentSignature(other)).not.toBe(videoDocumentSignature(changed));
});
