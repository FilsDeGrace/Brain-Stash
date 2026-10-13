/** Request validation, prompt building and output parsing for api/teach.js. No I/O here. */
export const KINDS = ['lesson', 'diagnose'];
export const MAX_BODY_CHARS = 9000;

const CARD_CAPS = { id: 80, title: 120, category: 80, summary: 1200, example: 1200, whyItMatters: 1200 };
const QUIZ_CAPS = { prompt: 800, label: 300, id: 10 };

const text = (value, max) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null);

/** Returns { ok: true, value } or { ok: false }. Never throws. */
export function parseTeachRequest(body) {
  try {
    if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY_CHARS) return { ok: false };
    if (!KINDS.includes(body.kind)) return { ok: false };
    const rawCard = body.card;
    if (!rawCard || typeof rawCard !== 'object') return { ok: false };
    const card = {};
    for (const [field, max] of Object.entries(CARD_CAPS)) {
      const value = text(rawCard[field], max);
      if (value === null) return { ok: false };
      card[field] = value;
    }
    if (body.kind === 'lesson') return { ok: true, value: { kind: 'lesson', card } };

    const rawQuiz = body.quiz;
    if (!rawQuiz || !Array.isArray(rawQuiz.options) || rawQuiz.options.length < 2 || rawQuiz.options.length > 6) return { ok: false };
    const prompt = text(rawQuiz.prompt, QUIZ_CAPS.prompt);
    if (prompt === null) return { ok: false };
    const options = [];
    for (const option of rawQuiz.options) {
      const id = text(option?.id, QUIZ_CAPS.id);
      const label = text(option?.label, QUIZ_CAPS.label);
      if (id === null || label === null) return { ok: false };
      options.push({ id, label });
    }
    const correctId = text(rawQuiz.correctId, QUIZ_CAPS.id);
    const selectedId = text(body.selectedId, QUIZ_CAPS.id);
    if (!options.some((o) => o.id === correctId) || !options.some((o) => o.id === selectedId) || selectedId === correctId) return { ok: false };
    return { ok: true, value: { kind: 'diagnose', card, quiz: { prompt, options, correctId }, selectedId } };
  } catch {
    return { ok: false };
  }
}

const SYSTEM = [
  'You are a patient tutor inside a thinking-skills app for adults.',
  'Use plain, concrete language and short sentences.',
  'Stay with the idea in the card. Do not invent studies, statistics, quotations or named experts.',
  'If you are unsure of a detail, leave it out.',
  'Reply with one JSON object using exactly the keys requested. No markdown, no code fences, no extra text.',
].join(' ');

/** @returns {{role:string, content:string}[]} */
export function buildMessages(value) {
  const { card } = value;
  const cardBlock = `CARD\nTitle: ${card.title}\nCategory: ${card.category}\nSummary: ${card.summary}\nExample: ${card.example}\nWhy it matters: ${card.whyItMatters}`;
  if (value.kind === 'lesson') {
    return [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `${cardBlock}\n\nTeach this idea to someone meeting it for the first time. Return JSON with these keys:\n"plain": 2 to 3 sentences explaining the idea in everyday words.\n"spot": an array of 3 short signs that this idea is at work in real life.\n"example": a new everyday example that is different from the card's example, in 2 to 3 sentences.\n"mistake": the most common way people misuse or misread this idea, in 1 to 2 sentences.` },
    ];
  }
  const label = (id) => value.quiz.options.find((o) => o.id === id)?.label ?? '';
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `${cardBlock}\n\nQUESTION: ${value.quiz.prompt}\nCORRECT ANSWER: ${label(value.quiz.correctId)}\nLEARNER CHOSE: ${label(value.selectedId)}\n\nThe learner chose a wrong answer. Return JSON with these keys:\n"why": 2 sentences on why that answer is tempting and what it gets wrong.\n"check": 1 sentence giving a question to ask next time to avoid this slip.` },
  ];
}

/** Pulls the first JSON object out of a model reply, tolerating code fences. */
export function extractJson(reply) {
  if (typeof reply !== 'string') return null;
  const stripped = reply.replace(/```(?:json)?/gi, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}
