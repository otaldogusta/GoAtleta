const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { parseVideoDocument } = require('../../src/core/scouting-video.ts');
const { parseVideoAiResult } = require('../../src/core/scouting-video-ai.ts');
const { parseScoutingVideoLinks } = require('../../src/core/scouting-video-links.ts');
const { parseVisualAlignmentCache } = require('../../src/core/scouting-video-visual-alignment.ts');
const { parseVideoReviewPreferences } = require('../../src/core/scouting-video-review-preferences.ts');
const input = process.argv[2];
if (!input) throw new Error('Provide recovered-records.json');
const records = JSON.parse(fs.readFileSync(input, 'utf8'));
const media = records.map(record => JSON.parse(record.value)).flatMap(value => value.document?.media ? [value.document.media] : value.media ? [value.media] : []);
const summary = { records: records.length, trackingChunks: 0, positions: 0, checkpointEndSeconds: 0, youtubeMinutes: 0, suggestedRallies: 0, sourceSessions: 0, documents: 0, videoRallies: 0, linksWithVideo: 0, missingFootage: 0, reviewPreferences: 0, visualWindows: 0, visualRallies: 0, unreadableWindows: 0 };
for (const record of records) {
 const value = JSON.parse(record.value);
 if (record.key.includes(':tracking-v1:')) {
  const doc = parseVideoDocument(value);
  if (!doc.analysis) throw new Error('Missing checkpoint analysis');
  summary.trackingChunks++; summary.positions += doc.analysis.positions.length;
  summary.checkpointEndSeconds = Math.max(summary.checkpointEndSeconds, Number(record.key.split(':').at(-1)));
 } else if (record.key.endsWith(':youtube')) {
  for (const chunk of value) { parseVideoAiResult(chunk, chunk.videoId, chunk.start, chunk.end); summary.youtubeMinutes++; summary.suggestedRallies += chunk.rallies.length; }
 } else if (record.key.endsWith(':preferences:v1')) {
  parseVideoReviewPreferences(value); summary.reviewPreferences++;
 } else if (record.key.endsWith(':visual-alignment:v1')) {
  const matching = media.find(item => record.key.includes(encodeURIComponent(item.fingerprint)));
  if (!matching) throw new Error('Visual alignment without its video');
  const entries = parseVisualAlignmentCache(record.value,matching);
  summary.visualWindows += entries.length; summary.visualRallies += entries.reduce((n,entry) => n+(entry.result?.rallies.length ?? 0),0); summary.unreadableWindows += entries.filter(entry => !entry.result).length;
 } else if (value.sessionIds && value.links) {
  parseScoutingVideoLinks(value, 7200); summary.sourceSessions += value.sessionIds.length;
  summary.linksWithVideo += value.links.filter(link => !link.missing).length; summary.missingFootage += value.links.filter(link => link.missing).length;
 } else if (value.document || value.media) {
  const doc = parseVideoDocument(value.document ?? value); summary.documents++; summary.videoRallies = Math.max(summary.videoRallies, doc.rallies.length);
 } else throw new Error('Unknown recovered scouting record');
}
if (!summary.documents || !summary.trackingChunks || !summary.youtubeMinutes) throw new Error('Incomplete recovery');
console.log(JSON.stringify({ applicationParsersPassed: true, ...summary }, null, 2));
