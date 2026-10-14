/** Shared selection helpers for fresh-first learning across Brain Stash. */

function safeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function safeKey(value) {
  return String(value ?? '').trim();
}

export function chooseFreshRandom(items, seenIds = [], options = {}) {
  const all = safeList(items);
  if (!all.length) return { item: null, status: 'empty', freshRemaining: 0 };

  const keyFor = typeof options.keyFor === 'function' ? options.keyFor : (item) => item?.id;
  const excluded = new Set(safeList(options.excludeIds).map(safeKey).filter(Boolean));
  const seen = new Set(safeList(seenIds).map(safeKey).filter(Boolean));
  const keyed = [];
  const uniqueKeys = new Set();
  for (const item of all) {
    const key = safeKey(keyFor(item));
    if (!key || uniqueKeys.has(key)) continue;
    uniqueKeys.add(key);
    keyed.push({ item, key });
  }
  if (!keyed.length) return { item: null, status: 'empty', freshRemaining: 0 };
  const usable = keyed.filter(({ key }) => !excluded.has(key));
  const pool = usable.length ? usable : keyed;
  const fresh = pool.filter(({ key }) => !seen.has(key));
  const candidates = fresh.length ? fresh : pool;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const rawIndex = Math.floor(Number(random()) * candidates.length);
  const index = Math.min(candidates.length - 1, Math.max(0, Number.isFinite(rawIndex) ? rawIndex : 0));
  const chosen = candidates[index] || null;
  const item = chosen?.item || null;
  const key = chosen?.key || '';
  return {
    item,
    status: !item ? 'empty' : seen.has(key) ? 'seen' : 'fresh',
    freshRemaining: fresh.length,
  };
}


/** Choose an unsolved Rebus before any review; prefer never-seen puzzles first. */
export function chooseRebusContent(items, solvedIds = [], seenIds = [], excludeId = null, random = Math.random) {
  const all = safeList(items).filter((item) => safeKey(item?.id));
  if (!all.length) return { item: null, status: 'empty' };
  const solved = new Set(safeList(solvedIds).map(safeKey).filter(Boolean));
  const seen = new Set(safeList(seenIds).map(safeKey).filter(Boolean));
  const others = all.filter((item) => safeKey(item.id) !== safeKey(excludeId));
  const poolBase = others.length ? others : all;
  const unseenUnsolved = poolBase.filter((item) => !solved.has(safeKey(item.id)) && !seen.has(safeKey(item.id)));
  const unsolved = poolBase.filter((item) => !solved.has(safeKey(item.id)));
  const pool = unseenUnsolved.length ? unseenUnsolved : unsolved.length ? unsolved : poolBase;
  const rawIndex = Math.floor(Number(random()) * pool.length);
  const index = Math.min(pool.length - 1, Math.max(0, Number.isFinite(rawIndex) ? rawIndex : 0));
  const item = pool[index] || null;
  if (!item) return { item: null, status: 'empty' };
  const key = safeKey(item.id);
  return { item, status: solved.has(key) ? 'solved' : seen.has(key) ? 'seen' : 'new' };
}

/** Select the next eligible Deep Stash entry, resuming an unfinished lesson first. */
export function chooseFreshStashCard(cards, sessions = {}, seenIds = [], excludeId = null, random = Math.random) {
  const allCards = safeList(cards).filter((card) => safeKey(card?.id));
  const candidates = allCards.filter((card) => safeKey(card.id) !== safeKey(excludeId));
  if (!candidates.length) return { item: allCards[0] || null, status: 'review' };
  const seen = new Set(safeList(seenIds).map(safeKey).filter(Boolean));
  const inProgress = candidates.filter((card) => Boolean(sessions?.[card.id]) && !sessions?.[card.id]?.completed);
  const fresh = candidates.filter((card) => !seen.has(safeKey(card.id)) && !sessions?.[card.id]);
  const seenUnstarted = candidates.filter((card) => seen.has(safeKey(card.id)) && !sessions?.[card.id]);
  const completed = candidates.filter((card) => Boolean(sessions?.[card.id]?.completed));
  const pool = inProgress.length ? inProgress : fresh.length ? fresh : seenUnstarted.length ? seenUnstarted : completed.length ? completed : candidates;
  const rawIndex = Math.floor(Number(random()) * pool.length);
  const index = Math.min(pool.length - 1, Math.max(0, Number.isFinite(rawIndex) ? rawIndex : 0));
  const item = pool[index] || null;
  return { item, status: inProgress.length ? 'in-progress' : fresh.length ? 'new' : 'review' };
}

