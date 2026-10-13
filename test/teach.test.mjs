import assert from 'node:assert/strict';
import handler from '../api/teach.js';
import { buildMessages, extractJson, parseTeachRequest } from '../server/teachCore.js';
import { normalizeDiagnosis, normalizeLesson } from '../src/engine/teachShape.js';
import { readFileSync } from 'node:fs';

const stash = JSON.parse(readFileSync(new URL('../src/content/stash.json', import.meta.url), 'utf8'));

const card = stash[0];
const lessonBody = { kind: 'lesson', card: { id: card.id, title: card.title, category: card.category, summary: card.summary, example: card.example, whyItMatters: card.whyItMatters } };
const diagnoseBody = { kind: 'diagnose', card: lessonBody.card, quiz: { prompt: card.quiz.prompt, options: card.quiz.options, correctId: card.quiz.correctId }, selectedId: card.quiz.options.find((o) => o.id !== card.quiz.correctId).id };

// ---- Pure parsing
assert.equal(parseTeachRequest(lessonBody).ok, true, 'a real stash card is accepted');
assert.ok(stash.every((c) => parseTeachRequest({ kind: 'lesson', card: { id: c.id, title: c.title, category: c.category, summary: c.summary, example: c.example, whyItMatters: c.whyItMatters } }).ok), 'every card in the deck passes the length caps');
assert.ok(stash.every((c) => parseTeachRequest({ kind: 'diagnose', card: lessonBody.card, quiz: { prompt: c.quiz.prompt, options: c.quiz.options, correctId: c.quiz.correctId }, selectedId: c.quiz.options.find((o) => o.id !== c.quiz.correctId).id }).ok), 'every quiz passes the length caps');
assert.equal(parseTeachRequest(null).ok, false);
assert.equal(parseTeachRequest({ ...lessonBody, kind: 'chat' }).ok, false, 'unknown kinds are rejected');
assert.equal(parseTeachRequest({ ...lessonBody, card: { ...lessonBody.card, summary: 'x'.repeat(5000) } }).ok, false, 'oversized fields are rejected');
assert.equal(parseTeachRequest({ ...diagnoseBody, selectedId: diagnoseBody.quiz.correctId }).ok, false, 'diagnosing a correct answer is rejected');
assert.equal(parseTeachRequest({ ...diagnoseBody, selectedId: 'zz' }).ok, false, 'an unknown selected option is rejected');
assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 }, 'a preface before a fenced block is tolerated');
assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
assert.equal(extractJson('no json here'), null);
assert.equal(extractJson('{broken'), null);
assert.equal(buildMessages(parseTeachRequest(lessonBody).value)[1].content.includes(card.title), true);
assert.equal(normalizeLesson({ plain: 'a', spot: ['one'], example: 'b', mistake: 'c' }), null, 'a lesson needs at least two spot items');
assert.equal(normalizeDiagnosis({ why: 'x' }), null);

// ---- Handler with a mocked upstream
const goodLesson = { plain: 'It means working backwards from failure.', spot: ['You list risks first', 'You ask what could go wrong'], example: 'A cook plans around what would ruin the meal.', mistake: 'Treating it as pessimism instead of planning.' };
const goodDiagnosis = { why: 'It sounds sensible but copies someone else.', check: 'Ask what would make this fail.' };
const realFetch = globalThis.fetch;
let calls = [];
function mockFetch(responder) { globalThis.fetch = async (url, init) => { calls.push({ url, init }); return responder(url, init); }; }
const upstreamOk = (obj) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }) });
function makeRes() {
  const res = { headers: {}, statusCode: 0, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}
let ipCounter = 0;
const request = (over = {}) => ({ method: 'POST', headers: { host: 'app.example', 'x-forwarded-for': `10.0.0.${++ipCounter}` }, body: lessonBody, socket: {}, ...over });

process.env.AI_API_KEY = 'SECRET-KEY-123';
process.env.AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
delete process.env.AI_MODELS;
process.env.AI_MODEL = 'test-model';

// lesson
mockFetch(() => upstreamOk(goodLesson));
let res = makeRes(); await handler(request(), res);
assert.equal(res.statusCode, 200); assert.equal(res.body.kind, 'lesson'); assert.deepEqual(res.body.data, goodLesson);
assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'trailing slash on the base URL is handled');
assert.equal(calls[0].init.headers.Authorization, 'Bearer SECRET-KEY-123');
assert.equal(JSON.parse(calls[0].init.body).model, 'test-model');
assert.equal(res.headers['Cache-Control'], 'no-store');

