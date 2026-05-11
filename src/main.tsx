import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop errors that appear in some browsers
const suppressResizeObserverError = () => {
  window.addEventListener('error', (e) => {
    if (e.message && (
      e.message === 'ResizeObserver loop completed with undelivered notifications.' || 
      e.message === 'ResizeObserver loop limit exceeded'
    )) {
      e.stopImmediatePropagation();
    }
  });
};

suppressResizeObserverError();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
