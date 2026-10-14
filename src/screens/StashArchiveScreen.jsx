import React from 'react';
import Icon from '../components/Icons.jsx';

/** Browse the complete stash deck while respecting local tier unlocks. */
export default function StashArchiveScreen({ cards, unlockedTier, sessions, seenIds = new Set(), savedIds, onOpenCard, onBack }) {
  const tierOneCards = cards.filter((card) => Number(card.tier ?? card.difficulty ?? 1) === 1);
  const completedCount = cards.filter((card) => sessions[card.id]?.completed).length;
  const tierOneCompleted = tierOneCards.filter((card) => sessions[card.id]?.completed).length;
  const availableCount = cards.filter((card) => Number(card.tier ?? card.difficulty ?? 1) <= unlockedTier).length;
  const progressCount = unlockedTier < 2 ? tierOneCompleted : completedCount;
  const progressTotal = unlockedTier < 2 ? tierOneCards.length : cards.length;

  return <section className="screen-page stash-archive-screen" data-mode="stash">
    <div className="page-heading">
      <div><span className="eyebrow">THE PRIVATE ARCHIVE</span><h1>Browse the <em>stash.</em></h1><p>Find a new principle, continue where you left off, or revisit an idea worth remembering.</p></div>
      <div className="heading-glyph"><Icon name="book-open" size={27}/></div>
    </div>
    <div className="archive-progress-strip">
      <div><span className="eyebrow">{unlockedTier < 2 ? 'TIER 1 UNLOCK PROGRESS' : 'TIER 2 UNLOCKED'}</span><strong>{progressCount} <small>/ {progressTotal} completed</small></strong></div>
      <div className="archive-progress-track" role="progressbar" aria-label="Archive principles completed" aria-valuemin={0} aria-valuemax={progressTotal} aria-valuenow={progressCount}><span style={{width: `${progressTotal ? progressCount / progressTotal * 100 : 0}%`}}/></div>
      <p>{unlockedTier < 2 ? 'Complete every Tier 1 principle to reveal Tier 2.' : 'Tier 2 is open. Keep working through the archive at your own pace.'}</p>
    </div>
    <div className="collection-toolbar"><span>{availableCount} AVAILABLE · {cards.length - availableCount} SEALED</span><button className="text-back" onClick={onBack}><Icon name="back" size={15}/> BACK TO ENTRY</button></div>
    <div className="saved-card-list stash-archive-list">
      {cards.map((card, index) => {
        const tier = Number(card.tier ?? card.difficulty ?? 1) || 1;
        const completed = Boolean(sessions[card.id]?.completed);
        const wasSeen = seenIds instanceof Set ? seenIds.has(String(card.id)) : Array.isArray(seenIds) && seenIds.map(String).includes(String(card.id));
        const inProgress = Boolean(sessions[card.id]?.locked && !completed);
        const isSaved = savedIds.has(String(card.id));
        const isLocked = tier > unlockedTier;
        return <button className={`saved-card-row stash-archive-row ${isLocked ? 'archive-row-locked' : ''}`} key={card.id} onClick={() => !isLocked && onOpenCard(card.id)} disabled={isLocked} aria-label={isLocked ? `${card.title}, Tier ${tier}, locked` : `Open ${card.title}${completed ? ', completed' : inProgress ? ', in progress' : wasSeen ? ', seen before' : ''}`}>
          <span className="saved-card-index">{completed ? <Icon name="check" size={16}/> : isLocked ? <Icon name="lock" size={15}/> : String(index + 1).padStart(2, '0')}</span>
          <span className="saved-card-copy"><small>TIER {tier} · {card.category}{isSaved ? ' · SAVED' : ''}</small><strong>{card.title}</strong><span>{isLocked ? 'Complete all Tier 1 entries to unlock this principle.' : card.summary}</span></span>
          <span className={`archive-row-status ${completed ? 'is-complete' : isLocked ? 'is-locked' : inProgress ? 'is-progress' : wasSeen ? 'is-seen' : ''}`}>{completed ? 'DONE' : isLocked ? 'SEALED' : inProgress ? 'IN PROGRESS' : wasSeen ? 'SEEN' : 'OPEN'}</span>
          <Icon name={isLocked ? 'lock' : 'arrow'} size={16}/>
        </button>;
      })}
    </div>
  </section>;
}
