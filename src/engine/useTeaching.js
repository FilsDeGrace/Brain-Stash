import { useCallback, useEffect, useRef, useState } from 'react';
import { readStored, writeStored } from './storage.js';
import { buildDiagnoseRequest, buildLessonRequest, diagnoseKey, lessonKey, requestTeaching, TeachError } from './teachClient.js';
import { normalizeTeaching } from './teachShape.js';

const CACHE_KEY = 'teach-cache';
const IDLE = { status: 'idle' };

function loadCache() {
  const stored = readStored(CACHE_KEY, {});
  const entries = {};
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      const data = normalizeTeaching(key.startsWith('lesson:') ? 'lesson' : 'diagnose', value);
      if (data) entries[key] = { status: 'ready', data };
    }
  }
  return entries;
}

/**
 * AI walkthroughs for Deep Stash cards. Each result is fetched once, cached on this
 * device, and shared by key. Duplicate taps while a request is running are ignored.
 * Entries are { status: 'idle' | 'loading' | 'ready' | 'error', data?, error? }.
 */
export function useTeaching() {
  const [entries, setEntries] = useState(loadCache);
  const entriesRef = useRef(entries);
  const inflight = useRef(new Map());

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => {
    const ready = {};
    for (const [key, entry] of Object.entries(entries)) if (entry.status === 'ready') ready[key] = entry.data;
    writeStored(CACHE_KEY, ready);
  }, [entries]);
  useEffect(() => () => { inflight.current.forEach((controller) => controller.abort()); inflight.current.clear(); }, []);

  const run = useCallback(async (key, body) => {
    if (inflight.current.has(key) || entriesRef.current[key]?.status === 'ready') return;
    const controller = new AbortController();
    inflight.current.set(key, controller);
    setEntries((current) => ({ ...current, [key]: { status: 'loading' } }));
    try {
      const data = await requestTeaching(body, { signal: controller.signal });
      setEntries((current) => ({ ...current, [key]: { status: 'ready', data } }));
    } catch (error) {
      const code = error instanceof TeachError ? error.code : 'unavailable';
      setEntries((current) => {
        if (code === 'cancelled') { const next = { ...current }; delete next[key]; return next; }
        return { ...current, [key]: { status: 'error', error: code } };
      });
    } finally {
      inflight.current.delete(key);
    }
  }, []);

  const stateFor = useCallback((key) => entries[key] || IDLE, [entries]);
  const teach = useCallback((card) => run(lessonKey(card), buildLessonRequest(card)), [run]);
  const diagnose = useCallback((card, selectedId) => run(diagnoseKey(card, selectedId), buildDiagnoseRequest(card, selectedId)), [run]);
  return { stateFor, teach, diagnose };
}
