import React from 'react';
import Icon from '../components/Icons.jsx';

export default function MathsLessonsScreen({ lessons, mathTier = 1, onOpenLesson, onStartRound }) {
  return <section className="screen-page" data-mode="maths">
    <div className="page-heading"><div><span className="eyebrow">DISCIPLINE 01 · QUICK MATHS</span><h1>Make numbers<br/><em>move faster.</em></h1><p>Small mental shortcuts. Less counting, more seeing the pattern.</p><span className="math-tier-chip">CURRENT TIER · {mathTier}</span></div><div className="heading-glyph"><Icon name="bolt" size={28}/></div></div>
    <div className="section-heading list-heading"><div><span className="eyebrow">THE PRACTICE ROOM</span><h2>Choose a technique</h2></div><span className="count-label">{lessons.length} LESSONS</span></div>
    <div className="lesson-list">{lessons.map((lesson, index) => <button className={`lesson-row ${lesson.locked ? 'lesson-locked' : ''}`} key={lesson.id} onClick={() => onOpenLesson(lesson.id)} disabled={lesson.locked}>
      <span className="lesson-number">{String(index + 1).padStart(2,'0')}</span><span className="lesson-copy"><small>{lesson.level} · {lesson.duration}</small><strong>{lesson.title}</strong><span>{lesson.locked ? `Unlock at Tier ${lesson.tier}` : lesson.summary}</span></span><Icon name={lesson.locked ? 'lock' : 'arrow'} size={18}/>
    </button>)}</div>
    <div className="practice-cta"><div><span className="eyebrow">NO WARM-UP NEEDED</span><h3>Ready to test your speed?</h3><p>Ten generated questions. Earn 80% or more to open the next tier.</p></div><button className="button button-primary" onClick={onStartRound}>Start a round <Icon name="arrow" size={16}/></button></div>
  </section>;
}
