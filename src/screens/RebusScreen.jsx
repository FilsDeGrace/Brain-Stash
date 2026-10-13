import React from 'react';
import Icon from '../components/Icons.jsx';

export default function RebusScreen({ imageSrc, imageAlt, entryMode, wordLengths, status, locked, attempt, hintsLeft, hintCost, timer, puzzleNumber, totalPuzzles, answerText, explanation, slots = [], pool = [], inputValue = '', hintText = '', canAffordHint = true, onHint, onSkip, onNext, onQuit, onPlaceTile, onClearSlot, onInputChange, onSubmit }) {
  const complete = status === 'finished';
  return <section className="screen-page rebus-screen" data-mode="rebus">
    <div className="quiz-toolbar"><button className="text-back" onClick={onQuit}><Icon name="back" size={16}/> BACK TO PRACTICE</button><span className="round-count">PUZZLE {String(puzzleNumber).padStart(2,'0')} <i/> {String(totalPuzzles).padStart(2,'0')}</span></div>
    <div className="round-progress"><span style={{width: `${((puzzleNumber - 1) / totalPuzzles) * 100}%`}}/></div>
    <div className="page-heading rebus-heading"><div><span className="eyebrow">DISCIPLINE 02 · REBUS</span><h1>Look closer.</h1><p>Sometimes the position says more than the words.</p></div><span className="heading-glyph"><Icon name="eye" size={27}/></span></div>
    <div className="puzzle-art"><img src={imageSrc} alt={imageAlt}/><span className="art-caption">FIG. {String(puzzleNumber).padStart(2,'0')} <i/> READ THE CLUE</span></div>
    <div className="answer-entry">
      <div className="entry-label"><span>YOUR ANSWER</span><span className="word-pattern">({wordLengths.join(', ')})</span></div>
      {entryMode === 'tiles' ? <>
        <div className={`tile-slots ${attempt === 'wrong' ? 'shake' : ''}`}>
          {slots.map((slot, index) => slot.kind === 'fixed'
            ? <span className="fixed-slot" key={`fixed-${index}`}>{slot.char}</span>
            : <button key={`slot-${index}`} className={`letter-slot ${slot.char ? 'slot-filled' : ''}`} onClick={() => slot.char && !locked && onClearSlot(index)} disabled={locked || !slot.char} aria-label={slot.char ? `Remove letter ${slot.char}` : 'Empty answer slot'}>{slot.char || ''}</button>)}
        </div>
        {attempt === 'wrong' && <p className="inline-error" role="status">Not quite. Clear a tile and take another look.</p>}
        {!complete && <><div className="tile-bank" aria-label="Available letter tiles">{pool.map((tile) => <button key={tile.id} className={`letter-tile ${tile.used ? 'tile-used' : ''}`} disabled={tile.used || locked} onClick={() => onPlaceTile(tile.id)}>{tile.char}</button>)}</div><p className="entry-helper">Tap letters in order. Tap a filled slot to clear it.</p></>}
      </> : <>
        <input className="rebus-input" value={inputValue} onChange={(e) => onInputChange(e.target.value)} placeholder="Type the phrase…" disabled={locked} onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }} aria-label="Type your rebus answer" />
        <button className="button button-primary button-wide submit-answer" onClick={onSubmit} disabled={locked || !inputValue.trim()}>Check answer <Icon name="arrow" size={16}/></button>
        {attempt === 'wrong' && <p className="inline-error" role="status">Not quite. Read the arrangement again.</p>}
      </>}
      {hintText && <div className="hint-reveal" role="status"><Icon name="eye" size={14}/><span>HINT: {hintText}</span></div>}
    </div>
    {complete && <div className="rebus-success" role="status"><span className="success-seal"><Icon name="check" size={23}/></span><div><span className="eyebrow">PUZZLE SOLVED</span><h2>{answerText}</h2><p>Another pattern added to your mental toolkit.</p></div></div>}
    {complete && explanation && <div className="explanation-note"><span className="eyebrow">THE REASONING</span><p>{explanation}</p></div>}
    <div className="rebus-controls">{!complete ? <><button className="button button-quiet" onClick={onHint} disabled={hintsLeft <= 0 || locked || !canAffordHint} aria-label={canAffordHint ? `Use a hint for ${hintCost} XP` : `Need ${hintCost} XP to use a hint`}><Icon name="eye" size={16}/> Hint <span className="button-cost">{canAffordHint ? `−${hintCost} XP` : `Need ${hintCost} XP`} · {hintsLeft} left</span></button><button className="button button-quiet" onClick={onSkip} disabled={locked}>Skip <Icon name="arrow" size={15}/></button></> : <button className="button button-primary button-wide" onClick={onNext}>Next puzzle <Icon name="arrow" size={17}/></button>}</div>
  </section>;
}
