import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, Smartphone, X } from 'lucide-react';
import {
  AndroidUpdates,
  checkAndroidRelease,
  type AndroidRelease,
  type AndroidUpdateProgress,
} from './android-updates';
import { Button } from './components';
import { withTimeout } from './async';
import { useApp } from './state';

export default function InAppAndroidUpdates() {
  const { t, online, language } = useApp();
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [status, setStatus] = useState<'checking' | 'current' | 'available' | 'error' | 'applying'>(
    'checking',
  );
  const [progress, setProgress] = useState<AndroidUpdateProgress | null>(null);
  const [message, setMessage] = useState<
    | 'updateCheckFailed'
    | 'updateInstallFailed'
    | 'installPermissionRequired'
    | 'installationCancelled'
    | null
  >(null);
  const active = useRef(true);
  const applying = useRef(false);
  const request = useRef(0);
  const check = useCallback(async () => {
    if (applying.current) return;
    const id = ++request.current;
    setStatus('checking');
    setMessage(null);
    try {
      const latest = await withTimeout(checkAndroidRelease(), 25000);
      if (!active.current || id !== request.current) return;
      setRelease(latest);
      setStatus(latest.available ? 'available' : 'current');
    } catch {
      if (active.current && id === request.current) {
        setMessage('updateCheckFailed');
        setStatus('error');
      }
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      active.current = false;
      request.current++;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      if (applying.current) void AndroidUpdates.cancel().catch(() => {});
    };
  }, [check]);
  async function install() {
    if (applying.current) return;
    applying.current = true;
    request.current++;
    setStatus('applying');
    setMessage(null);
    // An indeterminate indicator is used until Android reports actual byte progress.
    setProgress(null);
    let listener: Awaited<ReturnType<typeof AndroidUpdates.addListener>> | undefined;
    try {
      listener = await AndroidUpdates.addListener('progress', (event) => {
        if (active.current) setProgress(event);
      });
      await AndroidUpdates.install();
      applying.current = false;
      if (active.current) await check();
    } catch (error) {
      if (active.current) {
        const code = (error as { code?: string }).code;
        const cancelled = code === 'UPDATE_CANCELLED' || code === 'INSTALL_CANCELLED';
        setMessage(
          cancelled
            ? 'installationCancelled'
            : code === 'INSTALL_PERMISSION_REQUIRED'
              ? 'installPermissionRequired'
              : 'updateInstallFailed',
        );
        setStatus(cancelled ? 'available' : 'error');
      }
    } finally {
      applying.current = false;
      await listener?.remove().catch(() => {});
    }
  }
  const busy = status === 'checking' || status === 'applying';
  const phase = progress?.phase;
  const title =
    status === 'checking'
      ? 'checkingUpdates'
      : status === 'current'
        ? 'appUpToDate'
        : status === 'applying'
          ? phase === 'verifying'
            ? 'verifyingAppUpdate'
            : phase === 'permission'
              ? 'allowAppUpdates'
              : phase === 'installing'
                ? 'approveAppUpdate'
                : 'applyingUpdate'
          : status === 'error'
            ? message || 'updateCheckFailed'
            : 'updateAvailable';
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
          <h3>{t(title)}</h3>
          <p>{t(phase === 'permission' ? 'installPermissionHint' : 'inAppUpdateHint')}</p>
        </div>
      </div>
      <dl className="update-details">
        <div>
          <dt>{t('appVersion')}</dt>
          <dd>{release?.installedVersion || __APP_VERSION__}</dd>
        </div>
        {release?.available && (
          <div>
            <dt>{t('latestRelease')}</dt>
            <dd>{release.latestVersion || `${t('nativeBuild')} ${release.latestVersionCode}`}</dd>
          </div>
        )}
      </dl>
      {status === 'applying' && (
        <div className="update-progress">
          <progress
            aria-label={t('downloadProgress')}
            max={100}
            value={progress ? Math.max(0, Math.min(100, progress.percent)) : undefined}
          />
          {progress && (
            <span>
              {new Intl.NumberFormat(language + '-ET', { style: 'percent' }).format(
                progress.percent / 100,
              )}
            </span>
          )}
        </div>
      )}
      {message && status !== 'error' && (
        <p className="update-footnote" role="status">
          {t(message)}
        </p>
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
        {release?.available && status !== 'applying' && (
          <Button disabled={busy || !online} onClick={() => void install()}>
            <Download size={17} />
            {t('installAppUpdate')}
          </Button>
        )}
        {status === 'applying' && (phase === 'downloading' || !phase) && (
          <Button className="button secondary" onClick={() => void AndroidUpdates.cancel()}>
            <X size={17} />
            {t('cancel')}
          </Button>
        )}
      </div>
      <p className="update-footnote">{t('updateDataSafe')}</p>
    </section>
  );
}
