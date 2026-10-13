import {
  extractRequestBody,
  generateAndStoreCandidate,
  hashActor,
  isAdminRequest,
  isValidDisciplineId,
  listLibraryItems,
  reviewLibraryItem,
  sameOrigin,
  toDatabaseErrorCode,
} from '../server/libraryCore.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => res.status(status).json(payload);
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'method' }); }
  if (!sameOrigin(req)) return send(403, { error: 'origin' });

  if (req.method === 'GET') {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const status = url.searchParams.get('status') || 'approved';
    const disciplineId = url.searchParams.get('discipline') || null;
    const admin = isAdminRequest(req);
    if (!['approved', 'pending', 'rejected'].includes(status) || (status !== 'approved' && !admin)) return send(403, { error: 'forbidden' });
    if (disciplineId && !isValidDisciplineId(disciplineId)) return send(400, { error: 'bad_request' });
    try {
      const items = await listLibraryItems({ status, disciplineId, admin });
      return send(200, { items, configured: true });
    } catch (error) {
      if (error.message === 'database_unconfigured' && status === 'approved') return send(200, { items: [], configured: false });
      if (error.message === 'database_unconfigured') return send(503, { error: 'database_unconfigured' });
      console.error('library: listing failed', error?.message || 'error');
      return send(503, { error: 'library_unavailable' });
    }
  }

  const body = extractRequestBody(req);
  if (!body) return send(400, { error: 'bad_request' });

  if (body.action === 'review') {
    if (!isAdminRequest(req)) return send(403, { error: 'forbidden' });
    try {
      const item = await reviewLibraryItem(body.id, body.status);
      if (!item) return send(404, { error: 'not_found' });
      return send(200, { item });
    } catch (error) {
      const code = toDatabaseErrorCode(error);
      console.error('library: review failed', code);
      return send(code === 'bad_request' ? 400 : 503, { error: code });
    }
  }

  if (body.action !== 'generate' || !isValidDisciplineId(body.disciplineId)) return send(400, { error: 'bad_request' });
  try {
    const result = await generateAndStoreCandidate(body.disciplineId, { actorHash: hashActor(req), actorLimit: 3, globalLimit: 20 });
    return send(result.duplicate ? 200 : 201, { ...result, message: result.duplicate ? 'A matching item already exists in the shared library.' : 'Draft generated. It will join the shared library after review.' });
  } catch (error) {
    const code = toDatabaseErrorCode(error);
    if (code === 'service_error') console.error('library: generation failed', error?.message || 'error');
    const status = code === 'bad_request' ? 400 : code === 'duplicate_rejected' || code === 'duplicate_pending' || code === 'duplicate_bundled' ? 409 : code === 'quota_exhausted' || code === 'ai_busy' ? 429 : code === 'database_unconfigured' || code === 'ai_unconfigured' ? 503 : 502;
    return send(status, { error: code });
  }
}
