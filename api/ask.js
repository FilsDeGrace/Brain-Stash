import {
  answerTopicQuestion,
  extractRequestBody,
  hashActor,
  sameOrigin,
  toDatabaseErrorCode,
} from '../server/libraryCore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => res.status(status).json(payload);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'method' }); }
  if (!sameOrigin(req)) return send(403, { error: 'origin' });
  const body = extractRequestBody(req);
  if (!body) return send(400, { error: 'bad_request' });
  try {
    const result = await answerTopicQuestion(body, { actorHash: hashActor(req), actorLimit: 2, globalLimit: 40 });
    return send(200, result);
  } catch (error) {
    const code = toDatabaseErrorCode(error);
    if (code === 'service_error') console.error('ask: request failed', error?.name || 'error');
    const status = code === 'bad_request' ? 400
      : code === 'question_private_info' ? 400
      : code === 'topic_unavailable' ? 404
      : code === 'quota_exhausted' || code === 'ai_busy' ? 429
      : ['database_unconfigured', 'ai_unconfigured', 'database_permissions', 'database_schema_error', 'database_unavailable'].includes(code) ? 503
      : 502;
    return send(status, { error: code });
  }
}
