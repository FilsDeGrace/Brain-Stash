import disciplines from '../src/content/disciplines.js';

const failures = [];
const disciplineIds = new Set();
const itemIds = new Set();
const requiredText = ['title', 'summary', 'explanation', 'example', 'whyItMatters', 'tryThis', 'question', 'answer'];

if (disciplines.length !== 7) failures.push(`expected 7 disciplines, found ${disciplines.length}`);
for (const discipline of disciplines) {
  if (!discipline.id || disciplineIds.has(discipline.id)) failures.push(`missing or duplicate discipline id: ${discipline.id}`);
  disciplineIds.add(discipline.id);
  if (!discipline.title || !discipline.description || !discipline.kicker || !discipline.icon) failures.push(`${discipline.id}: metadata missing`);
  if (!Array.isArray(discipline.items) || discipline.items.length < 1) failures.push(`${discipline.id}: no starter items`);
  for (const item of discipline.items || []) {
    const key = `${discipline.id}:${item.id}`;
    if (!item.id || itemIds.has(key)) failures.push(`${key}: missing or duplicate item id`);
    itemIds.add(key);
    for (const field of requiredText) if (typeof item[field] !== 'string' || item[field].trim().length < (field === 'title' ? 5 : 4)) failures.push(`${key}: ${field} missing or too short`);
    if (!Array.isArray(item.sources)) failures.push(`${key}: sources must be an array`);
    for (const source of item.sources || []) {
      try { if (new URL(source.url).protocol !== 'https:' || !source.label) failures.push(`${key}: invalid source`); }
      catch { failures.push(`${key}: invalid source URL`); }
    }
  }
}
const money = disciplines.find((discipline) => discipline.id === 'money');
if (!money?.disclaimer || !/not financial, investment, tax or legal advice/i.test(money.disclaimer)) failures.push('money discipline must include an NFA disclaimer');
if (!disciplines.some((discipline) => discipline.id === 'hidden-systems')) failures.push('Hidden Systems discipline is missing');
if (!disciplines.find((discipline) => discipline.id === 'money')?.items.some((item) => item.id === 'money-need-use-cost-alternative')) failures.push('the four-question spending pause is missing');

if (failures.length) {
  console.error(`Discipline validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Discipline validation passed: ${disciplines.length} disciplines, ${itemIds.size} starter discoveries, all required fields and source URLs valid.`);
}
