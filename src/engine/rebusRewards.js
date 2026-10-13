/**
 * One-time local-profile rewards for authored Rebus puzzles.
 * Returns a new Set so callers can persist a stable snapshot of solved IDs.
 */
export function claimPuzzleReward(solvedIds, puzzleId) {
  const key = String(puzzleId ?? '').trim();
  const next = new Set(solvedIds instanceof Set ? solvedIds : Array.isArray(solvedIds) ? solvedIds.map(String) : []);
  if (!key || next.has(key)) return { claimed: false, solvedIds: next };
  next.add(key);
  return { claimed: true, solvedIds: next };
}
