export function friendlyLibraryError(code) {
  const messages = {
    database_unconfigured: 'New discoveries are not available yet. The starter library is still available.',
    ai_unconfigured: 'AI generation is not available yet. The starter library is still available.',
    quota_exhausted: 'The shared generation budget has been reached for now. Try again tomorrow.',
    duplicate_rejected: 'A very similar discovery has already been reviewed and rejected. Try generating a different topic.',
    duplicate_pending: 'A similar discovery is already awaiting review. Try again with a different topic.',
    duplicate_bundled: 'The AI repeated an existing starter discovery, so nothing new was added. Try again for a different idea.',
    ai_busy: 'The AI service is busy. Try again later.',
    ai_timeout: 'The AI request took too long. Try again when the connection is stable.',
    ai_bad_output: 'The AI response did not pass validation. Nothing was added to the library; try again.',
    library_unavailable: 'The shared library could not be reached right now.',
    forbidden: 'This action is not authorised.',
    bad_request: 'The request could not be understood. Try again.',
    service_error: 'The library could not save that draft. Check your connection and try again.',
  };
  return messages[code] || 'Something went wrong. Check your connection and try again.';
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || (response.status === 429 ? 'quota_exhausted' : 'service_error'));
  return payload;
}

export async function fetchSharedItems({ disciplineId = null, signal } = {}) {
  const query = new URLSearchParams();
  if (disciplineId) query.set('discipline', disciplineId);
  const response = await fetch(`/api/library${query.size ? `?${query.toString()}` : ''}`, { method: 'GET', signal, headers: { Accept: 'application/json' } });
  return parseResponse(response);
}

export async function generateSharedItem(disciplineId, { signal } = {}) {
  const response = await fetch('/api/library', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'generate', disciplineId }),
  });
  return parseResponse(response);
}
