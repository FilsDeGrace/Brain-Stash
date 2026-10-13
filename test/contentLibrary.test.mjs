import test from 'node:test';
import assert from 'node:assert/strict';
import disciplines from '../src/content/disciplines.js';
import {
  chooseCronDiscipline,
  extractJson,
  generateAndStoreCandidate,
  isValidDisciplineId,
  normaliseCandidate,
  normaliseTitle,
  reviewLibraryItem,
  toDatabaseErrorCode,
  safeSecretMatch,
  sameOrigin,
} from '../server/libraryCore.js';

const validDraft = {
  title: 'Feedback loops in everyday decisions',
  kind: 'concept',
  category: 'Systems thinking',
  summary: 'A feedback loop occurs when the result of an action influences what happens next. This can reinforce a trend or counteract it.',
  explanation: 'Feedback loops appear when a change affects a system in a way that changes future behaviour. Reinforcing loops amplify movement, while balancing loops push a system toward a limit or target. Real systems can contain both, so the direction and delay of the feedback matter.',
  example: 'A post that gets early engagement may be shown to more people, creating more engagement and further distribution. A platform might also introduce limits that slow the loop.',
  whyItMatters: 'Thinking in loops helps explain why small changes can snowball and why interventions sometimes produce delayed or unexpected effects.',
  tryThis: 'Draw the main steps in a process and connect each result to any action it changes next.',
  question: 'What makes a loop a feedback loop?',
  answer: 'The output of a process affects future input or behaviour in the same system.',
  sources: [{ label: 'Systems overview', url: 'https://www.nasa.gov/' }],
};

test('seven new knowledge disciplines are present and have distinct IDs', () => {
  assert.equal(disciplines.length, 7);
  assert.equal(new Set(disciplines.map((entry) => entry.id)).size, 7);
  for (const id of ['psychology', 'influence', 'scale', 'principles', 'practical', 'hidden-systems', 'money']) assert.ok(isValidDisciplineId(id), id);
});

test('candidate validation normalises and limits a valid draft', () => {
  const candidate = normaliseCandidate(validDraft, 'hidden-systems', new Date('2026-10-13T00:00:00Z'));
  assert.ok(candidate);
  assert.match(candidate.id, /^ai-[a-f0-9]{24}$/);
  assert.equal(candidate.disciplineId, 'hidden-systems');
  assert.equal(candidate.status, 'pending');
  assert.equal(candidate.sources[0].url, 'https://www.nasa.gov/');
  assert.equal(candidate.createdAt, '2026-10-13T00:00:00.000Z');
  const moneyCandidate = normaliseCandidate(validDraft, 'money', new Date('2026-10-13T00:00:00Z'));
  assert.match(moneyCandidate.disclaimer, /not financial, investment, tax or legal advice/i);
});

test('candidate validator rejects malformed or too-short AI output', () => {
  assert.equal(normaliseCandidate(null, 'money'), null);
  assert.equal(normaliseCandidate({ ...validDraft, summary: 'tiny' }, 'money'), null);
  assert.equal(normaliseCandidate(validDraft, 'not-a-discipline'), null);
  assert.deepEqual(normaliseCandidate({ ...validDraft, sources: [{ label: 'not secure', url: 'http://example.com' }] }, 'money').sources, []);
});

test('title normalisation catches superficial duplicate variants', () => {
  assert.equal(normaliseTitle(' Goodhart’s Law! '), normaliseTitle('goodharts law'));
});

test('JSON extraction tolerates code fences but rejects malformed data', () => {
  assert.deepEqual(extractJson('```json\n{"title":"Test"}\n```'), { title: 'Test' });
  assert.equal(extractJson('not json'), null);
  assert.equal(extractJson('x'.repeat(30000)), null);
});

test('same-origin guard rejects a foreign website', () => {
  assert.equal(sameOrigin({ headers: { origin: 'https://brainstash.example', host: 'brainstash.example' } }), true);
  assert.equal(sameOrigin({ headers: { origin: 'https://evil.example', host: 'brainstash.example' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'brainstash.example' } }), true);
});

