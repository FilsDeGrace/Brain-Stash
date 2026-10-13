import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src', 'content', 'rebus.json');
const puzzles = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const ids = new Set();
const repeatedExplanations = new Map();
const genericPhrases = [
  'look for how the image arranges its words and shapes',
  'the image represents the answer',
  'this rebus represents the phrase',
  'the answer is shown in the image',
];

if (!Array.isArray(puzzles) || puzzles.length !== 54) errors.push(`Expected 54 Rebus puzzles, found ${Array.isArray(puzzles) ? puzzles.length : 'non-array content'}`);
for (const [index, puzzle] of (Array.isArray(puzzles) ? puzzles : []).entries()) {
  const label = `rebus[${index}]${puzzle?.id ? ` (${puzzle.id})` : ''}`;
  if (!puzzle?.id || ids.has(String(puzzle.id))) errors.push(`${label}: missing or duplicate ID`);
  ids.add(String(puzzle?.id ?? ''));
  if (!String(puzzle?.answer ?? '').trim()) errors.push(`${label}: missing answer`);
  const explanation = String(puzzle?.explanation ?? '').trim();
  if (explanation.length < 35) errors.push(`${label}: explanation is missing or too short to explain the visual clue`);
  if (genericPhrases.some((phrase) => explanation.toLowerCase().includes(phrase))) errors.push(`${label}: generic explanation placeholder found`);
  if (!Array.isArray(puzzle?.wordLengths) || !puzzle.wordLengths.length) errors.push(`${label}: wordLengths missing`);
  if (!String(puzzle?.imageSrc ?? '').trim() || !String(puzzle?.imageAlt ?? '').trim()) errors.push(`${label}: image path or alt text missing`);
  if (explanation) repeatedExplanations.set(explanation, (repeatedExplanations.get(explanation) || 0) + 1);
}
for (const [explanation, count] of repeatedExplanations) if (count > 1) errors.push(`Repeated Rebus explanation appears ${count} times: ${explanation.slice(0, 80)}`);
if (errors.length) {
  console.error(`Rebus validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Rebus validation passed: ${puzzles.length} puzzles have unique IDs and specific, non-placeholder explanations.`);
}
