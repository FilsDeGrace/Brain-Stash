import React from 'react';
import Icon from '../components/Icons.jsx';
import ModeCards from '../components/ModeCards.jsx';

/** Practice hub: every discipline in one place. */
export default function PlayScreen({ modes, onSelectMode }) {
  return <section className="screen-page play-screen" data-mode="stash">
    <div className="page-heading">
      <div><span className="eyebrow">PLAY</span><h1>Choose your <em>practice.</em></h1><p>Four ways to train your thinking. Pick one and start.</p></div>
      <span className="heading-glyph"><Icon name="play" size={27}/></span>
    </div>
    <div className="modes-section"><ModeCards modes={modes} onSelectMode={onSelectMode} /></div>
  </section>;
}
