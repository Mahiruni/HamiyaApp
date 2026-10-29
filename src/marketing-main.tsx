import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Check, Download, Globe2, Smartphone } from 'lucide-react';
import { marketingCopy } from './marketing-copy';
import './marketing.css';

const androidDownload = 'https://github.com/Mahiruni/HamiyaApp/releases/latest/download/Hamiya.apk';
const siteHashes = new Set(['', '#site-content', '#our-divisions', '#the-app', '#get-app']);
// Preserve existing customer links and Supabase authentication callbacks after the website launch.
if (
  !siteHashes.has(location.hash) ||
  /(?:^|[?&])(code|token_hash|error_description)=/.test(location.search)
) {
  location.replace('/app' + location.search + location.hash);
} else {
  createRoot(document.getElementById('marketing-root')!).render(
    <StrictMode>
      <Marketing />
    </StrictMode>,
  );
}
function Marketing() {
  const [language, setLanguage] = useState<'en' | 'am' | 'om'>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hamiya-language') || 'null');
      return stored === 'am' || stored === 'om' ? stored : 'en';
    } catch {
      return 'en';
    }
  });
  const c = marketingCopy[language];
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('hamiya-language', JSON.stringify(language));
    } catch {
      /* Browsing remains available without storage. */
    }
  }, [language]);
  const divisions = [
    {
      id: 'food',
      name: c.food,
      tag: c.foodTag,
      body: c.foodBody,
      action: c.foodAction,
      route: 'food',
    },
    {
      id: 'coffee',
      name: c.coffee,
      tag: c.coffeeTag,
      body: c.coffeeBody,
      action: c.coffeeAction,
      route: 'coffee',
    },
    {
      id: 'vehicles',
      name: c.cars,
      tag: c.carsTag,
      body: c.carsBody,
      action: c.carsAction,
      route: 'vehicles',
    },
  ];
  const download = (light = false) => (
    <a className={'site-button' + (light ? ' site-button-light' : '')} href={androidDownload}>
      <Download size={19} aria-hidden="true" />
      {c.download}
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
  return (
    <div className="hamiya-site">
      <a className="site-skip" href="#site-content">
        {c.skip}
      </a>
      <header className="site-header site-container">
        <a className="site-brand" href="/" aria-label={c.group}>
          <img src="/brand/hamiya-food-icon-192.png" alt="" width="44" height="44" />
          <span>
            HAMIYA<small>{c.group}</small>
          </span>
        </a>
        <nav aria-label={c.group}>
          <a href="#our-divisions">{c.divisions}</a>
          <a href="#the-app">{c.app}</a>
        </nav>
        <div className="site-header-actions">
          <label className="site-language">
            <Globe2 size={18} aria-hidden="true" />
            <select
              aria-label={c.language}
              value={language}
              onChange={(event) => setLanguage(event.target.value as typeof language)}
            >
              <option value="en">EN</option>
              <option value="am">አማ</option>
              <option value="om">OM</option>
            </select>
          </label>
          <a className="site-portal" href="/app#home">
            {c.portal}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>
      <main id="site-content">
        <section className="site-hero site-container">
          <div className="site-hero-copy">
            <span className="site-eyebrow">{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p>{c.intro}</p>
            <div className="site-hero-cta">
              {download()}
              <a className="site-text-link" href="/app#home">
                {c.portal}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <small>{c.downloadNote}</small>
          </div>
          <div className="site-hero-images" aria-hidden="true">
            <div className="site-hero-food">
              <img src="/brand/divisions/food.webp" alt="" fetchPriority="high" />
              <span>{c.food}</span>
            </div>
            <div>
              <img src="/brand/divisions/coffee.webp" alt="" />
              <span>{c.coffee}</span>
            </div>
            <div>
              <img src="/brand/divisions/vehicles.webp" alt="" />
              <span>{c.cars}</span>
            </div>
            <div className="site-hero-mark">
              <img src="/brand/hamiya-food-icon-192.png" alt="" width="54" height="54" />
            </div>
          </div>
        </section>
        <section id="our-divisions" className="site-divisions site-container">
          <div className="site-section-intro">
            <span className="site-eyebrow">{c.divisions}</span>
            <h2>{c.discover}</h2>
            <p>{c.discoverIntro}</p>
          </div>
          <div className="site-division-grid">
            {divisions.map((division, index) => (
              <article className="site-division" key={division.id}>
                <a
                  className="site-division-image"
                  href={'/app#catalog/' + division.route}
                  aria-label={division.action}
                >
                  <img
                    src={'/brand/divisions/' + division.id + '.webp'}
                    alt={division.name}
                    loading="lazy"
                    width="640"
                    height="480"
                  />
                  <span>0{index + 1}</span>
                  <ArrowUpRight size={23} aria-hidden="true" />
                </a>
                <span className="site-eyebrow">{division.tag}</span>
                <h3>{division.name}</h3>
                <p>{division.body}</p>
                <a className="site-text-link" href={'/app#catalog/' + division.route}>
                  {division.action}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section id="the-app" className="site-app-section">
          <div className="site-app-layout site-container">
            <div>
              <span className="site-eyebrow">{c.app}</span>
              <h2>{c.appTitle}</h2>
              <p>{c.appIntro}</p>
              <ul>
                {[c.featureOne, c.featureTwo, c.featureThree, c.featureFour].map((feature) => (
                  <li key={feature}>
                    <Check size={19} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a className="site-text-link" href="#get-app">
                {c.download}
                <ArrowRight size={19} aria-hidden="true" />
              </a>
            </div>
            <div
              className="site-app-preview"
              role="img"
              aria-label={c.settings + ': ' + c.updateHint}
            >
              <div className="site-phone">
                <span className="site-phone-speaker" />
                <img src="/brand/hamiya-food-icon-192.png" width="58" height="58" alt="" />
                <strong>HAMIYA</strong>
                <p>{c.settings}</p>
                <div className="site-phone-panel">
                  <Smartphone size={24} aria-hidden="true" />
                  <h3>{c.updates}</h3>
                  <p>{c.updateHint}</p>
                  <div>
                    {c.version}
                    <b>{__APP_VERSION__}</b>
                  </div>
                  <span className="site-preview-button">
                    <Download size={17} aria-hidden="true" />
                    {c.updateButton}
                  </span>
                </div>
                <span className="site-phone-home" />
              </div>
            </div>
          </div>
        </section>
        <section className="site-steps site-container">
          <h2>{c.stepsTitle}</h2>
          <ol>
            {[
              [c.stepOne, c.stepOneBody],
              [c.stepTwo, c.stepTwoBody],
              [c.stepThree, c.stepThreeBody],
            ].map(([title, body], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section id="get-app" className="site-download site-container">
          <div className="site-download-inner">
            <div>
              <span className="site-eyebrow">{c.app}</span>
              <h2>{c.getTitle}</h2>
              <p>{c.getBody}</p>
              {download(true)}
              <small>{c.downloadNote}</small>
            </div>
            <div className="site-download-note">
              <Smartphone size={34} aria-hidden="true" />
              <p>{c.getNote}</p>
              <p>{c.firstInstall}</p>
              <a href="/app#home">
                {c.portal}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer site-container">
        <div className="site-footer-top">
          <div className="site-brand">
            <img src="/brand/hamiya-food-icon-192.png" alt="" width="42" height="42" />
            <span>
              HAMIYA<small>{c.group}</small>
            </span>
          </div>
          <nav aria-label={c.help}>
            <a href="/app#privacy">{c.privacy}</a>
            <a href="/app#terms">{c.terms}</a>
            <a href="/app#help">{c.help}</a>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>
            © {new Date().getFullYear()} {c.rights}
          </span>
          <span>{c.developed}</span>
        </div>
      </footer>
    </div>
  );
}