/**
 * Build a round with unseen items first. Previously seen items are used only
 * when the fresh pool cannot fill the requested round. A round never repeats
 * the same stable item twice.
 */
export function selectFreshFirst(items, count, options = {}) {
  const all = safeList(items);
  if (!all.length) return [];
  const keyFor = typeof options.keyFor === 'function' ? options.keyFor : (item) => item?.id;
  const seen = new Set(safeList(options.seenIds).map(safeKey).filter(Boolean));
  const answered = new Set(safeList(options.answeredIds).map(safeKey).filter(Boolean));
  const ordered = typeof options.orderItems === 'function' ? options.orderItems(all) : all;
  const unique = [];
  const used = new Set();
  for (const item of safeList(ordered)) {
    const key = safeKey(keyFor(item));
    if (!key || used.has(key)) continue;
    used.add(key);
    unique.push({ item, key });
  }
  const fresh = unique.filter(({ key }) => !seen.has(key));
  const reviewed = unique.filter(({ key }) => seen.has(key));
  const target = Math.min(unique.length, Math.max(1, Number(count) || unique.length));
  const selected = [...fresh, ...reviewed].slice(0, target);
  return selected.map(({ item, key }) => ({
    ...item,
    freshContentStatus: !seen.has(key) ? 'new' : answered.has(key) ? 'answered' : 'seen',
  }));
}

/** Find the next unseen item after currentIndex, wrapping around the list. */
export function nextFreshIndex(items, currentIndex, seenIds = [], options = {}) {
  const all = safeList(items);
  if (!all.length) return -1;
  const keyFor = typeof options.keyFor === 'function' ? options.keyFor : (item) => item?.id;
  const seen = new Set(safeList(seenIds).map(safeKey).filter(Boolean));
  const start = Number.isInteger(currentIndex) ? currentIndex : -1;
  for (let step = 1; step <= all.length; step += 1) {
    const index = ((start + step) % all.length + all.length) % all.length;
    if (!seen.has(safeKey(keyFor(all[index])))) return index;
  }
  return all.length > 1 ? (Math.max(0, start) + 1) % all.length : 0;
}

/** Add valid keys once and keep the newest bounded history. */
export function rememberIds(existingIds, newIds, limit = 500) {
  const combined = [...safeList(existingIds), ...safeList(newIds)]
    .map(safeKey)
    .filter(Boolean);
  const unique = [...new Set(combined)];
  const max = Math.max(1, Number(limit) || 500);
  return unique.slice(-max);
}


/** Preserve the old ten-question XP scale while proportionally rewarding shorter fresh-content rounds. */
export function calculateRoundXp(questionCount, score) {
  const count = Math.max(0, Math.min(10, Math.floor(Number(questionCount) || 0)));
  const correct = Math.max(0, Math.min(count, Math.floor(Number(score) || 0)));
  if (!count) return 0;
  return Math.round((10 + correct * 10) * (count / 10));
}

export function questionHistoryKey(mode, question) {
  const normalise = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (mode === 'maths') {
    // Maths IDs are round-position IDs, so use the actual expression and answer.
    return `maths:${normalise(question?.prompt)}=${normalise(question?.answer)}`;
  }
  const identity = question?.id || [question?.prompt, question?.context, ...(question?.options || []).map((option) => option?.label)].map(normalise).join('|');
  return `${String(mode || 'question')}:${normalise(identity)}`;
}
