import { generateAndStoreCandidate, safeSecretMatch, chooseCronDiscipline, toDatabaseErrorCode } from '../server/libraryCore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => res.status(status).json(payload);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'method' }); }
  const expected = String(process.env.CRON_SECRET || '');
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!safeSecretMatch(token, expected)) return send(401, { error: 'unauthorized' });
  try {
    const disciplineId = chooseCronDiscipline(new Date());
    const result = await generateAndStoreCandidate(disciplineId, { actorHash: 'actor:scheduled-daily', actorLimit: 1, globalLimit: 20 });
    return send(200, { ok: true, disciplineId, duplicate: result.duplicate, status: result.item.status });
  } catch (error) {
    const code = toDatabaseErrorCode(error);
    if (code === 'quota_exhausted') return send(200, { ok: true, skipped: 'daily_generation_budget_used' });
    if (code === 'service_error') console.error('cron-library: generation failed', error?.message || 'error');
    return send(code === 'database_unconfigured' || code === 'ai_unconfigured' ? 503 : 502, { error: code });
  }
}
