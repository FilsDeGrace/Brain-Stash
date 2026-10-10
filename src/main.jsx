import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

// Do not keep a production cache between Vite dev sessions: it can serve stale
// bundles ahead of hot updates. Also remove an older registration from a browser
// that visited a pre-fix development build.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.DEV) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((registration) => registration.active?.scriptURL.endsWith('/sw.js')).map((registration) => registration.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith('brain-stash-shell-')).map((key) => caches.delete(key)));
        }
      } catch { /* A browser may restrict cache management; dev still won't register a new worker. */ }
      return;
    }
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline caching is an enhancement; the app remains usable without SW support.
      });
    }
  });
}
