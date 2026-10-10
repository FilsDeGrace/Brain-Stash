const PREFIX = 'brain-stash:';

export function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearStored() {
  try {
    Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Private browsing or disabled storage: the in-memory app remains usable.
  }
}

export function localDayStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayBefore(stamp) {
  const date = new Date(`${stamp}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return localDayStamp(date);
}
