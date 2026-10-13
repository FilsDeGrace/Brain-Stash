import { buildMessages, extractJson, parseTeachRequest } from '../server/teachCore.js';
import { normalizeTeaching } from '../src/engine/teachShape.js';

// Environment variables (set in the Vercel dashboard, never in code):
//   AI_API_KEY   your provider key
//   AI_BASE_URL  the provider's OpenAI-compatible base URL
//   AI_MODELS    comma-separated model IDs, tried in order (preferred)
//   AI_MODEL     one-model compatibility fallback
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const UPSTREAM_TIMEOUT_MS = 20000;
const hits = new Map(); // Best effort: each server instance keeps its own counts.

function tooMany(ip) {
  const now = Date.now();
  if (hits.size > 500) for (const [key, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => res.status(status).json(payload);

  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'method' }); }
  if (!sameOrigin(req)) return send(403, { error: 'origin' });

  const key = process.env.AI_API_KEY;
  const base = String(process.env.AI_BASE_URL || '').replace(/\/+$/, '');
  const models = String(process.env.AI_MODELS || process.env.AI_MODEL || '').split(',').map((model) => model.trim()).filter(Boolean);
  if (!key || !base || !models.length) return send(503, { error: 'unavailable' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const parsed = parseTeachRequest(body);
  if (!parsed.ok) return send(400, { error: 'bad_request' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (tooMany(ip)) return send(429, { error: 'busy' });

  let lastStatus = 502;
  let lastError = 'upstream';
  for (const model of models) {
    try {
      const upstream = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: buildMessages(parsed.value), temperature: 0.4, max_tokens: 1200 }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (upstream.status === 429) {
        lastStatus = 429;
        lastError = 'busy';
        continue;
      }
      if (!upstream.ok) {
        console.error('teach: upstream status', upstream.status);
        lastStatus = 502;
        lastError = 'upstream';
        continue;
      }
      const payload = await upstream.json();
      const data = normalizeTeaching(parsed.value.kind, extractJson(payload?.choices?.[0]?.message?.content));
      if (data) return send(200, { kind: parsed.value.kind, data });
      lastStatus = 502;
      lastError = 'bad_output';
    } catch (error) {
      console.error('teach: request failed', error?.name || 'error');
      lastStatus = 502;
      lastError = 'upstream';
    }
  }
  return send(lastStatus, { error: lastError });
}
