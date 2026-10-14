import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
let handler, calls = [], denied = true, badUser = false, youtubeId;
const document = { version: 1, media: { fingerprint: 'shared', name: 'Vídeo', duration: 20, width: 1280, height: 720 }, rallies: [{ id: 'r1', start: 0, winner: null, reviewed: false }], contacts: [], corrections: [] };
const fakeClient = {
  auth: { getUser: async () => ({ data: { user: badUser ? null : { id: 'verified-viewer', email_confirmed_at: '2026-10-13' } }, error: badUser ? {} : null }) },
  rpc: async (name, parameters) => { calls.push({ name, parameters }); return { data: denied ? { error: 'ACCESS_DENIED' } : { document, teamName: 'Equipe', title: 'Jogo', opponent: 'Adversário', mediaProvider: youtubeId ? 'youtube' : 'storage', youtubeId, objectPath: 'authorized/private/path', updatedAt: '2026-10-13', expiresAt: '2026-10-20' } }; },
  storage: { from: bucket => ({ createSignedUrl: async (path, duration) => { calls.push({ bucket, path, duration }); return { data: { signedUrl: 'https://test.invalid/private/signed' } }; } }) },
};
const coreSource = await readFile('src/core/scouting-video.ts', 'utf8');
const core = { exports: {} }; vm.runInNewContext(ts.transpileModule(coreSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, core);
const source = (await readFile('supabase/functions/scouting-video-share/index.ts', 'utf8')).replace(/^import .*;\r?\n/gm, '');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
  Deno: { serve: fn => { handler = fn; }, env: { get: () => 'synthetic' } }, createClient: () => fakeClient,
  parseVideoDocument: core.exports.parseVideoDocument, buildCorsHeaders: () => ({}), corsPreflight: () => new Response('ok'), Request, Response, TextDecoder, Uint8Array, URL,
});
const payload = { id: '20000000-0000-0000-0000-000000000001', code: 'a'.repeat(64) };
const request = (body = payload, authorization) => new Request('https://test.invalid/share', { method: 'POST', headers: authorization ? { Authorization: authorization } : {}, body: JSON.stringify(body) });
assert.equal((await handler(new Request('https://test.invalid/share'))).status, 405);
assert.equal((await handler(request({ code: 'short' }))).status, 400); assert.equal(calls.length, 0);
assert.equal((await handler(request({ oversized: 'x'.repeat(2000) }))).status, 413);
assert.equal((await handler(request())).status, 404); assert.equal(calls.length, 1);
assert.equal(calls[0].parameters.p_user, null);
badUser = true; calls = []; assert.equal((await handler(request(payload, 'Bearer invalid'))).status, 401); assert.equal(calls.length, 0);
badUser = false; denied = false;
const response = await handler(request(payload, 'Bearer valid')), value = await response.json();
assert.equal(response.status, 200); assert.equal(value.permission, 'viewer'); assert.equal(value.objectPath, undefined);
assert.equal(value.document.media.duration, 20); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
assert.equal(calls[0].parameters.p_user, 'verified-viewer');
assert.equal(calls[1].bucket, 'scouting-videos'); assert.equal(calls[1].path, 'authorized/private/path'); assert.equal(calls[1].duration, 300);
console.log('scouting-video-share-edge: passed (method/body limits, verified identity, denied access without signing, private media TTL, projection)');

youtubeId = 'M7lc1UVf-VE'; document.media.youtubeId = youtubeId; calls = [];
const ytResponse = await handler(request()); const yt = await ytResponse.json();
assert.equal(ytResponse.status, 200); assert.equal(yt.mediaProvider, 'youtube');
assert.equal(yt.youtubeId, youtubeId); assert.equal(calls.length, 1, 'YouTube never signs or uploads storage');
document.media.youtubeId = 'abcdefghijk';
assert.equal((await handler(request())).status, 503);
console.log('YouTube edge projection: passed (provider ID, no Storage, mismatch rejection)');
