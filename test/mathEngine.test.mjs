// Run with: node test/mathEngine.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createRng, hashSeed, listSkills, generateQuestion, generateRound, timeMsFor, SKILL_IDS,
} from '../src/engine/mathEngine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const lessons = JSON.parse(fs.readFileSync(path.join(here, '../src/content/mathLessons.json'), 'utf8'));

let failures = 0;
let checks = 0;
function check(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    if (failures <= 40) console.log('FAIL:', msg);
  }
}

const unfmt = (s) => Number(String(s).replace(/,/g, ''));
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---- arithmetic verifier for any text containing "a op b = c" chains ----
const CHAIN = /(\d[\d,]*(?:\s*[×÷+−]\s*\d[\d,]*)+)\s*=\s*(\d[\d,]*)/g;
const PCT = /(\d+)% of (\d[\d,]*)\s*=\s*(\d[\d,]*)/g;
const SQ = /(\d[\d,]*)²\s*=\s*(\d[\d,]*)/g;

function verifyText(text, where) {
  let m;
  CHAIN.lastIndex = 0;
  while ((m = CHAIN.exec(text))) {
    const expr = m[1].replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    if (!/^[\d\s*/+\-.]+$/.test(expr)) { check(false, `${where}: unsafe expression ${expr}`); continue; }
    const val = Function(`"use strict"; return (${expr});`)();
    check(Math.abs(val - unfmt(m[2])) < 1e-9, `${where}: "${m[1]} = ${m[2]}" is wrong (got ${val})`);
  }
  PCT.lastIndex = 0;
  while ((m = PCT.exec(text))) {
    const val = (Number(m[1]) * unfmt(m[2])) / 100;
    check(Math.abs(val - unfmt(m[3])) < 1e-9, `${where}: "${m[0]}" is wrong (got ${val})`);
  }
  SQ.lastIndex = 0;
  while ((m = SQ.exec(text))) {
    const n = unfmt(m[1]);
    check(n * n === unfmt(m[2]), `${where}: "${m[0]}" is wrong (got ${n * n})`);
  }
}

// ---- independent ground truth from meta ----
function truth(meta) {
  if (meta.kind === 'binary') {
    return { '+': meta.a + meta.b, '−': meta.a - meta.b, '×': meta.a * meta.b }[meta.op];
  }
  if (meta.kind === 'percent') return (meta.base * meta.p) / 100;
  if (meta.kind === 'square') return meta.n * meta.n;
  return NaN;
}

// ---- 1. every skill, every tier in range, many seeds ----
const positions = { a: 0, b: 0, c: 0, d: 0 };
let totalQ = 0;
for (const sk of listSkills()) {
  for (let tier = sk.minTier; tier <= sk.maxTier; tier++) {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = createRng(seed * 7919 + tier);
      const q = generateQuestion({ skillId: sk.id, tier, rng, index: seed });
      const tag = `${sk.id} t${tier} seed${seed} "${q.prompt}"`;
      totalQ++;
      positions[q.correctId]++;

      check(q.options.length === 4, `${tag}: needs 4 options`);
      check(new Set(q.options.map((o) => o.label)).size === 4, `${tag}: duplicate labels`);
      check(['a', 'b', 'c', 'd'].join() === q.options.map((o) => o.id).join(), `${tag}: ids out of order`);
      const correct = q.options.find((o) => o.id === q.correctId);
      check(correct && unfmt(correct.label) === q.answer, `${tag}: correctId does not point at the answer`);
      check(q.options.filter((o) => unfmt(o.label) === q.answer).length === 1, `${tag}: answer appears more than once`);
      check(q.answer === truth(q.meta), `${tag}: answer ${q.answer} != truth ${truth(q.meta)}`);
      check(q.options.every((o) => unfmt(o.label) > 0 && Number.isInteger(unfmt(o.label))), `${tag}: non-positive or non-integer option`);
      check(q.tier >= sk.minTier && q.tier <= sk.maxTier, `${tag}: tier out of skill range`);
      check(q.explanation.includes(fmt(q.answer)), `${tag}: explanation missing the answer`);
      check(q.timeMs === timeMsFor(tier, 15), `${tag}: wrong timeMs`);
      for (const line of q.working) verifyText(line, `${tag} working`);
    }
  }
}
console.log(`Generated and checked ${totalQ} questions.`);

// ---- 2. position of the correct answer is evenly spread ----
for (const [k, v] of Object.entries(positions)) {
  const share = v / totalQ;
  check(share > 0.2 && share < 0.3, `correct answer position ${k} share ${share.toFixed(3)} is skewed`);
}

// ---- 3. determinism ----
const r1 = generateRound({ skillId: 'mixed', tier: 3, count: 10, seed: 'daily-2026-10-10' });
const r2 = generateRound({ skillId: 'mixed', tier: 3, count: 10, seed: 'daily-2026-10-10' });
const r3 = generateRound({ skillId: 'mixed', tier: 3, count: 10, seed: 'daily-2026-10-11' });
check(JSON.stringify(r1) === JSON.stringify(r2), 'same seed must give identical rounds');
check(JSON.stringify(r1) !== JSON.stringify(r3), 'different seeds must give different rounds');
check(hashSeed('a') !== hashSeed('b'), 'hashSeed collision on trivial input');

