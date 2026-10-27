import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from './state';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';
import './premium.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider>
        <App />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
