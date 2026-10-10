// Answer matching for Rebus puzzles. Ignores case, spaces and punctuation.
export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function isCorrect(puzzle, input) {
  const guess = normalize(input);
  if (!guess) return false;
  return [puzzle.answer, ...(puzzle.accepts ?? [])].some((a) => normalize(a) === guess);
}

// Answers up to this many letters use tile entry; longer ones use free typing.
export const TILE_MAX_LETTERS = 12;
export const entryModeFor = (puzzle) =>
  puzzle.letterCount <= TILE_MAX_LETTERS ? 'tiles' : 'typing';
