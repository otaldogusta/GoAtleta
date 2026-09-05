const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// query-string 7 (used by React Navigation) requires the decoder synchronously.
// Keep the patched 0.5 linear decoder callable from CommonJS, including on Node 20.
const decoderPath = require.resolve('decode-uri-component');
const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(decoderPath), 'package.json'), 'utf8'));
assert.equal(metadata.version, '0.5.0');
assert.equal(metadata.type, 'commonjs');
const decode = require(decoderPath);
assert.equal(typeof decode, 'function');
assert.equal(decode('Jo%C3%A3o'), 'João');
assert.equal(require('query-string').parse('name=Jo%C3%A3o+Silva').name, 'João Silva');
console.log('[uri-decoder] Patched linear decoder is compatible with React Navigation.');
