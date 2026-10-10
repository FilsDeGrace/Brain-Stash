import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng, generateRound, listSkills, timeMsFor } from '../src/engine/mathEngine.js';
import { entryModeFor } from '../src/engine/rebusMatch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'src', 'content');
const read = (name) => JSON.parse(fs.readFileSync(path.join(contentDir, `${name}.json`), 'utf8'));
const failures = [];
const banks = {
  lessons: read('mathLessons'),
  rebus: read('rebus'),
  stash: read('stash'),
  traps: read('traps'),
  fallacies: read('fallacies'),
};

function uniqueIds(items, label) {
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) failures.push(`${label}: duplicate IDs`);
  if (items.some((item) => item.id === undefined || item.id === null || String(item.id).trim() === '')) failures.push(`${label}: missing ID`);
}

function validQuestion(question, label) {
  if (!Array.isArray(question.options) || question.options.length !== 4) failures.push(`${label}.${question.id}: expected four answer options`);
  else {
    const ids = question.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) failures.push(`${label}.${question.id}: duplicate option IDs`);
    if (!ids.includes(question.correctId)) failures.push(`${label}.${question.id}: correct option ID is missing`);
    if (question.options.some((option) => !option.label?.trim())) failures.push(`${label}.${question.id}: blank option label`);
  }
  if (!question.explanation?.trim()) failures.push(`${label}.${question.id}: missing explanation`);
}

for (const [name, items] of Object.entries(banks)) uniqueIds(items, name);
const skillIds = new Set(listSkills().map((skill) => skill.id));
for (const lesson of banks.lessons) {
  if (!Array.isArray(lesson.steps) || lesson.steps.length < 1) failures.push(`lessons.${lesson.id}: no steps`);
  if (!lesson.title || !lesson.blurb) failures.push(`lessons.${lesson.id}: title or blurb missing`);
  if (!skillIds.has(lesson.skillId)) failures.push(`lessons.${lesson.id}: no matching math-engine skill (${lesson.skillId})`);
}
for (const question of banks.traps) {
  validQuestion(question, 'traps');
  if (!question.context?.trim() || !question.prompt?.trim()) failures.push(`traps.${question.id}: scenario/context or question missing`);
}
for (const question of banks.fallacies) {
  validQuestion(question, 'fallacies');
  if (!question.context?.trim() || !question.prompt?.trim()) failures.push(`fallacies.${question.id}: scenario/context or question missing`);
}
for (const card of banks.stash) {
  if (!card.title || !card.category || !card.summary || !card.example || !card.whyItMatters) failures.push(`stash.${card.id}: required content missing`);
  if (![1, 2].includes(Number(card.tier ?? card.difficulty ?? 1))) failures.push(`stash.${card.id}: unsupported tier`);
  validQuestion({ ...card.quiz, id: card.id }, 'stash');
}
for (const puzzle of banks.rebus) {
  const entryMode = entryModeFor(puzzle);
  const answerLetters = puzzle.answer.replace(/[^a-z0-9]/gi, '').length;
  if (puzzle.wordLengths.reduce((sum, length) => sum + length, 0) !== answerLetters) failures.push(`rebus.${puzzle.id}: word-length pattern does not match answer (${puzzle.wordLengths.join(', ')} vs ${answerLetters})`);
  if (Number(puzzle.letterCount) !== answerLetters) failures.push(`rebus.${puzzle.id}: letterCount ${puzzle.letterCount} does not match answer length ${answerLetters}`);
  const expectedEntry = answerLetters <= 12 ? 'tiles' : 'typing';
  if (entryMode !== expectedEntry) failures.push(`rebus.${puzzle.id}: should use ${expectedEntry} entry at ${answerLetters} letters`);
  const imagePath = path.join(root, 'public', String(puzzle.imageSrc).replace(/^\//, ''));
  if (!fs.existsSync(imagePath)) failures.push(`rebus.${puzzle.id}: image not found (${puzzle.imageSrc})`);
  if (entryMode === 'tiles') {
    const poolText = String(puzzle.tiles || puzzle.answer.replace(/[^a-z0-9]/gi, '')).toUpperCase();
    const available = [...poolText].reduce((map, char) => ({ ...map, [char]: (map[char] || 0) + 1 }), {});
    const required = [...puzzle.answer.toUpperCase().replace(/[^A-Z0-9]/g, '')].reduce((map, char) => ({ ...map, [char]: (map[char] || 0) + 1 }), {});
    for (const [char, count] of Object.entries(required)) if ((available[char] || 0) < count) failures.push(`rebus.${puzzle.id}: tile pool is missing ${char}`);
  }
}

// Check generated questions across each engine tier and the two-second-per-tier timing rule.
for (let tier = 1; tier <= 5; tier += 1) {
  const round = generateRound({ skillId: 'mixed', tier, count: 10, seed: `validator-tier-${tier}`, baseSeconds: 15 });
  if (round.length !== 10) failures.push(`math engine tier ${tier}: expected ten generated questions`);
  for (const q of round) {
    validQuestion(q, 'math-engine');
    if (q.timeMs !== timeMsFor(tier, 15)) failures.push(`math engine ${q.id}: expected ${timeMsFor(tier, 15)}ms at tier ${tier}, got ${q.timeMs}`);
  }
}
const sampleRng = createRng(42);
if (typeof sampleRng() !== 'number') failures.push('math engine: seeded random generator failed');

if (failures.length) {
  console.error(`Brain Stash content validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Brain Stash content validation passed.');
  console.log(`Validated ${banks.lessons.length} maths lessons, ${banks.rebus.length} rebus puzzles, ${banks.stash.length} Deep Stash cards, ${banks.traps.length} Mind Trap questions, ${banks.fallacies.length} fallacy questions, and generated maths rounds at tiers 1–5.`);
}
