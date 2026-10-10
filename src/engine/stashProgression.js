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
