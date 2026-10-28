import './settings.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Globe2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from './components';
import { languages } from './i18n';
import { verifyReleaseSignature } from './update-signature';
import { useApp } from './state';
import {
  apkDownloadUrl,
  updateOrigin,
  updateAction,
  validateRelease,
  type AppRelease,
} from './update-policy';
import {
  applyLiveRelease,
  installedRelease,
  liveUpdatesSupported,
  nativeApp,
} from './native-updates';
export default function Settings() {
  const { t, language, setLanguage } = useApp();
  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">HAMIYA</span>
          <h1>{t('appSettings')}</h1>
          <p>{t('settingsIntro')}</p>
        </div>
      </div>
      <div className="settings-grid">
        <Updates />
        <section className="panel settings-language">
          <div className="settings-panel-heading">
            <Globe2 size={22} />
            <h2>{t('language')}</h2>
          </div>
          <p>{t('languageIntro')}</p>
          <div className="language-pills">
            {languages.map((item) => (
              <button
                key={item.code}
                aria-pressed={language === item.code}
                className={language === item.code ? 'active' : ''}
                onClick={() => setLanguage(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <section className="panel settings-about">
          <div className="settings-panel-heading">
            <ShieldCheck size={22} />
            <h2>{t('aboutHamiya')}</h2>
          </div>
          <p>{t('groupName')}</p>
          <p>{t('developedByHisab')}</p>
          <small>
            {t('appVersion')}: {__APP_VERSION__}
          </small>
        </section>
      </div>
    </section>
  );
}
function Updates() {
  const { t, online, language } = useApp();
  const [status, setStatus] = useState<'checking' | 'current' | 'available' | 'error' | 'applying'>(
    'checking',
  );
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [native, setNative] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [installError, setInstallError] = useState(false);
  const [nativeRequired, setNativeRequired] = useState(false);
  const active = useRef(true);
  const applying = useRef(false);
  const request = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    if (applying.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('checking');
    setInstallError(false);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      if (!navigator.onLine) throw new Error('Offline');
      const response = await fetch(updateOrigin + '/updates/latest.json', {
        cache: 'no-store',
        signal: controller.signal,
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Update service unavailable');
      const latest = validateRelease(await response.json());
      const current = await installedRelease();
      if (!active.current || request.current !== controller) return;
      if (controller.signal.aborted) throw new Error('Update check timed out');
      const action = updateAction(latest, current.commit, current.native);
      const signed = !nativeApp() || (await verifyReleaseSignature(latest, __UPDATE_PUBLIC_KEY__));
      if (!active.current || request.current !== controller || controller.signal.aborted) return;
      const needsNative = action === 'apk' || (nativeApp() && (!liveUpdatesSupported() || !signed));
      setRelease(latest);
      setNative(current.native);
      setNativeRequired(needsNative);
      setStatus(
        action === 'current' && !(nativeApp() && !liveUpdatesSupported()) ? 'current' : 'available',
      );
    } catch {
      if (active.current && request.current === controller) setStatus('error');
    } finally {
      clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void installedRelease()
      .then((current) => {
        if (active.current) setNative(current.native);
      })
      .catch(() => {});
    void check();
    const onOnline = () => void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active.current = false;
      request.current?.abort();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);
  async function apply() {
    if (!release || status === 'applying') return;
    applying.current = true;
    setStatus('applying');
    setProgress(0);
    try {
      await applyLiveRelease(
        release,
        (value) => {
          if (active.current) setProgress(Math.round(Math.max(0, Math.min(100, value))));
        },
        () => active.current,
      );
    } catch {
      if (active.current) {
        setInstallError(true);
        setStatus('error');
      }
    } finally {
      applying.current = false;
    }
  }
  const busy = status === 'checking' || status === 'applying';
  return (
    <section className="panel update-panel" aria-labelledby="updates-title">
      <div className="settings-panel-heading">
        <Smartphone size={23} />
        <h2 id="updates-title">{t('appUpdates')}</h2>
      </div>
      <div className={'update-status update-status-' + status} role="status" aria-live="polite">
        <span className="update-status-icon">
          {status === 'current' ? <CheckCircle2 size={28} /> : <Download size={28} />}
        </span>
        <div>
          <h3>
            {t(
              status === 'checking'
                ? 'checkingUpdates'
                : status === 'current'
                  ? 'appUpToDate'
                  : status === 'available'
                    ? 'updateAvailable'
                    : status === 'applying'
                      ? 'applyingUpdate'
                      : installError
                        ? 'updateInstallFailed'
                        : 'updateCheckFailed',
            )}
          </h3>
          <p>{t(nativeRequired ? 'secureUpdateHint' : 'liveUpdateHint')}</p>
        </div>
      </div>
      <dl className="update-details">
        <div>
          <dt>{t('appVersion')}</dt>
          <dd>{native || __APP_VERSION__}</dd>
        </div>
        {release && (
          <div>
            <dt>{t('latestRelease')}</dt>
            <dd>
              {release.nativeVersion} ·{' '}
              {new Intl.DateTimeFormat(language + '-ET', { dateStyle: 'medium' }).format(
                new Date(release.releasedAt),
              )}
            </dd>
          </div>
        )}
      </dl>
      {status === 'applying' && (
        <div className="update-progress">
          <progress aria-label={t('downloadProgress')} max={100} value={progress} />
          <span>{progress}%</span>
        </div>
      )}
      <div className="update-actions">
        <Button
          busy={status === 'checking'}
          disabled={busy || !online}
          className="button secondary"
          onClick={() => void check()}
        >
          <RefreshCw size={17} />
          {t('checkUpdates')}
        </Button>
        {release &&
          status === 'available' &&
          (nativeRequired ? (
            <a className="button primary" href={apkDownloadUrl} target="_blank" rel="noreferrer">
              <Download size={17} />
              {t('downloadAndroidUpdate')}
            </a>
          ) : (
            <Button disabled={!online} onClick={() => void apply()}>
              <Download size={17} />
              {t('updateAndRestart')}
            </Button>
          ))}
      </div>
      <p className="update-footnote">{t('updateDataSafe')}</p>
    </section>
  );
}
