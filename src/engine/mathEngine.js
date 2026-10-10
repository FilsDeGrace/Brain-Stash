// Maths engine for Brain Stash.
// Pure logic: no React, no storage, no timers. Deterministic when given a seeded rng.
//
// Public API
//   createRng(seed)                      -> () => number in [0, 1)
//   hashSeed(string)                     -> uint32 (use for the daily challenge: hashSeed('2026-10-10'))
//   listSkills()                         -> [{ id, title, minTier, maxTier }]
//   generateQuestion({ skillId, tier, rng, baseSeconds, index })
//   generateRound({ skillId, tier, count, seed, baseSeconds })   skillId may be 'mixed'
//   timeMsFor(tier, baseSeconds)
//
// A question is: { id, skillId, tier, prompt, options[4], correctId, answer, explanation,
//                  working[], timeMs, meta }.
// `options` is [{ id: 'a'|'b'|'c'|'d', label }]. `meta` describes the operands so tests
// can recompute the answer independently of the generator.

const MIN_TIER = 1;
const MAX_TIER = 5;

// ---------- small helpers ----------

export function createRng(seed) {
  // mulberry32
  let t = seed >>> 0;
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  // FNV-1a
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const pad2 = (n) => String(n).padStart(2, '0');

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normaliseTier(tier) {
  const n = Math.round(Number(tier));
  return Number.isFinite(n) ? clamp(n, MIN_TIER, MAX_TIER) : MIN_TIER;
}

export function timeMsFor(tier, baseSeconds = 15) {
  const base = Number.isFinite(baseSeconds) && baseSeconds >= 5 && baseSeconds <= 60 ? baseSeconds : 15;
  return (base + (normaliseTier(tier) - 1) * 2) * 1000;
}

// ---------- distractors ----------

function genericSlips(answer) {
  const out = [
    answer + 10, answer - 10, answer + 100, answer - 100,
    answer + 1, answer - 1, answer + 2, answer - 2, answer + 20, answer - 20,
  ];
  const s = String(answer);
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] !== s[i + 1]) {
      const chars = s.split('');
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      if (chars[0] !== '0') out.push(Number(chars.join('')));
    }
  }
  return out;
}

function buildDistractors(rng, answer, skillSlips) {
  const valid = (x) => Number.isInteger(x) && x > 0 && x !== answer;
  const uniq = (list) => [...new Set(list.filter(valid))];
  const chosen = [];
  const take = (list, max) => {
    for (const x of shuffle(rng, list)) {
      if (chosen.length >= max) break;
      if (!chosen.includes(x)) chosen.push(x);
    }
  };
  // Prefer rule-based slips (what the trick looks like when misapplied), then generic slips.
  take(uniq(skillSlips), 2);
  take(uniq(genericSlips(answer)), 3);
  take(uniq(skillSlips), 3);
  for (let j = 1; chosen.length < 3 && j < 50; j++) {
    const x = answer + j * 7;
    if (valid(x) && !chosen.includes(x)) chosen.push(x);
  }
  return chosen.slice(0, 3);
}

// ---------- skills ----------
// Each gen returns { prompt, answer, working[], trick, slips[], meta }.