// AI_MODELS accepts a comma-separated list and falls back when the first model fails.
const triedModels = [];
delete process.env.AI_MODEL;
process.env.AI_MODELS = 'gemini-2.5-flash, gemini-2.5-flash-lite';
mockFetch((_url, init) => {
  const model = JSON.parse(init.body).model;
  triedModels.push(model);
  return model === 'gemini-2.5-flash'
    ? ({ ok: false, status: 404, json: async () => ({}) })
    : upstreamOk(goodLesson);
});
res = makeRes(); await handler(request(), res);
assert.equal(res.statusCode, 200, 'a fallback model can satisfy the request');
assert.deepEqual(triedModels, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
delete process.env.AI_MODELS;
process.env.AI_MODEL = 'test-model';

// diagnose
mockFetch(() => upstreamOk(goodDiagnosis));
res = makeRes(); await handler(request({ body: diagnoseBody }), res);
assert.equal(res.statusCode, 200); assert.deepEqual(res.body.data, goodDiagnosis);

// string body (some runtimes do not pre-parse)
res = makeRes(); await handler(request({ body: JSON.stringify(diagnoseBody) }), res);
assert.equal(res.statusCode, 200, 'a JSON string body is parsed');

// method / origin / validation
mockFetch(() => upstreamOk(goodLesson));
res = makeRes(); await handler(request({ method: 'GET' }), res); assert.equal(res.statusCode, 405);
res = makeRes(); await handler(request({ headers: { host: 'app.example', origin: 'https://evil.example', 'x-forwarded-for': '9.9.9.9' } }), res); assert.equal(res.statusCode, 403, 'cross-origin calls are refused');
res = makeRes(); await handler(request({ headers: { host: 'app.example', origin: 'https://app.example', 'x-forwarded-for': '9.9.9.8' } }), res); assert.equal(res.statusCode, 200, 'same-origin calls are allowed');
res = makeRes(); await handler(request({ body: { kind: 'lesson' } }), res); assert.equal(res.statusCode, 400);

// model output problems
mockFetch(() => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'I cannot do that.' } }] }) }));
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 502); assert.equal(res.body.error, 'bad_output');
mockFetch(() => upstreamOk({ plain: 'only one field' }));
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 502, 'incomplete lessons are not passed to the app');

// upstream failures never leak the key or upstream text
mockFetch(() => ({ ok: false, status: 500, json: async () => ({ error: 'SECRET-KEY-123 leaked' }) }));
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 502); assert.equal(JSON.stringify(res.body).includes('SECRET'), false);
mockFetch(() => ({ ok: false, status: 429, json: async () => ({}) }));
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 429);
mockFetch(() => { throw new Error('network down SECRET-KEY-123'); });
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 502); assert.equal(JSON.stringify(res.body).includes('SECRET'), false);

// rate limit (per IP)
mockFetch(() => upstreamOk(goodLesson));
const sameIp = { method: 'POST', headers: { host: 'app.example', 'x-forwarded-for': '7.7.7.7' }, body: lessonBody, socket: {} };
let last; for (let i = 0; i < 21; i += 1) { last = makeRes(); await handler(sameIp, last); }
assert.equal(last.statusCode, 429, 'the 21st call in the window is limited');
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 200, 'a different IP is unaffected');

// missing configuration
delete process.env.AI_API_KEY;
res = makeRes(); await handler(request(), res); assert.equal(res.statusCode, 503, 'no key means the feature reports unavailable');

globalThis.fetch = realFetch;
console.log('AI teaching checks passed.');
