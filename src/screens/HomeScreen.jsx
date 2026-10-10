import React from 'react';
import Icon from '../components/Icons.jsx';

const modeMeta = {
  maths: { icon: 'bolt', number: '01', accent: 'bronze' },
  rebus: { icon: 'eye', number: '02', accent: 'terracotta' },
  stash: { icon: 'book', number: '03', accent: 'gold' },
  traps: { icon: 'target', number: '04', accent: 'oxblood' },
};

export default function HomeScreen({ progress, daily, modes, onSelectMode, onOpenCollection }) {
  return <div className="home-screen" data-mode="stash">
    <section className="daily-hero">
      <div className="hero-topline"><span className="eyebrow"><i className="eyebrow-mark"/> DAILY CHALLENGE</span><span className={`completion-tag ${daily.done.stash ? 'is-done' : ''}`}>{daily.done.stash ? <><Icon name="check" size={13}/> COMPLETED</> : 'TODAY · 01'}</span></div>
      <div className="hero-copy">
        <h1>A sharper mind<br/><em>is built daily.</em></h1>
        <p>One useful idea. One question. A little more clarity than yesterday.</p>
      </div>
      <div className="hero-footer">
        <button className="button button-primary" onClick={daily.onStart}>{daily.done.stash ? 'Review today’s idea' : 'Enter today’s challenge'} <Icon name="arrow" size={17}/></button>
        <div className="hero-seal" aria-hidden="true"><span className="seal-orbit"/><span className="seal-cross">✳</span><small>NO. 001</small></div>
      </div>
      <span className="hero-corner corner-tl"/><span className="hero-corner corner-br"/>
    </section>

    <section className="progress-strip" aria-label="Your progress">
      <div className="progress-stat"><span className="stat-icon bronze"><Icon name="flame" size={17}/></span><div><strong>{progress.streak} <small>day{progress.streak === 1 ? '' : 's'}</small></strong><span>STREAK</span></div></div>
      <div className="stat-rule"/>
      <div className="progress-stat"><span className="stat-icon gold"><Icon name="bolt" size={17}/></span><div><strong>{progress.xp.toLocaleString()} <small>XP</small></strong><span>COLLECTED</span></div></div>
      <div className="stat-rule"/>
      <div className="progress-stat level-stat"><span className="level-orbit">{String(progress.level).padStart(2,'0')}</span><div><strong>Level {progress.level}</strong><div className="mini-progress"><span style={{ width: `${Math.min(100, (progress.xp % 120) / 120 * 100)}%` }}/></div><span>{progress.xpToNext} XP TO NEXT</span></div></div>
    </section>

    <section className="modes-section">
      <div className="section-heading"><div><span className="eyebrow">CHOOSE YOUR PRACTICE</span><h2>The four disciplines</h2></div><span className="section-index">A — D</span></div>
      <button className="mode-card stash-feature" onClick={() => onSelectMode('stash')} data-mode="stash">
        <div className="feature-seal"><Icon name="book" size={25}/><span className="seal-tick"/></div>
        <div className="mode-info"><div className="mode-overline">THE SIGNATURE COLLECTION <span>03</span></div><h3>Deep Stash</h3><p>Principles worth keeping. Discover, test, and collect them.</p><div className="mode-link">OPEN THE ARCHIVE <Icon name="arrow" size={15}/></div></div>
        <Icon className="mode-chevron" name="arrow" size={18}/>
      </button>
      <div className="mode-grid">
        {modes.filter((mode) => mode.id !== 'stash').map((mode) => {
          const meta = modeMeta[mode.id];
          return <button key={mode.id} className={`mode-card compact-mode mode-${mode.id}`} onClick={() => onSelectMode(mode.id)} data-mode={mode.id}>
            <div className="compact-top"><span className={`mode-icon ${meta.accent}`}><Icon name={meta.icon} size={19}/></span><span className="mode-number">{meta.number}</span></div>
            <h3>{mode.title}</h3><p>{mode.blurb}</p>
            <div className="compact-bottom"><span>{mode.badge || 'PRACTICE'}</span><Icon name="arrow" size={15}/></div>
          </button>;
        })}
      </div>
    </section>
    <section className="home-footnote"><span className="tiny-seal">✳</span><p>Knowledge kept close. Progress kept private.</p><button onClick={onOpenCollection}>VIEW YOUR ARCHIVE <Icon name="arrow" size={13}/></button></section>
  </div>;
}
