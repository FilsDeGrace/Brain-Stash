/** Pure tier helpers for the local Deep Stash archive. */
export function stashTier(card) {
  return Number(card?.tier ?? card?.difficulty ?? 1) || 1;
}

/** Tier 2 unlocks only after every Tier 1 card is marked complete. */
export function getUnlockedStashTier(cards, sessions) {
  const tierOne = cards.filter((card) => stashTier(card) === 1);
  if (!tierOne.length) return 1;
  return tierOne.every((card) => Boolean(sessions?.[card.id]?.completed)) ? 2 : 1;
}

export function getEligibleStashCards(cards, unlockedTier) {
  return cards.filter((card) => stashTier(card) <= unlockedTier);
}

/**
 * Chooses the card to show for the current route.
 * A requested card that exists and is unlocked wins. Otherwise fall back to
 * today's card, then to the first card in the deck. Always returns a card
 * object (or null for an empty deck), never a boolean.
 */
export function resolveCurrentStash({ requested, locked, daily, deck }) {
  if (requested && !locked) return requested;
  return daily || deck?.[0] || null;
}
