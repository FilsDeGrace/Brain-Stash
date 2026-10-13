import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import disciplines, { DISCIPLINE_IDS } from '../src/content/disciplines.js';

const disciplineById = new Map(disciplines.map((discipline) => [discipline.id, discipline]));
const VALID_KINDS = new Set(['concept', 'fact', 'scale-fact', 'bias', 'warning-sign', 'technique', 'principle', 'mental-model', 'method', 'checklist', 'framework']);
const MAX_RESPONSE_CHARS = 11000;

export function isValidDisciplineId(value) {
  return typeof value === 'string' && DISCIPLINE_IDS.includes(value);
}

export function normaliseTitle(value) {
  return String(value || '').normalize('NFKD').toLocaleLowerCase('en').replace(/[’‘'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function safeText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function cleanSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((source) => {
    const label = safeText(source?.label, 140);
    const rawUrl = safeText(source?.url, 500);
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' || !label) return null;
      return { label, url: url.toString() };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function extractJson(reply) {
  if (typeof reply !== 'string' || reply.length > MAX_RESPONSE_CHARS * 2) return null;
  const stripped = reply.replace(/```(?:json)?/gi, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start || end - start > MAX_RESPONSE_CHARS) return null;
  try { return JSON.parse(stripped.slice(start, end + 1)); } catch { return null; }
}

export function normaliseCandidate(raw, disciplineId, now = new Date()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !isValidDisciplineId(disciplineId)) return null;
  const title = safeText(raw.title, 120);
  const summary = safeText(raw.summary, 650);
  const explanation = safeText(raw.explanation, 2200);
  const example = safeText(raw.example, 1500);
  const whyItMatters = safeText(raw.whyItMatters, 1200);
  const tryThis = safeText(raw.tryThis, 1200);
  const question = safeText(raw.question, 420);
  const answer = safeText(raw.answer, 650);
  const normalizedTitle = normaliseTitle(title);
  if (title.length < 5 || normalizedTitle.length < 5 || summary.length < 25 || explanation.length < 80 || example.length < 20 || whyItMatters.length < 25 || tryThis.length < 10 || question.length < 10 || answer.length < 5) return null;
  const discipline = disciplineById.get(disciplineId);
  const kind = VALID_KINDS.has(raw.kind) ? raw.kind : 'concept';
  const category = safeText(raw.category, 100) || discipline.shortTitle;
  const sources = cleanSources(raw.sources);
  const id = `ai-${createHash('sha256').update(`${disciplineId}:${normalizedTitle}`).digest('hex').slice(0, 24)}`;
  return {
    id,
    disciplineId,
    kind,
    title,
    category,
    summary,
    explanation,
    example,
    whyItMatters,
    tryThis,
    question,
    answer,
    sources,
    ...(discipline.id === 'money' && discipline.disclaimer ? { disclaimer: discipline.disclaimer } : {}),
    source: 'ai',
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

export function extractRequestBody(req) {
  let body = req?.body;
  if (typeof body === 'string') {
    if (body.length > 12000) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  try { if (JSON.stringify(body).length > 12000) return null; } catch { return null; }
  return body;
}

export function sameOrigin(req) {
  const origin = req?.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function safeSecretMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdminRequest(req) {
  return safeSecretMatch(String(req?.headers?.['x-content-admin-token'] || ''), String(process.env.CONTENT_ADMIN_TOKEN || ''));
}

export function getDatabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !key) return null;
    return { url, key };
  } catch { return null; }
}

export function getAiConfig() {
  const key = String(process.env.AI_API_KEY || '');
  const base = String(process.env.AI_BASE_URL || '').replace(/\/+$/, '');
  const models = String(process.env.AI_MODELS || process.env.AI_MODEL || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 5);
  if (!key || !base || !models.length) return null;
  try { if (!['https:'].includes(new URL(base).protocol)) return null; } catch { return null; }
  return { key, base, models };
}

export function hashActor(req) {
  const configKey = String(process.env.QUOTA_SALT || process.env.AI_API_KEY || 'brain-stash-quota');
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req?.socket?.remoteAddress || 'unknown');
  return `actor:${createHmac('sha256', configKey).update(ip).digest('hex')}`;
}

async function supabaseRequest(path, { method = 'GET', body, prefer } = {}) {
  const config = getDatabaseConfig();
  if (!config) throw new Error('database_unconfigured');
  const headers = { apikey: config.key, Accept: 'application/json' };
  // New Supabase secret keys are opaque API keys, not JWTs; only legacy service_role JWTs belong in Authorization.
  if (!config.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.key}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`database_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

export async function listLibraryItems({ status = 'approved', disciplineId = null, admin = false } = {}) {
  if (status !== 'approved' && !(admin && ['pending', 'rejected'].includes(status))) throw new Error('invalid_status');
  const query = new URLSearchParams({
    select: 'id,discipline_id,title,content,status,source,created_at',
    status: `eq.${status}`,
    order: 'created_at.desc',
    limit: status === 'pending' ? '100' : '250',
  });
  if (disciplineId) query.set('discipline_id', `eq.${disciplineId}`);
  const rows = await supabaseRequest(`brain_stash_items?${query.toString()}`);
  return (Array.isArray(rows) ? rows : []).map(rowToItem);
}

function rowToItem(row) {
  const content = row?.content && typeof row.content === 'object' && !Array.isArray(row.content) ? row.content : {};
  return { ...content, id: String(row.id || content.id || ''), disciplineId: String(row.discipline_id || content.disciplineId || ''), status: String(row.status || content.status || 'approved'), source: String(row.source || content.source || 'shared'), createdAt: row.created_at || content.createdAt || null };
}

async function consumeQuota(actorHash, actorLimit, globalLimit) {
  const result = await supabaseRequest('rpc/consume_brain_stash_quota', {
    method: 'POST',
    body: { p_actor_hash: actorHash, p_actor_limit: actorLimit, p_global_limit: globalLimit },
  });
  if (typeof result === 'boolean') return result;
  if (Array.isArray(result) && typeof result[0]?.consume_brain_stash_quota === 'boolean') return result[0].consume_brain_stash_quota;
  throw new Error('quota_response_invalid');
}

function buildMessages(discipline, knownTitles) {
  const known = [...new Set(knownTitles.map((title) => safeText(title, 120)).filter(Boolean))].slice(0, 100);
  const financeNotice = discipline.id === 'money'
    ? 'This is financial education, not personalised financial advice. Do not recommend specific assets, make return promises, or frame the content as a buy/sell instruction. Explain uncertainty and risk.'
    : '';
  const prompt = `Create exactly one original, useful learning item for Brain Stash in the discipline "${discipline.title}". Audience: curious adults. Tone: precise, grounded, vivid, not sensationalist. Avoid generic motivational advice, pop-psychology myths, absolute claims and fabricated quotations. Do not repeat these existing titles: ${JSON.stringify(known)}. ${financeNotice}

Return ONLY a JSON object with these fields:
{"title":"5-120 characters","kind":"one of concept, fact, scale-fact, bias, warning-sign, technique, principle, mental-model, method, checklist, framework","category":"short topic label","summary":"2-3 clear sentences, 25-650 characters","explanation":"accurate explanation, 80-2200 characters","example":"specific realistic example, 20-1500 characters","whyItMatters":"practical significance, 25-1200 characters","tryThis":"safe, actionable exercise or reflection, 10-1200 characters","question":"one recall question","answer":"concise correct answer","sources":[{"label":"source name","url":"https://..."}]}. Include up to four genuinely relevant source URLs where possible. Never invent a quotation or say a source was checked when it was not. Be precise about estimates, context and limitations. Do not include markdown fences.`;
  return [
    { role: 'system', content: 'You are a careful educational editor. Produce a single well-structured draft for human review. All claims must be proportionate to evidence. Output valid JSON only.' },
    { role: 'user', content: prompt },
  ];
}

function extractCandidateTitles(discipline) {
  return discipline.items.map((item) => item.title);
}

async function findDuplicate(disciplineId, title) {
  const query = new URLSearchParams({ select: 'id,discipline_id,title,content,status,source,created_at', discipline_id: `eq.${disciplineId}`, normalized_title: `eq.${normaliseTitle(title)}`, limit: '1' });
  const rows = await supabaseRequest(`brain_stash_items?${query.toString()}`);
  return Array.isArray(rows) && rows.length ? rowToItem(rows[0]) : null;
}

function findBundledDuplicate(disciplineId, normalizedTitle) {
  const discipline = disciplineById.get(disciplineId);
  const item = discipline?.items.find((entry) => normaliseTitle(entry.title) === normalizedTitle);
  return item ? {
    ...item,
    disciplineId: discipline.id,
    disciplineTitle: discipline.title,
    shortTitle: discipline.shortTitle,
    ...(discipline.disclaimer ? { disclaimer: discipline.disclaimer } : {}),
    source: 'bundled',
    status: 'approved',
  } : null;
}

function usableDuplicate(item) {
  if (item?.status === 'rejected') throw new Error('duplicate_rejected');
  if (item?.status === 'pending') throw new Error('duplicate_pending');
  return item;
}

async function generateWithAi(disciplineId) {
  const discipline = disciplineById.get(disciplineId);
  const config = getAiConfig();
  if (!config) throw new Error('ai_unconfigured');
  let existingTitles = extractCandidateTitles(discipline);
  try {
    const query = new URLSearchParams({ select: 'title', discipline_id: `eq.${disciplineId}`, order: 'created_at.desc', limit: '100' });
    const existingRows = await supabaseRequest(`brain_stash_items?${query.toString()}`);
    existingTitles = [...existingTitles, ...(Array.isArray(existingRows) ? existingRows.map((row) => row.title) : [])];
  } catch (error) {
    if (error.message === 'database_unconfigured') throw error;
    // The bundled titles still provide a duplicate-avoidance baseline.
  }
  let lastFailure = 'ai_upstream';
  for (const model of config.models) {
    try {
      const response = await fetch(`${config.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
        body: JSON.stringify({ model, messages: buildMessages(discipline, existingTitles), temperature: 0.45, max_tokens: 1800 }),
        signal: AbortSignal.timeout(22000),
      });
      if (!response.ok) {
        lastFailure = response.status === 429 ? 'ai_busy' : 'ai_upstream';
        continue;
      }
      const payload = await response.json();
      const raw = extractJson(payload?.choices?.[0]?.message?.content);
      const candidate = normaliseCandidate(raw, disciplineId);
      if (candidate) return candidate;
      lastFailure = 'ai_bad_output';
    } catch (error) {
      lastFailure = error?.name === 'TimeoutError' ? 'ai_timeout' : 'ai_upstream';
    }
  }
  throw new Error(lastFailure);
}

export async function generateAndStoreCandidate(disciplineId, { actorHash, actorLimit = 3, globalLimit = 20 } = {}) {
  if (!isValidDisciplineId(disciplineId)) throw new Error('invalid_discipline');
  if (!getDatabaseConfig()) throw new Error('database_unconfigured');
  if (!getAiConfig()) throw new Error('ai_unconfigured');
  const allowed = await consumeQuota(actorHash || 'actor:unknown', actorLimit, globalLimit);
  if (!allowed) throw new Error('quota_exhausted');
  const candidate = await generateWithAi(disciplineId);
  const normalizedTitle = normaliseTitle(candidate.title);
  const bundledDuplicate = findBundledDuplicate(disciplineId, normalizedTitle);
  if (bundledDuplicate) throw new Error('duplicate_bundled');
  const duplicate = usableDuplicate(await findDuplicate(disciplineId, candidate.title));
  if (duplicate) return { item: duplicate, duplicate: true };
  const row = {
    id: candidate.id,
    discipline_id: disciplineId,
    title: candidate.title,
    normalized_title: normalizedTitle,
    content: candidate,
    status: 'pending',
    source: 'ai',
  };
  try {
    const inserted = await supabaseRequest('brain_stash_items', { method: 'POST', body: row, prefer: 'return=representation' });
    const record = Array.isArray(inserted) ? inserted[0] : inserted;
    if (record) return { item: rowToItem(record), duplicate: false };
    throw new Error('database_empty_insert');
  } catch (error) {
    if (error.status === 409 || error.status === 400) {
      const afterConflict = await findDuplicate(disciplineId, candidate.title);
      if (afterConflict) return { item: usableDuplicate(afterConflict), duplicate: true };
    }
    throw error;
  }
}

export async function reviewLibraryItem(id, status) {
  if (typeof id !== 'string' || !/^ai-[a-f0-9]{24}$/.test(id) || !['approved', 'rejected'].includes(status)) throw new Error('invalid_review');
  const query = new URLSearchParams({ id: `eq.${id}`, status: 'eq.pending', select: 'id,discipline_id,title,content,status,source,created_at' });
  const updated = await supabaseRequest(`brain_stash_items?${query.toString()}`, { method: 'PATCH', body: { status, reviewed_at: new Date().toISOString() }, prefer: 'return=representation' });
  const row = Array.isArray(updated) ? updated[0] : updated;
  return row ? rowToItem(row) : null;
}

export function chooseCronDiscipline(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  return disciplines[((day % disciplines.length) + disciplines.length) % disciplines.length].id;
}

export function toDatabaseErrorCode(error) {
  if (error?.message === 'database_unconfigured') return 'database_unconfigured';
  if (error?.message === 'ai_unconfigured') return 'ai_unconfigured';
  if (error?.message === 'quota_exhausted') return 'quota_exhausted';
  if (error?.message === 'duplicate_rejected') return 'duplicate_rejected';
  if (error?.message === 'duplicate_pending') return 'duplicate_pending';
  if (error?.message === 'duplicate_bundled') return 'duplicate_bundled';
  if (error?.message === 'ai_busy') return 'ai_busy';
  if (error?.message === 'ai_bad_output') return 'ai_bad_output';
  if (error?.message === 'ai_timeout') return 'ai_timeout';
  if (error?.message === 'invalid_discipline' || error?.message === 'invalid_review') return 'bad_request';
  return 'service_error';
}