const SKILLS = {
  mul5: {
    title: 'Multiplying by 5',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      const n = t === 1 ? 2 * int(rng, 6, 49) : t === 2 ? int(rng, 13, 99) : int(rng, 101, 499);
      const answer = n * 5;
      return {
        prompt: `${n} × 5`,
        answer,
        working: [`${n} × 10 = ${fmt(n * 10)}`, `${fmt(n * 10)} ÷ 2 = ${fmt(answer)}`],
        trick: 'Multiply by 10, then halve.',
        slips: [n * 10, Math.floor(n / 2) * 10],
        meta: { kind: 'binary', op: '×', a: n, b: 5 },
      };
    },
  },

  add_comp: {
    title: 'Add by rounding',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      let R, a, e;
      if (t === 1) { R = pick(rng, [30, 40, 50, 60, 70, 80, 90]); a = int(rng, 21, 76); e = int(rng, 1, 3); }
      else if (t === 2) { R = pick(rng, [100, 200, 300]); a = int(rng, 120, 689); e = int(rng, 1, 4); }
      else { R = pick(rng, [200, 300, 400, 500, 600, 700, 800, 900]); a = int(rng, 150, 699); e = int(rng, 1, 6); }
      const b = R - e;
      const answer = a + b;
      const flip = rng() < 0.5;
      return {
        prompt: flip ? `${b} + ${a}` : `${a} + ${b}`,
        answer,
        working: [
          `${b} is ${e} short of ${R}.`,
          `${a} + ${R} = ${fmt(a + R)}`,
          `${fmt(a + R)} − ${e} = ${fmt(answer)}`,
        ],
        trick: 'Round up to an easy number, add it, then take the extra off.',
        slips: [a + R, a + R + e],
        meta: { kind: 'binary', op: '+', a, b },
      };
    },
  },

  sub_comp: {
    title: 'Subtract by rounding',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      let R, a, e;
      if (t === 1) { R = pick(rng, [30, 40, 50, 60, 70, 80, 90]); a = int(rng, R + 5, Math.min(R + 50, 99)); e = int(rng, 1, 3); }
      else if (t === 2) { R = pick(rng, [100, 200, 300]); a = int(rng, R + 20, R + 300); e = int(rng, 1, 4); }
      else { R = pick(rng, [200, 300, 400, 500, 600, 700, 800, 900]); a = int(rng, R + 20, R + 500); e = int(rng, 1, 6); }
      const b = R - e;
      const answer = a - b;
      return {
        prompt: `${a} − ${b}`,
        answer,
        working: [
          `${b} is ${e} less than ${R}.`,
          `${a} − ${R} = ${fmt(a - R)}`,
          `${fmt(a - R)} + ${e} = ${fmt(answer)}`,
        ],
        trick: 'Subtract the round number, then give back what you over-subtracted.',
        slips: [a - R, a - R - e],
        meta: { kind: 'binary', op: '−', a, b },
      };
    },
  },

  mul9: {
    title: 'Multiplying by 9 and 99',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      const f = t === 3 ? 99 : 9;
      const n = t === 1 ? int(rng, 12, 49) : t === 2 ? int(rng, 50, 99) : int(rng, 12, 98);
      const base = f === 9 ? 10 : 100;
      const answer = n * f;
      return {
        prompt: `${n} × ${f}`,
        answer,
        working: [`${n} × ${base} = ${fmt(n * base)}`, `${fmt(n * base)} − ${n} = ${fmt(answer)}`],
        trick: `Multiply by ${base}, then subtract the number once.`,
        slips: [n * base, n * base + n, n * base - f],
        meta: { kind: 'binary', op: '×', a: n, b: f },
      };
    },
  },

  mul11: {
    title: 'Multiplying by 11',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      let n;
      if (t === 1) {
        do { const a = int(rng, 1, 8); const b = int(rng, 0, 9 - a); n = a * 10 + b; } while (n < 12);
      } else if (t === 2) {
        const a = int(rng, 1, 9);
        const b = int(rng, Math.max(0, 10 - a), 9);
        n = a * 10 + b;
      } else {
        n = int(rng, 101, 999);
      }
      const answer = n * 11;
      const digits = String(n).split('').map(Number);
      let working;
      let slips = [n * 10];
      if (digits.length === 2) {
        const [a, b] = digits;
        const mid = a + b;
        if (mid < 10) {
          working = [
            `Outer digits: ${a} and ${b}.`,
            `Middle digit: ${a} + ${b} = ${mid}.`,
            `Put them together: ${fmt(answer)}.`,
          ];
        } else {
          working = [
            `Outer digits: ${a} and ${b}.`,
            `Middle: ${a} + ${b} = ${mid}, so write ${mid % 10} and carry 1 to the left.`,
            `${a} + 1 = ${a + 1}, which gives ${fmt(answer)}.`,
          ];
          slips.push(Number(`${a}${mid}${b}`));
        }
      } else {
        const [d0, d1, d2] = digits;
        working = [
          `Neighbour sums: ${d0}, ${d0 + d1}, ${d1 + d2}, ${d2}.`,
          'Write from the right, carrying whenever a sum passes 9.',
          `Result: ${fmt(answer)}.`,
        ];
        slips.push(Number(`${d0}${d0 + d1}${d1 + d2}${d2}`));
      }
      return {
        prompt: `${n} × 11`,
        answer,
        working,
        trick: 'Each digit is added to its neighbour; the outer digits stay as they are.',
        slips,
        meta: { kind: 'binary', op: '×', a: n, b: 11 },
      };
    },
  },

  sq5: {
    title: 'Squares ending in 5',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      const n = t === 1 ? int(rng, 1, 5) : t === 2 ? int(rng, 6, 9) : int(rng, 10, 19);
      const num = n * 10 + 5;
      const answer = num * num;
      return {
        prompt: `${num}²`,
        answer,
        working: [`${n} × ${n + 1} = ${n * (n + 1)}`, `Put 25 after it: ${fmt(answer)}.`],
        trick: 'Multiply the leading digits by the next number up, then write 25.',
        slips: [n * n * 100 + 25, (n + 1) * (n + 1) * 100 + 25, n * (n + 1) * 10 + 25],
        meta: { kind: 'square', n: num },
      };
    },
  },

  mul25: {
    title: 'Multiplying by 25',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      const n = t === 1 ? 4 * int(rng, 3, 24) : t === 2 ? int(rng, 12, 99) : int(rng, 101, 399);
      const answer = n * 25;
      return {
        prompt: `${n} × 25`,
        answer,
        working: [`${n} × 100 = ${fmt(n * 100)}`, `${fmt(n * 100)} ÷ 4 = ${fmt(answer)}`],
        trick: 'Multiply by 100, then divide by 4.',
        slips: [n * 100, n * 50],
        meta: { kind: 'binary', op: '×', a: n, b: 25 },
      };
    },
  },

  pct: {
    title: 'Percentages from building blocks',
    minTier: 1,
    maxTier: 3,
    gen(rng, t) {
      const ps = t === 1 ? [10, 25, 50] : t === 2 ? [5, 15, 20, 30, 35, 45] : [12, 22, 32, 65, 95];
      const p = pick(rng, ps);
      const parts = [];
      let rest = p;
      for (const c of [50, 25, 10, 5, 1]) {
        while (rest >= c) { parts.push(c); rest -= c; }
      }
      let base = null;
      for (let i = 0; i < 40 && base === null; i++) {
        const cand = t === 1 ? 40 * int(rng, 1, 10) : t === 2 ? 20 * int(rng, 2, 20) : 20 * int(rng, 2, 45);
        if (parts.every((c) => Number.isInteger((cand * c) / 100))) base = cand;
      }
      if (base === null) base = 100 * int(rng, 2, 9);
      const values = parts.map((c) => (base * c) / 100);
      const answer = values.reduce((s, v) => s + v, 0);
      const working = parts.map((c, i) => `${c}% of ${fmt(base)} = ${fmt(values[i])}`);
      if (parts.length > 1) working.push(`${values.map(fmt).join(' + ')} = ${fmt(answer)}`);
      const last = values[values.length - 1];
      return {
        prompt: `${p}% of ${fmt(base)}`,
        answer,
        working,
        trick: 'Split the percentage into blocks you can do instantly (50%, 25%, 10%, 5%, 1%) and add them.',
        slips: [answer - last, answer + last, answer * 10],
        meta: { kind: 'percent', p, base },
      };
    },
  },

  dblhalf: {
    title: 'Double and halve',
    minTier: 2,
    maxTier: 5,
    gen(rng, t) {
      let a, b;
      if (t === 2) { a = pick(rng, [15, 25, 35, 45]); b = 2 * int(rng, 6, 18); }
      else if (t === 3) { a = pick(rng, [15, 25, 35, 45, 55, 65, 75, 85, 95]); b = 2 * int(rng, 7, 34); }
      else if (t === 4) { a = pick(rng, [25, 35, 45, 55, 65, 75, 85, 95]); b = 2 * int(rng, 17, 49); }
      else { a = pick(rng, [35, 45, 55, 65, 75, 85, 95]); b = 2 * int(rng, 26, 99); }
      const answer = a * b;
      return {
        prompt: `${a} × ${b}`,
        answer,
        working: [
          `Double ${a} to get ${2 * a}; halve ${b} to get ${b / 2}.`,
          `${fmt(2 * a)} × ${fmt(b / 2)} = ${fmt(answer)}`,
        ],
        trick: 'Double one factor and halve the other; the product does not change.',
        slips: [answer * 2, answer / 2],
        meta: { kind: 'binary', op: '×', a, b },
      };
    },
  },

  split: {
    title: 'Break it up',
    minTier: 3,
    maxTier: 5,
    gen(rng, t) {
      let a, h;
      if (t === 3) { a = int(rng, 12, 59); h = 1; }
      else if (t === 4) { a = int(rng, 12, 99); h = int(rng, 1, 3); }
      else { a = int(rng, 12, 99); h = int(rng, 1, 5); }
      const tens = t === 3 ? int(rng, 1, 4) : int(rng, 1, 9);
      const u = int(rng, 1, 9);
      const b = h * 100 + tens * 10 + u;
      const p1 = a * h * 100;
      const p2 = a * tens * 10;
      const p3 = a * u;
      const answer = a * b;
      return {
        prompt: `${a} × ${b}`,
        answer,
        working: [
          `${a} × ${h * 100} = ${fmt(p1)}`,
          `${a} × ${tens * 10} = ${fmt(p2)}`,
          `${a} × ${u} = ${fmt(p3)}`,
          `${fmt(p1)} + ${fmt(p2)} + ${fmt(p3)} = ${fmt(answer)}`,
        ],
        trick: 'Split the larger number by place value, multiply each part, then add.',
        slips: [answer - p2, answer - p3, p1 + a * tens + p3],
        meta: { kind: 'binary', op: '×', a, b },
      };
    },
  },

  near100: {
    title: 'Pairs just below 100',
    minTier: 3,
    maxTier: 4,
    gen(rng, t) {
      const top = t === 3 ? 5 : 9;
      const x = int(rng, 1, top);
      const y = int(rng, 1, top);
      const a = 100 - x;
      const b = 100 - y;
      const L = 100 - x - y;
      const R = x * y;
      const answer = L * 100 + R;
      return {
        prompt: `${a} × ${b}`,
        answer,
        working: [
          `${a} is ${x} below 100 and ${b} is ${y} below 100.`,
          `Left part: ${a} − ${y} = ${L}`,
          `Right part: ${x} × ${y} = ${R}, written as two digits: ${pad2(R)}.`,
          `Join them: ${L} and ${pad2(R)} gives ${fmt(answer)}.`,
        ],
        trick: 'Subtract each number\u2019s shortfall from the other; multiply the shortfalls; join the two parts.',
        slips: [Number(`${L}${R}`), L * 100 + x + y, (L + 1) * 100 + R],
        meta: { kind: 'binary', op: '×', a, b },
      };
    },
  },

  diffsq: {
    title: 'Symmetric pairs',
    minTier: 3,
    maxTier: 5,
    gen(rng, t) {
      const ms = t === 3 ? [30, 40, 50, 60]
        : t === 4 ? [20, 30, 40, 50, 60, 70, 80]
        : [20, 30, 40, 50, 60, 70, 80, 90, 110, 120, 130, 140, 150, 160, 170, 180, 190];
      const m = pick(rng, ms);
      const d = int(rng, 1, t === 3 ? 5 : 9);
      const a = m - d;
      const b = m + d;
      const answer = a * b;
      return {
        prompt: `${a} × ${b}`,
        answer,
        working: [
          `${a} and ${b} sit ${d} either side of ${m}.`,
          `${m}² = ${fmt(m * m)}`,
          `${d}² = ${d * d}`,
          `${fmt(m * m)} − ${d * d} = ${fmt(answer)}`,
        ],
        trick: 'When two numbers are the same distance from an easy middle value, the product is middle² − distance².',
        slips: [m * m, m * m + d * d, m * m - d],
        meta: { kind: 'binary', op: '×', a, b },
      };
    },
  },
};

