import React, { useState } from 'react';
import Icon from '../components/Icons.jsx';

const friendlyError = (error) => ({
  forbidden: 'That review token was not accepted. Check the token saved for the Production deployment.',
  not_found: 'This entry is no longer waiting for review. The queue has been refreshed.',
  already_reviewed: 'This entry has already been reviewed. The queue has been refreshed.',
  bad_request: 'That review could not be applied. Reload the queue and try again.',
  database_unconfigured: 'The shared library is not connected yet. Check the database setup.',
  database_permissions: 'The database rejected this change. Check the Supabase secret key configured in Vercel.',
  database_schema_error: 'The database structure does not match this app. Check that the shared-library SQL was run successfully.',
  database_unavailable: 'Brain Stash could not reach the database. Try again in a moment.',
  library_unavailable: 'Brain Stash could not load the review queue. Try again in a moment.',
  service_error: 'We could not confirm whether this review was saved. Reload the queue before trying again.',
}[error] || 'We could not complete that request. Check your connection and try again.');

export default function LibraryReviewScreen({ disciplines, onBack }) {
  const [token, setToken] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), 'x-content-admin-token': token.trim() },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || (response.status === 429 ? 'service_error' : 'service_error'));
    return result;
  };

  const loadPending = async (event) => {
    event?.preventDefault();
    if (!token.trim() || loading || activeId) return;
    setLoading(true);
    setError('');
    setMessage('');
    // Don't leave old actions available if refreshing the queue fails.
    setItems([]);
    try {
      const result = await request('/api/library?status=pending');
      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems(nextItems);
      setMessage(nextItems.length === 0 ? 'You’re all caught up. There are no entries waiting for review.' : `Loaded ${nextItems.length} ${nextItems.length === 1 ? 'draft' : 'drafts'}.`);
    } catch (caught) {
      setItems([]);
      setError(friendlyError(caught.message));
    } finally {
      setLoading(false);
    }
  };

  const refreshPending = async () => {
    const result = await request('/api/library?status=pending');
    return Array.isArray(result.items) ? result.items : [];
  };

  const review = async (item, status) => {
    if (!token.trim() || activeId || loading) return;
    setActiveId(item.id);
    setError('');
    setMessage('');
    try {
      const result = await request('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', id: item.id, status }),
      });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (result.alreadyApplied) {
        setMessage(status === 'approved' ? 'This entry was already published. The queue is up to date.' : 'This entry was already rejected. The queue is up to date.');
      } else {
        setMessage(status === 'approved' ? 'Published. This discovery is now available in the shared library.' : 'Rejected. This discovery will not appear in the shared library.');
      }
    } catch (caught) {
      // The server might have saved the decision even if the response was lost.
      // Re-fetch the authoritative pending queue instead of trusting stale UI state.
      try {
        setItems(await refreshPending());
      } catch {
        // Fail closed: don't leave potentially stale approval buttons on screen.
        setItems([]);
      }
      if (caught.message === 'already_reviewed' || caught.message === 'not_found') {
        setMessage(friendlyError(caught.message));
      } else {
        setError(friendlyError(caught.message));
      }
    } finally {
      setActiveId('');
    }
  };

  return <section className="screen-page library-review-screen" data-mode="stash">
    <button className="text-back" onClick={onBack}><Icon name="back" size={15}/> BACK</button>
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Review the <em>new entries.</em></h1><p>Read each entry and check its sources. Approve it to publish it for everyone, or reject it to keep it out of the shared library.</p></div><span className="heading-glyph"><Icon name="check" size={27}/></span></div>
    <form className="review-token-form" onSubmit={loadPending}>
      <label htmlFor="review-token">Content review token</label>
      <input id="review-token" type="password" autoComplete="off" value={token} onChange={(event) => { setToken(event.target.value); setItems([]); setError(''); setMessage(''); }} placeholder="Enter your review token" required />
      <button className="button button-primary" type="submit" disabled={loading || Boolean(activeId) || !token.trim()}>{loading ? 'Loading…' : 'Load pending drafts'} <Icon name="arrow" size={15}/></button>
      <small>Enter your review token each time you open this page.</small>
    </form>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {message && <p className="review-message" role="status">{message}</p>}
    <div className="review-queue-heading"><span className="eyebrow">PENDING QUEUE</span><span className="count-label">{items.length} {items.length === 1 ? 'DRAFT' : 'DRAFTS'}</span></div>
    {!items.length && !loading && !error && !message && <div className="review-empty"><Icon name="check" size={22}/><strong>No drafts to review</strong><p>Enter your review token and load the queue to see entries waiting for your decision.</p></div>}
    <div className="review-queue">
      {items.map((item) => {
        const discipline = disciplines.find((entry) => entry.id === item.disciplineId);
        return <article className="review-item" key={item.id}>
          <div className="review-item-top"><span className="eyebrow">{discipline?.shortTitle || item.disciplineId}</span><span className="content-status is-pending">PENDING REVIEW</span></div>
          <h2>{item.title}</h2><p>{item.summary}</p>
          <details><summary>Read full draft</summary><p>{item.explanation}</p><strong>Example</strong><p>{item.example}</p><strong>Why it matters</strong><p>{item.whyItMatters}</p><strong>Try this</strong><p>{item.tryThis}</p><strong>Knowledge check</strong><p>{item.question}</p><strong>Answer</strong><p>{item.answer}</p>{item.disclaimer && <p>{item.disclaimer}</p>}{item.sources?.length > 0 && <div className="review-sources">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div>}</details>
          <div className="review-actions"><button className="button button-primary" onClick={() => review(item, 'approved')} disabled={Boolean(activeId) || loading}>{activeId === item.id ? 'Saving…' : 'Approve'}</button><button className="button button-quiet bordered-button" onClick={() => review(item, 'rejected')} disabled={Boolean(activeId) || loading}>{activeId === item.id ? 'Saving…' : 'Reject'}</button></div>
        </article>;
      })}
    </div>
    <div className="review-guidance"><strong>Before you publish</strong><p>Check factual claims and open source links. Reject unsupported claims, fabricated references, unsafe instructions, or personal investment recommendations. Money entries are educational and are not individual financial advice.</p></div>
  </section>;
}
