import React from 'react';
import Icon from './Icons.jsx';

const modeMeta = {
  maths: { icon: 'bolt', number: '01', accent: 'bronze' },
  rebus: { icon: 'eye', number: '02', accent: 'terracotta' },
  stash: { icon: 'book', number: '03', accent: 'gold' },
  traps: { icon: 'target', number: '04', accent: 'oxblood' },
  court: { icon: 'target', number: '05', accent: 'bronze' },
};

/** Practice disciplines: the Deep Stash feature card plus the compact grid. */
export default function ModeCards({ modes, onSelectMode }) {
  return <>
    <button className="mode-card stash-feature" onClick={() => onSelectMode('stash')} data-mode="stash">
      <div className="feature-seal"><Icon name="book" size={25}/><span className="seal-tick"/></div>
      <div className="mode-info"><div className="mode-overline">THE SIGNATURE COLLECTION <span>03</span></div><h3>Deep Stash</h3><p>Principles worth keeping. Discover, test, and collect them.</p><div className="mode-link">OPEN THE ARCHIVE <Icon name="arrow" size={15}/></div></div>
      <Icon className="mode-chevron" name="arrow" size={18}/>
    </button>
    <div className="mode-grid">
      {(Array.isArray(modes) ? modes : []).filter((mode) => mode && mode.id !== 'stash').map((mode, index) => {
        const meta = modeMeta[mode.id] || { icon: 'play', number: String(index + 1).padStart(2, '0'), accent: 'bronze' };
        return <button key={mode.id} className={`mode-card compact-mode mode-${mode.id}`} onClick={() => onSelectMode(mode.id)} data-mode={mode.id}>
          <div className="compact-top"><span className={`mode-icon ${meta.accent}`}><Icon name={meta.icon} size={19}/></span><span className="mode-number">{meta.number}</span></div>
          <h3>{mode.title}</h3><p>{mode.blurb}</p>
          <div className="compact-bottom"><span>{mode.badge || 'PRACTICE'}</span><Icon name="arrow" size={15}/></div>
        </button>;
      })}
    </div>
  </>;
}
