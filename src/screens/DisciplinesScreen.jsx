import React from 'react';
import Icon from '../components/Icons.jsx';

function itemKindLabel(item) {
  return String(item?.kind || 'discovery').replaceAll('-', ' ').toUpperCase();
}

function itemPath(item) {
  return `/disciplines/${item.disciplineId}/${item.id}`;
}

function mergeItems(discipline, remoteItems, personalItems) {
  const local = (discipline?.items || []).map((item) => ({ ...item, disciplineId: discipline.id, status: 'approved', source: 'bundled' }));
  const matches = (items) => (items || []).filter((item) => item && item.disciplineId === discipline?.id);
  const seen = new Set();
  return [...matches(remoteItems), ...matches(personalItems), ...local].filter((item) => {
    if (!item.id || seen.has(String(item.id))) return false;
    seen.add(String(item.id));
    return true;
  });
}

function KindBadge({ item }) {
  const isPending = item.status === 'pending';
  return <span className={`content-status ${isPending ? 'is-pending' : ''}`}>{isPending ? 'DRAFT · REVIEW PENDING' : ['ai', 'shared'].includes(item.source) ? 'SHARED LIBRARY' : itemKindLabel(item)}</span>;
}

export default function DisciplinesScreen({
  disciplines,
  disciplineId = null,
  itemId = null,
  remoteItems = [],
  personalItems = [],
  isLoadingShared = false,
  libraryConfigured = null,
  isGenerating = false,
  generationError = '',
  isItemSaved = () => false,
  onOpenDiscipline,
  onOpenItem,
  onGenerate,
  onSaveItem,
  onBack,
}) {
  const discipline = disciplines.find((entry) => entry.id === disciplineId) || null;

  if (!discipline) {
    return <section className="screen-page disciplines-screen" data-mode="stash">
      <button className="text-back" onClick={() => onBack('home')}><Icon name="back" size={15}/> BACK TO HOME</button>
      <div className="page-heading"><div><span className="eyebrow">THE KNOWLEDGE WING</span><h1>Explore the <em>deeper layer.</em></h1><p>Seven disciplines for understanding people, systems, reality and the choices that shape your life.</p></div><span className="heading-glyph"><Icon name="brain" size={27}/></span></div>
      <div className="discipline-intro-note"><Icon name="spark" size={18}/><p>Read a discovery, test yourself, save what matters, and let the library grow over time.</p></div>
      <div className="discipline-grid">
        {disciplines.map((entry, index) => <button className={`discipline-card accent-${entry.accent || 'bronze'}`} key={entry.id} onClick={() => onOpenDiscipline(entry.id)}>
          <div className="discipline-card-top"><span className="discipline-icon"><Icon name={entry.icon || 'book'} size={21}/></span><span className="mode-number">{String(index + 1).padStart(2, '0')}</span></div>
          <span className="eyebrow">{entry.shortTitle.toUpperCase()}</span>
          <h2>{entry.title}</h2><p>{entry.kicker}</p>
          <div className="discipline-card-bottom"><span>{entry.items.length} STARTER DISCOVERIES</span><Icon name="arrow" size={16}/></div>
        </button>)}
      </div>
      <div className="discipline-footer"><Icon name="book" size={17}/><p>Explore a growing collection of ideas, with new discoveries reviewed before they are shared.</p></div>
    </section>;
  }

  const items = mergeItems(discipline, remoteItems, personalItems);
  const selectedItem = itemId ? items.find((entry) => String(entry.id) === String(itemId)) : null;

  if (itemId && selectedItem) {
    const pending = selectedItem.status === 'pending';
    return <section className="screen-page knowledge-detail-screen" data-mode="stash">
      <button className="text-back" onClick={() => onBack(discipline.id)}><Icon name="back" size={15}/> BACK TO {discipline.shortTitle.toUpperCase()}</button>
      <div className="knowledge-detail-top"><span className="eyebrow">{discipline.title.toUpperCase()}</span><KindBadge item={selectedItem}/></div>
      <h1>{selectedItem.title}</h1>
      <p className="knowledge-deck">{selectedItem.summary}</p>
      {pending && <div className="draft-notice"><Icon name="clock" size={18}/><p><strong>Draft awaiting review.</strong> You can read and save this discovery now. It will become part of the shared library only after it is approved.</p></div>}
      {discipline.disclaimer && <div className="finance-disclaimer">{discipline.disclaimer}</div>}
      <article className="knowledge-paper">
        <div className="knowledge-section"><span className="eyebrow">THE IDEA</span><p>{selectedItem.explanation}</p></div>
        {selectedItem.example && <div className="knowledge-section"><span className="eyebrow">IN REAL LIFE</span><p>{selectedItem.example}</p></div>}
        {selectedItem.whyItMatters && <div className="knowledge-section"><span className="eyebrow">WHY IT MATTERS</span><p>{selectedItem.whyItMatters}</p></div>}
        {selectedItem.tryThis && <div className="knowledge-action"><Icon name="target" size={20}/><div><span className="eyebrow">PUT IT TO USE</span><p>{selectedItem.tryThis}</p></div></div>}
        {selectedItem.question && <details className="recall-question"><summary><Icon name="brain" size={16}/> Test your recall</summary><p>{selectedItem.question}</p><details><summary>Reveal answer</summary><p>{selectedItem.answer || 'Return to the explanation and state the central idea in your own words.'}</p></details></details>}
      </article>
      {Array.isArray(selectedItem.sources) && selectedItem.sources.length > 0 && <section className="knowledge-sources"><span className="eyebrow">SOURCES TO CHECK</span>{selectedItem.sources.map((source) => <a key={`${source.url}-${source.label}`} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.label}</span><Icon name="arrow" size={14}/></a>)}<p>AI-generated sources should be checked before a draft is approved for everyone.</p></section>}
      <div className="knowledge-actions">
        <button className="button button-primary" onClick={() => onSaveItem(selectedItem)} disabled={isItemSaved(selectedItem.id)}><Icon name={isItemSaved(selectedItem.id) ? 'check' : 'bookmark'} size={16}/>{isItemSaved(selectedItem.id) ? 'Saved to your collection' : 'Stash this discovery'}</button>
        <button className="button button-quiet bordered-button" onClick={() => onGenerate(discipline.id)} disabled={isGenerating || isLoadingShared || libraryConfigured === false}><Icon name="spark" size={16}/>{libraryConfigured === false ? 'Unavailable' : isGenerating ? 'Generating…' : 'Generate another'}</button>
      </div>
      {generationError && <p className="inline-error" role="status">{generationError}</p>}
      <button className="text-link centered-link" onClick={() => onBack(null)}>Explore all seven disciplines <Icon name="arrow" size={14}/></button>
    </section>;
  }

  if (itemId && !selectedItem && !isLoadingShared) {
    return <section className="screen-page locked-practice" data-mode="stash"><span className="eyebrow">ENTRY NOT AVAILABLE</span><h1>This discovery is <em>not here.</em></h1><p>It may have been removed or is not available on this device. The rest of your library is safe.</p><button className="button button-primary" onClick={() => onBack(discipline.id)}>Back to {discipline.shortTitle} <Icon name="arrow" size={16}/></button></section>;
  }

  return <section className="screen-page discipline-detail-screen" data-mode="stash">
    <button className="text-back" onClick={() => onBack(null)}><Icon name="back" size={15}/> ALL DISCIPLINES</button>
    <div className="page-heading"><div><span className="eyebrow">DISCIPLINE FILE · {discipline.shortTitle.toUpperCase()}</span><h1>{discipline.title}</h1><p>{discipline.description}</p></div><span className="heading-glyph"><Icon name={discipline.icon || 'book'} size={27}/></span></div>
    {discipline.disclaimer && <div className="finance-disclaimer">{discipline.disclaimer}</div>}
    <div className="generate-panel"><div className="generate-panel-mark"><Icon name="spark" size={22}/></div><div className="generate-panel-copy"><strong>Expand this discipline</strong><p>{libraryConfigured === false ? 'New AI discoveries are not available yet. You can still explore the starter collection below.' : 'Generate a new discovery for this discipline. It will be checked before it is shared.'}</p><small>{isLoadingShared ? 'Checking the shared library…' : libraryConfigured === false ? 'STARTER COLLECTION AVAILABLE' : 'NEW DISCOVERIES · CHECKED BEFORE SHARING'}</small></div><button className="button button-primary" onClick={() => onGenerate(discipline.id)} disabled={isGenerating || isLoadingShared || libraryConfigured === false}>{libraryConfigured === false ? 'Unavailable' : isGenerating ? 'Generating…' : 'Generate'} <Icon name="arrow" size={15}/></button></div>
    {generationError && <p className="inline-error" role="status">{generationError}</p>}
    <div className="section-heading discipline-list-heading"><div><span className="eyebrow">THE FILES</span><h2>Discoveries</h2></div><span className="count-label">{items.length} ENTRIES</span></div>
    <div className="knowledge-list">
      {items.map((item, index) => <button className="knowledge-row" key={item.id} onClick={() => onOpenItem(discipline.id, item.id)}>
        <span className="knowledge-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="knowledge-row-copy"><small>{String(item.category || discipline.shortTitle).toUpperCase()} · {item.status === 'pending' ? 'DRAFT' : itemKindLabel(item)}</small><strong>{item.title}</strong><span>{item.summary}</span></span>
        <Icon name="arrow" size={16}/>
      </button>)}
    </div>
    {isLoadingShared && <p className="quiet-note">Loading approved contributions from the shared library…</p>}
    {!items.length && !isLoadingShared && <p className="quiet-note">No entries are available yet. Generate the first draft for this discipline.</p>}
    <button className="text-link centered-link" onClick={() => onBack(null)}>Return to all disciplines <Icon name="arrow" size={14}/></button>
  </section>;
}
