import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect } from 'react';

export const nativeSurface = registerPlugin<{
  setSurface(options: { dark: boolean }): Promise<void>;
  feedback(): Promise<void>;
}>('HamiyaSystemUi');

// Android's view feedback respects the device setting and needs no permission.
// Older installed binaries can keep using web updates without this optional method.
export function confirmFeedback() {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('HamiyaSystemUi'))
    void nativeSurface.feedback().catch(() => {});
}

// This lives outside the error boundary so crash recovery also restores readable
// system icons. A resume or theme change refreshes the actual native surface.
export function NativeSystemSurface() {
  useEffect(() => {
    let lastSurface: boolean | undefined;
    const sync = (force = false) => {
      const loading = !!document.querySelector('.startup-splash');
      if (!force && loading === lastSurface) return;
      lastSurface = loading;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', loading ? '#193b4d' : '#f6f8fa');
      if (!Capacitor.isNativePlatform()) return;
      void (async () => {
        await SystemBars.show();
        await SystemBars.setStyle({
          style: loading ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        });
        if (Capacitor.isPluginAvailable('HamiyaSystemUi'))
          await nativeSurface.setSurface({ dark: loading });
      })().catch(() => {});
    };
    const observer = new MutationObserver(() => sync());
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    const visible = () => sync(true);
    sync(true);
    document.addEventListener('visibilitychange', visible);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return null;
}
