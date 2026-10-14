import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  (window.location.protocol === 'http:' || window.location.protocol === 'https:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          reg.unregister().catch(() => {});
        }
      })
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            caches.delete(key).catch(() => {});
          }
        })
        .catch(() => {});
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
