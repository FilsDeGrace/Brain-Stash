import React from 'react';
import Icon from '../components/Icons.jsx';

export default function CollectionScreen({ cards, categories, activeCategory, onFilter, onOpenCard, onBack }) {
  const visible = activeCategory ? cards.filter((card) => card.category === activeCategory) : cards;
  return <section className="screen-page collection-screen" data-mode="stash">
    <div className="page-heading"><div><span className="eyebrow">YOUR PRIVATE ARCHIVE</span><h1>The <em>collection.</em></h1><p>Ideas you chose to keep, ready to revisit.</p></div><div className="heading-glyph"><Icon name="bookmark" size={27}/></div></div>
    <div className="collection-toolbar"><span>{cards.length} {cards.length === 1 ? 'ENTRY' : 'ENTRIES'} SAVED</span><button className="text-back" onClick={onBack}><Icon name="back" size={15}/> BACK</button></div>
    {cards.length > 0 && <div className="category-filters"><button className={!activeCategory ? 'filter-active' : ''} onClick={() => onFilter(null)}>All</button>{categories.map((category) => <button className={activeCategory === category ? 'filter-active' : ''} key={category} onClick={() => onFilter(category)}>{category}</button>)}</div>}
    {visible.length === 0 ? <div className="empty-archive"><div className="empty-seal"><Icon name="book" size={28}/></div><span className="eyebrow">NOTHING FILED YET</span><h2>Nothing saved yet.</h2><p>When an idea stays with you, save it here. Your archive grows one useful thought at a time.</p><button className="button button-primary" onClick={() => onOpenCard('daily')}>Discover today’s idea <Icon name="arrow" size={16}/></button></div> : <div className="saved-card-list">{visible.map((card, index) => <button className="saved-card-row" key={card.id} onClick={() => onOpenCard(card.id)}><span className="saved-card-index">{String(index + 1).padStart(2,'0')}</span><span className="saved-card-copy"><small>{card.category} · SAVED {new Date(card.savedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</small><strong>{card.title}</strong><span>{card.summary}</span></span><Icon name="arrow" size={17}/></button>)}</div>}
  </section>;
}
