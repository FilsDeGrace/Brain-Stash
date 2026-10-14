import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import HomeScreen from '../screens/HomeScreen.jsx';
import MathsLessonsScreen from '../screens/MathsLessonsScreen.jsx';
import LessonScreen from '../screens/LessonScreen.jsx';
import QuizRoundScreen from '../screens/QuizRoundScreen.jsx';
import RebusScreen from '../screens/RebusScreen.jsx';
import StashCardScreen from '../screens/StashCardScreen.jsx';
import StashArchiveScreen from '../screens/StashArchiveScreen.jsx';
import CollectionScreen from '../screens/CollectionScreen.jsx';
import ResultScreen from '../screens/ResultScreen.jsx';
import SettingsScreen from '../screens/SettingsScreen.jsx';
import ProfileScreen from '../screens/ProfileScreen.jsx';
import ReasoningHubScreen from '../screens/ReasoningHubScreen.jsx';
import PlayScreen from '../screens/PlayScreen.jsx';
import CourtScreen from '../screens/CourtScreen.jsx';
import DisciplinesScreen from '../screens/DisciplinesScreen.jsx';
import LibraryReviewScreen from '../screens/LibraryReviewScreen.jsx';
import StashDropModal from '../components/StashDropModal.jsx';
import Icon from '../components/Icons.jsx';
import { clearStored, dayBefore, localDayStamp, readStored, writeStored } from '../engine/storage.js';
import { useCountdown } from '../engine/useCountdown.js';
import { useTeaching } from '../engine/useTeaching.js';
import { diagnoseKey, lessonKey } from '../engine/teachClient.js';
import { createRng, generateRound, hashSeed, listSkills } from '../engine/mathEngine.js';
import { entryModeFor, isCorrect as isRebusCorrect, normalize as normalizeRebusAnswer } from '../engine/rebusMatch.js';
import { claimPuzzleReward } from '../engine/rebusRewards.js';
import { getEligibleStashCards, getUnlockedStashTier, resolveCurrentStash, stashTier } from '../engine/stashProgression.js';
import { calculateRoundXp, chooseFreshRandom, chooseFreshStashCard, chooseRebusContent, nextFreshIndex, questionHistoryKey, rememberIds, selectFreshFirst } from '../engine/freshContent.js';
import mathLessons from '../content/mathLessons.json';
import rebusDeck from '../content/rebus.json';
import stashDeck from '../content/stash.json';
import trapQuestions from '../content/traps.json';
import fallacyQuestions from '../content/fallacies.json';
import courtDeck from '../content/court.json';
import disciplines from '../content/disciplines.js';
import { fetchSharedItems, friendlyLibraryError, generateSharedItem } from '../engine/sharedLibraryClient.js';

const emptyProgress = { streak: 0, xp: 0, level: 1, xpToNext: 120, lastActiveDate: null, mathTier: 1, mathsRounds: 0 };
const defaultSettings = { timerLength: 15, timerPreset: '15', soundOn: true, reducedMotion: false };
const dailyDefaults = { done: { maths: false, rebus: false, stash: false }, stashId: null };
const modeCards = [
  { id: 'maths', title: 'Quick Maths', blurb: 'Shortcuts that make numbers click.', badge: 'GENERATED ROUNDS' },
  { id: 'rebus', title: 'Rebus', blurb: 'Decode the picture. Find the phrase.', badge: '54 PUZZLES' },
  { id: 'stash', title: 'Deep Stash', blurb: 'Principles worth keeping.', badge: 'DAILY IDEA' },
  { id: 'traps', title: 'Mind Traps', blurb: 'Challenge intuition, then explore fallacies.', badge: 'LOGIC & REASONING' },
  { id: 'court', title: 'The Court', blurb: 'Weigh evidence. Test arguments. Deliver a verdict.', badge: '20 CASE FILES' },
];
function stashCardAsDiscovery(card) {
  const correct = card?.quiz?.options?.find((option) => option.id === card.quiz.correctId)?.label || card?.quiz?.explanation || '';
  return {
    id: `deep-stash-${card.id}`,
    originalCardId: card.id,
    disciplineId: 'principles',
    disciplineTitle: 'Laws, Principles & Mental Models',
    shortTitle: 'Deep Stash',
    title: card.title,
    category: card.category || 'Principle',
    kind: 'principle',
    summary: card.summary || 'A principle worth examining.',
    explanation: card.whyItMatters || card.summary || '',
    example: card.example || '',
    whyItMatters: card.whyItMatters || '',
    tryThis: card.example ? `Use this idea in a real decision: ${card.example}` : 'Think of one situation where this principle might help.',
    question: card.quiz?.prompt || '',
    answer: correct,
    sources: [],
    source: 'deep-stash',
    status: 'approved',
  };
}

function buildDropPool(sharedItems = [], personalItems = [], unlockedTier = 1) {
  const seedItems = disciplines.flatMap((discipline) => discipline.items.map((item) => ({
    ...item, disciplineId: discipline.id, disciplineTitle: discipline.title, shortTitle: discipline.shortTitle, disclaimer: discipline.disclaimer || '', source: 'bundled', status: 'approved',
  })));
  const deepStashItems = stashDeck.filter((card) => stashTier(card) <= unlockedTier).map(stashCardAsDiscovery);
  const all = [...sharedItems, ...personalItems, ...seedItems, ...deepStashItems];
  const seen = new Set();
  return all.filter((item) => {
    if (!item?.id || !item?.title || !item?.summary || seen.has(String(item.id))) return false;
    seen.add(String(item.id));
    return true;
  });
}

function chooseRandomDrop(items, excludeId = null, seenIds = readStored('drop-seen-ids', [])) {
  const result = chooseFreshRandom(items, seenIds, {
    excludeIds: excludeId ? [String(excludeId)] : [],
    keyFor: (item) => item?.id,
  });
  return result.item ? { ...result.item, freshContentStatus: result.status } : null;
}

function initialDrop(today, unlockedTier = 1) {
  const stored = readStored('daily-drop-state', null);
  const storedCard = stored?.item?.originalCardId ? stashDeck.find((card) => String(card.id) === String(stored.item.originalCardId)) : null;
  const storedCardIsAvailable = !storedCard || stashTier(storedCard) <= unlockedTier;
  if (stored?.date === today && stored?.item?.id && storedCardIsAvailable) return stored.item;
  const candidates = readStored('generated-knowledge-items', []);
  const result = chooseFreshRandom(buildDropPool([], Array.isArray(candidates) ? candidates : [], unlockedTier), readStored('drop-seen-ids', []), { keyFor: (item) => item?.id });
  return result.item ? { ...result.item, freshContentStatus: result.status } : null;
}


const mathSkillIds = new Set(listSkills().map((skill) => skill.id));

function getRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

function xpProgress(xp) {
  return { level: Math.floor(Math.max(0, xp) / 120) + 1, xpToNext: 120 - (Math.max(0, xp) % 120) };
}

function normalizeProgress(value) {
  const progress = { ...emptyProgress, ...(value || {}) };
  const current = xpProgress(progress.xp || 0);
  return {
    ...progress,
    streak: Math.max(0, Number(progress.streak) || 0),
    xp: Math.max(0, Number(progress.xp) || 0),
    mathTier: Math.min(5, Math.max(1, Number(progress.mathTier) || 1)),
    mathsRounds: Math.max(0, Number(progress.mathsRounds) || 0),
    ...current,
  };
}

function seededIndex(stamp, length) {
  const seed = String(stamp).split('-').join('').split('').reduce((sum, value, index) => sum + (Number(value) || 0) * (index + 3), 0);
  return length ? seed % length : 0;
}

function shuffleWithSeed(items, seed) {
  const rng = createRng(hashSeed(seed));
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function emptyQuiz(mode = 'maths') {
  return { mode, skillId: 'mixed', tier: 1, questions: [], index: 0, score: 0, status: 'idle', locked: false, reveal: null, startedAt: 0 };
}

function getBaseSeconds(settings) {
  const amount = Number(settings.timerLength);
  return Math.min(60, Math.max(5, Number.isFinite(amount) ? amount : 15));
}

function scrambleAnswer(puzzle) {
  const letters = normalizeRebusAnswer(puzzle.answer).split('');
  if (letters.length < 2) return letters;
  const rng = createRng(hashSeed(puzzle.id || puzzle.answer));
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [letters[index], letters[other]] = [letters[other], letters[index]];
  }
  if (letters.join('') === normalizeRebusAnswer(puzzle.answer)) letters.push(letters.shift());
  return letters;
}

function buildTilePool(puzzle, selectedTileIds) {
  const source = puzzle.tiles ? String(puzzle.tiles).toUpperCase().split('') : scrambleAnswer(puzzle).map((char) => char.toUpperCase());
  return source.map((char, index) => ({ id: `${puzzle.id}-${index}`, char, used: selectedTileIds.includes(`${puzzle.id}-${index}`) }));
}

