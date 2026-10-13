import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src', 'content', 'court.json');
const court = JSON.parse(fs.readFileSync(file, 'utf8'));

const failures = [];
const warnings = [];
const words = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
const LETTERS = ['a', 'b', 'c', 'd'];

// Word-count ranges from the Court prompt section. Out-of-range is a warning, not a failure.
const RANGES = {
  title: [2, 5],
  context: [100, 170],
  counsel: [45, 90],
  prompt: [10, 40],
  option: [12, 35],
  factor: [12, 35],
  trapNote: [25, 60],
  ratio: [25, 50],
  explanation: [130, 200],
};

function range(label, text, key) {
  const [lo, hi] = RANGES[key];
  const n = words(text);
  if (n < lo || n > hi) warnings.push(`${label}: ${n} words (expected ${lo}-${hi})`);
}

const ids = court.map((c) => c.id);
if (new Set(ids).size !== ids.length) failures.push('court: duplicate IDs');

const titles = court.map((c) => String(c.title).trim().toLowerCase());
if (new Set(titles).size !== titles.length) failures.push('court: duplicate titles');

for (const c of court) {
  const L = `court.${c.id}`;
  if (c.kind !== 'court') failures.push(`${L}: kind must be 'court'`);
  const idMatch = /^court-t([1-5])-b(\d+)-(\d{2})$/.exec(String(c.id));
  if (!idMatch) failures.push(`${L}: ID does not match court-t{tier}-b{batch}-{nn}`);
  else if (Number(idMatch[1]) !== Number(c.difficulty)) failures.push(`${L}: ID tier ${idMatch[1]} does not match difficulty ${c.difficulty}`);
  if (!c.category?.trim() || !c.title?.trim()) failures.push(`${L}: category or title missing`);
  if (!c.context?.trim() || !c.prompt?.trim()) failures.push(`${L}: context or prompt missing`);
  if (!/^On (these facts|this evidence)/.test(c.prompt ?? '')) failures.push(`${L}: prompt must begin 'On these facts' or 'On this evidence'`);
  if (!c.explanation?.trim()) failures.push(`${L}: missing explanation`);
  if (!c.canonicalRatio?.trim()) failures.push(`${L}: missing canonicalRatio`);
  if (!c.trap?.type?.trim() || !c.trap?.note?.trim()) failures.push(`${L}: trap type or note missing`);

  // Counsel
  const counselIds = (c.counsel ?? []).map((x) => x.id);
  if (counselIds.length !== 2 || counselIds[0] !== 'a' || counselIds[1] !== 'b') failures.push(`${L}: expected exactly two counsel with ids a and b`);

  // Verdict options (same four-option shape as the other banks)
  const optionIds = (c.options ?? []).map((o) => o.id);
  if (optionIds.length !== 4 || optionIds.join('') !== LETTERS.join('')) failures.push(`${L}: options must be exactly a, b, c, d`);
  if (!optionIds.includes(c.correctId)) failures.push(`${L}: correctId missing from options`);
  if (!optionIds.includes(c.intuitiveWrongId)) failures.push(`${L}: intuitiveWrongId missing from options`);
  if (c.correctId === c.intuitiveWrongId) failures.push(`${L}: intuitiveWrongId must differ from correctId`);
  if ((c.options ?? []).some((o) => !o.label?.trim())) failures.push(`${L}: blank option label`);

  // Factors (ratio chips)
  const factors = c.factors ?? [];
  const factorIds = factors.map((f) => f.id);
  if (new Set(factorIds).size !== factorIds.length) failures.push(`${L}: duplicate factor IDs`);
  const roleCount = (role) => factors.filter((f) => f.role === role).length;
  if (factors.length !== 6) failures.push(`${L}: expected six factors, found ${factors.length}`);
  if (roleCount('deciding') !== 1) failures.push(`${L}: expected exactly one deciding factor`);
  if (roleCount('acceptable') !== 1) failures.push(`${L}: expected exactly one acceptable factor`);
  if (roleCount('trap') !== 3) failures.push(`${L}: expected three trap factors`);
  if (roleCount('irrelevant') !== 1) failures.push(`${L}: expected one irrelevant factor`);
  if (factors.some((f) => !['deciding', 'acceptable', 'trap', 'irrelevant'].includes(f.role))) failures.push(`${L}: unknown factor role`);

  // Consistency map
  const keys = Object.keys(c.consistency ?? {});
  if (keys.sort().join('') !== LETTERS.join('')) failures.push(`${L}: consistency keys must equal the option IDs`);
  for (const [verdict, list] of Object.entries(c.consistency ?? {})) {
    for (const f of list) if (!factorIds.includes(f)) failures.push(`${L}: consistency.${verdict} lists unknown factor '${f}'`);
  }
  const deciding = factors.find((f) => f.role === 'deciding');
  if (deciding && !(c.consistency?.[c.correctId] ?? []).includes(deciding.id)) failures.push(`${L}: deciding factor must be listed under the correct verdict`);

  // Word-count ranges (warnings)
  range(`${L}.title`, c.title, 'title');
  range(`${L}.context`, c.context, 'context');
  (c.counsel ?? []).forEach((x) => range(`${L}.counsel.${x.id}`, x.argument, 'counsel'));
  range(`${L}.prompt`, c.prompt, 'prompt');
  (c.options ?? []).forEach((o) => range(`${L}.option.${o.id}`, o.label, 'option'));
  factors.forEach((f) => range(`${L}.factor.${f.id}`, f.label, 'factor'));
  range(`${L}.trap.note`, c.trap?.note, 'trapNote');
  range(`${L}.canonicalRatio`, c.canonicalRatio, 'ratio');
  range(`${L}.explanation`, c.explanation, 'explanation');
}

// Batch-level: no correct answer position more than twice in any six consecutive items per tier.
const byTier = new Map();
for (const c of court) byTier.set(c.difficulty, [...(byTier.get(c.difficulty) ?? []), c]);
for (const [tier, items] of byTier) {
  const counts = {};
  for (const c of items) counts[c.correctId] = (counts[c.correctId] ?? 0) + 1;
  for (const [letter, n] of Object.entries(counts)) if (n > 2) failures.push(`court tier ${tier}: correct answer is '${letter}' ${n} times`);
}

if (warnings.length) {
  console.warn(`Court word-count warnings (${warnings.length}):`);
  warnings.forEach((w) => console.warn(`- ${w}`));
}
if (failures.length) {
  console.error(`Court validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((f) => console.error(`- ${f}`));
  process.exitCode = 1;
} else {
  const tiers = [...byTier.keys()].sort().map((t) => `T${t}:${byTier.get(t).length}`).join(' ');
  const letters = LETTERS.map((l) => `${l}:${court.filter((c) => c.correctId === l).length}`).join(' ');
  console.log(`Court validation passed. ${court.length} cases (${tiers}). Correct-answer spread ${letters}.`);
}
