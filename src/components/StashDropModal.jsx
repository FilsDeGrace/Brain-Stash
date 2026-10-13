import React, { useEffect, useRef } from 'react';
import Icon from './Icons.jsx';

export default function StashDropModal({ item, saved, onSave, onTeach, onSurprise, onDismiss }) {
  const dialogRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!item) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const getFocusable = () => dialog?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') || [];
    const focusables = getFocusable();
    (focusables[0] || dialog)?.focus?.();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onDismissRef.current(); return; }
      if (event.key !== 'Tab') return;
      const current = getFocusable();
      if (!current.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) previousFocus.focus();
    };
  }, [Boolean(item)]);

  if (!item) return null;
  const label = item.shortTitle || item.disciplineTitle || 'DEEP STASH';
  return <div className="stash-drop-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <section className="stash-drop-modal" ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="stash-drop-title">
      <div className="drop-topline"><span className="eyebrow"><i className="eyebrow-mark"/> {item.isDaily ? 'YOUR DAILY DROP' : 'A NEW DISCOVERY'}</span><button className="icon-button" onClick={onDismiss} aria-label="Close discovery"><Icon name="close" size={18}/></button></div>
      <div className="drop-seal"><Icon name="spark" size={27}/><span>BS</span></div>
      <span className="eyebrow drop-category">{String(item.category || label).toUpperCase()}</span>
      <h2 id="stash-drop-title">{item.title}</h2>
      <p className="drop-summary">{item.summary}</p>
      {item.disclaimer && <p className="drop-nfa-note">{item.disclaimer}</p>}
      <div className="drop-rule"><span/><b>✳</b><span/></div>
      <div className="drop-actions">
        <button className="button button-primary" onClick={onTeach}><Icon name="book" size={16}/> Teach me</button>
        <button className="button button-quiet bordered-button" onClick={onSave} disabled={saved}><Icon name={saved ? 'check' : 'bookmark'} size={16}/>{saved ? 'Saved' : 'Stash it'}</button>
      </div>
      <div className="drop-bottom-actions"><button onClick={onSurprise}><Icon name="refresh" size={14}/> Surprise me</button><button onClick={onDismiss}>Not now</button></div>
      <p className="drop-footnote">One useful idea can change the way you see a whole situation.</p>
    </section>
  </div>;
}
