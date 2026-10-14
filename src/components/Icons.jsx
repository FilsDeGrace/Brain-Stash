import React from 'react';

const paths = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  play: <><path d="m8 5 11 7-11 7z"/></>,
  collection: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h8M8 9h6"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1 1.9-2 3.4-2.2-.5a7 7 0 0 1-1.7 1L14 23h-4l-.7-2.1a7 7 0 0 1-1.7-1l-2.2.5-2-3.4 1.1-1.9A7 7 0 0 1 4.5 13l-2-1v-4l2-.8a7 7 0 0 1 1-1.7L5 3.4 8.4 2l1.8 1.3a7 7 0 0 1 2 0L14 2l3.4 1.4-.5 2.2a7 7 0 0 1 1 1.7l2 .8v4l-2 1a7 7 0 0 1-.5 1.9Z" transform="translate(1 0) scale(.9)"/></>,
  arrow: <><path d="M4 12h15M13 5l7 7-7 7"/></>,
  back: <><path d="M19 12H5M11 6l-6 6 6 6"/></>,
  flame: <><path d="M12 22c4.5 0 7-3.1 7-7.2 0-3.5-2-5.5-4.5-8.3.2 2.6-1.1 3.8-2.2 4.4C12 7.1 10 4.8 8.5 3 8.7 7.1 5 9.7 5 14.7 5 18.9 7.8 22 12 22Z"/><path d="M12 22c2 0 3.2-1.4 3.2-3.2 0-1.4-.7-2.1-1.8-3.4-.2 1.1-.8 1.6-1.5 2-.3-1.5-1-2.2-1.7-3.1-.1 2.2-1.4 2.7-1.4 4.6 0 1.7 1.2 3.1 3.2 3.1Z"/></>,
  bolt: <><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></>,
  brain: <><path d="M9 4.5a3 3 0 0 0-5 2.3 3.7 3.7 0 0 0 0 6.4A3.4 3.4 0 0 0 8 19a3.3 3.3 0 0 0 5 1V5a3 3 0 0 0-4-2.8Z"/><path d="M15 4.5a3 3 0 0 1 5 2.3 3.7 3.7 0 0 1 0 6.4A3.4 3.4 0 0 1 16 19a3.3 3.3 0 0 1-5 1V5a3 3 0 0 1 4-2.8Z"/><path d="M5 9h3M16 8h3M6 15h3M15 14h4"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  bookmark: <><path d="M6 3h12v18l-6-4-6 4z"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  history: <><path d="M3 11a9 9 0 1 1 2.6 6.4"/><path d="M3 4v7h7"/><path d="M12 7v5l3 2"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  spark: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></>,
  book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M8 6h8M8 10h8M8 14h5"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-5.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 10h8M8 13h5"/></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.7, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

export function BrandMark({ size = 34 }) {
  return <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
    <circle cx="22" cy="22" r="19" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="22" cy="22" r="14.5" stroke="currentColor" strokeOpacity=".42" strokeWidth=".8"/>
    <path d="M12.5 27V16h3.1l6.4 8.1 6.4-8.1h3.1v11h-3.2v-6l-6.3 7.5-6.3-7.5v6z" fill="currentColor"/>
    <path d="M22 0v4M22 40v4M0 22h4M40 22h4" stroke="currentColor" strokeWidth="1.3"/>
  </svg>;
}
