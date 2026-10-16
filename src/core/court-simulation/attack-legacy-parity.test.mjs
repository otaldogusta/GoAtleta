import assert from 'node:assert/strict';
import test from 'node:test';
import { attackPresets, sampleAttack } from './attack-motion.js';
import { sampleAttack as sampleReference } from '../__tests__/fixtures/court-reference/attack-motion.mjs';

const legacyFrame = frame => {
 const { attackArc, attackGuide, ...result } = frame;
 if (result.flight) {
  const { attackArc, attackGuide, ...flight } = result.flight;
  result.flight = flight;
 }
 return result;
};

for (const preset of attackPresets) for (const blockers of [1, 2, 3]) {
 test(`legacy default motion and contacts survive curve editing: ${preset.name}/${blockers}`, () => {
  for (const pass of [false, true]) {
   const options = { preset: preset.name, blockers, layers: { attack: true, block: true, pass } };
   const timing = sampleReference(0, options);
   for (const progress of [0, timing.setContact, timing.attackContact, .85, 1]) {
    const reference = sampleReference(progress, options);
    assert.deepEqual(legacyFrame(sampleAttack(progress, options)), reference);
    assert.deepEqual(legacyFrame(sampleAttack(progress, { ...options, attackArc: null })), reference);
   }
  }
 });
}
