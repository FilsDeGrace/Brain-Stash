import assert from 'node:assert/strict';
import { getEligibleStashCards, getUnlockedStashTier, stashTier } from '../src/engine/stashProgression.js';

const cards = [
  { id: 'a', tier: 1 },
  { id: 'b', difficulty: 1 },
  { id: 'c', tier: 2 },
];
assert.equal(stashTier(cards[0]), 1);
assert.equal(stashTier(cards[2]), 2);
assert.equal(getUnlockedStashTier(cards, {}), 1, 'Tier 2 remains sealed before completion');
assert.equal(getUnlockedStashTier(cards, { a: { completed: true } }), 1, 'One unfinished Tier 1 card keeps Tier 2 sealed');
assert.equal(getUnlockedStashTier(cards, { a: { completed: true }, b: { completed: true } }), 2, 'Completing every Tier 1 card opens Tier 2');
assert.deepEqual(getEligibleStashCards(cards, 1).map((card) => card.id), ['a', 'b']);
assert.deepEqual(getEligibleStashCards(cards, 2).map((card) => card.id), ['a', 'b', 'c']);
console.log('Deep Stash progression checks passed (6 assertions).');
