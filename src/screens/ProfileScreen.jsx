import React from 'react';
import Icon from '../components/Icons.jsx';

export default function ProfileScreen({ progress, savedCount, onSettings, onCollection, onShare }) {
  const progressPercent = (progress.xp % 120) / 120 * 100;
  return <section className="screen-page profile-screen" data-mode="stash">
    <div className="page-heading"><div><span className="eyebrow">YOUR RECORD</span><h1>The work <em>so far.</em></h1><p>A private measure of curiosity and practice.</p></div><div className="heading-glyph"><Icon name="user" size={26}/></div></div>
    <div className="profile-plaque"><div className="profile-monogram"><span>BS</span><i/></div><div className="profile-identity"><span className="eyebrow">ARCHIVE KEEPER</span><h2>Independent mind</h2><p>Here for the long game.</p></div><span className="profile-level">LVL<br/><b>{progress.level}</b></span></div>
    <div className="profile-stats"><div><span>EXPERIENCE</span><strong>{progress.xp.toLocaleString()} <small>XP</small></strong></div><div><span>DAY STREAK</span><strong>{progress.streak} <small>days</small></strong></div><div><span>SAVED IDEAS</span><strong>{savedCount}</strong></div></div>
    <div className="level-detail"><div className="level-detail-head"><span className="eyebrow">NEXT LEVEL</span><strong>{progress.xpToNext} XP remaining</strong></div><div className="large-progress"><span style={{width:`${progressPercent}%`}}/></div><p>Each completed practice session adds experience. Your level is a record of consistency, not a ranking.</p></div>
    <div className="profile-links"><button onClick={onCollection}><span><Icon name="collection" size={18}/></span><div><strong>My collection</strong><small>Revisit the ideas you saved</small></div><Icon name="arrow" size={17}/></button><button onClick={onShare}><span><Icon name="share" size={18}/></span><div><strong>Share your progress</strong><small>Send a simple text update</small></div><Icon name="arrow" size={17}/></button><button onClick={onSettings}><span><Icon name="settings" size={18}/></span><div><strong>Settings</strong><small>Timer, motion, and local data</small></div><Icon name="arrow" size={17}/></button></div>
    <p className="privacy-note"><Icon name="lock" size={13}/> This record belongs to you. No account needed.</p>
  </section>;
}
