import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ask.js';
import { answerTopicQuestion, normalizeAskQuestion, parseAskRequest } from '../server/libraryCore.js';
import { suggestedQuestions } from '../src/engine/askClient.js';

const topicRequest = {
  disciplineId: 'influence',
  topic: {
    id: 'influence-foot-in-door',
    title: 'The Foot-in-the-Door Technique',
    category: 'Compliance',
    summary: 'A small initial request may make a later, larger request feel more consistent with the first choice.',
    explanation: 'The technique describes how accepting a small request can make a later request feel more consistent with the person’s earlier decision. It is context-dependent and never creates an obligation to agree again.',
    example: 'Someone agrees to share a survey and is then asked to join a much larger unpaid project.',
  },
  question: 'Can you explain this idea in simpler words?',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
function makeRes() {
  const res = { headers: {}, statusCode: 0, body: null };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const keyNames = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'QUOTA_SALT', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODELS', 'AI_MODEL'];
const previousEnv = Object.fromEntries(keyNames.map((key) => [key, process.env[key]]));
const realFetch = globalThis.fetch;
before(() => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://brain-stash-test.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test_secret_key',
    QUOTA_SALT: 'test-quota-salt',
    AI_API_KEY: 'test-ai-key',
    AI_BASE_URL: 'https://ai.example.test/v1',
    AI_MODELS: 'test-model',
  });
});
after(() => {
  globalThis.fetch = realFetch;
  for (const key of keyNames) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

  test('question normalisation reuses case and punctuation variants', () => {
    assert.equal(normalizeAskQuestion('Can you explain this idea?'), normalizeAskQuestion(' can YOU explain this idea! '));
  });

  test('suggested follow-ups fit the current discipline', () => {
    assert.match(suggestedQuestions('influence')[1].question, /recognise or respond/);
    assert.match(suggestedQuestions('money')[0].question, /numbers/);
    assert.match(suggestedQuestions('court')[0].question, /ruling/);
    assert.match(suggestedQuestions('hidden-systems')[0].question, /incentives/);
    assert.equal(suggestedQuestions('influence').length, 3);
  });

  test('ask payload requires known category and useful topic context', () => {
    assert.ok(parseAskRequest(topicRequest));
    assert.equal(parseAskRequest({ ...topicRequest, disciplineId: 'not-a-category' }), null);
    assert.equal(parseAskRequest({ ...topicRequest, topic: { id: 'x', title: 'x' } }), null);
  });

  test('ask endpoint refuses a made-up topic even when its category is valid', async () => {
    const beforeFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (input) => {
      calls += 1;
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rest/v1/brain_stash_items')) return jsonResponse([]);
      throw new Error('Unexpected network request');
    };
    try {
      await assert.rejects(answerTopicQuestion({
        ...topicRequest,
        topic: { id: 'invented-topic', title: 'Made-up topic', summary: 'Enough context to pass basic input checks.', explanation: 'This should not be trusted.', details: 'Forged context.' },
      }, { actorHash: 'actor:test' }), /topic_unavailable/);
      assert.equal(calls, 1, 'unknown topics may be checked against the shared library but must not reach quota or Gemini');
    } finally {
      globalThis.fetch = beforeFetch;
    }
  });

  test('public cache rejects obvious personal contact details and secrets', () => {
    assert.throws(() => parseAskRequest({ ...topicRequest, question: 'Can you email me at name@example.com about this?' }), /question_private_info/);
    assert.throws(() => parseAskRequest({ ...topicRequest, question: 'My API key is abc123 please test it' }), /question_private_info/);
  });

  test('Q&A resolves authored topics across the disciplines before calling Gemini', async () => {
    const cases = [
      ['psychology', 'psych-spotlight-effect'],
      ['influence', 'influence-foot-in-door'],
      ['scale', 'scale-chess-shannon-number'],
      ['principles', 'inversion'],
      ['practical', 'practical-spend-pause'],
      ['hidden-systems', 'systems-principal-agent'],
      ['money', 'money-need-use-cost-alternative'],
      ['maths', 'lesson-mul5'],
      ['court', 'court-t1-b2-01'],
      ['rebus', 'tricycle'],
      ['traps', 'survivorship'],
      ['fallacies', 'fallacy-t1-b1-01'],
    ];
    let aiCalls = 0;
    const saved = new Map();
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      if (url.pathname.endsWith('/rest/v1/brain_stash_qa_cache') && method === 'GET') {
        const key = [url.searchParams.get('discipline_id'), url.searchParams.get('topic_id'), url.searchParams.get('normalized_question')].join('|');
        return jsonResponse(saved.has(key) ? [saved.get(key)] : []);
      }
      if (url.pathname.endsWith('/rpc/consume_brain_stash_question_quota')) return jsonResponse(true);
      if (url.pathname.endsWith('/chat/completions')) {
        aiCalls += 1;
        const prompt = JSON.parse(init.body).messages.map((entry) => entry.content).join('\n');
        assert.doesNotMatch(prompt, /Browser-supplied spoof context/);
        assert.doesNotMatch(prompt, /Spoofed topic title/);
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ answer: 'This is a grounded explanation with enough detail to help the reader understand the topic and its limits.' }) } }] });
      }
      if (url.pathname.endsWith('/rest/v1/brain_stash_qa_cache') && method === 'POST') {
        const row = { ...JSON.parse(init.body), created_at: '2026-10-13T10:00:00Z' };
        const key = [row.discipline_id, row.topic_id, row.normalized_question].join('|');
        saved.set(key, row);
        return jsonResponse([row], 201);
      }
      throw new Error(`Unexpected test request: ${method} ${url.pathname}`);
    };
    for (const [disciplineId, topicId] of cases) {
      await answerTopicQuestion({
        disciplineId,
        topic: { id: topicId, title: 'Spoofed topic title', summary: 'Browser-supplied spoof context long enough to pass basic validation.', explanation: 'Browser-supplied spoof context', details: 'Browser-supplied spoof context' },
        question: 'Explain this topic in simple words please.',
      }, { actorHash: `actor:${disciplineId}`, actorLimit: 2, globalLimit: 40 });
    }
    assert.equal(aiCalls, cases.length, 'every listed built-in topic should resolve from trusted server content');
  });

  test('first answer is generated and saved; a matching question reuses the shared answer', async () => {
    const calls = [];
    let storedRow = null;
    let quotaCalls = 0;
    let aiCalls = 0;
    let aiRequestBody = null;
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      calls.push({ path: url.pathname, method });
      if (url.pathname.endsWith('/rest/v1/brain_stash_qa_cache') && method === 'GET') {
        if (storedRow && url.searchParams.get('normalized_question') === `eq.${normalizeAskQuestion(topicRequest.question)}`) return jsonResponse([storedRow]);
        return jsonResponse([]);
      }
      if (url.pathname.endsWith('/rpc/consume_brain_stash_question_quota')) {
        quotaCalls += 1;
        return jsonResponse(true);
      }
      if (url.pathname.endsWith('/chat/completions')) {
        aiCalls += 1;
        aiRequestBody = JSON.parse(init.body);
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ answer: 'In simple terms, one small yes can make a later request feel familiar or consistent. But you can still judge the new request on its own costs and terms.' }) } }] });
      }
      if (url.pathname.endsWith('/rest/v1/brain_stash_qa_cache') && method === 'POST') {
        storedRow = { ...JSON.parse(init.body), created_at: '2026-10-13T10:00:00Z' };
        return jsonResponse([storedRow], 201);
      }
      throw new Error(`Unexpected test request: ${method} ${url.pathname}`);
    };

    const first = await answerTopicQuestion(topicRequest, { actorHash: 'actor:test', actorLimit: 2, globalLimit: 40 });
    assert.equal(first.cached, false);
    assert.match(first.answer, /small yes/);
    assert.equal(aiCalls, 1);
    assert.equal(quotaCalls, 1);
    const sentPrompt = aiRequestBody.messages.map((message) => message.content).join('\n');
    assert.match(sentPrompt, /A small initial commitment may change how a person sees their own willingness/);
    assert.doesNotMatch(sentPrompt, /Someone agrees to share a survey/);

    const second = await answerTopicQuestion(topicRequest, { actorHash: 'actor:another-reader', actorLimit: 2, globalLimit: 40 });
    assert.equal(second.cached, true);
    assert.equal(second.answer, first.answer);
    assert.equal(aiCalls, 1, 'matching questions do not call the AI again');
    assert.equal(quotaCalls, 1, 'cached answers do not consume AI-generation quota');
  });

  test('question quota blocks new AI answers when the database declines the quota', async () => {
    const calls = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.pathname.endsWith('/rest/v1/brain_stash_qa_cache')) return jsonResponse([]);
      if (url.pathname.endsWith('/rpc/consume_brain_stash_question_quota')) return jsonResponse(false);
      throw new Error(`This request should not happen: ${url.pathname}`);
    };
    await assert.rejects(answerTopicQuestion(topicRequest, { actorHash: 'actor:test', actorLimit: 2, globalLimit: 40 }), /quota_exhausted/);
    assert.equal(calls.some((path) => path.endsWith('/chat/completions')), false);
  });

  test('ask endpoint validates method, origin and returns only safe error codes', async () => {
    globalThis.fetch = realFetch;
    const getRes = makeRes();
    await handler({ method: 'GET', headers: { host: 'app.example' }, url: '/api/ask' }, getRes);
    assert.equal(getRes.statusCode, 405);
    const originRes = makeRes();
    await handler({ method: 'POST', headers: { host: 'app.example', origin: 'https://evil.example' }, body: topicRequest }, originRes);
    assert.equal(originRes.statusCode, 403);
    const privateRes = makeRes();
    await handler({ method: 'POST', headers: { host: 'app.example', origin: 'https://app.example' }, body: { ...topicRequest, question: 'My password is test-123 please explain this' } }, privateRes);
    assert.equal(privateRes.statusCode, 400);
    assert.equal(privateRes.body.error, 'question_private_info');
  });
