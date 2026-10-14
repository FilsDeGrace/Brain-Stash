import React from 'react';
import Icon from '../components/Icons.jsx';
import AskAboutThis from '../components/AskAboutThis.jsx';

export default function QuizRoundScreen({ mode, prompt, context, options, status, locked, reveal, explanation, timer, tier, questionNumber, totalQuestions, topicId, onSelect, onNext, onQuit }) {
  const title = mode === 'maths' ? 'Quick Maths' : mode === 'fallacies' ? 'Fallacies' : 'Mind Traps';
  const ratio = timer ? Math.max(0, Math.min(1, timer.timeLeftMs / timer.totalMs)) : 1;
  const secs = timer ? Math.ceil(timer.timeLeftMs / 1000) : null;
  return <section className="screen-page quiz-screen" data-mode={mode === 'maths' ? 'maths' : 'traps'}>
    <div className="quiz-toolbar"><button className="text-back" onClick={onQuit}><Icon name="back" size={16}/> LEAVE ROUND</button><span className="round-count">QUESTION {String(questionNumber).padStart(2,'0')} <i/> {String(totalQuestions).padStart(2,'0')}</span></div>
    <div className="round-progress"><span style={{width: `${((questionNumber - 1) / totalQuestions) * 100}%`}}/></div>
    <div className="quiz-topline"><span className="eyebrow">{mode === 'maths' ? `MENTAL ARITHMETIC · TIER ${tier || 1}` : mode === 'fallacies' ? 'ARGUMENT & LOGIC' : 'LOGIC & REASONING'}</span>{timer && <div className={`timer-wrap ${ratio < .35 ? 'timer-urgent' : ''}`} aria-label={timer.paused ? `Timer paused at ${secs} seconds` : `${secs} seconds remaining`}><svg viewBox="0 0 56 56" className="timer-ring"><circle className="timer-track" cx="28" cy="28" r="23"/><circle className="timer-value" cx="28" cy="28" r="23" style={{strokeDasharray: 144.5, strokeDashoffset: 144.5 * (1 - ratio)}}/></svg><span aria-live="polite">{secs}</span></div>}</div>
    <div className="question-area"><span className="question-label">{mode === 'maths' ? 'SOLVE' : mode === 'fallacies' ? 'EXAMINE THE ARGUMENT' : 'SPOT THE TRAP'}</span>{context && <div className="question-context"><span className="eyebrow">SCENARIO</span><p>{context}</p></div>}<h1 className={mode === 'maths' ? 'math-prompt' : 'reasoning-prompt'}>{prompt}</h1></div>
    <div className="answer-list" role="group" aria-label="Answer choices">{options.map((option, index) => {
      const isCorrect = reveal && option.id === reveal.correctId;
      const isChosen = reveal && option.id === reveal.selectedId;
      const isWrong = isChosen && !isCorrect;
      return <button key={option.id} className={`answer-option ${isCorrect ? 'answer-correct' : ''} ${isWrong ? 'answer-wrong' : ''} ${!reveal && !locked ? '' : 'answer-locked'}`} disabled={locked || status !== 'running'} onClick={() => onSelect(option.id)}>
        <span className="answer-letter">{String.fromCharCode(65 + index)}</span><span>{option.label}</span><span className="answer-state">{isCorrect ? <Icon name="check" size={17}/> : isWrong ? <Icon name="close" size={17}/> : null}</span>
      </button>;
    })}</div>
    {reveal && <div className={`answer-feedback ${reveal.timedOut ? 'feedback-timeout' : ''}`} role="status"><div className="feedback-title"><Icon name={reveal.selectedId === reveal.correctId && !reveal.timedOut ? 'check' : 'eye'} size={16}/><strong>{reveal.timedOut ? 'Time is up' : reveal.selectedId === reveal.correctId ? 'Well reasoned' : 'Not quite'}</strong></div><p>{explanation}</p></div>}
    {status === 'running' && timer && <p className="timer-note"><Icon name="clock" size={13}/> The clock pauses when you leave this tab.</p>}
    <div className="quiz-footer">
      {reveal ? <button className="button button-primary button-wide" onClick={onNext}>{questionNumber >= totalQuestions ? 'See your result' : 'Next question'} <Icon name="arrow" size={17}/></button> : <p className="selection-hint">Choose one answer to lock it in.</p>}
    </div>
    {reveal && mode !== 'maths' && <AskAboutThis key={`${mode}:${topicId || questionNumber}`} disciplineId={mode === 'fallacies' ? 'fallacies' : 'traps'} topic={{ id: topicId || `${mode}-${questionNumber}`, title: prompt, category: mode === 'fallacies' ? 'Fallacy' : 'Mind trap', summary: context || prompt, explanation: explanation || '', details: `Question: ${prompt}\nChoices: ${options.map((option) => option.label).join(' | ')}\nCorrect choice: ${options.find((option) => option.id === reveal.correctId)?.label || ''}` }} />}
  </section>;
}
