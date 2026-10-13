import React from 'react';
import Icon from '../components/Icons.jsx';

const roleLabels = {
  deciding: 'DECIDING FACTOR',
  acceptable: 'ACCEPTABLE FACTOR',
  trap: 'POTENTIAL TRAP',
  irrelevant: 'IRRELEVANT FACTOR',
};

/** A case-based reasoning exercise. Verdict feedback is based only on the authored case file. */
export default function CourtScreen({ caseItem, caseNumber, totalCases, selectedId = null, onSelectVerdict, onNext, onPrevious }) {
  if (!caseItem) {
    return <section className="screen-page court-screen" data-mode="court"><h1>The Court</h1><p>No case files are available.</p></section>;
  }

  const revealed = Boolean(selectedId);
  const correct = selectedId === caseItem.correctId;
  const selectedConsistency = caseItem.consistency?.[selectedId] || [];
  const decidingFactor = (caseItem.factors || []).find((factor) => factor.role === 'deciding');

  return <section className="screen-page court-screen" data-mode="court">
    <div className="quiz-toolbar">
      <span className="eyebrow">THE COURT · CASE FILE</span>
      <span className="round-count">CASE {String(caseNumber).padStart(2, '0')} <i/> {String(totalCases).padStart(2, '0')}</span>
    </div>
    <div className="round-progress"><span style={{ width: `${(caseNumber / Math.max(1, totalCases)) * 100}%` }} /></div>
    <div className="page-heading court-heading">
      <div><span className="eyebrow">TIER {caseItem.difficulty} · {caseItem.category}</span><h1>Enter <em>your verdict.</em></h1><p>Separate the decisive facts from the arguments that only feel persuasive.</p></div>
      <span className="heading-glyph"><Icon name="target" size={27}/></span>
    </div>

    <article className="court-case-file">
      <div className="court-file-top"><span>BS / COURT ARCHIVE</span><span>{String(caseItem.id).toUpperCase()}</span></div>
      <h2>{caseItem.title}</h2>
      <p className="court-context">{caseItem.context}</p>
      <div className="court-rule"><span>THE QUESTION BEFORE THE COURT</span><p>{caseItem.prompt}</p></div>
    </article>

    <div className="court-counsel-grid">
      {(caseItem.counsel || []).map((counsel) => <article className="court-counsel" key={counsel.id}>
        <span className="eyebrow">COUNSEL {String(counsel.id).toUpperCase()}</span>
        <p>{counsel.argument}</p>
      </article>)}
    </div>

    <div className="court-verdict-section">
      <div className="section-heading"><div><span className="eyebrow">YOUR DECISION</span><h2>Choose a verdict.</h2></div><span className="count-label">ONE ANSWER</span></div>
      <div className="court-options">
        {(caseItem.options || []).map((option, index) => {
          const isCorrect = revealed && option.id === caseItem.correctId;
          const isSelected = selectedId === option.id;
          return <button key={option.id} className={`court-option ${isCorrect ? 'court-answer-correct' : ''} ${revealed && isSelected && !isCorrect ? 'court-answer-wrong' : ''}`} disabled={revealed} onClick={() => onSelectVerdict(option.id)}>
            <span className="court-option-letter">{String.fromCharCode(65 + index)}</span><span>{option.label}</span>
            {isCorrect && <Icon name="check" size={17}/>}
          </button>;
        })}
      </div>
    </div>

    {revealed && <section className="court-ruling" role="status">
      <div className="court-ruling-heading"><Icon name={correct ? 'check' : 'eye'} size={18}/><div><span className="eyebrow">THE RULING</span><h2>{correct ? 'Verdict upheld.' : 'Verdict not upheld.'}</h2></div></div>
      <p>{caseItem.explanation}</p>
      <div className="court-ratio"><span className="eyebrow">THE DECISIVE REASON</span><p>{caseItem.canonicalRatio}</p></div>
      {decidingFactor && <div className="court-deciding-factor"><span className="eyebrow">DECIDING FACTOR</span><p>{decidingFactor.label}</p></div>}
      {caseItem.trap && <div className="court-trap-note"><span className="eyebrow">WATCH FOR · {caseItem.trap.type}</span><p>{caseItem.trap.note}</p></div>}
      <div className="court-factors-wrap"><span className="eyebrow">FACTORS IN THE FILE</span><div className="court-factors">
        {(caseItem.factors || []).map((factor) => <div className={`court-factor factor-${factor.role} ${selectedConsistency.includes(factor.id) ? 'factor-matches-verdict' : ''}`} key={factor.id}>
          <span>{roleLabels[factor.role] || String(factor.role || 'FACTOR').toUpperCase()}</span><p>{factor.label}</p>
        </div>)}
      </div></div>
      <p className="court-consistency-note">{selectedConsistency.length ? `Your verdict relies on ${selectedConsistency.length} factor${selectedConsistency.length === 1 ? '' : 's'} identified in the case file.` : 'Your verdict does not align with the factors identified in the case file.'}</p>
    </section>}

    <div className="court-navigation">
      <button className="button button-quiet bordered-button" onClick={onPrevious} disabled={caseNumber <= 1}><Icon name="back" size={15}/> Previous case</button>
      <button className="button button-primary" onClick={onNext}>{caseNumber >= totalCases ? 'Return to first case' : revealed ? 'Next case' : 'Pass this case'} <Icon name="arrow" size={16}/></button>
    </div>
  </section>;
}
