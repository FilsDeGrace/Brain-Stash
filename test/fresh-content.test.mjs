import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRoundXp,
  chooseFreshRandom,
  chooseFreshStashCard,
  chooseRebusContent,
  nextFreshIndex,
  questionHistoryKey,
  rememberIds,
  selectFreshFirst,
} from '../src/engine/freshContent.js';

const items = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];

test('random discovery picks an unseen item before reviewing seen entries', () => {
  const result = chooseFreshRandom(items, ['a', 'b'], { random: () => 0, keyFor: (item) => item.id });
  assert.equal(result.item.id, 'c');
  assert.equal(result.status, 'fresh');
  assert.equal(result.freshRemaining, 1);
});

test('random discovery avoids current item when alternatives exist', () => {
  const result = chooseFreshRandom(items, [], { excludeIds: ['a'], random: () => 0, keyFor: (item) => item.id });
  assert.equal(result.item.id, 'b');
  assert.equal(result.status, 'fresh');
});

test('random discovery falls back to a clear review state after all content is seen', () => {
  const result = chooseFreshRandom(items, ['a', 'b', 'c'], { random: () => 0, keyFor: (item) => item.id });
  assert.equal(result.status, 'seen');
  assert.ok(items.some((item) => item.id === result.item.id));
  assert.equal(chooseFreshRandom([{ title: 'missing ID' }]).status, 'empty');
});


test('Rebus selection favours unseen unsolved puzzles and only reviews solved ones when exhausted', () => {
  const puzzles = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
  const fresh = chooseRebusContent(puzzles, ['r1'], ['r1', 'r2'], 'r1', () => 0);
  assert.equal(fresh.item.id, 'r3');
  assert.equal(fresh.status, 'new');
  const seenUnsolved = chooseRebusContent(puzzles, ['r1'], ['r1', 'r2', 'r3'], 'r1', () => 0);
  assert.equal(seenUnsolved.item.id, 'r2');
  assert.equal(seenUnsolved.status, 'seen');
  const review = chooseRebusContent(puzzles, ['r1', 'r2', 'r3'], ['r1', 'r2', 'r3'], 'r1', () => 0);
  assert.equal(review.item.id, 'r2');
  assert.equal(review.status, 'solved');
});

test('Deep Stash resumes unfinished work, then chooses unseen principles before reviews', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const sessions = { a: { locked: true, completed: false }, b: { completed: true } };
  const resume = chooseFreshStashCard(cards, sessions, ['a', 'b', 'c'], 'd', () => 0);
  assert.equal(resume.item.id, 'a');
  assert.equal(resume.status, 'in-progress');
  const fresh = chooseFreshStashCard(cards, { b: { completed: true } }, ['b', 'c'], 'b', () => 0);
  assert.equal(fresh.item.id, 'a');
  assert.equal(fresh.status, 'new');
  const review = chooseFreshStashCard(cards, { a: { completed: true }, b: { completed: true } }, ['a', 'b', 'c', 'd'], 'd', () => 0);
  assert.equal(review.item.id, 'c');
  assert.equal(review.status, 'review');
});

test('round selector puts unseen questions first, removes duplicate IDs, and marks history', () => {
  const selected = selectFreshFirst([items[0], items[1], items[2], { ...items[2], title: 'Duplicate C' }], 2, {
    seenIds: ['a', 'b'],
    answeredIds: ['a'],
    keyFor: (item) => item.id,
  });
  assert.deepEqual(selected.map((item) => item.id), ['c', 'a']);
  assert.deepEqual(selected.map((item) => item.freshContentStatus), ['new', 'answered']);
});


test('a round can end at the fresh-pool size instead of padding with repeats', () => {
  const selected = selectFreshFirst(items, 2, { seenIds: ['a'], keyFor: (item) => item.id });
  assert.deepEqual(selected.map((item) => item.id), ['b', 'c']);
  assert.ok(selected.every((item) => item.freshContentStatus === 'new'));
});

test('next-index selector wraps to the next unseen item and reviews when exhausted', () => {
  assert.equal(nextFreshIndex(items, 0, ['a', 'b'], { keyFor: (item) => item.id }), 2);
  assert.equal(nextFreshIndex(items, 2, ['a', 'b', 'c'], { keyFor: (item) => item.id }), 0);
  assert.equal(nextFreshIndex([], 0, []), -1);
});


test('shorter fresh-only rounds award proportionate XP instead of a full-round bonus', () => {
  assert.equal(calculateRoundXp(10, 6), 70);
  assert.equal(calculateRoundXp(5, 3), 20);
  assert.equal(calculateRoundXp(1, 1), 2);
  assert.equal(calculateRoundXp(0, 0), 0);
});

test('history lists deduplicate IDs, preserve newest items, and create stable question keys', () => {
  assert.deepEqual(rememberIds(['a', 'b'], ['b', 'c'], 2), ['b', 'c']);
  assert.equal(questionHistoryKey('maths', { prompt: ' 2 + 2 = ?', answer: '4' }), 'maths:2 + 2 = ?=4');
  assert.equal(questionHistoryKey('maths', { prompt: '2 + 3 = ?', answer: '5' }), 'maths:2 + 3 = ?=5');
  assert.equal(questionHistoryKey('traps', { prompt: '  Think  clearly ', context: 'Scenario', options: [] }), questionHistoryKey('traps', { prompt: 'think clearly', context: 'Scenario', options: [] }));
});

console.log('Fresh-content regression tests passed.');