export const SKILL_IDS = Object.keys(SKILLS);

export function listSkills() {
  return SKILL_IDS.map((id) => ({
    id,
    title: SKILLS[id].title,
    minTier: SKILLS[id].minTier,
    maxTier: SKILLS[id].maxTier,
  }));
}

// ---------- question + round generation ----------

export function generateQuestion({ skillId, tier = 1, rng, baseSeconds = 15, index = 0 }) {
  const skill = SKILLS[skillId];
  if (!skill) throw new RangeError(`Unknown skill: ${skillId}`);
  if (typeof rng !== 'function') throw new TypeError('generateQuestion needs an rng function');
  const t = clamp(normaliseTier(tier), skill.minTier, skill.maxTier);
  const g = skill.gen(rng, t);
  const distractors = buildDistractors(rng, g.answer, g.slips);
  const labels = shuffle(rng, [g.answer, ...distractors]);
  const ids = ['a', 'b', 'c', 'd'];
  const options = labels.map((n, i) => ({ id: ids[i], label: fmt(n) }));
  const correctId = ids[labels.indexOf(g.answer)];
  return {
    id: `${skillId}-t${t}-${index}`,
    skillId,
    tier: t,
    prompt: g.prompt,
    options,
    correctId,
    answer: g.answer,
    explanation: [...g.working, g.trick].join('\n'),
    working: g.working,
    timeMs: timeMsFor(tier, baseSeconds),
    meta: g.meta,
  };
}

