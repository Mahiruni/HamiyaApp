import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { boundedFetch } from './async';
import { installedRelease, nativeApp } from './native-updates';
import { updateAction, updateOrigin, validateRelease } from './update-policy';
import { useApp } from './state';

export default function UpdateNotice() {
  const { t, navigate } = useApp();
  const [available, setAvailable] = useState(false);
  const lastCheck = useRef(0);
  useEffect(() => {
    if (!nativeApp()) return;
    let active = true;
    const controller = new AbortController();
    const check = async () => {
      if (
        !navigator.onLine ||
        document.visibilityState !== 'visible' ||
        Date.now() - lastCheck.current < 3600000
      )
        return;
      lastCheck.current = Date.now();
      try {
        const [response, current] = await Promise.all([
          boundedFetch(updateOrigin + '/updates/latest.json', {
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
          }),
          installedRelease(),
        ]);
        if (!response.ok) return;
        const release = validateRelease(await response.json());
        if (active)
          setAvailable(updateAction(release, current.commit, current.native) !== 'current');
      } catch {
        /* Settings provides an explicit retry if an automatic check cannot complete. */
      }
    };
    void check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      active = false;
      controller.abort();
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);
  return available ? (
    <button className="update-notice" onClick={() => navigate('settings')}>
      <Download size={17} />
      {t('updateAvailable')}
      <span>{t('viewDetails')}</span>
    </button>
  ) : null;
}
