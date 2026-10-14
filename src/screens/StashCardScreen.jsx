import React from 'react';
import Icon from '../components/Icons.jsx';
import AskAboutThis from '../components/AskAboutThis.jsx';

function teachMessage(code) {
  if (code === 'offline') return 'You appear to be offline. Reconnect and try again.';
  if (code === 'busy') return 'Too many requests right now. Try again in a minute.';
  return 'The walkthrough isn’t available right now. Try again in a moment.';
}

export default function StashCardScreen({ card, saved, quiz, quizReveal, locked, completed, isDailyCard = false, canTeach = false, lessonState = { status: 'idle' }, diagnosisState = null, onTeach, onDiagnose, onSave, onSelectQuizOption, onDone, onOpenCollection, onOpenArchive, previousCard = null, nextCard = null, cardPosition = 0, cardTotal = 0, onPreviousCard, onNextCard }) {
  const entryLabel = isDailyCard ? (completed ? 'DAILY REVIEW' : locked ? 'DAILY IN PROGRESS' : 'DAILY ENTRY') : (completed ? 'ARCHIVE REVIEW' : locked ? 'ARCHIVE IN PROGRESS' : 'ARCHIVE ENTRY');
  return <section className="screen-page stash-screen" data-mode="stash">
    <div className="page-heading stash-heading"><div><span className="eyebrow">THE PRIVATE ARCHIVE · {entryLabel}</span><h1>Deep <em>Stash.</em></h1><p>One principle. A clearer way to see the world.</p></div><div className="stash-heading-seal"><Icon name="lock" size={22}/><span>SEALED<br/>INSIGHT</span></div></div>
    <div className="archive-status"><span><i className="status-dot"/> {completed ? 'ENTRY COMPLETED' : isDailyCard ? 'TODAY’S DISCOVERY' : 'ARCHIVE PRINCIPLE'} · TIER {card.tier ?? card.difficulty ?? 1}</span><span>{saved ? <><Icon name="bookmark" size={13}/> IN YOUR COLLECTION</> : 'ARCHIVE NO. 0' + String((String(card.id ?? '').length % 8) + 1)}</span></div>
    {completed && <div className="content-history-note" role="note"><Icon name="history" size={15}/><span>You've completed this principle. Revisit it anytime to refresh your memory; completion rewards are only given once.</span></div>}
    <article className="knowledge-artifact">
      <div className="artifact-frame"><div className="artifact-top"><span>BS / {card.label || String(card.category || 'PRINCIPLE').toUpperCase()}</span><span>◆</span></div><div className="artifact-glyph" aria-hidden="true"><span className="glyph-ring ring-one"/><span className="glyph-ring ring-two"/><span className="glyph-center">{card.label && card.label.length ? card.label.split(' ').map(word => word[0]).join('').slice(0,3) : 'BS'}</span><span className="glyph-axis"/></div><span className="artifact-category">{card.category || 'Principle'}</span><h2>{card.title}</h2><p className="artifact-summary">{card.summary || 'A principle to examine and keep in mind.'}</p><div className="artifact-rule"><span/><span>✳</span><span/></div><div className="artifact-bottom"><span>AN IDEA TO KEEP</span><span>TIER {card.tier ?? card.difficulty ?? 1} · {String(card.id).toUpperCase().replaceAll('-', ' ')}</span></div></div>
    </article>
    <div className="insight-section"><span className="eyebrow">IN PRACTICE</span><p>{card.example || 'Look for a real situation where this principle changes what you notice or decide.'}</p></div>
    <div className="insight-section why-section"><span className="eyebrow">WHY IT MATTERS</span><p>{card.whyItMatters || 'Understanding the reasoning behind a principle helps you apply it without overgeneralising.'}</p></div>
    {onTeach && <div className="insight-section teach-section">
      <span className="eyebrow">GO DEEPER</span>
      {lessonState.status === 'ready' ? <div className="teach-lesson">
        <h3>In plain words</h3><p>{lessonState.data.plain}</p>
        <h3>How to spot it</h3><ul>{lessonState.data.spot.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <h3>A fresh example</h3><p>{lessonState.data.example}</p>
        <h3>A common mistake</h3><p>{lessonState.data.mistake}</p>
        <p className="teach-note">Written by AI from this principle.</p>
      </div> : <>
        <p>A short walkthrough: the idea in plain words, how to spot it, a fresh example, and a common mistake.</p>
        {lessonState.status === 'error' && <p className="inline-error" role="status">{teachMessage(lessonState.error)}</p>}
        <button className="button button-quiet bordered-button" onClick={onTeach} disabled={!canTeach || lessonState.status === 'loading'}>{lessonState.status === 'loading' ? 'Writing your walkthrough…' : lessonState.status === 'error' ? 'Try again' : 'Teach me this'}</button>
        {!canTeach && <p className="entry-helper">Needs an internet connection.</p>}
      </>}
    </div>}
    <div className="stash-actions"><button className={`button ${saved ? 'button-saved' : 'button-quiet bordered-button'}`} onClick={onSave}><Icon name={saved ? 'check' : 'bookmark'} size={16}/>{saved ? 'Saved to collection' : 'Save this principle'}</button><div className="stash-secondary-links"><button className="text-link" onClick={onOpenArchive}>Browse archive <Icon name="arrow" size={15}/></button><button className="text-link" onClick={onOpenCollection}>Collection <Icon name="arrow" size={15}/></button></div></div>
    {quiz && <div className="reflection-quiz"><div className="quiz-section-title"><span className="eyebrow">TEST YOUR UNDERSTANDING</span><span className="quiz-number">01 / 01</span></div><h3>{quiz.prompt}</h3><div className="stash-options">{quiz.options.map((option, index) => {const correct = quizReveal && option.id === quiz.correctId; const chosen = quizReveal && option.id === quizReveal.selectedId; return <button key={option.id} className={`stash-option ${correct ? 'answer-correct' : ''} ${chosen && !correct ? 'answer-wrong' : ''}`} onClick={() => onSelectQuizOption(option.id)} disabled={locked}><span>{String.fromCharCode(65 + index)}</span>{option.label}{correct && <Icon name="check" size={16}/>}</button>;})}</div>
      {quizReveal && <div className="answer-feedback" role="status"><div className="feedback-title"><Icon name={quizReveal.selectedId === quiz.correctId ? 'check' : 'eye'} size={16}/><strong>{quizReveal.selectedId === quiz.correctId ? 'Principle understood' : 'Take the lesson with you'}</strong></div><p>{quiz.explanation}</p>{diagnosisState && <div className="teach-diagnosis">{diagnosisState.status === 'ready' ? <><p><strong>Why it tempts:</strong> {diagnosisState.data.why}</p><p><strong>Next time:</strong> {diagnosisState.data.check}</p><p className="teach-note">Written by AI.</p></> : <>{diagnosisState.status === 'error' && <p className="inline-error" role="status">{teachMessage(diagnosisState.error)}</p>}<button className="text-link" onClick={onDiagnose} disabled={!canTeach || diagnosisState.status === 'loading'}>{diagnosisState.status === 'loading' ? 'Thinking…' : 'Why was that tempting?'} <Icon name="arrow" size={14}/></button>{!canTeach && <p className="entry-helper">Needs an internet connection.</p>}</>}</div>}</div>}
      {!completed && <button className="button button-primary button-wide" onClick={onDone} disabled={!quizReveal}>{isDailyCard ? 'Complete daily entry' : 'Complete principle'} <Icon name="arrow" size={16}/></button>}
      {completed && <div className="completed-next"><Icon name="check" size={17}/><span>{isDailyCard ? "Today's entry is in the books." : 'This principle is in the books.'}</span><button className="text-link" onClick={isDailyCard ? onOpenCollection : onOpenArchive}>{isDailyCard ? 'Review saved ideas' : 'Continue browsing'} <Icon name="arrow" size={14}/></button></div>}
    </div>}
    {cardPosition > 0 && cardTotal > 0 && <nav className="topic-navigation stash-topic-navigation" aria-label="Browse archive principles">
      <button type="button" className="topic-nav-button topic-nav-previous" onClick={onPreviousCard} disabled={!previousCard}>
        <span className="topic-nav-direction"><Icon name="back" size={15}/> Previous principle</span>
        <strong>{previousCard?.title || 'First principle'}</strong>
      </button>
      <span className="topic-nav-count">{cardPosition} OF {cardTotal}</span>
      <button type="button" className="topic-nav-button topic-nav-next" onClick={onNextCard} disabled={!nextCard}>
        <span className="topic-nav-direction">Next principle <Icon name="arrow" size={15}/></span>
        <strong>{nextCard?.title || 'End of archive'}</strong>
      </button>
    </nav>}

    <AskAboutThis key={`principles:${card.id}`} disciplineId="principles" topic={{ id: card.id, title: card.title, category: card.category || 'Principle', summary: card.summary || '', explanation: card.whyItMatters || card.summary || '', example: card.example || '', whyItMatters: card.whyItMatters || '' }} />
  </section>;
}
