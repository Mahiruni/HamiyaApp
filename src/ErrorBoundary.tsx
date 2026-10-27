import { Component, type ReactNode } from 'react';
import { translate, type Language } from './i18n';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const language = (
      ['en', 'am', 'om'].includes(document.documentElement.lang)
        ? document.documentElement.lang
        : 'en'
    ) as Language;
    return (
      <main className="recovery-screen" role="alert">
        <img src="/brand/hamiya-food-icon-192.png" alt="HAMIYA" width={64} height={64} />
        <h1>{translate(language, 'appErrorTitle')}</h1>
        <p>{translate(language, 'appErrorText')}</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          {translate(language, 'retry')}
        </button>
      </main>
    );
  }
}
