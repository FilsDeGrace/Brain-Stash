import React from 'react';
import Icon from '../components/Icons.jsx';

export default function ReasoningHubScreen({ onStartMindTraps, onStartFallacies }) {
  return <section className="screen-page reasoning-hub" data-mode="traps">
    <div className="page-heading">
      <div><span className="eyebrow">DISCIPLINE 04 · REASONING</span><h1>Look past <em>the obvious.</em></h1><p>Test your first instinct, then learn to recognise the shape of flawed reasoning.</p></div>
      <div className="heading-glyph"><Icon name="target" size={27}/></div>
    </div>
    <div className="reasoning-route-list">
      <button className="reasoning-route-card" onClick={onStartMindTraps}>
        <span className="reasoning-route-index">01</span>
        <span className="reasoning-route-icon"><Icon name="target" size={24}/></span>
        <span className="reasoning-route-copy"><strong>Mind Traps</strong><small>Arithmetic intuition, probability, averages, and misleading patterns.</small><em>15 QUESTIONS · UNTIMED</em></span>
        <Icon name="arrow" size={18}/>
      </button>
      <button className="reasoning-route-card fallacies-route" onClick={onStartFallacies}>
        <span className="reasoning-route-index">02</span>
        <span className="reasoning-route-icon"><Icon name="scale" size={24}/></span>
        <span className="reasoning-route-copy"><strong>Fallacies</strong><small>Spot ad hominem, straw men, false dilemmas, and faulty causal claims.</small><em>10 QUESTIONS · UNTIMED</em></span>
        <Icon name="arrow" size={18}/>
      </button>
    </div>
    <div className="reasoning-note"><Icon name="book-open" size={17}/><p>Each answer includes an explanation. The point is not only to be right, but to see why the other answers fail.</p></div>
  </section>;
}