export function generateRound({ skillId = 'mixed', tier = 1, count = 10, seed = Date.now(), baseSeconds = 15 } = {}) {
  const rng = createRng(typeof seed === 'string' ? hashSeed(seed) : seed);
  const t = normaliseTier(tier);
  const n = clamp(Math.floor(Number(count)) || 10, 1, 50);
  let pool;
  if (skillId === 'mixed') {
    pool = SKILL_IDS.filter((id) => SKILLS[id].minTier <= t && t <= SKILLS[id].maxTier);
    if (pool.length === 0) pool = SKILL_IDS;
  } else {
    if (!SKILLS[skillId]) throw new RangeError(`Unknown skill: ${skillId}`);
    pool = [skillId];
  }
  const questions = [];
  const seen = new Set();
  let last = null;
  for (let i = 0; i < n; i++) {
    let q = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      let choices = pool;
      if (pool.length > 1 && last) choices = pool.filter((id) => id !== last);
      const id = pick(rng, choices);
      const cand = generateQuestion({ skillId: id, tier: t, rng, baseSeconds, index: i });
      if (!seen.has(cand.prompt)) { q = cand; break; }
      q = cand;
    }
    seen.add(q.prompt);
    last = q.skillId;
    questions.push(q);
  }
  return questions;
}
