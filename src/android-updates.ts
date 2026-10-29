import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface AndroidRelease {
  installedVersion: string;
  installedVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  available: boolean;
  bytes: number;
  releasedAt: string;
}
export type AndroidUpdatePhase = 'downloading' | 'verifying' | 'permission' | 'installing';
export interface AndroidUpdateProgress {
  bytes: number;
  total: number;
  percent: number;
  phase: AndroidUpdatePhase;
}
interface AndroidUpdater {
  check(): Promise<AndroidRelease>;
  install(): Promise<{ installed: boolean }>;
  cancel(): Promise<void>;
  addListener(
    event: 'progress',
    listener: (event: AndroidUpdateProgress) => void,
  ): Promise<PluginListenerHandle>;
}
export const AndroidUpdates = registerPlugin<AndroidUpdater>('HamiyaAppUpdate');
export const androidUpdatesSupported = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('HamiyaAppUpdate');

let checking: Promise<AndroidRelease> | undefined;
export function checkAndroidRelease() {
  // The notice and Settings can mount together, including React's development remount.
  return (checking ??= AndroidUpdates.check().finally(() => {
    checking = undefined;
  }));
}