function buildSlots(answer, selectedTileIds, pool) {
  let letterIndex = 0;
  return answer.toUpperCase().split('').map((char) => {
    if (!/[A-Z0-9]/.test(char)) return { kind: 'fixed', char };
    const tileId = selectedTileIds[letterIndex];
    const tile = tileId ? pool.find((item) => item.id === tileId) : null;
    letterIndex += 1;
    return { kind: 'letter', char: tile ? tile.char : null, locked: false };
  });
}

function playFeedback(correct = true) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(correct ? 660 : 185, context.currentTime);
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.11);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => context.close();
  } catch { /* Sound is optional and can be blocked by the browser. */ }
}

export default function App() {
  const today = localDayStamp();
  const [route, setRoute] = useState(getRoute);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [progress, setProgress] = useState(() => normalizeProgress(readStored('progress', emptyProgress)));
  const [settings, setSettings] = useState(() => {
    const stored = readStored('settings', {});
    const merged = { ...defaultSettings, ...stored };
    if (!stored.timerPreset) merged.timerPreset = [10, 15].includes(Number(merged.timerLength)) ? String(merged.timerLength) : 'custom';
    return merged;
  });
  const [savedCards, setSavedCards] = useState(() => readStored('saved-cards', []));
  const [savedKnowledgeItems, setSavedKnowledgeItems] = useState(() => { const value = readStored('saved-knowledge-items', []); return Array.isArray(value) ? value : []; });
  const [sharedItems, setSharedItems] = useState([]);
  const [sharedItemsLoading, setSharedItemsLoading] = useState(true);
  const [sharedLibraryConfigured, setSharedLibraryConfigured] = useState(null);
  const [generatedItems, setGeneratedItems] = useState(() => { const value = readStored('generated-knowledge-items', []); return Array.isArray(value) ? value : []; });
  const [generation, setGeneration] = useState({ disciplineId: null, loading: false, error: '' });
  const [daily, setDaily] = useState(() => ({ ...dailyDefaults, ...readStored(`daily-${today}`, dailyDefaults) }));
  const [stashSessions, setStashSessions] = useState(() => { const value = readStored('stash-sessions', {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; });
  const [stashSeenIds, setStashSeenIds] = useState(() => { const value = readStored('stash-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [knowledgeSeenIds, setKnowledgeSeenIds] = useState(() => { const value = readStored('knowledge-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [knowledgeCurrentVisit, setKnowledgeCurrentVisit] = useState(null);
  const [mathsSeenKeys, setMathsSeenKeys] = useState(() => { const value = readStored('maths-seen-question-keys', []); return Array.isArray(value) ? value.map(String) : []; });
  const [mathsAnsweredKeys, setMathsAnsweredKeys] = useState(() => { const value = readStored('maths-answered-question-keys', []); return Array.isArray(value) ? value.map(String) : []; });
  const [trapsSeenIds, setTrapsSeenIds] = useState(() => { const value = readStored('traps-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [trapsAnsweredIds, setTrapsAnsweredIds] = useState(() => { const value = readStored('traps-answered-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [fallaciesSeenIds, setFallaciesSeenIds] = useState(() => { const value = readStored('fallacies-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [fallaciesAnsweredIds, setFallaciesAnsweredIds] = useState(() => { const value = readStored('fallacies-answered-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const initialStashTier = getUnlockedStashTier(stashDeck, stashSessions);
  const [dropItem, setDropItem] = useState(() => initialDrop(today, initialStashTier));
  const [dropSeenIds, setDropSeenIds] = useState(() => { const value = readStored('drop-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [dropVisible, setDropVisible] = useState(() => !readStored(`drop-dismissed-${today}`, false));
  const [dropIsDaily, setDropIsDaily] = useState(() => {
    const stored = readStored('daily-drop-state', null);
    return stored?.date === today ? stored.isDaily !== false : true;
  });
  const [activeCategory, setActiveCategory] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [quiz, setQuiz] = useState(() => emptyQuiz());
  const [lastResult, setLastResult] = useState(null);
  const [rebusSolvedIds, setRebusSolvedIds] = useState(() => {
    const stored = readStored('rebus-solved-ids', []);
    return Array.isArray(stored) ? stored.map(String) : [];
  });
  const [rebusSeenIds, setRebusSeenIds] = useState(() => { const value = readStored('rebus-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const rebusSolvedRef = useRef(new Set(rebusSolvedIds));
  const [rebusIndex, setRebusIndex] = useState(() => {
    const stored = readStored('rebus-session-current', readStored(`rebus-session-${today}`, readStored(`rebus-session-${dayBefore(today)}`, null)));
    const storedIndex = rebusDeck.findIndex((puzzle) => puzzle.id === stored?.puzzleId);
    return storedIndex >= 0 ? storedIndex : seededIndex(today, rebusDeck.length);
  });
  const [rebusSession, setRebusSession] = useState(() => {
    const stored = readStored('rebus-session-current', readStored(`rebus-session-${today}`, readStored(`rebus-session-${dayBefore(today)}`, null)));
    if (stored?.puzzleId && rebusDeck.some((puzzle) => puzzle.id === stored.puzzleId)) {
      return { puzzleId: null, selectedTileIds: [], inputValue: '', attempt: 'none', status: 'running', hintCount: 0, hintText: '', awarded: false, ...stored };
    }
    return { dayStamp: today, puzzleId: null, selectedTileIds: [], inputValue: '', attempt: 'none', status: 'running', hintCount: 0, hintText: '', awarded: false };
  });
  const [courtIndex, setCourtIndex] = useState(() => {
    const stored = Number(readStored('court-index', seededIndex(today, courtDeck.length)));
    return Number.isInteger(stored) && stored >= 0 && stored < courtDeck.length ? stored : seededIndex(today, courtDeck.length);
  });
  const [courtAnswers, setCourtAnswers] = useState(() => {
    const stored = readStored('court-answers', {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  });
  const [courtSeenIds, setCourtSeenIds] = useState(() => { const value = readStored('court-seen-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [courtPassedIds, setCourtPassedIds] = useState(() => { const value = readStored('court-passed-ids', []); return Array.isArray(value) ? value.map(String) : []; });
  const [courtEntryStatus, setCourtEntryStatus] = useState(() => {
    const caseId = courtDeck[Number(readStored('court-index', seededIndex(today, courtDeck.length)))]?.id;
    const answers = readStored('court-answers', {});
    const passed = readStored('court-passed-ids', []);
    const seen = readStored('court-seen-ids', []);
    if (caseId && answers?.[caseId]) return 'answered';
    if (caseId && (Array.isArray(passed) && passed.map(String).includes(String(caseId)) || Array.isArray(seen) && seen.map(String).includes(String(caseId)))) return 'seen';
    return 'new';
  });
  const quizAdvanceLock = useRef(null);
  const rebusAwardLock = useRef(false);
  const rebusAdvanceLock = useRef(false);
  const stashFinishLocks = useRef(new Set());
  const generationLock = useRef(false);
  const previousRouteRef = useRef(null);

  useEffect(() => {
    const update = () => setRoute(getRoute());
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('hashchange', update);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    if (!window.location.hash) window.location.hash = '/';
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    // Topic-to-topic navigation should start at the title on mobile, not retain
    // the previous topic's scroll position. Respect the user's motion setting.
    window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }, [route, settings.reducedMotion]);

  useEffect(() => {
    if (!isOnline) { setSharedItemsLoading(false); return undefined; }
    const controller = new AbortController();
    let active = true;
    setSharedItemsLoading(true);
    fetchSharedItems({ signal: controller.signal }).then((result) => {
      if (!active) return;
      setSharedItems(Array.isArray(result.items) ? result.items : []);
      setSharedLibraryConfigured(result.configured !== false);
    }).catch(() => {
      // The bundled library remains available if a static preview has no /api route or the network is down.
    }).finally(() => { if (active) setSharedItemsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [isOnline]);

  useEffect(() => { writeStored('progress', progress); }, [progress]);
  useEffect(() => { writeStored('settings', settings); document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reducedMotion)); }, [settings]);
  useEffect(() => { writeStored('saved-cards', savedCards); }, [savedCards]);
  useEffect(() => { writeStored('saved-knowledge-items', savedKnowledgeItems); }, [savedKnowledgeItems]);
  useEffect(() => { writeStored('generated-knowledge-items', generatedItems); }, [generatedItems]);
  useEffect(() => { if (dropItem?.id) writeStored('daily-drop-state', { date: today, item: dropItem, isDaily: dropIsDaily }); }, [dropItem, dropIsDaily, today]);
  useEffect(() => {
    if (!dropItem?.id) return;
    setDropSeenIds((current) => {
      const next = rememberIds(current, [String(dropItem.id)], 1000);
      if (next.length === current.length && next.every((id, index) => id === current[index])) return current;
      return next;
    });
  }, [dropItem?.id]);
  useEffect(() => { writeStored('drop-seen-ids', dropSeenIds); }, [dropSeenIds]);
  useEffect(() => { writeStored(`daily-${today}`, daily); }, [daily, today]);
  useEffect(() => { writeStored('stash-sessions', stashSessions); }, [stashSessions]);
  useEffect(() => { writeStored('stash-seen-ids', stashSeenIds); }, [stashSeenIds]);
  useEffect(() => { writeStored('rebus-solved-ids', rebusSolvedIds); }, [rebusSolvedIds]);
  useEffect(() => { writeStored('rebus-seen-ids', rebusSeenIds); }, [rebusSeenIds]);
  useEffect(() => { writeStored('maths-seen-question-keys', mathsSeenKeys); }, [mathsSeenKeys]);
  useEffect(() => { writeStored('maths-answered-question-keys', mathsAnsweredKeys); }, [mathsAnsweredKeys]);
  useEffect(() => { writeStored('traps-seen-ids', trapsSeenIds); }, [trapsSeenIds]);
  useEffect(() => { writeStored('traps-answered-ids', trapsAnsweredIds); }, [trapsAnsweredIds]);
  useEffect(() => { writeStored('fallacies-seen-ids', fallaciesSeenIds); }, [fallaciesSeenIds]);
  useEffect(() => { writeStored('fallacies-answered-ids', fallaciesAnsweredIds); }, [fallaciesAnsweredIds]);
  useEffect(() => { writeStored('knowledge-seen-ids', knowledgeSeenIds); }, [knowledgeSeenIds]);
  useEffect(() => {
    if (rebusSession?.puzzleId) writeStored('rebus-session-current', rebusSession);
  }, [rebusSession]);
  useEffect(() => { writeStored('court-index', courtIndex); }, [courtIndex]);
  useEffect(() => { writeStored('court-answers', courtAnswers); }, [courtAnswers]);
  useEffect(() => { writeStored('court-seen-ids', courtSeenIds); }, [courtSeenIds]);
  useEffect(() => { writeStored('court-passed-ids', courtPassedIds); }, [courtPassedIds]);

  useEffect(() => {
    const segments = route.split('/').filter(Boolean);
    if (segments[0] !== 'disciplines' || !segments[1] || !segments[2]) {
      setKnowledgeCurrentVisit(null);
      return;
    }
    const key = `${segments[1]}:${String(segments[2])}`;
    setKnowledgeCurrentVisit({ key, wasSeen: knowledgeSeenIds.includes(key) });
  // Capture the item's history once when its route changes. The marking effect below
  // updates persistent history separately, so a first visit never labels itself as a repeat.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    const segments = route.split('/').filter(Boolean);
    if (segments[0] !== 'disciplines' || !segments[1] || !segments[2]) return;
    const discipline = disciplines.find((entry) => entry.id === segments[1]);
    if (!discipline) return;
    const itemId = String(segments[2]);
    const exists = discipline.items.some((item) => String(item.id) === itemId)
      || sharedItems.some((item) => String(item.id) === itemId && item.disciplineId === discipline.id && item.status === 'approved')
      || generatedItems.some((item) => String(item.id) === itemId && item.disciplineId === discipline.id)
      || savedKnowledgeItems.some((item) => String(item.id) === itemId && item.disciplineId === discipline.id);
    if (!exists) return;
    const key = `${discipline.id}:${itemId}`;
    setKnowledgeSeenIds((current) => current.includes(key) ? current : rememberIds(current, [key], 2000));
  }, [route, sharedItems, generatedItems, savedKnowledgeItems]);

  useEffect(() => {
    if (route !== '/court' || !currentCourtCase?.id) return;
    const id = String(currentCourtCase.id);
    setCourtSeenIds((current) => current.includes(id) ? current : [...current, id]);
  }, [route, courtIndex]);

  const navigate = (path) => {
    if (getRoute() === path) setRoute(path);
    else window.location.hash = path;
  };

  const recordActivity = (mode, amount = 0, extraProgress = {}, markDaily = true) => {
    const current = progress;
    const previousDay = current.lastActiveDate;
    const nextStreak = previousDay === today ? current.streak : previousDay === dayBefore(today) ? current.streak + 1 : 1;
    const nextXp = Math.max(0, current.xp + amount);
    const nextProgress = { ...current, streak: nextStreak, xp: nextXp, ...xpProgress(nextXp), lastActiveDate: today, ...extraProgress };
    setProgress(nextProgress);
    if (markDaily && (mode === 'maths' || mode === 'rebus' || mode === 'stash')) {
      setDaily((currentDaily) => ({ ...currentDaily, done: { ...currentDaily.done, [mode]: true } }));
    }
    return nextProgress;
  };

  const spendXp = (amount) => setProgress((current) => {
    const nextXp = Math.max(0, current.xp - amount);
    return { ...current, xp: nextXp, ...xpProgress(nextXp) };
  });

  // Each authored puzzle can award XP only once per local profile. A replay may
  // still count as today's activity, but never re-mints the puzzle reward.
  const claimRebusReward = (puzzleId, amount = 20) => {
    const claim = claimPuzzleReward(rebusSolvedRef.current, puzzleId);
    if (!claim.claimed) {
      recordActivity('rebus', 0);
      return false;
    }
    rebusSolvedRef.current = claim.solvedIds;
    const solved = [...claim.solvedIds];
    setRebusSolvedIds(solved);
    writeStored('rebus-solved-ids', solved);
    recordActivity('rebus', amount);
    return true;
  };

  const buildQuiz = (mode, skillId = 'mixed') => {
    let questions;
    let tier = progress.mathTier;
    if (mode === 'maths') {
      const skills = mathSkillIds.has(skillId) ? skillId : 'mixed';
      if (skills !== 'mixed') {
        const skill = listSkills().find((entry) => entry.id === skills);
        if (skill) tier = Math.min(skill.maxTier, Math.max(skill.minTier, progress.mathTier));
      }
      const targetCount = 10;
      const seen = new Set(mathsSeenKeys);
      const answered = new Set(mathsAnsweredKeys);
      const selectedKeys = new Set();
      const freshQuestions = [];
      const reviewQuestions = [];
      let firstRound = [];
      for (let attempt = 0; attempt < 12 && freshQuestions.length < targetCount; attempt += 1) {
        const round = generateRound({ skillId: skills, tier, count: targetCount, seed: `${today}-${Date.now()}-${Math.random()}-${attempt}`, baseSeconds: getBaseSeconds(settings) });
        if (!firstRound.length) firstRound = round;
        for (const question of round) {
          const key = questionHistoryKey('maths', question);
          if (selectedKeys.has(key)) continue;
          selectedKeys.add(key);
          if (seen.has(key)) reviewQuestions.push({ ...question, freshContentStatus: answered.has(key) ? 'answered' : 'seen' });
          else freshQuestions.push({ ...question, freshContentStatus: 'new' });
          if (freshQuestions.length >= targetCount) break;
        }
      }
      questions = [...freshQuestions, ...reviewQuestions].slice(0, targetCount);
      if (!questions.length) questions = firstRound.map((question) => { const key = questionHistoryKey('maths', question); return { ...question, freshContentStatus: seen.has(key) ? answered.has(key) ? 'answered' : 'seen' : 'new' }; });
      if (questions.length && questions[0].tier) tier = questions[0].tier;
    } else if (mode === 'traps') {
      const seen = new Set(trapsSeenIds);
      const freshCount = trapQuestions.filter((question) => !seen.has(questionHistoryKey('traps', question))).length;
      const roundSize = freshCount > 0 ? Math.min(10, freshCount) : 10;
      questions = selectFreshFirst(shuffleWithSeed(trapQuestions, `${today}-${Date.now()}-${Math.random()}-traps`), roundSize, {
        seenIds: trapsSeenIds,
        answeredIds: trapsAnsweredIds,
        keyFor: (question) => questionHistoryKey('traps', question),
      });
    } else {
      const seen = new Set(fallaciesSeenIds);
      const freshCount = fallacyQuestions.filter((question) => !seen.has(questionHistoryKey('fallacies', question))).length;
      const roundSize = freshCount > 0 ? Math.min(10, freshCount) : 10;
      questions = selectFreshFirst(shuffleWithSeed(fallacyQuestions, `${today}-${Date.now()}-${Math.random()}-fallacies`), roundSize, {
        seenIds: fallaciesSeenIds,
        answeredIds: fallaciesAnsweredIds,
        keyFor: (question) => questionHistoryKey('fallacies', question),
      });
    }
    return { ...emptyQuiz(mode), skillId, tier, questions, status: 'running', startedAt: Date.now() };
  };

  const startQuiz = (mode, skillId = 'mixed') => {
    setQuiz(buildQuiz(mode, skillId));
    navigate(mode === 'maths' ? '/maths/round' : mode === 'fallacies' ? '/fallacies/round' : '/traps/round');
  };

  useEffect(() => {
    const requestedMode = route === '/maths/round' ? 'maths' : route === '/traps/round' ? 'traps' : route === '/fallacies/round' ? 'fallacies' : null;
    if (requestedMode && (quiz.mode !== requestedMode || quiz.status === 'idle' || !quiz.questions?.length)) {
      setQuiz(buildQuiz(requestedMode));
    }
  // The round is intentionally created only when entering/reloading a route with no live round.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, quiz.mode, quiz.status, quiz.questions?.length]);

  useEffect(() => {
    if (route === '/result' && !lastResult) navigate('/');
  }, [route, lastResult]);

  const questions = quiz.questions || [];
  const currentQuestion = questions[quiz.index];
  const currentRouteIsQuiz = (route === '/maths/round' && quiz.mode === 'maths') || (route === '/traps/round' && quiz.mode === 'traps') || (route === '/fallacies/round' && quiz.mode === 'fallacies');
  const requestedQuestionTime = quiz.mode === 'maths' ? (currentQuestion?.timeMs || getBaseSeconds(settings) * 1000) : getBaseSeconds(settings) * 1000;
  const questionKey = `${quiz.mode}-${quiz.index}-${quiz.startedAt}-${currentQuestion?.id || 'no-question'}`;
  const countdown = useCountdown(requestedQuestionTime, currentRouteIsQuiz && quiz.mode === 'maths' && quiz.status === 'running' && Boolean(currentQuestion), questionKey);
  const timer = currentRouteIsQuiz && quiz.mode === 'maths' ? countdown : null;

  useEffect(() => {
    if (!currentRouteIsQuiz || quiz.mode !== 'maths' || quiz.status !== 'running' || !currentQuestion || !timer || !timer.totalMs || timer.timeLeftMs > 0) return;
    setQuiz((current) => {
      if (current.status !== 'running' || current.startedAt !== quiz.startedAt || current.index !== quiz.index) return current;
      const question = current.questions?.[current.index];
      if (!question) return current;
      return { ...current, status: 'revealed', locked: true, reveal: { selectedId: null, correctId: question.correctId, timedOut: true } };
    });
  }, [currentRouteIsQuiz, quiz.mode, quiz.status, quiz.index, quiz.startedAt, currentQuestion, timer]);

  const onSelectQuiz = (optionId) => {
    if (quiz.locked || quiz.status !== 'running' || !currentQuestion) return;
    const correct = optionId === currentQuestion.correctId;
    const historyKey = questionHistoryKey(quiz.mode, currentQuestion);
    if (quiz.mode === 'maths') setMathsAnsweredKeys((current) => rememberIds(current, [historyKey], 2000));
    else if (quiz.mode === 'traps') setTrapsAnsweredIds((current) => rememberIds(current, [historyKey], 1000));
    else if (quiz.mode === 'fallacies') setFallaciesAnsweredIds((current) => rememberIds(current, [historyKey], 1000));
    if (settings.soundOn) playFeedback(correct);
    setQuiz((current) => {
      if (current.locked || current.status !== 'running' || current.index !== quiz.index || current.startedAt !== quiz.startedAt) return current;
      return { ...current, status: 'revealed', locked: true, score: current.score + (correct ? 1 : 0), reveal: { selectedId: optionId, correctId: currentQuestion.correctId, timedOut: false } };
    });
  };

  const onNextQuiz = () => {
    if (quiz.status !== 'revealed' || quizAdvanceLock.current === questionKey) return;
    quizAdvanceLock.current = questionKey;
    if (quiz.index + 1 >= questions.length) {
      const earned = calculateRoundXp(questions.length, quiz.score);
      const mode = quiz.mode;
      const tierAdvanced = mode === 'maths' && quiz.score / questions.length >= 0.8;
      const nextMathTier = tierAdvanced ? Math.min(5, Math.max(progress.mathTier + 1, quiz.tier + 1)) : progress.mathTier;
      const extraProgress = mode === 'maths' ? { mathTier: nextMathTier, mathsRounds: progress.mathsRounds + 1 } : {};
      const nextProgress = recordActivity(mode, earned, extraProgress, mode === 'maths');
      const finalLevel = nextProgress?.level ?? xpProgress(progress.xp + earned).level;
      const total = questions.length;
      const score = quiz.score;
      const modeTitle = mode === 'maths' ? 'Quick Maths' : mode === 'traps' ? 'Mind Traps' : 'Fallacies';
      const shareText = `Brain Stash · ${modeTitle}\nScore: ${score}/${total}\n+${earned} XP · Level ${finalLevel}\nA sharper mind is built daily.`;
      setLastResult({ mode, score, total, xpGained: earned, newLevel: finalLevel, streak: nextProgress?.streak ?? progress.streak, shareText });
      setQuiz({ ...quiz, status: 'finished' });
      navigate('/result');
    } else {
      setQuiz((current) => ({ ...current, index: current.index + 1, status: 'running', locked: false, reveal: null, startedAt: Date.now() }));
    }
  };

  useEffect(() => {
    if (!currentRouteIsQuiz || !currentQuestion) return;
    const historyKey = questionHistoryKey(quiz.mode, currentQuestion);
    if (quiz.mode === 'maths') setMathsSeenKeys((current) => rememberIds(current, [historyKey], 500));
    else if (quiz.mode === 'traps') setTrapsSeenIds((current) => rememberIds(current, [historyKey], 500));
    else if (quiz.mode === 'fallacies') setFallaciesSeenIds((current) => rememberIds(current, [historyKey], 500));
  }, [currentRouteIsQuiz, quiz.mode, quiz.startedAt, quiz.index, currentQuestion?.prompt, currentQuestion?.id]);

  const stashUnlockedTier = getUnlockedStashTier(stashDeck, stashSessions);
  const eligibleStashDeck = getEligibleStashCards(stashDeck, stashUnlockedTier);
  const stashSeenSet = new Set(stashSeenIds.map(String));
  const freshStashDeck = eligibleStashDeck.filter((card) => !stashSeenSet.has(String(card.id)) && !stashSessions[card.id]);
  const inProgressStashDeck = eligibleStashDeck.filter((card) => Boolean(stashSessions[card.id]) && !stashSessions[card.id]?.completed);
  const seenUnstartedStashDeck = eligibleStashDeck.filter((card) => stashSeenSet.has(String(card.id)) && !stashSessions[card.id]);
  const fallbackStashDeck = inProgressStashDeck.length ? inProgressStashDeck : freshStashDeck.length ? freshStashDeck : seenUnstartedStashDeck.length ? seenUnstartedStashDeck : eligibleStashDeck;
  const generatedDailyStash = fallbackStashDeck[seededIndex(today, fallbackStashDeck.length)];
  const storedDailyStash = daily.stashId ? stashDeck.find((card) => String(card.id) === String(daily.stashId) && stashTier(card) <= stashUnlockedTier) : null;
  const dailyStash = storedDailyStash || generatedDailyStash;
  useEffect(() => {
    if (dailyStash && String(daily.stashId || '') !== String(dailyStash.id)) {
      setDaily((current) => ({ ...current, stashId: dailyStash.id }));
    }
  }, [dailyStash?.id, daily.stashId]);

  const openDailyStash = () => {
    const current = eligibleStashDeck.find((card) => String(card.id) === String(dailyStash?.id));
    const currentHasUnfinishedAnswer = Boolean(current && stashSessions[current.id] && !stashSessions[current.id]?.completed);
    const currentWasOnlyViewed = Boolean(current && stashSeenSet.has(String(current.id)) && !stashSessions[current.id]);
    if (current && (stashSessions[current.id]?.completed || currentWasOnlyViewed) && !currentHasUnfinishedAnswer) {
      const next = chooseFreshStashCard(eligibleStashDeck, stashSessions, stashSeenIds, current.id).item;
      if (next) setDaily((value) => ({ ...value, stashId: next.id }));
    }
    navigate('/stash');
  };

  const dailyRouteRef = useRef(null);
  useEffect(() => {
    const wasRoute = dailyRouteRef.current;
    dailyRouteRef.current = route;
    if (route !== '/stash' || wasRoute === '/stash') return;
    const current = eligibleStashDeck.find((card) => String(card.id) === String(daily.stashId));
    if (!current) return;
    const currentHasUnfinishedAnswer = Boolean(stashSessions[current.id] && !stashSessions[current.id]?.completed);
    const currentWasOnlyViewed = stashSeenSet.has(String(current.id)) && !stashSessions[current.id];
    if (!stashSessions[current.id]?.completed && !(currentWasOnlyViewed && !currentHasUnfinishedAnswer)) return;
    const next = chooseFreshStashCard(eligibleStashDeck, stashSessions, stashSeenIds, current.id).item;
    if (next && String(next.id) !== String(current.id)) setDaily((value) => ({ ...value, stashId: next.id }));
  // Choose the next principle only when entering the daily route, not immediately
  // after completion; the user should still see their completion feedback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
  const stashRouteId = route.startsWith('/stash/') ? route.split('/')[2] : null;
  const requestedStash = stashDeck.find((card) => String(card.id) === String(stashRouteId));
  const stashLocked = Boolean(requestedStash && stashTier(requestedStash) > stashUnlockedTier);
  const resolvedCurrentStash = resolveCurrentStash({ requested: requestedStash, locked: stashLocked, daily: dailyStash, deck: stashDeck });
  const currentStash = resolvedCurrentStash || {
    id: '__archive-entry-unavailable__', tier: 1, category: 'Archive', title: 'Archive entry unavailable',
    summary: '', example: '', whyItMatters: '', quiz: { prompt: '', options: [], correctId: '' },
  };
  const stashSession = stashSessions[currentStash.id] || { selectedId: null, correctId: null, locked: false, completed: false };
  const hasValidStashQuiz = Boolean(currentStash.quiz && currentStash.quiz.correctId && Array.isArray(currentStash.quiz.options) && currentStash.quiz.options.length);
  const currentStashQuiz = hasValidStashQuiz ? currentStash.quiz : { prompt: '', options: [], correctId: '' };
  const saved = savedCards.some((entry) => String(entry.id) === String(currentStash.id));
  const teaching = useTeaching();
  const missedOptionId = hasValidStashQuiz && stashSession.locked && stashSession.selectedId && stashSession.selectedId !== currentStashQuiz.correctId ? stashSession.selectedId : null;
  const lessonState = teaching.stateFor(lessonKey(currentStash));
  const diagnosisState = missedOptionId ? teaching.stateFor(diagnoseKey(currentStash, missedOptionId)) : null;

  useEffect(() => {
    const isStashEntry = route === '/stash' || (route.startsWith('/stash/') && route !== '/stash/archive' && !stashLocked);
    if (!isStashEntry || !stashDeck.some((card) => String(card.id) === String(currentStash.id))) return;
    setStashSeenIds((current) => rememberIds(current, [String(currentStash.id)], stashDeck.length * 3));
  }, [route, currentStash.id, stashLocked]);

  const saveStashCard = () => {
    setSavedCards((current) => current.some((entry) => String(entry.id) === String(currentStash.id)) ? current : [...current, { id: currentStash.id, savedAt: Date.now() }]);
  };

  const isKnowledgeItemSaved = (itemId) => savedKnowledgeItems.some((entry) => String(entry.id) === String(itemId));

  const saveKnowledgeItem = (item) => {
    if (!item?.id || !item?.disciplineId) return;
    setSavedKnowledgeItems((current) => current.some((entry) => String(entry.id) === String(item.id)) ? current : [...current, { ...item, savedAt: Date.now() }]);
  };

  const saveDiscovery = (item) => {
    if (!item?.id) return;
    if (item.originalCardId) {
      setSavedCards((current) => current.some((entry) => String(entry.id) === String(item.originalCardId)) ? current : [...current, { id: item.originalCardId, savedAt: Date.now() }]);
      return;
    }
    saveKnowledgeItem(item);
  };

  const surpriseMe = () => {
    const next = chooseRandomDrop(buildDropPool(sharedItems, generatedItems, stashUnlockedTier), dropItem?.id, dropSeenIds);
    if (next) setDropItem(next);
    setDropIsDaily(false);
    setDropVisible(true);
  };

  const dismissDrop = () => {
    setDropVisible(false);
    writeStored(`drop-dismissed-${today}`, true);
  };

  const teachDrop = (item) => {
    if (item?.originalCardId) navigate(`/stash/${item.originalCardId}`);
    else if (item?.disciplineId && item?.id) navigate(`/disciplines/${item.disciplineId}/${item.id}`);
    setDropVisible(false);
    writeStored(`drop-dismissed-${today}`, true);
  };

  const generateKnowledgeItem = async (disciplineId) => {
    if (generationLock.current || generation.loading) return;
    const routeAtStart = getRoute();
    generationLock.current = true;
    setGeneration({ disciplineId, loading: true, error: '' });
    try {
      const result = await generateSharedItem(disciplineId);
      const item = result?.item;
      if (!item?.id) throw new Error('service_error');
      if (item.status === 'approved' || item.source === 'shared') {
        setSharedItems((current) => [item, ...current.filter((entry) => String(entry.id) !== String(item.id))]);
      } else {
        setGeneratedItems((current) => [item, ...current.filter((entry) => String(entry.id) !== String(item.id))]);
      }
      setGeneration({ disciplineId, loading: false, error: '' });
      // Finish saving the draft without hijacking navigation if the user moved elsewhere while waiting.
      if (getRoute() === routeAtStart) navigate(`/disciplines/${disciplineId}/${item.id}`);
    } catch (error) {
      setGeneration({ disciplineId, loading: false, error: friendlyLibraryError(error?.message) });
    } finally {
      generationLock.current = false;
    }
  };

  const answerStashQuiz = (optionId) => {
    if (!hasValidStashQuiz || stashSession.locked) return;
    if (settings.soundOn) playFeedback(optionId === currentStashQuiz.correctId);
    setStashSessions((current) => {
      if (current[currentStash.id]?.locked) return current;
      return { ...current, [currentStash.id]: { ...(current[currentStash.id] || stashSession), selectedId: optionId, correctId: currentStashQuiz.correctId, locked: true, completed: Boolean(current[currentStash.id]?.completed) } };
    });
  };

  const finishStash = () => {
    if (!hasValidStashQuiz || !stashSession.locked || stashSession.completed || stashFinishLocks.current.has(String(currentStash.id))) return;
    stashFinishLocks.current.add(String(currentStash.id));
    const isDailyCard = currentStash.id === dailyStash?.id;
    recordActivity('stash', stashSession.selectedId === currentStashQuiz.correctId ? 25 : 15, {}, isDailyCard);
    setStashSessions((current) => ({ ...current, [currentStash.id]: { ...stashSession, completed: true } }));
  };

  const openNewRebus = (excludeId = null) => {
    if (rebusAdvanceLock.current) return;
    const choice = chooseRebusContent(rebusDeck, rebusSolvedIds, rebusSeenIds, excludeId);
    const puzzle = choice.item;
    if (!puzzle) return;
    rebusAdvanceLock.current = true;
    const index = rebusDeck.findIndex((item) => String(item.id) === String(puzzle.id));
    rebusAwardLock.current = false;
    setRebusIndex(Math.max(0, index));
    setRebusSeenIds((current) => rememberIds(current, [String(puzzle.id)], rebusDeck.length * 3));
    setRebusSession({ dayStamp: today, puzzleId: puzzle.id, selectedTileIds: [], inputValue: '', attempt: 'none', status: 'running', hintCount: 0, hintText: '', awarded: false, freshContentStatus: choice.status, selectionKey: `${Date.now()}-${Math.random()}` });
  };

  useEffect(() => {
    if (rebusSession?.selectionKey && rebusAdvanceLock.current) rebusAdvanceLock.current = false;
  }, [rebusSession?.selectionKey]);

  const startRebus = () => {
    const existingIndex = rebusDeck.findIndex((puzzle) => puzzle.id === rebusSession.puzzleId);
    if (existingIndex >= 0 && rebusSession.status !== 'finished' && !rebusSolvedIds.includes(String(rebusSession.puzzleId))) {
      setRebusIndex(existingIndex);
      setRebusSeenIds((current) => rememberIds(current, [String(rebusSession.puzzleId)], rebusDeck.length * 3));
      if (!rebusSession.freshContentStatus) {
        setRebusSession((current) => ({ ...current, freshContentStatus: rebusSolvedIds.includes(String(current.puzzleId)) ? 'solved' : rebusSeenIds.includes(String(current.puzzleId)) ? 'seen' : 'new' }));
      }
      rebusAwardLock.current = false;
    } else {
      openNewRebus(rebusSession.puzzleId);
    }
    navigate('/rebus');
  };

  useEffect(() => {
    if (route !== '/rebus') {
      previousRouteRef.current = route;
      return;
    }
    const enteringRebus = previousRouteRef.current !== '/rebus';
    previousRouteRef.current = route;
    const storedIndex = rebusDeck.findIndex((puzzle) => String(puzzle.id) === String(rebusSession.puzzleId));
    if (storedIndex < 0 || (enteringRebus && (rebusSession.status === 'finished' || rebusSolvedIds.includes(String(rebusSession.puzzleId))))) {
      openNewRebus(rebusSession.puzzleId || null);
      return;
    }
    setRebusIndex(storedIndex);
    setRebusSeenIds((current) => rememberIds(current, [String(rebusSession.puzzleId)], rebusDeck.length * 3));
  // Route-entry handling is deliberate: puzzle completion must not immediately
  // replace the success screen; only entering the discipline selects another.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const currentPuzzle = rebusDeck.find((puzzle) => puzzle.id === rebusSession.puzzleId) || rebusDeck[rebusIndex] || rebusDeck[0];
  const currentEntryMode = entryModeFor(currentPuzzle);
  const tilePool = buildTilePool(currentPuzzle, rebusSession.selectedTileIds);
  const slots = buildSlots(currentPuzzle.answer, rebusSession.selectedTileIds, tilePool);
  const targetLetters = normalizeRebusAnswer(currentPuzzle.answer);

  const finishRebus = (attempt = 'none', answerCorrect = true) => {
    if (answerCorrect && rebusAwardLock.current) return;
    if (answerCorrect) rebusAwardLock.current = true;
    setRebusSession((current) => ({ ...current, attempt, status: 'finished', awarded: answerCorrect, inputValue: currentPuzzle.answer }));
    if (settings.soundOn) playFeedback(answerCorrect);
    if (answerCorrect && !rebusSession.awarded) claimRebusReward(currentPuzzle.id, 20);
  };

  const placeRebusTile = (tileId) => {
    if (rebusSession.status === 'finished' || rebusSession.selectedTileIds.length >= targetLetters.length || tilePool.find((tile) => tile.id === tileId)?.used) return;
    const nextIds = [...rebusSession.selectedTileIds, tileId];
    const nextString = nextIds.map((id) => tilePool.find((tile) => tile.id === id)?.char || '').join('');
    if (nextIds.length >= targetLetters.length) {
      if (isRebusCorrect(currentPuzzle, nextString)) {
        if (settings.soundOn) playFeedback(true);
        setRebusSession((current) => ({ ...current, selectedTileIds: nextIds, attempt: 'none', status: 'finished', inputValue: currentPuzzle.answer, awarded: true }));
        if (!rebusAwardLock.current) { rebusAwardLock.current = true; claimRebusReward(currentPuzzle.id, 20); }
      } else {
        if (settings.soundOn) playFeedback(false);
        setRebusSession((current) => ({ ...current, selectedTileIds: nextIds, attempt: 'wrong' }));
      }
    } else {
      setRebusSession((current) => ({ ...current, selectedTileIds: nextIds, attempt: 'none' }));
    }
  };

  const clearRebusSlot = (slotIndex) => {
    const targetPosition = slots.slice(0, slotIndex).filter((slot) => slot.kind === 'letter').length;
    setRebusSession((current) => ({ ...current, selectedTileIds: current.selectedTileIds.slice(0, targetPosition), attempt: 'none' }));
  };

  const typeRebusAnswer = (value) => setRebusSession((current) => ({ ...current, inputValue: value, attempt: 'none' }));

  const submitTypedRebus = () => {
    if (rebusSession.status === 'finished' || !rebusSession.inputValue.trim()) return;
    if (isRebusCorrect(currentPuzzle, rebusSession.inputValue)) finishRebus('none', true);
    else { if (settings.soundOn) playFeedback(false); setRebusSession((current) => ({ ...current, attempt: 'wrong' })); }
  };

  const takeRebusHint = () => {
    if (progress.xp < currentPuzzle.hintCost) {
      setRebusSession((current) => ({ ...current, hintText: `You need ${currentPuzzle.hintCost} XP to use a hint. Solve a puzzle to earn XP.` }));
      return;
    }
    const hintsLeft = Math.max(0, currentPuzzle.hintsLeft - rebusSession.hintCount);
    if (!hintsLeft || rebusSession.status === 'finished') return;
    if (currentEntryMode === 'tiles' && rebusSession.selectedTileIds.length >= targetLetters.length) {
      setRebusSession((current) => ({ ...current, hintText: 'Clear a tile first to reveal a letter.' }));
      return;
    }
    if (currentEntryMode === 'tiles') {
      const nextChar = targetLetters[rebusSession.selectedTileIds.length];
      const matching = tilePool.find((tile) => !tile.used && tile.char === nextChar.toUpperCase());
      const predicted = [...rebusSession.selectedTileIds.map((id) => tilePool.find((tile) => tile.id === id)?.char || ''), ...(matching ? [matching.char] : [])].join('');
      const completesCorrectly = Boolean(matching) && rebusSession.selectedTileIds.length + 1 >= targetLetters.length && isRebusCorrect(currentPuzzle, predicted);
      if (completesCorrectly) {
        const actualCost = Math.min(progress.xp, currentPuzzle.hintCost);
        setRebusSession((current) => ({ ...current, selectedTileIds: [...current.selectedTileIds, matching.id], hintCount: current.hintCount + 1, hintText: `The next letter is ${nextChar.toUpperCase()}.`, status: 'finished', inputValue: currentPuzzle.answer, awarded: true }));
        if (settings.soundOn) playFeedback(true);
        if (!rebusAwardLock.current) {
          rebusAwardLock.current = true;
          if (rebusSolvedRef.current.has(String(currentPuzzle.id))) recordActivity('rebus', -actualCost);
          else claimRebusReward(currentPuzzle.id, 20 - actualCost);
        }
      } else {
        spendXp(currentPuzzle.hintCost);
        setRebusSession((current) => ({ ...current, hintCount: current.hintCount + 1, hintText: `The next letter is ${nextChar.toUpperCase()}.` }));
        if (matching) placeRebusTile(matching.id);
      }
    } else {
      spendXp(currentPuzzle.hintCost);
      const targetWords = currentPuzzle.answer.split(/\s+/);
      const knownCount = Math.min(rebusSession.hintCount, targetWords.length - 1);
      const nextWord = targetWords[knownCount] || targetWords[0];
      setRebusSession((current) => ({ ...current, hintCount: current.hintCount + 1, hintText: `The next word begins with “${nextWord[0].toUpperCase()}”.` }));
    }
  };

  const nextRebus = () => {
    openNewRebus(currentPuzzle.id);
  };

  // Skip advances without passing through the completed/reveal state or awarding XP.
  const skipRebus = () => {
    openNewRebus(currentPuzzle.id);
  };

  const currentCourtCase = courtDeck[courtIndex] || courtDeck[0] || null;
  const selectedCourtVerdict = currentCourtCase ? courtAnswers[currentCourtCase.id] || null : null;
  const selectCourtVerdict = (optionId) => {
    if (!currentCourtCase || selectedCourtVerdict) return;
    if (!(currentCourtCase.options || []).some((option) => option.id === optionId)) return;
    setCourtAnswers((current) => ({ ...current, [currentCourtCase.id]: optionId }));
  };
  const moveCourt = (delta) => {
    if (!courtDeck.length) return;
    if (delta < 0) {
      const index = Math.max(0, courtIndex - 1);
      const target = courtDeck[index];
      setCourtIndex(index);
      setCourtEntryStatus(target && courtAnswers[target.id] ? 'answered' : target && (courtPassedIds.includes(String(target.id)) || courtSeenIds.includes(String(target.id))) ? 'seen' : 'new');
      return;
    }
    if (currentCourtCase && !selectedCourtVerdict) {
      setCourtPassedIds((current) => rememberIds(current, [String(currentCourtCase.id)], courtDeck.length * 3));
    }
    const seenAfterLeaving = rememberIds(courtSeenIds, currentCourtCase ? [String(currentCourtCase.id)] : [], courtDeck.length * 3);
    const nextIndex = nextFreshIndex(courtDeck, courtIndex, seenAfterLeaving, { keyFor: (item) => String(item.id) });
    const target = courtDeck[nextIndex];
    setCourtIndex(nextIndex);
    setCourtEntryStatus(target && courtAnswers[target.id] ? 'answered' : target && (courtPassedIds.includes(String(target.id)) || courtSeenIds.includes(String(target.id))) ? 'seen' : 'new');
  };

  const openCourt = () => {
    const current = courtDeck[courtIndex];
    if (current && courtSeenIds.includes(String(current.id)) && !courtAnswers[current.id] && !courtPassedIds.includes(String(current.id))) {
      setCourtEntryStatus('seen');
      navigate('/court');
      return;
    }
    const fresh = courtDeck.filter((item) => !courtSeenIds.includes(String(item.id)) && !courtPassedIds.includes(String(item.id)) && !courtAnswers[item.id]);
    const pool = fresh.length ? fresh : courtDeck;
    if (pool.length) {
      const selected = pool[Math.floor(Math.random() * pool.length)];
      const index = courtDeck.findIndex((item) => String(item.id) === String(selected.id));
      if (index >= 0) {
        setCourtIndex(index);
        setCourtEntryStatus(courtAnswers[selected.id] ? 'answered' : (courtPassedIds.includes(String(selected.id)) || courtSeenIds.includes(String(selected.id))) ? 'seen' : 'new');
      }
    }
    navigate('/court');
  };

  const courtRouteRef = useRef(null);
  useEffect(() => {
    const previousRoute = courtRouteRef.current;
    courtRouteRef.current = route;
    if (route !== '/court' || previousRoute === '/court') return;
    const current = courtDeck[courtIndex];
    if (!current) return;
    if (!courtAnswers[current.id] && !courtPassedIds.includes(String(current.id))) {
      setCourtEntryStatus(courtSeenIds.includes(String(current.id)) ? 'seen' : 'new');
      return;
    }
    const fresh = courtDeck.filter((item) => !courtSeenIds.includes(String(item.id)) && !courtPassedIds.includes(String(item.id)) && !courtAnswers[item.id]);
    if (!fresh.length) return;
    const selected = fresh[Math.floor(Math.random() * fresh.length)];
    const index = courtDeck.findIndex((item) => String(item.id) === String(selected.id));
    if (index >= 0) {
      setCourtIndex(index);
      setCourtEntryStatus(courtAnswers[selected.id] ? 'answered' : (courtPassedIds.includes(String(selected.id)) || courtSeenIds.includes(String(selected.id))) ? 'seen' : 'new');
    }
  // Direct links and refreshes should not reopen a finished case when fresh cases remain.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const savedEntries = useMemo(() => [
    ...savedCards.map((entry) => {
      const card = stashDeck.find((item) => String(item.id) === String(entry.id));
      return card ? { id: card.id, title: card.title, category: card.category, summary: card.summary, savedAt: entry.savedAt, route: `/stash/${card.id}` } : null;
    }).filter(Boolean),
    ...savedKnowledgeItems.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category || disciplines.find((discipline) => discipline.id === entry.disciplineId)?.shortTitle || 'Discovery',
      summary: entry.summary,
      savedAt: entry.savedAt,
      route: `/disciplines/${entry.disciplineId}/${entry.id}`,
    })),
  ], [savedCards, savedKnowledgeItems]);
  const categories = useMemo(() => [...new Set(savedEntries.map((card) => card.category))], [savedEntries]);

  const shareResults = async () => {
    const shareText = lastResult?.shareText || `Brain Stash\nLevel ${progress.level} · ${progress.xp} XP · ${progress.streak}-day streak\nKnowledge kept close. Progress kept private.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Brain Stash results', text: shareText });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        window.alert('Result copied. Share it with a friend.');
      } else window.prompt('Copy your result:', shareText);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { window.prompt('Copy your result:', shareText); } catch { /* Sharing is optional. */ }
      }
    }
  };

  const openMode = (mode) => {
    if (mode === 'maths') navigate('/maths');
    else if (mode === 'rebus') startRebus();
    else if (mode === 'stash') openDailyStash();
    else if (mode === 'court') openCourt();
    else navigate('/traps');
  };

  const resetProgress = () => {
    clearStored();
    setProgress(normalizeProgress(emptyProgress));
    setSettings({ ...defaultSettings });
    setSavedCards([]);
    setSavedKnowledgeItems([]);
    setGeneratedItems([]);
    setDropSeenIds([]);
    setKnowledgeSeenIds([]);
    setKnowledgeCurrentVisit(null);
    setMathsSeenKeys([]);
    setMathsAnsweredKeys([]);
    setTrapsSeenIds([]);
    setTrapsAnsweredIds([]);
    setFallaciesSeenIds([]);
    setFallaciesAnsweredIds([]);
    setDropItem(initialDrop(today, 1));
    setDropVisible(true);
    setDropIsDaily(true);
    setActiveCategory(null);
    setDaily({ ...dailyDefaults });
    setStashSessions({});
    setStashSeenIds([]);
    stashFinishLocks.current.clear();
    quizAdvanceLock.current = null;
    setLastResult(null);
    setQuiz(emptyQuiz());
    setRebusSolvedIds([]);
    setRebusSeenIds([]);
    rebusSolvedRef.current.clear();
    setRebusIndex(seededIndex(today, rebusDeck.length));
    setRebusSession({ dayStamp: today, puzzleId: null, selectedTileIds: [], inputValue: '', attempt: 'none', status: 'running', hintCount: 0, hintText: '', awarded: false });
    setCourtAnswers({});
    setCourtSeenIds([]);
    setCourtPassedIds([]);
    setCourtEntryStatus('new');
    setCourtIndex(seededIndex(today, courtDeck.length));
    navigate('/');
  };

  let screen;
  let showNav = true;
  let backLabel = null;
  let onBack = null;

  if (route === '/' || route === '') {
    screen = <HomeScreen progress={progress} daily={{ done: daily.done, onStart: openDailyStash }} modes={modeCards} onSelectMode={openMode} onOpenCollection={() => navigate('/collection')} onExploreDisciplines={() => navigate('/disciplines')} onSurpriseMe={surpriseMe} />;
  } else if (route === '/play') {
    screen = <PlayScreen modes={modeCards} onSelectMode={openMode} onExploreDisciplines={() => navigate('/disciplines')} />;
  } else if (route === '/disciplines' || route.startsWith('/disciplines/')) {
    const segments = route.split('/').filter(Boolean);
    const disciplineId = segments[1] || null;
    const itemId = segments[2] || null;
    screen = <DisciplinesScreen
      disciplines={disciplines}
      disciplineId={disciplineId}
      itemId={itemId}
      remoteItems={sharedItems}
      personalItems={[...generatedItems, ...savedKnowledgeItems]}
      seenItemIds={knowledgeSeenIds}
      currentVisit={knowledgeCurrentVisit}
      isLoadingShared={sharedItemsLoading}
      libraryConfigured={sharedLibraryConfigured}
      isGenerating={generation.loading}
      generationError={generation.disciplineId === disciplineId ? generation.error : ''}
      isItemSaved={isKnowledgeItemSaved}
      onOpenDiscipline={(id) => navigate(`/disciplines/${id}`)}
      onOpenItem={(id, item) => navigate(`/disciplines/${id}/${item}`)}
      onGenerate={generateKnowledgeItem}
      onSaveItem={saveKnowledgeItem}
      onBack={(id) => navigate(id === 'home' ? '/' : id ? `/disciplines/${id}` : '/disciplines')}
    />;
    backLabel = 'Back to disciplines'; onBack = () => navigate('/disciplines');
  } else if (route === '/library-review') {
    screen = <LibraryReviewScreen disciplines={disciplines} onBack={() => navigate('/')} />;
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/maths') {
    const lessonViews = mathLessons.map((lesson) => ({ ...lesson, level: `TIER ${lesson.tier}`, duration: `${lesson.steps.length} STEPS`, summary: lesson.blurb, locked: lesson.tier > progress.mathTier }));
    screen = <MathsLessonsScreen lessons={lessonViews} mathTier={progress.mathTier} onOpenLesson={(id) => { const lesson = mathLessons.find((item) => item.id === id); if (lesson && lesson.tier <= progress.mathTier) { setStepIndex(0); navigate(`/maths/lesson/${id}`); } }} onStartRound={() => startQuiz('maths')} />;
  } else if (route.startsWith('/maths/lesson/')) {
    const lessonId = route.split('/')[3];
    const lesson = mathLessons.find((item) => item.id === lessonId) || mathLessons[0];
    if (lesson.tier > progress.mathTier) {
      screen = <div className="screen-page locked-practice" data-mode="maths"><span className="eyebrow">TECHNIQUE SEALED</span><h1>Tier {lesson.tier} <em>required.</em></h1><p>Complete a maths round with at least 80% accuracy to open the next tier. You are currently at Tier {progress.mathTier}.</p><button className="button button-primary" onClick={() => navigate('/maths')}>Back to techniques <Icon name="arrow" size={16}/></button></div>;
    } else {
      const lessonView = { ...lesson, level: `TIER ${lesson.tier}`, duration: `${lesson.steps.length} STEPS`, summary: lesson.blurb };
      const unlockedLessons = mathLessons.filter((item) => item.tier <= progress.mathTier);
      const lessonIndex = unlockedLessons.findIndex((item) => item.id === lesson.id);
      const previousTechnique = lessonIndex > 0 ? unlockedLessons[lessonIndex - 1] : null;
      const nextTechnique = lessonIndex >= 0 && lessonIndex < unlockedLessons.length - 1 ? unlockedLessons[lessonIndex + 1] : null;
      const openTechnique = (nextLesson) => {
        if (!nextLesson) return;
        setStepIndex(0);
        navigate(`/maths/lesson/${nextLesson.id}`);
      };
      screen = <LessonScreen {...lessonView} lessonId={lesson.id} stepIndex={Math.min(stepIndex, lesson.steps.length - 1)} previousTechnique={previousTechnique} nextTechnique={nextTechnique} techniquePosition={lessonIndex + 1} techniqueTotal={unlockedLessons.length} onPreviousTechnique={() => openTechnique(previousTechnique)} onNextTechnique={() => openTechnique(nextTechnique)} onNext={() => setStepIndex((index) => Math.min(index + 1, lesson.steps.length - 1))} onBack={() => setStepIndex((index) => Math.max(0, index - 1))} onGoBack={() => navigate('/maths')} onStartRound={() => startQuiz('maths', lesson.skillId)} />;
    }
    backLabel = 'Back to maths'; onBack = () => navigate('/maths');
  } else if (route === '/court') {
    screen = <CourtScreen caseItem={currentCourtCase} caseNumber={courtIndex + 1} totalCases={courtDeck.length} selectedId={selectedCourtVerdict} reviewStatus={courtEntryStatus} onSelectVerdict={selectCourtVerdict} onNext={() => moveCourt(1)} onPrevious={() => moveCourt(-1)} />;
    backLabel = 'Back to practice'; onBack = () => navigate('/play');
  } else if (route === '/traps') {
    screen = <ReasoningHubScreen onStartMindTraps={() => startQuiz('traps')} onStartFallacies={() => startQuiz('fallacies')} />;
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/maths/round' || route === '/traps/round' || route === '/fallacies/round') {
    const activeQuestion = currentQuestion;
    if (!activeQuestion) {
      screen = <div className="screen-page" data-mode={quiz.mode === 'maths' ? 'maths' : 'traps'}><p>Opening the next round…</p></div>;
    } else {
      const questionTopicId = activeQuestion.id || `${quiz.mode}-${hashSeed(`${activeQuestion.prompt || ''}|${activeQuestion.context || ''}|${(activeQuestion.options || []).map((option) => option.label).join('|')}`)}`;
      screen = <QuizRoundScreen mode={quiz.mode} topicId={questionTopicId} prompt={activeQuestion.prompt} context={activeQuestion.context} options={activeQuestion.options} status={quiz.status} locked={quiz.locked} reveal={quiz.reveal} explanation={activeQuestion.explanation} timer={timer} tier={quiz.tier} historyStatus={activeQuestion.freshContentStatus || 'new'} questionNumber={quiz.index + 1} totalQuestions={questions.length} onSelect={onSelectQuiz} onNext={onNextQuiz} onQuit={() => navigate(quiz.mode === 'maths' ? '/maths' : '/traps')} />;
    }
    backLabel = 'Leave round'; onBack = () => navigate(quiz.mode === 'maths' ? '/maths' : '/traps');
  } else if (route === '/rebus') {
    const completed = rebusSession.status === 'finished';
    screen = <RebusScreen puzzleId={currentPuzzle.id} imageSrc={currentPuzzle.imageSrc} imageAlt={currentPuzzle.imageAlt} entryMode={currentEntryMode} wordLengths={currentPuzzle.wordLengths} status={rebusSession.status} locked={completed} attempt={rebusSession.attempt} hintsLeft={Math.max(0, currentPuzzle.hintsLeft - rebusSession.hintCount)} hintCost={currentPuzzle.hintCost} timer={null} puzzleNumber={rebusIndex + 1} totalPuzzles={rebusDeck.length} answerText={completed ? currentPuzzle.answer : undefined} explanation={currentPuzzle.explanation} hintText={rebusSession.hintText} canAffordHint={progress.xp >= currentPuzzle.hintCost} reviewStatus={rebusSession.freshContentStatus || (rebusSolvedIds.includes(String(currentPuzzle.id)) ? 'solved' : rebusSeenIds.includes(String(currentPuzzle.id)) ? 'seen' : 'new')} slots={slots} pool={tilePool} inputValue={rebusSession.inputValue} onHint={takeRebusHint} onSkip={skipRebus} onNext={nextRebus} onQuit={() => navigate('/')} onPlaceTile={placeRebusTile} onClearSlot={clearRebusSlot} onInputChange={typeRebusAnswer} onSubmit={submitTypedRebus} />;
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/stash/archive') {
    screen = <StashArchiveScreen cards={stashDeck} unlockedTier={stashUnlockedTier} sessions={stashSessions} seenIds={new Set(stashSeenIds.map(String))} savedIds={new Set(savedCards.map((entry) => String(entry.id)))} onOpenCard={(id) => navigate(`/stash/${id}`)} onBack={() => navigate('/stash')} />;
    backLabel = 'Back to today’s entry'; onBack = () => navigate('/stash');
  } else if (route === '/stash' || route.startsWith('/stash/')) {
    if (stashLocked) {
      screen = <div className="screen-page locked-practice" data-mode="stash"><span className="eyebrow">ARCHIVE SEALED</span><h1>Tier {stashTier(requestedStash)} <em>is not open.</em></h1><p>Complete every Tier 1 entry to unlock the next collection of principles.</p><button className="button button-primary" onClick={() => navigate('/stash')}>Return to today’s entry <Icon name="arrow" size={16}/></button></div>;
    } else if (!hasValidStashQuiz) {
      screen = <div className="screen-page locked-practice" data-mode="stash"><span className="eyebrow">ARCHIVE FILE UNAVAILABLE</span><h1>This entry is <em>incomplete.</em></h1><p>The selected archive file is missing its reflection question. Your progress is safe. Return to the archive and open another entry.</p><button className="button button-primary" onClick={() => navigate('/stash/archive')}>Back to archive <Icon name="arrow" size={16}/></button></div>;
    } else {
      const currentQuiz = currentStashQuiz;
      const reveal = stashSession.locked ? { selectedId: stashSession.selectedId, correctId: currentQuiz.correctId, timedOut: false } : null;
      const stashCardIndex = eligibleStashDeck.findIndex((card) => String(card.id) === String(currentStash.id));
      const previousStashCard = stashCardIndex > 0 ? eligibleStashDeck[stashCardIndex - 1] : null;
      const stashAfterCurrent = stashCardIndex >= 0
        ? [...eligibleStashDeck.slice(stashCardIndex + 1), ...eligibleStashDeck.slice(0, stashCardIndex)]
        : eligibleStashDeck;
      const nextStashCard = stashAfterCurrent.find((card) => !stashSeenSet.has(String(card.id)) && !stashSessions[card.id])
        || stashAfterCurrent.find((card) => stashSessions[card.id] && !stashSessions[card.id]?.completed)
        || stashAfterCurrent.find((card) => stashSeenSet.has(String(card.id)) && !stashSessions[card.id])
        || stashAfterCurrent[0]
        || null;
      screen = <StashCardScreen card={currentStash} isDailyCard={String(currentStash.id) === String(dailyStash?.id)} saved={saved} quiz={currentQuiz} quizReveal={reveal} locked={stashSession.locked} completed={stashSession.completed} unlockedTier={stashUnlockedTier} canTeach={isOnline} lessonState={lessonState} diagnosisState={diagnosisState} previousCard={previousStashCard} nextCard={nextStashCard} cardPosition={stashCardIndex + 1} cardTotal={eligibleStashDeck.length} onPreviousCard={() => previousStashCard && navigate(`/stash/${previousStashCard.id}`)} onNextCard={() => nextStashCard && navigate(`/stash/${nextStashCard.id}`)} onTeach={() => teaching.teach(currentStash)} onDiagnose={() => missedOptionId && teaching.diagnose(currentStash, missedOptionId)} onSave={saveStashCard} onSelectQuizOption={answerStashQuiz} onDone={finishStash} onOpenCollection={() => navigate('/collection')} onOpenArchive={() => navigate('/stash/archive')} />;
    }
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/collection') {
    screen = <CollectionScreen cards={savedEntries} categories={categories} activeCategory={activeCategory} onFilter={setActiveCategory} onOpenCard={(id, itemRoute) => navigate(itemRoute || `/stash/${id}`)} onBack={() => navigate('/')} />;
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/result' && lastResult) {
    screen = <ResultScreen {...lastResult} onShare={shareResults} onRetry={() => startQuiz(lastResult.mode === 'fallacies' ? 'fallacies' : lastResult.mode === 'traps' ? 'traps' : 'maths')} onHome={() => navigate('/')} />;
    backLabel = 'Back to home'; onBack = () => navigate('/');
  } else if (route === '/settings') {
    screen = <SettingsScreen settings={settings} onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} onResetProgress={resetProgress} onBack={() => navigate('/profile')} />;
    backLabel = 'Back to profile'; onBack = () => navigate('/profile');
  } else if (route === '/profile') {
    screen = <ProfileScreen progress={progress} savedCount={savedCards.length + savedKnowledgeItems.length} onSettings={() => navigate('/settings')} onCollection={() => navigate('/collection')} onShare={shareResults} />;
  } else {
    screen = <div className="not-found"><Icon name="eye" size={27}/><h1>That page is out of the archive.</h1><p>The page may have moved. Your progress is still here.</p><button className="button button-primary" onClick={() => navigate('/')}>Return home <Icon name="arrow" size={16}/></button></div>;
  }

  const dropSaved = dropItem?.originalCardId
    ? savedCards.some((entry) => String(entry.id) === String(dropItem.originalCardId))
    : isKnowledgeItemSaved(dropItem?.id);

  return <AppShell route={route} progress={progress} onNavigate={navigate} onSettings={() => navigate('/settings')} showNav={showNav} backLabel={backLabel} onBack={onBack}>
    {!isOnline && <div className="offline-ribbon"><span/> OFFLINE MODE · YOUR ARCHIVE IS AVAILABLE</div>}
    {screen}
    {route === '/' && dropVisible && dropItem && <StashDropModal item={{ ...dropItem, isDaily: dropIsDaily }} saved={dropSaved} onSave={() => saveDiscovery(dropItem)} onTeach={() => teachDrop(dropItem)} onSurprise={surpriseMe} onDismiss={dismissDrop} />}
  </AppShell>;
}
