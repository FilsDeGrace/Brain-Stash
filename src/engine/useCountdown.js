import { useEffect, useRef, useState } from 'react';
import { visibleCountdownSnapshot } from './timerState.js';

/**
 * Countdown timer that pauses while the document is hidden.
 * The returned time is derived from the active reset key during render. This
 * prevents a previous question's zero from leaking into the first render of
 * the next question before React runs the reset effect.
 * @param {number} totalMs
 * @param {boolean} active
 * @param {string|number} resetKey
 */
export function useCountdown(totalMs, active, resetKey) {
  const safeTotalMs = Math.max(0, Number(totalMs) || 0);
  const [snapshot, setSnapshot] = useState(() => ({ key: resetKey, totalMs: safeTotalMs, timeLeftMs: safeTotalMs, paused: false }));
  const remainingRef = useRef(safeTotalMs);
  const deadlineRef = useRef(0);
  // If question identity changes, expose its full duration synchronously. Do
  // not make timeout decisions from the previous question's stale snapshot.
  const visible = visibleCountdownSnapshot(snapshot, resetKey, safeTotalMs);
  const timeLeftMs = visible.timeLeftMs;
  const paused = visible.paused;

  useEffect(() => {
    remainingRef.current = safeTotalMs;
    deadlineRef.current = Date.now() + safeTotalMs;
    setSnapshot({ key: resetKey, totalMs: safeTotalMs, timeLeftMs: safeTotalMs, paused: false });
  }, [safeTotalMs, resetKey]);

  useEffect(() => {
    if (!active) return undefined;

    const isHidden = () => document.visibilityState === 'hidden';
    const publish = (remaining, isPaused = false) => {
      setSnapshot((current) => {
        // Ignore a tick queued for a question that has already changed.
        if (current.key !== resetKey || current.totalMs !== safeTotalMs) return current;
        return { ...current, timeLeftMs: remaining, paused: isPaused };
      });
    };
    const pause = () => {
      if (!isHidden()) return;
      remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
      publish(remainingRef.current, true);
    };
    const resume = () => {
      if (isHidden()) return;
      deadlineRef.current = Date.now() + remainingRef.current;
      publish(remainingRef.current, false);
    };
    const handleVisibilityChange = () => { if (isHidden()) pause(); else resume(); };
    const tick = window.setInterval(() => {
      if (isHidden()) return;
      const next = Math.max(0, deadlineRef.current - Date.now());
      remainingRef.current = next;
      publish(next, false);
    }, 200);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (isHidden()) pause(); else resume();
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, resetKey, safeTotalMs]);

  return { timeLeftMs: Math.max(0, Math.min(safeTotalMs, timeLeftMs)), totalMs: safeTotalMs, paused };
}
