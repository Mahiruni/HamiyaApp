import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { withTimeout } from './async';
import { verifyReleaseSignature } from './update-signature';
import { validateRelease, type AppRelease } from './update-policy';
export const nativeApp = () => Capacitor.isNativePlatform();
export const liveUpdatesSupported = () =>
  nativeApp() && Capacitor.isPluginAvailable('CapacitorUpdater');
export async function installedRelease() {
  if (!liveUpdatesSupported()) return { native: null, commit: __BUILD_COMMIT__ };
  const current = await withTimeout(CapacitorUpdater.current(), 5000);
  // The running JS carries the identity of the bundled or downloaded release.
  return { native: current.native, commit: __BUILD_COMMIT__ };
}
export function confirmAppReady() {
  if (liveUpdatesSupported()) void CapacitorUpdater.notifyAppReady().catch(() => {});
}
export async function applyLiveRelease(
  release: AppRelease,
  onProgress: (value: number) => void,
  shouldActivate: () => boolean = () => true,
) {
  if (!liveUpdatesSupported()) {
    if (nativeApp()) throw new Error('Native upgrade required');
    await navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
    if (shouldActivate()) window.location.reload();
    return;
  }
  validateRelease(release);
  if (!(await verifyReleaseSignature(release, __UPDATE_PUBLIC_KEY__)))
    throw new Error('Signed update required');
  const listener = await CapacitorUpdater.addListener('download', (event) => {
    if (event.bundle.version === release.version) onProgress(event.percent);
  });
  try {
    const bundle = await CapacitorUpdater.download({
      url: release.url,
      version: release.version,
      checksum: release.checksum,
    });
    if (bundle.status === 'error') throw new Error('Update failed verification');
    if (shouldActivate()) await CapacitorUpdater.set({ id: bundle.id });
  } finally {
    await listener.remove();
  }
}
