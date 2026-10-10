import React from 'react';
import Icon, { BrandMark } from './Icons.jsx';

const navItems = [
  { id: '/', label: 'Home', icon: 'home' },
  { id: '/maths', label: 'Play', icon: 'play' },
  { id: '/collection', label: 'Collection', icon: 'collection' },
  { id: '/profile', label: 'Profile', icon: 'user' },
];

export default function AppShell({ children, route, progress, onNavigate, onSettings, showNav = true, backLabel = null, onBack = null }) {
  const active = route.startsWith('/maths') || route.startsWith('/rebus') || route.startsWith('/traps') || route.startsWith('/fallacies') || route.startsWith('/stash') ? '/maths' : route.startsWith('/collection') ? '/collection' : route.startsWith('/profile') || route.startsWith('/settings') ? '/profile' : '/';
  return <div className="app-frame">
    <header className="topbar">
      <div className="topbar-brand">
        {backLabel && <button className="icon-button back-button" onClick={onBack} aria-label={backLabel}><Icon name="back" /></button>}
        <button className="brand-lockup" onClick={() => onNavigate('/')} aria-label="Brain Stash home">
          <span className="brand-emblem"><BrandMark size={34} /></span>
          <span className="brand-wordmark">BRAIN <b>STASH</b><small>THE PRIVATE ARCHIVE</small></span>
        </button>
      </div>
      <div className="topbar-actions">
        <div className="mini-stat" title="Current streak"><Icon name="flame" size={15}/><span>{progress.streak}</span></div>
        <div className="level-chip"><span>LVL</span><b>{progress.level}</b></div>
        <button className="icon-button settings-button" onClick={onSettings} aria-label="Open settings"><Icon name="settings" size={19}/></button>
      </div>
    </header>
    <main className="main-content" key={route}>{children}</main>
    {showNav && <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => <button key={item.id} className={`nav-item ${active === item.id ? 'is-active' : ''}`} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}>
        <Icon name={item.icon} size={19}/><span>{item.label}</span>
      </button>)}
    </nav>}
  </div>;
}
