// Evaluator-side calibration for GA-018. No API, credentials, network or dependencies.
// Usage: node --experimental-strip-types this-file.mjs module.mts base|reference
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const [file, expected] = process.argv.slice(2);
if (!file || !['base', 'reference'].includes(expected)) throw new Error('Expected module and base|reference');
const { getConfirmedPhone, hasConfirmedPhone } = await import(pathToFileURL(file));
const digits = '5511999990000'; // Fictitious test fixture; never sent anywhere.
const provider = { app_metadata: { providers: ['phone'] } };
const cases = [
  ['missing-plus', () => assert.equal(getConfirmedPhone({ ...provider, phone: digits }), `+${digits}`)],
  ['formatted-phone', () => assert.equal(getConfirmedPhone({ ...provider, phone: '+55 (11) 99999-0000' }), `+${digits}`)],
  ['comparison', () => assert.equal(hasConfirmedPhone({ ...provider, phone: digits }, `+${digits}`), true)],
  ['already-normalized', () => assert.equal(getConfirmedPhone({ ...provider, phone: `+${digits}` }), `+${digits}`)],
  ['timestamp', () => assert.equal(getConfirmedPhone({ phone: `+${digits}`, phone_confirmed_at: '2026-01-01T00:00:00Z' }), `+${digits}`)],
  ['unconfirmed', () => assert.equal(getConfirmedPhone({ phone: digits }), '')],
  ['editable-metadata', () => assert.equal(getConfirmedPhone({ phone: digits, user_metadata: { providers: ['phone'], phone_confirmed_at: 'fixture' } }), '')],
  ['empty', () => assert.equal(getConfirmedPhone({ ...provider, phone: '' }), '')],
  ['null', () => assert.equal(getConfirmedPhone(null), '')],
  ['undefined', () => assert.equal(getConfirmedPhone(undefined), '')],
];
const failed = [];
for (const [name, check] of cases) {
  try { check(); } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    failed.push(name);
  }
}
// Calibration succeeds only when the old implementation fails the expected regression
// and the historical correction passes every assertion. No model quality score here.
assert.deepEqual(failed, expected === 'base' ? ['missing-plus', 'formatted-phone', 'comparison'] : []);
console.log(JSON.stringify({ case: 'GA-018', variant: expected, assertions: cases.length,
  passed: cases.length - failed.length, failed, calibration: 'PASS', model_evaluated: false }));
