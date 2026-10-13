import React from 'react';
import Icon from '../components/Icons.jsx';
import ModeCards from '../components/ModeCards.jsx';

/** Practice hub: every discipline in one place. */
export default function PlayScreen({ modes, onSelectMode, onExploreDisciplines }) {
  return <section className="screen-page play-screen" data-mode="stash">
    <div className="page-heading">
      <div><span className="eyebrow">PLAY</span><h1>Choose your <em>practice.</em></h1><p>Train your reasoning, then explore the ideas and systems behind everyday life.</p></div>
      <span className="heading-glyph"><Icon name="play" size={27}/></span>
    </div>
    <div className="modes-section"><ModeCards modes={modes} onSelectMode={onSelectMode} /></div>
    <section className="knowledge-wing-teaser play-knowledge-teaser">
      <div className="knowledge-wing-copy"><span className="eyebrow">THE KNOWLEDGE WING · 07 DISCIPLINES</span><h2>Learn what sits <em>underneath.</em></h2><p>Psychology, influence, scale, principles, practical intelligence, hidden systems and money.</p></div>
      <button className="button button-primary" onClick={onExploreDisciplines}>Explore all seven <Icon name="arrow" size={16}/></button>
    </section>
  </section>;
}
