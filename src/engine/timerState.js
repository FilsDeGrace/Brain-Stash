/**
 * Select the visible countdown for a render. When a question key changes, the
 * old snapshot must never leak into the first render of the new question.
 * Kept pure so the timer race can be regression-tested without a browser.
 */
export function visibleCountdownSnapshot(snapshot, key, totalMs) {
  const safeTotalMs = Math.max(0, Number(totalMs) || 0);
  if (snapshot?.key === key && snapshot.totalMs === safeTotalMs) {
    return { timeLeftMs: Math.max(0, Math.min(safeTotalMs, snapshot.timeLeftMs)), paused: Boolean(snapshot.paused), matches: true };
  }
  return { timeLeftMs: safeTotalMs, paused: false, matches: false };
}
