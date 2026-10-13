import { hashSeed } from './mathEngine.js';
import { normalizeTeaching } from './teachShape.js';

const ENDPOINT = '/api/teach';
const TIMEOUT_MS = 25000;

/** Codes: offline, busy, unavailable, cancelled. */
export class TeachError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const cardPayload = (card) => ({ id: card.id, title: card.title, category: card.category, summary: card.summary, example: card.example, whyItMatters: card.whyItMatters });

/** Cache keys include a content signature so edited cards never show an old walkthrough. */
export const lessonKey = (card) => `lesson:${card.id}:${hashSeed(`${card.summary}|${card.example}|${card.whyItMatters}`)}`;
export const diagnoseKey = (card, selectedId) => `diagnose:${card.id}:${selectedId}:${hashSeed(`${card.quiz.prompt}|${card.quiz.options.map((o) => o.label).join('|')}`)}`;

export const buildLessonRequest = (card) => ({ kind: 'lesson', card: cardPayload(card) });
export const buildDiagnoseRequest = (card, selectedId) => ({
  kind: 'diagnose',
  card: cardPayload(card),
  quiz: { prompt: card.quiz.prompt, options: card.quiz.options.map((o) => ({ id: o.id, label: o.label })), correctId: card.quiz.correctId },
  selectedId,
});

/** Calls the serverless function and returns validated teaching content. */
export async function requestTeaching(body, { signal } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (response.status === 429) throw new TeachError('busy');
    if (!response.ok) throw new TeachError('unavailable');
    const payload = await response.json();
    const data = payload?.kind === body.kind ? normalizeTeaching(body.kind, payload.data) : null;
    if (!data) throw new TeachError('unavailable');
    return data;
  } catch (error) {
    if (error instanceof TeachError) throw error;
    if (signal?.aborted) throw new TeachError('cancelled');
    throw new TeachError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
