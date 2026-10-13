/** Pure shape checks for AI teaching output. Shared by the client and the serverless function. */
const clean = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** @returns {{plain:string, spot:string[], example:string, mistake:string} | null} */
export function normalizeLesson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const plain = clean(raw.plain, 900);
  const example = clean(raw.example, 900);
  const mistake = clean(raw.mistake, 600);
  const spot = Array.isArray(raw.spot) ? raw.spot.map((item) => clean(item, 240)).filter(Boolean).slice(0, 4) : [];
  if (!plain || !example || !mistake || spot.length < 2) return null;
  return { plain, spot, example, mistake };
}

/** @returns {{why:string, check:string} | null} */
export function normalizeDiagnosis(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const why = clean(raw.why, 600);
  const check = clean(raw.check, 450);
  if (!why || !check) return null;
  return { why, check };
}

export function normalizeTeaching(kind, raw) {
  if (kind === 'lesson') return normalizeLesson(raw);
  if (kind === 'diagnose') return normalizeDiagnosis(raw);
  return null;
}
