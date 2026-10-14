import React from 'react';
import Icon from '../components/Icons.jsx';
import AskAboutThis from '../components/AskAboutThis.jsx';

export default function LessonScreen({ title, level, duration, summary, stepIndex, onNext, onBack, onGoBack, onStartRound, lessonId, steps = [], previousTechnique = null, nextTechnique = null, techniquePosition = 0, techniqueTotal = 0, onPreviousTechnique, onNextTechnique }) {
  const step = steps[stepIndex];
  return <section className="screen-page lesson-screen" data-mode="maths">
    <button className="text-back" onClick={onGoBack}><Icon name="back" size={16}/> ALL TECHNIQUES</button>
    <div className="lesson-masthead"><span className="eyebrow">QUICK MATHS · {level}</span><span className="duration-chip"><Icon name="clock" size={14}/> {duration}</span></div>
    <h1>{title}</h1><p className="lead-copy">{summary}</p>
    <div className="step-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}><span>{String(stepIndex + 1).padStart(2,'0')}</span><div className="mini-progress"><span style={{width: `${((stepIndex + 1) / steps.length) * 100}%`}}/></div><span>{String(steps.length).padStart(2,'0')}</span></div>
    <article className="lesson-paper"><span className="paper-index">STEP {String(stepIndex + 1).padStart(2,'0')}</span><h2>{step.heading}</h2><p>{step.body}</p>{step.example && <div className="example-box"><span>WORKED EXAMPLE</span><strong>{step.example}</strong></div>}<div className="paper-ornament">∴</div></article>
    <div className="lesson-controls">{stepIndex > 0 ? <button className="button button-quiet" onClick={onBack}>Previous step</button> : <span/>}{stepIndex < steps.length - 1 ? <button className="button button-primary" onClick={onNext}>Next step <Icon name="arrow" size={16}/></button> : <button className="button button-primary" onClick={onStartRound}>Test this trick <Icon name="arrow" size={16}/></button>}</div>
    <nav className="topic-navigation technique-topic-navigation" aria-label="Browse mental maths techniques">
      <button type="button" className="topic-nav-button topic-nav-previous" onClick={onPreviousTechnique} disabled={!previousTechnique}>
        <span className="topic-nav-direction"><Icon name="back" size={15}/> Previous technique</span>
        <strong>{previousTechnique?.title || 'First technique'}</strong>
      </button>
      <span className="topic-nav-count">{techniquePosition} OF {techniqueTotal} UNLOCKED</span>
      <button type="button" className="topic-nav-button topic-nav-next" onClick={onNextTechnique} disabled={!nextTechnique}>
        <span className="topic-nav-direction">Next technique <Icon name="arrow" size={15}/></span>
        <strong>{nextTechnique?.title || 'Complete a round to unlock more'}</strong>
      </button>
    </nav>

    <AskAboutThis key={`maths:${lessonId || title}`} disciplineId="maths" topic={{ id: lessonId || title, title, category: level || 'Mental maths', summary, details: steps.map((item, index) => `Step ${index + 1}: ${item.heading}. ${item.body}${item.example ? ` Example: ${item.example}` : ''}`).join('\n') }} />
  </section>;
}