test('admin token comparison requires an exact non-empty match', () => {
  assert.equal(safeSecretMatch('secure-token', 'secure-token'), true);
  assert.equal(safeSecretMatch('secure-token', 'secure-tokeN'), false);
  assert.equal(safeSecretMatch('', ''), false);
});

test('daily generator rotates through the seven disciplines', () => {
  const start = new Date('2026-10-12T12:00:00Z');
  const ids = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start.getTime() + offset * 86400000);
    return chooseCronDiscipline(date);
  });
  assert.equal(new Set(ids).size, 7);
});


function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

async function withLibraryEnvironment(run, fetchMock) {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'QUOTA_SALT', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODELS'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const beforeFetch = globalThis.fetch;
  Object.assign(process.env, {
    SUPABASE_URL: 'https://brain-stash-test.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test_secret_key',
    QUOTA_SALT: 'test-quota-salt',
    AI_API_KEY: 'test-ai-key',
    AI_BASE_URL: 'https://ai.example.test/v1',
    AI_MODELS: 'test-model',
  });
  globalThis.fetch = fetchMock;
  try { return await run(); }
  finally {
    globalThis.fetch = beforeFetch;
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

test('generation rejects a duplicate of a bundled starter instead of pretending it is new', async () => {
  const calls = [];
  const modelReply = { ...validDraft, title: 'The Spotlight Effect' };
  await withLibraryEnvironment(async () => {
    await assert.rejects(
      generateAndStoreCandidate('psychology', { actorHash: 'actor:test', actorLimit: 3, globalLimit: 20 }),
      /duplicate_bundled/,
    );
  }, async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || 'GET', headers: init.headers });
    if (url.pathname.endsWith('/rpc/consume_brain_stash_quota')) return jsonResponse(true);
    if (url.pathname.endsWith('/rest/v1/brain_stash_items') && url.searchParams.get('select') === 'title') return jsonResponse([]);
    if (url.pathname.endsWith('/chat/completions')) return jsonResponse({ choices: [{ message: { content: JSON.stringify(modelReply) } }] });
    throw new Error(`Unexpected mocked request: ${url.pathname}${url.search}`);
  });
  assert.equal(calls.some((call) => call.method === 'POST' && call.url.pathname.endsWith('/rest/v1/brain_stash_items')), false);
  assert.equal(calls[0].headers.apikey, 'sb_secret_test_secret_key');
  assert.equal(calls[0].headers.Authorization, undefined, 'Supabase secret keys must not be sent as bearer JWTs');
});

test('generation never returns a previously rejected draft to a user', async () => {
  const modelReply = { ...validDraft, title: 'A novel policy feedback mechanism' };
  const rejected = {
    id: 'ai-1234567890abcdef12345678', discipline_id: 'hidden-systems', title: modelReply.title,
    content: { ...modelReply, disciplineId: 'hidden-systems', id: 'ai-1234567890abcdef12345678' },
    status: 'rejected', source: 'ai', created_at: '2026-10-12T10:00:00Z',
  };
  await withLibraryEnvironment(async () => {
    await assert.rejects(
      generateAndStoreCandidate('hidden-systems', { actorHash: 'actor:test', actorLimit: 3, globalLimit: 20 }),
      /duplicate_rejected/,
    );
  }, async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/rpc/consume_brain_stash_quota')) return jsonResponse(true);
    if (url.pathname.endsWith('/rest/v1/brain_stash_items') && url.searchParams.get('select') === 'title') return jsonResponse([]);
    if (url.pathname.endsWith('/chat/completions')) return jsonResponse({ choices: [{ message: { content: JSON.stringify(modelReply) } }] });
    if (url.pathname.endsWith('/rest/v1/brain_stash_items') && url.searchParams.has('normalized_title')) return jsonResponse([rejected]);
    throw new Error(`Unexpected mocked request: ${url.pathname}${url.search}`);
  });
});


