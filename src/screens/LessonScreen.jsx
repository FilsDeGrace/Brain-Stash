import React from 'react';
import Icon from '../components/Icons.jsx';

export default function LessonScreen({ title, level, duration, summary, steps, stepIndex, onNext, onBack, onGoBack, onStartRound }) {
  const step = steps[stepIndex];
  return <section className="screen-page lesson-screen" data-mode="maths">
    <button className="text-back" onClick={onGoBack}><Icon name="back" size={16}/> ALL TECHNIQUES</button>
    <div className="lesson-masthead"><span className="eyebrow">QUICK MATHS · {level}</span><span className="duration-chip"><Icon name="clock" size={14}/> {duration}</span></div>
    <h1>{title}</h1><p className="lead-copy">{summary}</p>
    <div className="step-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}><span>{String(stepIndex + 1).padStart(2,'0')}</span><div className="mini-progress"><span style={{width: `${((stepIndex + 1) / steps.length) * 100}%`}}/></div><span>{String(steps.length).padStart(2,'0')}</span></div>
    <article className="lesson-paper"><span className="paper-index">STEP {String(stepIndex + 1).padStart(2,'0')}</span><h2>{step.heading}</h2><p>{step.body}</p>{step.example && <div className="example-box"><span>WORKED EXAMPLE</span><strong>{step.example}</strong></div>}<div className="paper-ornament">∴</div></article>
    <div className="lesson-controls">{stepIndex > 0 ? <button className="button button-quiet" onClick={onBack}>Previous</button> : <span/>}{stepIndex < steps.length - 1 ? <button className="button button-primary" onClick={onNext}>Next step <Icon name="arrow" size={16}/></button> : <button className="button button-primary" onClick={onStartRound}>Test this trick <Icon name="arrow" size={16}/></button>}</div>
  </section>;
}
