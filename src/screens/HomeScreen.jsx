import React from 'react';
import Icon from '../components/Icons.jsx';
import ModeCards from '../components/ModeCards.jsx';

export default function HomeScreen({ progress, daily, modes, onSelectMode, onOpenCollection, onExploreDisciplines, onSurpriseMe }) {
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
      <div className="section-heading"><div><span className="eyebrow">CHOOSE YOUR PRACTICE</span><h2>Core practice modes</h2></div><span className="section-index">01 — 05</span></div>
      <ModeCards modes={modes} onSelectMode={onSelectMode} />
    </section>
    <section className="knowledge-wing-teaser">
      <div className="knowledge-wing-copy"><span className="eyebrow">THE KNOWLEDGE WING · 07 DISCIPLINES</span><h2>Look beneath <em>the obvious.</em></h2><p>Human nature, manipulation, hidden systems, money psychology and more.</p></div>
      <div className="knowledge-wing-actions"><button className="button button-primary" onClick={onExploreDisciplines}>Explore disciplines <Icon name="arrow" size={16}/></button><button className="button button-quiet bordered-button" onClick={onSurpriseMe}><Icon name="spark" size={16}/> Surprise me</button></div>
    </section>
    <section className="home-footnote"><span className="tiny-seal">✳</span><p>Knowledge kept close. Progress kept private.</p><button onClick={onOpenCollection}>VIEW YOUR ARCHIVE <Icon name="arrow" size={13}/></button></section>
  </div>;
}