test('generation does not leak another users pending draft through duplicate resolution', async () => {
  const modelReply = { ...validDraft, title: 'A novel policy feedback mechanism' };
  const pending = {
    id: 'ai-1234567890abcdef12345678', discipline_id: 'hidden-systems', title: modelReply.title,
    content: { ...modelReply, disciplineId: 'hidden-systems', id: 'ai-1234567890abcdef12345678' },
    status: 'pending', source: 'ai', created_at: '2026-10-12T10:00:00Z',
  };
  await withLibraryEnvironment(async () => {
    await assert.rejects(
      generateAndStoreCandidate('hidden-systems', { actorHash: 'actor:test', actorLimit: 3, globalLimit: 20 }),
      /duplicate_pending/,
    );
  }, async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/rpc/consume_brain_stash_quota')) return jsonResponse(true);
    if (url.pathname.endsWith('/rest/v1/brain_stash_items') && url.searchParams.get('select') === 'title') return jsonResponse([]);
    if (url.pathname.endsWith('/chat/completions')) return jsonResponse({ choices: [{ message: { content: JSON.stringify(modelReply) } }] });
    if (url.pathname.endsWith('/rest/v1/brain_stash_items') && url.searchParams.has('normalized_title')) return jsonResponse([pending]);
    throw new Error(`Unexpected mocked request: ${url.pathname}${url.search}`);
  });
});


test('review decisions are atomic and retries resolve the stored final state', async () => {
  const id = 'ai-1234567890abcdef12345678';
  const reviewedRow = {
    id, discipline_id: 'psychology', title: 'The Mere-Exposure Effect',
    content: { id, disciplineId: 'psychology', title: 'The Mere-Exposure Effect', summary: 'A sufficiently long summary of this example review item.', status: 'approved' },
    status: 'approved', source: 'ai', created_at: '2026-10-13T12:00:00Z',
  };
  const calls = [];
  await withLibraryEnvironment(async () => {
    const result = await reviewLibraryItem(id, 'approved');
    assert.equal(result.item.status, 'approved');
    assert.equal(result.alreadyApplied, true);
  }, async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if ((init.method || 'GET') === 'PATCH') return jsonResponse([]);
    if ((init.method || 'GET') === 'GET') return jsonResponse([reviewedRow]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url.searchParams.get('status'), 'eq.pending', 'only pending drafts can transition');
  assert.equal(calls[1].method, 'GET', 'a retry checks the actual persisted state');
});

test('review cannot overwrite a decision that already reached the opposite terminal state', async () => {
  const id = 'ai-1234567890abcdef12345678';
  const rejectedRow = {
    id, discipline_id: 'psychology', title: 'The Mere-Exposure Effect',
    content: { id, disciplineId: 'psychology', title: 'The Mere-Exposure Effect' },
    status: 'rejected', source: 'ai', created_at: '2026-10-13T12:00:00Z',
  };
  await withLibraryEnvironment(async () => {
    await assert.rejects(reviewLibraryItem(id, 'approved'), /already_reviewed/);
  }, async (input, init = {}) => {
    if ((init.method || 'GET') === 'PATCH') return jsonResponse([]);
    return jsonResponse([rejectedRow]);
  });
});

test('review reports a missing row instead of leaving an ambiguous result', async () => {
  const id = 'ai-1234567890abcdef12345678';
  await withLibraryEnvironment(async () => {
    await assert.rejects(reviewLibraryItem(id, 'approved'), /not_found/);
  }, async (input, init = {}) => {
    if ((init.method || 'GET') === 'PATCH') return jsonResponse([]);
    return jsonResponse([]);
  });
});

test('database permission errors get a distinct safe diagnostic code', () => {
  assert.equal(toDatabaseErrorCode(Object.assign(new Error('database_http_403'), { status: 403 })), 'database_permissions');
  assert.equal(toDatabaseErrorCode(Object.assign(new Error('database_http_400'), { status: 400 })), 'database_schema_error');
  assert.equal(toDatabaseErrorCode(Object.assign(new Error('database_http_503'), { status: 503 })), 'database_unavailable');
});
