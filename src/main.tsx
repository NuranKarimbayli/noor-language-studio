import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register the offline service worker in production builds only — dev serves
// un-hashed modules that a cache-first SW would serve stale.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures (e.g. insecure context) are non-fatal.
    });
  });
}
