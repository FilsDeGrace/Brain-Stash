import assert from 'node:assert/strict';
import { claimPuzzleReward } from '../src/engine/rebusRewards.js';

const empty = new Set();
const first = claimPuzzleReward(empty, 'rebus-01');
assert.equal(first.claimed, true, 'a puzzle awards the first time it is solved');
assert.equal(first.solvedIds.has('rebus-01'), true);
assert.equal(empty.has('rebus-01'), false, 'the helper leaves the original Set untouched');

const repeat = claimPuzzleReward(first.solvedIds, 'rebus-01');
assert.equal(repeat.claimed, false, 're-entering and solving the same puzzle cannot mint XP again');
assert.equal(repeat.solvedIds.size, 1);

const next = claimPuzzleReward(repeat.solvedIds, 'rebus-02');
assert.equal(next.claimed, true, 'another authored puzzle can award its first-solve reward');
assert.equal(next.solvedIds.size, 2);

const invalid = claimPuzzleReward(next.solvedIds, '   ');
assert.equal(invalid.claimed, false, 'empty puzzle IDs never award XP');

console.log('Rebus one-time reward checks passed (8 assertions).');
