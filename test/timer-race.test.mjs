import assert from 'node:assert/strict';
import { visibleCountdownSnapshot } from '../src/engine/timerState.js';

const staleZero = { key: 'maths-0-round-a', totalMs: 10000, timeLeftMs: 0, paused: false };
const nextQuestion = visibleCountdownSnapshot(staleZero, 'maths-1-round-a', 15000);
assert.equal(nextQuestion.timeLeftMs, 15000, 'new question must synchronously expose its full timer, not stale zero');
assert.equal(nextQuestion.matches, false, 'the old snapshot must be treated as stale');

const currentZero = visibleCountdownSnapshot({ key: 'maths-1-round-a', totalMs: 15000, timeLeftMs: 0, paused: false }, 'maths-1-round-a', 15000);
assert.equal(currentZero.timeLeftMs, 0, 'zero must remain valid for the active question');
assert.equal(currentZero.matches, true, 'the active question snapshot should be accepted');

const changedDuration = visibleCountdownSnapshot({ key: 'maths-1-round-a', totalMs: 15000, timeLeftMs: 0, paused: false }, 'maths-1-round-a', 12000);
assert.equal(changedDuration.timeLeftMs, 12000, 'a settings/tier duration change must also reset synchronously');

console.log('Timer race regression checks passed (3 assertions).');
