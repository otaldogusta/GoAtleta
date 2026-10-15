import { Blob as NodeBlob } from 'node:buffer';
import { publishableVideoDocument, videoShareLink, videoStudioPermissions } from '../../../core/scouting-video-sharing';
import { videoArchive } from '../video/video-archive.web';
import { parseVideoDocument, type VideoDocument } from '../../../core/scouting-video';

const document: VideoDocument = {
    version: 1, media: { fingerprint: 'private-fingerprint', name: 'private-video.mp4', duration: 30, width: 1280, height: 720 },
    rallies: [{ id: 'private-rally', start: 0, winner: 'us', reviewed: true, pointTime: 14 }],
    contacts: [{ id: 'private-contact', studentId: 'private-student', time: 3.5, team: 'us', athlete: 'Nome do atleta', skill: 'Ataque', outcome: 'Erro' }],
    corrections: [{ time: 3, x: .5, y: .5 }],
};

test('published document preserves the same studio content without local paths, roster IDs or history', () => {
  const before = JSON.stringify(document), snapshot = publishableVideoDocument(document);
  expect(JSON.stringify(snapshot)).not.toMatch(/private-/);
  expect(snapshot.rallies[0]).toMatchObject({ start: 0, winner: 'us', pointTime: 14 });
  expect(snapshot.contacts[0]).toMatchObject({ time: 3.5, skill: 'Ataque', outcome: 'Erro', athlete: 'Nome do atleta', studentId: null });
  expect(snapshot.corrections).toEqual(document.corrections);
  expect(JSON.stringify(document)).toBe(before);
});

test('viewer permissions cannot be escalated by preview or an editable session', () => {
  for (const preview of [true, false]) for (const editable of [true, false]) {
    expect(Object.values(videoStudioPermissions(true, preview, editable))).toEqual([false, false, false, false, false]);
  }
  expect(videoStudioPermissions(false, true, true).manageSharing).toBe(false);
  expect(videoStudioPermissions(false, false, false).annotate).toBe(false);
  expect(videoStudioPermissions(false, false, true).annotate).toBe(true);
});

test('share proof stays out of the request path and invalid URL schemes are refused', () => {
  const id = '20000000-0000-0000-0000-000000000001', code = 'a'.repeat(64);
  const link = new URL(videoShareLink(id, code, 'https://goatleta.com'));
  expect(link.pathname).toBe('/scouting/shared'); expect(link.search).toBe('');
  expect(link.hash).toContain(code);
  expect(() => videoShareLink(id, code, 'ftp://localhost')).toThrow();
  expect(() => videoShareLink(id, 'weak', 'https://goatleta.com')).toThrow();
});

test('ZIP preserves binary media with bounded reads, UTF-8 filenames, standard CRC and cancellation', async () => {
    const previous = globalThis.Blob;
    Object.assign(globalThis, { Blob: NodeBlob });
    try {
        const bytes = new NodeBlob(['123456789']) as unknown as Blob;
        const archive = await videoArchive([{ name: 'análise.txt', blob: bytes }]);
        const result = new Uint8Array(await archive.arrayBuffer()), header = new DataView(result.buffer);
        expect(header.getUint32(14, true)).toBe(0xcbf43926);
        const length = header.getUint16(26, true);
        expect(new TextDecoder().decode(result.slice(30 + length, 30 + length + 9))).toBe('123456789');
        expect(header.getUint32(result.length - 22, true)).toBe(0x06054b50);
        const large = new NodeBlob([new Uint8Array(5 * 1024 * 1024)]) as unknown as Blob;
        const slice = jest.spyOn(large, 'slice'), wholeRead = jest.spyOn(large, 'arrayBuffer');
        const controller = new AbortController();
        await expect(videoArchive([{ name: 'video.mp4', blob: large }], { signal: controller.signal, onProgress: () => controller.abort() })).rejects.toThrow();
        expect(wholeRead).not.toHaveBeenCalled();
        expect(slice).toHaveBeenCalledTimes(1);
        expect(slice).toHaveBeenCalledWith(0, 2 * 1024 * 1024);
    } finally { Object.assign(globalThis, { Blob: previous }); }
});

test('local authoring generates a public reader URL', () => {
  const link = new URL(videoShareLink('12345678-1234-1234-1234-123456789abc', 'a'.repeat(64), 'http://localhost:8081'));
  expect(link.origin).toBe('https://goatleta.com');
  expect(link.pathname).toBe('/scouting/shared');
  expect(link.hash).toContain('code=');
});

test('shared tracking does not carry the local original binding and can be reopened', () => {
  const doc: VideoDocument = { ...document, media: { ...document.media, youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk' }, analysis: { model: 'vballnet-v2b-local', sampledFps: 30, positions: [{ time: 1, x: .5, y: .5 }], cuts: [], source: { fingerprint: 'original', name: 'original.mp4', duration: 30, width: 1280, height: 720, offsetSeconds: 0 } } };
  const shared = publishableVideoDocument(doc);
  expect(shared.analysis?.source).toBeUndefined();
  expect(parseVideoDocument(shared).analysis?.positions).toEqual(doc.analysis?.positions);
  expect(doc.analysis?.source).toBeDefined();
});