// ---- 4. rounds ----
for (let tier = 1; tier <= 5; tier++) {
  const round = generateRound({ skillId: 'mixed', tier, count: 15, seed: tier * 31 });
  check(round.length === 15, `round tier ${tier}: wrong length`);
  check(new Set(round.map((q) => q.prompt)).size === round.length, `round tier ${tier}: repeated prompt`);
  for (let i = 1; i < round.length; i++) {
    check(round[i].skillId !== round[i - 1].skillId, `round tier ${tier}: same skill back to back at ${i}`);
  }
}
const single = generateRound({ skillId: 'mul11', tier: 2, count: 8, seed: 5 });
check(single.every((q) => q.skillId === 'mul11'), 'single-skill round leaked other skills');

// ---- 5. bad input ----
let threw = false;
try { generateQuestion({ skillId: 'nope', tier: 1, rng: createRng(1) }); } catch (e) { threw = e instanceof RangeError; }
check(threw, 'unknown skill should throw RangeError');
threw = false;
try { generateRound({ skillId: 'nope' }); } catch (e) { threw = e instanceof RangeError; }
check(threw, 'unknown skill in round should throw RangeError');
for (const bad of [0, -3, 99, 2.7, NaN, undefined, '4']) {
  const q = generateQuestion({ skillId: 'mul5', tier: bad, rng: createRng(3) });
  check(q.tier >= 1 && q.tier <= 3, `bad tier ${String(bad)} not clamped (got ${q.tier})`);
}
check(timeMsFor(1, 10) === 10000 && timeMsFor(5, 10) === 18000, 'timeMsFor scaling wrong');
check(timeMsFor(1, 1) === 15000 && timeMsFor(1, NaN) === 15000, 'timeMsFor should fall back to 15s for bad base');
check(generateRound({ count: 0, seed: 1 }).length >= 1 && generateRound({ count: 500, seed: 1 }).length === 50, 'round count not clamped');

// ---- 6. the tricks themselves hold for the whole range they are taught on ----
for (let n = 10; n <= 999; n++) {
  // neighbour-sum method for x11, with carries from the right
  const d = String(n).split('').map(Number);
  const sums = [d[0], ...d.slice(1).map((x, i) => d[i] + x), d[d.length - 1]];
  let carry = 0; const out = [];
  for (let i = sums.length - 1; i >= 0; i--) { const v = sums[i] + carry; out.unshift(v % 10); carry = Math.floor(v / 10); }
  const result = Number((carry ? String(carry) : '') + out.join(''));
  check(result === n * 11, `x11 neighbour method failed for ${n}`);
  check((n * 100) / 4 === n * 25, `x25 failed for ${n}`);
  check(n * 10 - n === n * 9 && n * 100 - n === n * 99, `x9/x99 failed for ${n}`);
  check((n * 10) / 2 === n * 5, `x5 failed for ${n}`);
}
for (let k = 1; k <= 19; k++) {
  const num = k * 10 + 5;
  check(k * (k + 1) * 100 + 25 === num * num, `square-ending-in-5 failed for ${num}`);
}
for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) {
  check((100 - x - y) * 100 + x * y === (100 - x) * (100 - y), `near-100 failed for ${x},${y}`);
}
for (let m = 20; m <= 190; m += 10) for (let d = 1; d <= 9; d++) {
  check(m * m - d * d === (m - d) * (m + d), `symmetric-pair failed for ${m},${d}`);
}
for (let a = 15; a <= 95; a += 10) for (let b = 2; b <= 200; b += 2) {
  check(2 * a * (b / 2) === a * b, `double-and-halve failed for ${a},${b}`);
}

// ---- 7. lessons ----
const skillIds = new Set(SKILL_IDS);
check(lessons.length === SKILL_IDS.length, `expected one lesson per skill (${SKILL_IDS.length}), got ${lessons.length}`);
check(new Set(lessons.map((l) => l.skillId)).size === lessons.length, 'two lessons share a skillId');
check(new Set(lessons.map((l) => l.id)).size === lessons.length, 'duplicate lesson id');
for (const l of lessons) {
  check(skillIds.has(l.skillId), `lesson ${l.id}: unknown skillId ${l.skillId}`);
  check(typeof l.title === 'string' && l.title.length > 2, `lesson ${l.id}: missing title`);
  check(typeof l.blurb === 'string' && l.blurb.length > 5, `lesson ${l.id}: missing blurb`);
  check(Array.isArray(l.steps) && l.steps.length >= 3, `lesson ${l.id}: needs at least 3 steps`);
  for (const s of l.steps) {
    check(s.heading && s.body && s.body.length > 40, `lesson ${l.id}: step "${s.heading}" is too thin`);
    verifyText(`${s.body}\n${s.example ?? ''}`, `lesson ${l.id} / ${s.heading}`);
  }
  check(l.steps.some((s) => s.example), `lesson ${l.id}: no worked example`);
}

console.log(`${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
