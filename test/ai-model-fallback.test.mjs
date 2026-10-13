import assert from 'node:assert/strict';
import handler from '../api/teach.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL: process.env.AI_BASE_URL,
  AI_MODEL: process.env.AI_MODEL,
  AI_MODELS: process.env.AI_MODELS,
};
const lessonBody = {
  kind: 'lesson',
  card: {
    id: 'test-card', title: 'Inversion', category: 'Reasoning',
    summary: 'Consider what would make an outcome fail.',
    example: 'A team lists ways a launch could go wrong.',
    whyItMatters: 'It reveals avoidable failure points before they happen.',
  },
};
const goodLesson = {
  plain: 'Start by considering what could make the result fail.',
  spot: ['List the failure modes first.', 'Ask what could invalidate the plan.'],
  example: 'A shop checks what might spoil its stock before ordering.',
  mistake: 'It is planning, not assuming failure is inevitable.',
};
function res() {
  return {
    headers: {}, statusCode: 0, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

try {
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_BASE_URL = 'https://example.test/v1/';
  delete process.env.AI_MODEL;
  process.env.AI_MODELS = 'gemini-2.5-flash, gemini-2.5-flash-lite';
  const models = [];
  globalThis.fetch = async (_url, init) => {
    const model = JSON.parse(init.body).model;
    models.push(model);
    if (model === 'gemini-2.5-flash') return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(goodLesson) } }] }) };
  };
  const response = res();
  await handler({ method: 'POST', headers: { host: 'app.example', 'x-forwarded-for': '192.0.2.1' }, body: lessonBody, socket: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(models, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(response.body.data, goodLesson);

  process.env.AI_MODELS = 'gemini-2.5-flash-lite';
  globalThis.fetch = async (_url, init) => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(goodLesson) } }] }),
  });
  const single = res();
  await handler({ method: 'POST', headers: { host: 'app.example', 'x-forwarded-for': '192.0.2.2' }, body: lessonBody, socket: {} }, single);
  assert.equal(single.statusCode, 200, 'a one-item AI_MODELS value works too');
  console.log('AI_MODELS parsing and fallback checks passed.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
