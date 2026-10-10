import React from 'react';
import Icon from '../components/Icons.jsx';

export default function ResultScreen({ mode, score, total, xpGained, newLevel, streak, shareText, onShare, onRetry, onHome }) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const title = mode === 'maths' ? 'Quick Maths' : mode === 'traps' ? 'Mind Traps' : mode === 'fallacies' ? 'Fallacies' : mode === 'rebus' ? 'Rebus' : 'Deep Stash';
  return <section className="screen-page result-screen" data-mode={mode === 'traps' || mode === 'fallacies' ? 'traps' : mode === 'rebus' ? 'rebus' : mode === 'maths' ? 'maths' : 'stash'}>
    <div className="result-ornament" aria-hidden="true"><span/><span/><b>✳</b></div>
    <span className="eyebrow">SESSION COMPLETE · {title.toUpperCase()}</span>
    <h1>{percent >= 80 ? 'Sharp work.' : percent >= 50 ? 'Good practice.' : 'Every round teaches.'}</h1>
    <p className="result-lead">The point is not perfection. It is noticing a little more than you did before.</p>
    <div className="score-artifact"><div className="score-ring" style={{'--score': `${percent}%`}}><div><strong>{score}<small>/{total}</small></strong><span>CORRECT</span></div></div><div className="score-side"><span className="eyebrow">ROUND SCORE</span><strong>{percent}%</strong><span>{percent >= 80 ? 'A disciplined result.' : percent >= 50 ? 'The patterns will stick with practice.' : 'Review the explanations and try again.'}</span></div></div>
    <div className="result-rewards"><div><Icon name="bolt" size={18}/><span>XP EARNED</span><strong>+{xpGained}</strong></div><div><Icon name="flame" size={18}/><span>DAY STREAK</span><strong>{streak}</strong></div><div><Icon name="target" size={18}/><span>LEVEL</span><strong>{newLevel || '—'}</strong></div></div>
    <div className="result-actions"><button className="button button-primary button-wide" onClick={onRetry}><Icon name="refresh" size={16}/> Run it again</button><button className="button button-quiet bordered-button button-wide" onClick={onShare}><Icon name="share" size={16}/> Share result</button><button className="text-link centered-link" onClick={onHome}>Return to home <Icon name="arrow" size={14}/></button></div>
    <p className="privacy-note"><Icon name="lock" size={13}/> Your progress stays on this device.</p>
  </section>;
}
