import React, { useState } from 'react';
import Icon from '../components/Icons.jsx';

const friendlyError = (error) => ({
  forbidden: 'That review token was not accepted. Check the token and try again.',
  library_unavailable: 'The shared library could not be reached. Check the database connection and try again.',
  database_unconfigured: 'Shared storage is not configured yet. Follow docs/shared-library-setup.md first.',
}[error] || 'The request could not be completed. Check your connection and try again.');

export default function LibraryReviewScreen({ disciplines, onBack }) {
  const [token, setToken] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), 'x-content-admin-token': token } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'service_error');
    return result;
  };

  const loadPending = async (event) => {
    event?.preventDefault();
    if (!token.trim() || loading) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await request('/api/library?status=pending');
      setItems(Array.isArray(result.items) ? result.items : []);
      setMessage(`Loaded ${Array.isArray(result.items) ? result.items.length : 0} draft${result.items?.length === 1 ? '' : 's'}.`);
    } catch (caught) { setError(friendlyError(caught.message)); }
    finally { setLoading(false); }
  };

  const review = async (item, status) => {
    if (!token.trim() || activeId) return;
    setActiveId(item.id); setError(''); setMessage('');
    try {
      await request('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review', id: item.id, status }) });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage(status === 'approved' ? 'Approved. This discovery is now available in the shared library.' : 'Draft rejected and removed from the review queue.');
    } catch (caught) { setError(friendlyError(caught.message)); }
    finally { setActiveId(''); }
  };

  return <section className="screen-page library-review-screen" data-mode="stash">
    <button className="text-back" onClick={onBack}><Icon name="back" size={15}/> BACK</button>
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Review the <em>new entries.</em></h1><p>Check accuracy, source quality and usefulness before an AI-generated draft becomes part of the shared library.</p></div><span className="heading-glyph"><Icon name="check" size={27}/></span></div>
    <form className="review-token-form" onSubmit={loadPending}>
      <label htmlFor="review-token">Content review token</label>
      <input id="review-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter CONTENT_ADMIN_TOKEN" required />
      <button className="button button-primary" type="submit" disabled={loading || !token.trim()}>{loading ? 'Loading…' : 'Load pending drafts'} <Icon name="arrow" size={15}/></button>
      <small>The token is held in memory for this screen and is not saved to your browser.</small>
    </form>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {message && <p className="review-message" role="status">{message}</p>}
    <div className="review-queue-heading"><span className="eyebrow">PENDING QUEUE</span><span className="count-label">{items.length} DRAFTS</span></div>
    {!items.length && !loading && <div className="review-empty"><Icon name="check" size={22}/><strong>No drafts loaded</strong><p>Enter your review token and load the queue to see new AI-generated entries.</p></div>}
    <div className="review-queue">
      {items.map((item) => {
        const discipline = disciplines.find((entry) => entry.id === item.disciplineId);
        return <article className="review-item" key={item.id}>
          <div className="review-item-top"><span className="eyebrow">{discipline?.shortTitle || item.disciplineId}</span><span className="content-status is-pending">PENDING REVIEW</span></div>
          <h2>{item.title}</h2><p>{item.summary}</p>
          <details><summary>Read full draft</summary><p>{item.explanation}</p><strong>Example</strong><p>{item.example}</p><strong>Try this</strong><p>{item.tryThis}</p>{item.sources?.length > 0 && <div className="review-sources">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div>}</details>
          <div className="review-actions"><button className="button button-primary" onClick={() => review(item, 'approved')} disabled={Boolean(activeId)}>{activeId === item.id ? 'Saving…' : 'Approve'}</button><button className="button button-quiet bordered-button" onClick={() => review(item, 'rejected')} disabled={Boolean(activeId)}>Reject</button></div>
        </article>;
      })}
    </div>
    <div className="review-guidance"><strong>Review checklist</strong><p>Verify any factual claims and open the sources. Reject fabricated references, overconfident psychological claims, unsafe DIY advice, and personalised investment recommendations. The money discipline is for education only, not individual financial advice.</p></div>
  </section>;
}
