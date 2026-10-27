import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from './state';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';
import './premium.css';
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('hamiya-native');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider>
        <App />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    )
    .catch(() => {});
}
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
