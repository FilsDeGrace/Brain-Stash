import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { askAboutTopic, askErrorMessage, ASK_LIMIT_PER_TOPIC, normaliseAskQuestion, suggestedQuestions } from '../engine/askClient.js';
import { localDayStamp, readStored, writeStored } from '../engine/storage.js';

const cleanTopic = (topic) => ({
  id: String(topic?.id || ''),
  title: String(topic?.title || ''),
  category: String(topic?.category || ''),
  summary: String(topic?.summary || '').slice(0, 1400),
  explanation: String(topic?.explanation || '').slice(0, 3600),
  example: String(topic?.example || '').slice(0, 1800),
  whyItMatters: String(topic?.whyItMatters || '').slice(0, 1600),
  details: String(topic?.details || '').slice(0, 3600),
});

export default function AskAboutThis({ disciplineId, topic, enabled = true, disclaimer = '' }) {
  const day = localDayStamp();
  const currentTopic = useMemo(() => cleanTopic(topic), [topic?.id, topic?.title, topic?.summary, topic?.explanation, topic?.example, topic?.whyItMatters, topic?.details]);
  const storageKey = `topic-qa:${day}:${disciplineId}:${currentTopic.id}`;
  const [history, setHistory] = useState(() => {
    const value = readStored(storageKey, []);
    return Array.isArray(value) ? value.slice(0, ASK_LIMIT_PER_TOPIC) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);
  const activeKeyRef = useRef(storageKey);
  const inFlightRef = useRef(false);
  const suggestions = useMemo(() => suggestedQuestions(disciplineId), [disciplineId]);
  const remaining = Math.max(0, ASK_LIMIT_PER_TOPIC - history.length);

  useEffect(() => {
    activeKeyRef.current = storageKey;
    const saved = readStored(storageKey, []);
    setHistory(Array.isArray(saved) ? saved.slice(0, ASK_LIMIT_PER_TOPIC) : []);
    setInput('');
    setLoading(false);
    setError('');
    inFlightRef.current = false;
    return () => requestRef.current?.abort();
  }, [storageKey]);

  const submit = async (rawQuestion) => {
    const question = String(rawQuestion ?? input).trim();
    const normalized = normaliseAskQuestion(question);
    if (!enabled || !question || !normalized || loading || inFlightRef.current) return;
    const previous = history.find((entry) => normaliseAskQuestion(entry.question) === normalized);
    if (previous) {
      setError('You already asked this question today. Its answer is above.');
      setInput('');
      return;
    }
    if (history.length >= ASK_LIMIT_PER_TOPIC) {
      setError('You have used both questions for this topic today. Open another topic to keep exploring.');
      return;
    }
    inFlightRef.current = true;
    const requestKey = storageKey;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await askAboutTopic({ disciplineId, topic: currentTopic, question }, { signal: controller.signal });
      if (activeKeyRef.current !== requestKey) return;
      if (!history.some((entry) => normaliseAskQuestion(entry.question) === normalized)) {
        const next = [...history, { question, answer: result.answer, cached: Boolean(result.cached), createdAt: result.createdAt || new Date().toISOString() }].slice(0, ASK_LIMIT_PER_TOPIC);
        setHistory(next);
        writeStored(requestKey, next);
      }
      setInput('');
    } catch (caught) {
      if (activeKeyRef.current === requestKey && caught?.message !== 'cancelled') setError(askErrorMessage(caught?.message));
    } finally {
      if (activeKeyRef.current === requestKey) {
        setLoading(false);
        inFlightRef.current = false;
      }
    }
  };

  return <section className="ask-about-panel" aria-labelledby={`ask-title-${currentTopic.id}`}>
    <div className="ask-about-heading">
      <span className="ask-about-icon"><Icon name="message" size={20}/></span>
      <div className="ask-about-heading-copy">
        <span className="eyebrow">KEEP EXPLORING</span>
        <h2 id={`ask-title-${currentTopic.id}`}>Ask about this</h2>
        <p>Explore a detail, test an example, or ask where the idea has limits.</p>
      </div>
      <span className="ask-remaining">{remaining} / {ASK_LIMIT_PER_TOPIC}</span>
    </div>

    {history.length > 0 && <div className="ask-conversation" aria-live="polite">
      {history.map((entry, index) => <article className="ask-exchange" key={`${normaliseAskQuestion(entry.question)}-${index}`}>
        <div className="ask-question"><span>YOU ASKED</span><p>{entry.question}</p></div>
        <div className="ask-answer"><div className="ask-answer-label"><Icon name="spark" size={14}/><span>{entry.cached ? 'SHARED ANSWER' : 'ANSWER · SAVED FOR OTHERS'}</span></div><p>{entry.answer}</p></div>
      </article>)}
    </div>}

    {remaining > 0 && <div className="ask-suggestions">
      <span className="eyebrow">TRY A QUESTION</span>
      <div className="ask-suggestion-list">
        {suggestions.map((suggestion) => {
          const used = history.some((entry) => normaliseAskQuestion(entry.question) === normaliseAskQuestion(suggestion.question));
          return <button key={suggestion.label} type="button" className="ask-suggestion" onClick={() => submit(suggestion.question)} disabled={!enabled || loading || used} aria-label={`Ask: ${suggestion.question}`}>
            <span>{suggestion.label}</span><Icon name={used ? 'check' : 'arrow'} size={14}/>
          </button>;
        })}
      </div>
    </div>}

    <form className="ask-question-form" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
      <label htmlFor={`ask-input-${currentTopic.id}`}>Your question</label>
      <textarea id={`ask-input-${currentTopic.id}`} value={input} onChange={(event) => setInput(event.target.value.slice(0, 700))} placeholder={remaining ? 'What would you like to understand better?' : 'You have used today’s questions for this topic.'} rows={2} maxLength={700} disabled={!enabled || remaining <= 0 || loading}/>
      <div className="ask-form-footer"><span>{remaining > 0 ? `${remaining} ${remaining === 1 ? 'question' : 'questions'} left today` : 'Try another topic tomorrow'}</span><button className="button button-primary" type="submit" disabled={!enabled || remaining <= 0 || loading || !input.trim()}>{loading ? 'Thinking…' : 'Ask AI'} <Icon name={loading ? 'clock' : 'arrow'} size={15}/></button></div>
    </form>

    {!enabled && <p className="ask-note">Questions are available for published discoveries.</p>}
    {error && <p className="inline-error ask-error" role="alert">{error}</p>}
    <p className="ask-privacy-note">Questions and AI-generated answers are saved so other readers can reuse an existing answer. Check important claims, and never include personal or sensitive details.</p>
    {disciplineId === 'money' && <p className="ask-finance-note">{disclaimer || 'For education only, not personalised financial, investment, tax or legal advice.'}</p>}
  </section>;
}
